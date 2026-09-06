import {
  BANK_COOLDOWN_MS,
  bankPayout,
  bankRate,
  cosmeticById,
  itemById,
  locationById,
  materialsAt,
  recipeByOutput,
  SEARCH_COOLDOWN_MS,
  searchDurationSeconds,
  searchWeight,
  travelSeconds,
  WIN_ITEM_ID,
} from "@/lib/game/catalog";
import {
  buffLabel,
  consumableById,
  describeBuff,
  type BuffKind,
} from "@/lib/game/consumables";
import { rarityOf } from "@/lib/game/rarity";
import { getDb } from "@/lib/game/db";
import type {
  AreaCrowd,
  BankQuote,
  BusyState,
  Equipped,
  GameState,
  InventoryRow,
  MarketPrice,
  OrderBook,
  OrderRow,
  PlayerState,
  TradeRow,
} from "@/lib/game/types";

type PlayerRow = {
  user_id: number;
  username: string;
  gold: number;
  location_id: string;
  busy_type: string;
  busy_until: number | null;
  busy_payload: string | null;
  hat: string | null;
  outfit: string | null;
  accessory: string | null;
  has_won: number;
  won_at: number | null;
  last_event: string | null;
};

function nowMs() {
  return Date.now();
}

function loadPlayerRow(userId: number): PlayerRow {
  const row = getDb()
    .prepare(
      `SELECT p.*, u.username
       FROM players p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`
    )
    .get(userId) as PlayerRow | undefined;
  if (!row) throw new Error("Traveler not found.");
  return row;
}

function inventoryMap(userId: number) {
  const rows = getDb()
    .prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ?")
    .all(userId) as { item_id: string; quantity: number }[];
  return new Map(rows.map((row) => [row.item_id, row.quantity]));
}

function reservedItems(userId: number) {
  const rows = getDb()
    .prepare(
      "SELECT item_id, COALESCE(SUM(remaining), 0) AS qty FROM orders WHERE user_id = ? AND side = 'sell' AND remaining > 0 GROUP BY item_id"
    )
    .all(userId) as { item_id: string; qty: number }[];
  return Object.fromEntries(rows.map((row) => [row.item_id, row.qty]));
}

function reservedGold(userId: number) {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(price * remaining), 0) AS gold FROM orders WHERE user_id = ? AND side = 'buy' AND remaining > 0"
    )
    .get(userId) as { gold: number };
  return row.gold;
}

function availableItem(userId: number, itemId: string) {
  const have = inventoryMap(userId).get(itemId) ?? 0;
  const held = reservedItems(userId)[itemId] ?? 0;
  return have - held;
}

function availableGold(userId: number) {
  const gold = loadPlayerRow(userId).gold;
  return gold - reservedGold(userId);
}

function addItem(userId: number, itemId: string, qty: number) {
  if (qty <= 0) return;
  getDb()
    .prepare(
      `INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`
    )
    .run(userId, itemId, qty);
}

function removeItem(userId: number, itemId: string, qty: number) {
  const have = inventoryMap(userId).get(itemId) ?? 0;
  if (have < qty) throw new Error(`Not enough ${itemById[itemId]?.name ?? itemId}.`);
  const next = have - qty;
  const db = getDb();
  if (next === 0) {
    db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  } else {
    db.prepare("UPDATE inventory SET quantity = ? WHERE user_id = ? AND item_id = ?").run(
      next,
      userId,
      itemId
    );
  }
}

function setEvent(userId: number, message: string) {
  getDb().prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(message, userId);
}

function clearBusy(userId: number) {
  getDb()
    .prepare(
      "UPDATE players SET busy_type = 'idle', busy_until = NULL, busy_payload = NULL WHERE user_id = ?"
    )
    .run(userId);
}

export function resolveBusy(userId: number) {
  const player = loadPlayerRow(userId);
  if (player.busy_type === "idle" || !player.busy_until) return;
  if (player.busy_until > nowMs()) return;

  const payload = player.busy_payload ? JSON.parse(player.busy_payload) : {};
  if (player.busy_type === "travel") {
    const dest = String(payload.locationId ?? "");
    const location = locationById[dest];
    if (location) {
      getDb()
        .prepare("UPDATE players SET location_id = ? WHERE user_id = ?")
        .run(dest, userId);
      setEvent(userId, `You arrive at ${location.emoji} ${location.name}.`);
    }
  }
  if (player.busy_type === "mine" || player.busy_type === "search") {
    const locationId = String(payload.locationId ?? player.location_id);
    const luck = Number(payload.luck ?? 1);
    const extraQty = Number(payload.extraQty ?? 0);
    const double = Boolean(payload.double);
    const rolls = double ? 2 : 1;
    const finds: { itemId: string; qty: number }[] = [];
    if (payload.itemId) {
      finds.push({ itemId: String(payload.itemId), qty: Number(payload.qty ?? 0) });
    } else {
      for (let i = 0; i < rolls; i += 1) {
        const loot = rollSearchLoot(locationId, luck);
        if (loot.itemId) {
          finds.push({ itemId: loot.itemId, qty: loot.qty + extraQty });
        }
      }
    }
    const bits: string[] = [];
    for (const find of finds) {
      const item = itemById[find.itemId];
      if (!item || find.qty <= 0) continue;
      addItem(userId, item.id, find.qty);
      bits.push(`${item.emoji} ${item.name} ×${find.qty}`);
    }
    if (bits.length > 0) {
      setEvent(userId, `You pull ${bits.join(" and ")} from the search.`);
    }
  }
  clearBusy(userId);
}

function busyState(player: PlayerRow): BusyState {
  const remaining = player.busy_until ? Math.max(0, player.busy_until - nowMs()) : 0;
  if (player.busy_type === "idle" || remaining <= 0) {
    return {
      type: "idle",
      endsAt: null,
      remainingMs: 0,
      label: "Ready",
      detail: "You can travel or gather.",
    };
  }
  const payload = player.busy_payload ? JSON.parse(player.busy_payload) : {};
  if (player.busy_type === "travel") {
    const dest = locationById[String(payload.locationId ?? "")];
    return {
      type: "travel",
      endsAt: player.busy_until,
      remainingMs: remaining,
      label: `Walking to ${dest?.name ?? "somewhere"}`,
      detail: "Safe to close the tab. You will arrive while you are away.",
    };
  }
  const place =
    locationById[String(payload.locationId ?? player.location_id)] ??
    locationById[player.location_id];
  return {
    type: "search",
    endsAt: player.busy_until,
    remainingMs: remaining,
    label: `Searching ${place?.emoji ?? ""} ${place?.name ?? "the wilds"}`,
    detail: "The find stays hidden until the timer ends. Safe to leave.",
  };
}

function rollSearchLoot(locationId: string, luck = 1) {
  const pool = materialsAt(locationId);
  if (pool.length === 0) return { itemId: "", qty: 0 };
  const weights = pool.map((item) => {
    let weight = searchWeight(item);
    const rarity = rarityOf(item.id);
    if (luck > 1 && (rarity === "unique" || rarity === "legendary")) {
      weight *= luck;
    } else if (luck > 1 && rarity === "rare") {
      weight *= 1 + (luck - 1) * 0.5;
    }
    return weight;
  });
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let picked = pool[0];
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      picked = pool[index];
      break;
    }
  }
  const yieldSpec = picked.mine!;
  const span = yieldSpec.yieldMax - yieldSpec.yieldMin + 1;
  const qty = yieldSpec.yieldMin + Math.floor(Math.random() * span);
  return { itemId: picked.id, qty };
}

function readStrain(locationId: string) {
  const row = getDb()
    .prepare("SELECT strain, cools_at FROM area_strain WHERE location_id = ?")
    .get(locationId) as { strain: number; cools_at: number } | undefined;
  if (!row || row.cools_at <= nowMs()) return 0;
  return row.strain;
}

function bumpStrain(locationId: string) {
  const current = readStrain(locationId);
  const next = current + 1;
  getDb()
    .prepare(
      `INSERT INTO area_strain (location_id, strain, cools_at) VALUES (?, ?, ?)
       ON CONFLICT(location_id) DO UPDATE SET strain = excluded.strain, cools_at = excluded.cools_at`
    )
    .run(locationId, next, nowMs() + SEARCH_COOLDOWN_MS);
  return current;
}

function countSearchers(locationId: string) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM players
       WHERE location_id = ? AND busy_type IN ('search', 'mine') AND busy_until IS NOT NULL AND busy_until > ?`
    )
    .get(locationId, nowMs()) as { n: number };
  return row.n;
}

function listAreas(): AreaCrowd[] {
  return Object.values(locationById)
    .filter((location) => location.searchSeconds)
    .map((location) => {
      const strain = readStrain(location.id);
      const row = getDb()
        .prepare("SELECT cools_at FROM area_strain WHERE location_id = ?")
        .get(location.id) as { cools_at: number } | undefined;
      const cooldownMs =
        strain > 0 && row && row.cools_at > nowMs() ? row.cools_at - nowMs() : 0;
      return {
        locationId: location.id,
        searchers: countSearchers(location.id),
        strain,
        cooldownMs,
        nextSearchSeconds: searchDurationSeconds(location.id, strain),
      };
    });
}

function marketPrice(itemId: string): number {
  const row = getDb()
    .prepare(
      "SELECT SUM(price * quantity) AS notional, SUM(quantity) AS volume FROM trades WHERE item_id = ?"
    )
    .get(itemId) as { notional: number | null; volume: number | null };
  if (row.volume && row.notional) {
    return Math.max(1, Math.round(row.notional / row.volume));
  }
  return itemById[itemId]?.basePrice ?? 1;
}

function recordTrade(
  itemId: string,
  price: number,
  quantity: number,
  buyUserId: number,
  sellUserId: number
) {
  getDb()
    .prepare(
      "INSERT INTO trades (item_id, price, quantity, buy_user_id, sell_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(itemId, price, quantity, buyUserId, sellUserId, nowMs());
}

function executeFill(
  buy: { id: number; user_id: number; price: number; remaining: number },
  sell: { id: number; user_id: number; price: number; remaining: number },
  itemId: string,
  quantity: number,
  price: number
) {
  const db = getDb();
  db.prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(
    price * quantity,
    buy.user_id
  );
  db.prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(
    price * quantity,
    sell.user_id
  );
  removeItem(sell.user_id, itemId, quantity);
  addItem(buy.user_id, itemId, quantity);
  const buyLeft = buy.remaining - quantity;
  const sellLeft = sell.remaining - quantity;
  if (buyLeft <= 0) db.prepare("DELETE FROM orders WHERE id = ?").run(buy.id);
  else db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(buyLeft, buy.id);
  if (sellLeft <= 0) db.prepare("DELETE FROM orders WHERE id = ?").run(sell.id);
  else db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(sellLeft, sell.id);
  recordTrade(itemId, price, quantity, buy.user_id, sell.user_id);
}

function matchItem(itemId: string) {
  const db = getDb();
  while (true) {
    const buy = db
      .prepare(
        "SELECT id, user_id, price, remaining FROM orders WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker') ORDER BY price DESC, created_at ASC, id ASC"
      )
      .all(itemId) as { id: number; user_id: number; price: number; remaining: number }[];
    const sell = db
      .prepare(
        "SELECT id, user_id, price, remaining FROM orders WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker') ORDER BY price ASC, created_at ASC, id ASC"
      )
      .all(itemId) as { id: number; user_id: number; price: number; remaining: number }[];

    let pair: {
      buy: (typeof buy)[number];
      sell: (typeof sell)[number];
    } | null = null;
    for (const bid of buy) {
      const ask = sell.find((row) => row.user_id !== bid.user_id && bid.price >= row.price);
      if (ask) {
        pair = { buy: bid, sell: ask };
        break;
      }
    }
    if (!pair) break;
    const qty = Math.min(pair.buy.remaining, pair.sell.remaining);
    executeFill(pair.buy, pair.sell, itemId, qty, pair.sell.price);
  }
}

function requireIdle(userId: number) {
  resolveBusy(userId);
  const player = loadPlayerRow(userId);
  if (player.busy_type !== "idle" && player.busy_until && player.busy_until > nowMs()) {
    throw new Error("You are already busy. Wait, or leave and come back later.");
  }
}

function requireTown(userId: number) {
  resolveBusy(userId);
  const player = loadPlayerRow(userId);
  if (player.location_id !== "town") {
    throw new Error("Return to Lantern Plaza for the workshop, bank, and wardrobe.");
  }
  if (player.busy_type !== "idle" && player.busy_until && player.busy_until > nowMs()) {
    throw new Error("You are still on the road.");
  }
}

function addBuff(userId: number, kind: BuffKind, charges: number, power: number) {
  const row = getDb()
    .prepare("SELECT charges, power FROM player_buffs WHERE user_id = ? AND kind = ?")
    .get(userId, kind) as { charges: number; power: number } | undefined;
  if (!row) {
    getDb()
      .prepare(
        "INSERT INTO player_buffs (user_id, kind, charges, power) VALUES (?, ?, ?, ?)"
      )
      .run(userId, kind, charges, power);
    return;
  }
  getDb()
    .prepare(
      "UPDATE player_buffs SET charges = ?, power = ? WHERE user_id = ? AND kind = ?"
    )
    .run(row.charges + charges, Math.max(row.power, power), userId, kind);
}

function takeBuff(userId: number, kind: BuffKind) {
  const row = getDb()
    .prepare("SELECT charges, power FROM player_buffs WHERE user_id = ? AND kind = ?")
    .get(userId, kind) as { charges: number; power: number } | undefined;
  if (!row || row.charges <= 0) return null;
  if (row.charges <= 1) {
    getDb().prepare("DELETE FROM player_buffs WHERE user_id = ? AND kind = ?").run(userId, kind);
  } else {
    getDb()
      .prepare("UPDATE player_buffs SET charges = charges - 1 WHERE user_id = ? AND kind = ?")
      .run(userId, kind);
  }
  return { power: row.power };
}

function listBuffs(userId: number) {
  const rows = getDb()
    .prepare("SELECT kind, charges, power FROM player_buffs WHERE user_id = ? AND charges > 0")
    .all(userId) as { kind: BuffKind; charges: number; power: number }[];
  return rows.map((row) => ({
    kind: row.kind,
    charges: row.charges,
    power: row.power,
    label: describeBuff(row.kind, row.charges, row.power),
  }));
}

export function consumeItem(userId: number, itemId: string) {
  resolveBusy(userId);
  const consumable = consumableById[itemId];
  if (!consumable) throw new Error("That cannot be used.");
  if (availableItem(userId, itemId) < 1) {
    throw new Error("You do not have a free one to use.");
  }
  removeItem(userId, itemId, 1);
  addBuff(userId, consumable.kind, consumable.charges, consumable.power);
  const item = itemById[itemId];
  setEvent(
    userId,
    `${consumable.verb} ${item.emoji} ${item.name}. ${buffLabel[consumable.kind]} is ready.`
  );
}

export function arriveAt(userId: number, locationId: string) {
  resolveBusy(userId);
  const dest = locationById[locationId];
  if (!dest) throw new Error("Unknown place. That check-in code is not on the map.");
  const player = loadPlayerRow(userId);
  if (player.location_id === locationId) {
    setEvent(userId, `You are already at ${dest.emoji} ${dest.name}.`);
    return;
  }
  const interrupted =
    player.busy_type !== "idle" && Boolean(player.busy_until && player.busy_until > nowMs());
  getDb()
    .prepare(
      "UPDATE players SET location_id = ?, busy_type = 'idle', busy_until = NULL, busy_payload = NULL, last_event = ? WHERE user_id = ?"
    )
    .run(
      locationId,
      interrupted
        ? `Left a search and checked in at ${dest.emoji} ${dest.name}.`
        : `Checked in at ${dest.emoji} ${dest.name}.`,
      userId
    );
}

export function startTravel(userId: number, locationId: string) {
  requireIdle(userId);
  const dest = locationById[locationId];
  if (!dest) throw new Error("Unknown place on the map.");
  const player = loadPlayerRow(userId);
  if (player.location_id === locationId) throw new Error("You are already there.");
  let seconds = travelSeconds(player.location_id, locationId);
  const haste = takeBuff(userId, "travel_haste");
  if (haste) {
    seconds = Math.max(6, Math.round((seconds * haste.power) / 100));
  }
  const ends = nowMs() + seconds * 1000;
  getDb()
    .prepare(
      "UPDATE players SET busy_type = 'travel', busy_until = ?, busy_payload = ?, last_event = ? WHERE user_id = ?"
    )
    .run(
      ends,
      JSON.stringify({ locationId }),
      haste
        ? `You set out for ${dest.emoji} ${dest.name} on a fast road (${seconds}s).`
        : `You set out for ${dest.emoji} ${dest.name}.`,
      userId
    );
}

export function startSearch(userId: number) {
  requireIdle(userId);
  const player = loadPlayerRow(userId);
  const location = locationById[player.location_id];
  if (!location?.searchSeconds) {
    throw new Error("There is nothing to search here. Check in at the woods, ridge, shore, or fields.");
  }
  const strain = bumpStrain(location.id);
  const calm = takeBuff(userId, "search_calm");
  const haste = takeBuff(userId, "search_haste");
  const yieldBuff = takeBuff(userId, "search_yield");
  const luck = takeBuff(userId, "search_luck");
  const double = takeBuff(userId, "search_double");
  let seconds = searchDurationSeconds(location.id, calm ? 0 : strain);
  if (haste) {
    seconds = Math.max(8, Math.round((seconds * haste.power) / 100));
  }
  const ends = nowMs() + seconds * 1000;
  const extras = [
    calm ? "steady ground" : null,
    haste ? "quick hands" : null,
    yieldBuff ? "deep pockets" : null,
    luck ? "lucky pull" : null,
    double ? "second find" : null,
  ].filter(Boolean);
  const crowdNote =
    !calm && strain > 0
      ? ` Crowded — ${seconds}s.`
      : "";
  getDb()
    .prepare(
      "UPDATE players SET busy_type = 'search', busy_until = ?, busy_payload = ?, last_event = ? WHERE user_id = ?"
    )
    .run(
      ends,
      JSON.stringify({
        locationId: location.id,
        extraQty: yieldBuff ? 1 : 0,
        luck: luck?.power ?? 1,
        double: Boolean(double),
      }),
      `You start searching ${location.emoji} ${location.name}.${crowdNote}${
        extras.length ? ` (${extras.join(", ")})` : ""
      }`,
      userId
    );
}

export function startMine(userId: number) {
  startSearch(userId);
}

export function craftItem(userId: number, outputId: string) {
  requireTown(userId);
  const recipe = recipeByOutput[outputId];
  if (!recipe) throw new Error("No recipe for that.");
  for (const input of recipe.inputs) {
    if (availableItem(userId, input.itemId) < input.qty) {
      throw new Error(`Need more ${itemById[input.itemId].name}.`);
    }
  }
  for (const input of recipe.inputs) {
    removeItem(userId, input.itemId, input.qty);
  }
  addItem(userId, recipe.outputId, recipe.outputQty);
  const output = itemById[recipe.outputId];
  if (recipe.outputId === WIN_ITEM_ID) {
    const player = loadPlayerRow(userId);
    if (!player.has_won) {
      getDb()
        .prepare("UPDATE players SET has_won = 1, won_at = ? WHERE user_id = ?")
        .run(nowMs(), userId);
    }
    setEvent(userId, "The plaza lanterns flare. You crafted the 🌟 Celestial Relic. You win!");
    return;
  }
  setEvent(userId, `Crafted ${output.emoji} ${output.name} ×${recipe.outputQty}.`);
}

export function placeOrder(
  userId: number,
  itemId: string,
  side: "buy" | "sell",
  price: number,
  quantity: number
) {
  resolveBusy(userId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(price) || price < 1 || price > 9999) {
    throw new Error("Price must be a whole number from 1 to 9999.");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error("Quantity must be a whole number from 1 to 99.");
  }
  if (side === "buy" && availableGold(userId) < price * quantity) {
    throw new Error("Not enough free coin. Cancel a bid or sell something.");
  }
  if (side === "sell" && availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock. Cancel a sell order first.");
  }
  getDb()
    .prepare(
      "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(userId, itemId, side, price, quantity, nowMs());
  matchItem(itemId);
  setEvent(
    userId,
    side === "buy"
      ? `Bid posted: ${item.emoji} ${item.name} ×${quantity} at ${price}🪙.`
      : `Ask posted: ${item.emoji} ${item.name} ×${quantity} at ${price}🪙.`
  );
}

export function takeOrder(userId: number, orderId: number, quantity = 1) {
  resolveBusy(userId);
  const db = getDb();
  const order = db
    .prepare(
      "SELECT id, user_id, item_id, side, price, remaining FROM orders WHERE id = ? AND remaining > 0"
    )
    .get(orderId) as
    | { id: number; user_id: number; item_id: string; side: string; price: number; remaining: number }
    | undefined;
  if (!order) throw new Error("That order is gone.");
  if (order.user_id === userId) throw new Error("That is your own order.");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose how many to take.");
  }
  const fillQty = Math.min(quantity, order.remaining);

  if (order.side === "sell") {
    if (availableGold(userId) < order.price * fillQty) {
      throw new Error("Not enough coin to take that ask.");
    }
    const info = db
      .prepare(
        "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at) VALUES (?, ?, 'buy', ?, ?, ?)"
      )
      .run(userId, order.item_id, order.price, fillQty, nowMs());
    const buyId = Number(info.lastInsertRowid);
    executeFill(
      { id: buyId, user_id: userId, price: order.price, remaining: fillQty },
      { id: order.id, user_id: order.user_id, price: order.price, remaining: order.remaining },
      order.item_id,
      fillQty,
      order.price
    );
  } else {
    if (availableItem(userId, order.item_id) < fillQty) {
      throw new Error("Not enough stock to fill that bid.");
    }
    const info = db
      .prepare(
        "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at) VALUES (?, ?, 'sell', ?, ?, ?)"
      )
      .run(userId, order.item_id, order.price, fillQty, nowMs());
    const sellId = Number(info.lastInsertRowid);
    executeFill(
      { id: order.id, user_id: order.user_id, price: order.price, remaining: order.remaining },
      { id: sellId, user_id: userId, price: order.price, remaining: fillQty },
      order.item_id,
      fillQty,
      order.price
    );
  }
  const item = itemById[order.item_id];
  setEvent(userId, `Filled ${item.emoji} ${item.name} ×${fillQty} at ${order.price}🪙.`);
}

export function cancelOrder(userId: number, orderId: number) {
  resolveBusy(userId);
  const order = getDb()
    .prepare("SELECT id, user_id FROM orders WHERE id = ?")
    .get(orderId) as { id: number; user_id: number } | undefined;
  if (!order || order.user_id !== userId) throw new Error("You cannot cancel that.");
  getDb().prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  setEvent(userId, "Order pulled from the board.");
}

function readBankGlut(itemId: string) {
  const row = getDb()
    .prepare("SELECT units, cools_at FROM bank_intake WHERE item_id = ?")
    .get(itemId) as { units: number; cools_at: number } | undefined;
  if (!row || row.cools_at <= nowMs()) return 0;
  return row.units;
}

function listBankQuotes(): BankQuote[] {
  return Object.keys(itemById).map((itemId) => {
    const glut = readBankGlut(itemId);
    const mv = marketPrice(itemId);
    const rate = bankRate(glut);
    const row = getDb()
      .prepare("SELECT cools_at FROM bank_intake WHERE item_id = ?")
      .get(itemId) as { cools_at: number } | undefined;
    return {
      itemId,
      rate,
      payEach: Math.max(1, Math.round(mv * rate)),
      glut,
      cooldownMs: glut > 0 && row && row.cools_at > nowMs() ? row.cools_at - nowMs() : 0,
    };
  });
}

export function bankSell(userId: number, itemId: string, quantity: number) {
  requireTown(userId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a quantity.");
  if (availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock to sell to the bank.");
  }
  const mv = marketPrice(itemId);
  const glut = readBankGlut(itemId);
  const payout = bankPayout(mv, glut, quantity);
  removeItem(userId, itemId, quantity);
  getDb().prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(
    payout.total,
    userId
  );
  getDb()
    .prepare(
      `INSERT INTO bank_intake (item_id, units, cools_at) VALUES (?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET units = excluded.units, cools_at = excluded.cools_at`
    )
    .run(itemId, payout.nextGlut, nowMs() + BANK_COOLDOWN_MS);
  const pct = Math.round(payout.startRate * 100);
  setEvent(
    userId,
    `Bank bought ${item.emoji} ${item.name} ×${quantity} for ${payout.total}🪙 (${pct}% of MV). Dumping more drops the rate until the window cools.`
  );
}

export function buyCosmetic(userId: number, cosmeticId: string) {
  requireTown(userId);
  const cosmetic = cosmeticById[cosmeticId];
  if (!cosmetic) throw new Error("Unknown cosmetic.");
  const owned = getDb()
    .prepare("SELECT 1 FROM cosmetics WHERE user_id = ? AND cosmetic_id = ?")
    .get(userId, cosmeticId);
  if (owned) throw new Error("You already own that.");
  if (availableGold(userId) < cosmetic.price) throw new Error("Not enough free coin.");
  getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(
    cosmetic.price,
    userId
  );
  getDb()
    .prepare("INSERT INTO cosmetics (user_id, cosmetic_id) VALUES (?, ?)")
    .run(userId, cosmeticId);
  const slot = cosmetic.slot === "hat" ? "hat" : cosmetic.slot === "outfit" ? "outfit" : "accessory";
  getDb().prepare(`UPDATE players SET ${slot} = ? WHERE user_id = ?`).run(cosmeticId, userId);
  setEvent(userId, `Bought and equipped ${cosmetic.emoji} ${cosmetic.name}.`);
}

export function equipCosmetic(userId: number, cosmeticId: string | null, slot: string) {
  resolveBusy(userId);
  if (cosmeticId) {
    const cosmetic = cosmeticById[cosmeticId];
    if (!cosmetic || cosmetic.slot !== slot) throw new Error("That does not fit the slot.");
    const owned = getDb()
      .prepare("SELECT 1 FROM cosmetics WHERE user_id = ? AND cosmetic_id = ?")
      .get(userId, cosmeticId);
    if (!owned) throw new Error("Buy it at the wardrobe stall first.");
  }
  if (slot !== "hat" && slot !== "outfit" && slot !== "accessory") {
    throw new Error("Unknown slot.");
  }
  getDb().prepare(`UPDATE players SET ${slot} = ? WHERE user_id = ?`).run(cosmeticId, userId);
  setEvent(userId, cosmeticId ? "Look updated." : "You tucked that piece away.");
}

function mapOrder(row: {
  id: number;
  user_id: number;
  username: string;
  item_id: string;
  side: "buy" | "sell";
  price: number;
  remaining: number;
  created_at: number;
}): OrderRow {
  return {
    id: row.id,
    playerId: row.user_id,
    username: row.username,
    itemId: row.item_id,
    side: row.side,
    price: row.price,
    remaining: row.remaining,
    createdAt: row.created_at,
  };
}

export function getOrderBook(itemId: string): OrderBook {
  const rows = getDb()
    .prepare(
      `SELECT o.id, o.user_id, u.username, o.item_id, o.side, o.price, o.remaining, o.created_at
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.item_id = ? AND o.remaining > 0 AND u.username != 'Banker'`
    )
    .all(itemId) as {
    id: number;
    user_id: number;
    username: string;
    item_id: string;
    side: "buy" | "sell";
    price: number;
    remaining: number;
    created_at: number;
  }[];
  const mapped = rows.map(mapOrder);
  return {
    itemId,
    bids: mapped
      .filter((row) => row.side === "buy")
      .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt),
    asks: mapped
      .filter((row) => row.side === "sell")
      .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt),
  };
}

function priceSheet(): MarketPrice[] {
  const db = getDb();
  return Object.keys(itemById).map((itemId) => {
    const stats = db
      .prepare(
        "SELECT SUM(price * quantity) AS notional, SUM(quantity) AS volume, MAX(id) AS last_id FROM trades WHERE item_id = ?"
      )
      .get(itemId) as {
      notional: number | null;
      volume: number | null;
      last_id: number | null;
    };
    const last = stats.last_id
      ? (db.prepare("SELECT price FROM trades WHERE id = ?").get(stats.last_id) as
          | { price: number }
          | undefined)
      : undefined;
    const bid = db
      .prepare(
        "SELECT MAX(price) AS p FROM orders WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')"
      )
      .get(itemId) as { p: number | null };
    const ask = db
      .prepare(
        "SELECT MIN(price) AS p FROM orders WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')"
      )
      .get(itemId) as { p: number | null };
    const vwap =
      stats.volume && stats.notional
        ? Math.max(1, Math.round(stats.notional / stats.volume))
        : itemById[itemId].basePrice;
    return {
      itemId,
      vwap,
      last: last?.price ?? null,
      volume: stats.volume ?? 0,
      bestBid: bid.p,
      bestAsk: ask.p,
    };
  });
}

export function getGameState(userId: number): GameState {
  resolveBusy(userId);
  const player = loadPlayerRow(userId);
  const inv = inventoryMap(userId);
  const reserved = reservedItems(userId);
  const inventory: InventoryRow[] = [...inv.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  const owned = getDb()
    .prepare("SELECT cosmetic_id FROM cosmetics WHERE user_id = ?")
    .all(userId) as { cosmetic_id: string }[];
  const equipped: Equipped = {
    hat: player.hat,
    outfit: player.outfit,
    accessory: player.accessory,
  };
  const playerState: PlayerState = {
    id: player.user_id,
    username: player.username,
    gold: player.gold,
    availableGold: player.gold - reservedGold(userId),
    locationId: player.location_id,
    inventory,
    reservedItems: reserved,
    cosmetics: owned.map((row) => row.cosmetic_id),
    equipped,
    hasWon: Boolean(player.has_won),
    wonAt: player.won_at,
    busy: busyState(player),
    lastEvent: player.last_event,
    buffs: listBuffs(userId),
  };

  const myOrders = (
    getDb()
      .prepare(
        `SELECT o.id, o.user_id, u.username, o.item_id, o.side, o.price, o.remaining, o.created_at
         FROM orders o JOIN users u ON u.id = o.user_id
         WHERE o.user_id = ? AND o.remaining > 0
         ORDER BY o.created_at DESC`
      )
      .all(userId) as {
      id: number;
      user_id: number;
      username: string;
      item_id: string;
      side: "buy" | "sell";
      price: number;
      remaining: number;
      created_at: number;
    }[]
  ).map(mapOrder);

  const recentTrades = (
    getDb()
      .prepare(
        `SELECT t.id, t.item_id, t.price, t.quantity, t.created_at, b.username AS buy_name, s.username AS sell_name
         FROM trades t
         JOIN users b ON b.id = t.buy_user_id
         JOIN users s ON s.id = t.sell_user_id
         ORDER BY t.id DESC
         LIMIT 18`
      )
      .all() as {
      id: number;
      item_id: string;
      price: number;
      quantity: number;
      created_at: number;
      buy_name: string;
      sell_name: string;
    }[]
  ).map(
    (row): TradeRow => ({
      id: row.id,
      itemId: row.item_id,
      price: row.price,
      quantity: row.quantity,
      createdAt: row.created_at,
      buyUsername: row.buy_name,
      sellUsername: row.sell_name,
    })
  );

  const winners = getDb()
    .prepare(
      `SELECT u.username, p.won_at AS wonAt
       FROM players p JOIN users u ON u.id = p.user_id
       WHERE p.has_won = 1 AND p.won_at IS NOT NULL
       ORDER BY p.won_at ASC
       LIMIT 12`
    )
    .all() as { username: string; wonAt: number }[];

  return {
    now: nowMs(),
    player: playerState,
    prices: priceSheet(),
    myOrders,
    recentTrades,
    winners,
    areas: listAreas(),
    bank: listBankQuotes(),
  };
}
