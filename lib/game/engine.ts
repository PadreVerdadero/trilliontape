import {
  BANK_COOLDOWN_MS,
  bankPayout,
  bankRate,
  cosmeticById,
  FOOD_ITEM_IDS,
  FORAGE_STRAIN_ID,
  isFoodItem,
  isLegendaryItem,
  itemById,
  locationById,
  materialsAt,
  recipeByOutput,
  ENERGY_MAX,
  SEARCH_COOLDOWN_MS,
  searchEnergyCost,
  searchWeight,
  travelSeconds,
  VP_TO_WIN,
  WIN_ITEM_ID,
} from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import {
  buffLabel,
  consumableById,
  describeBuff,
  foodById,
  type BuffKind,
} from "@/lib/game/consumables";
import { rarityOf } from "@/lib/game/rarity";
import { getDb } from "@/lib/game/db";
import {
  chalkboardItem,
  contractsForWeek,
  CRATE_COST,
  donationCost,
  festivalClock,
  nextStallChange,
  RUMOR_COST,
  shiftDateKey,
  stallBuyRate,
  stallById,
  stallOpen,
  stalls,
  stallSellPrice,
  sundayMarketOpen,
  weekId,
  windowKey,
  type FestivalClock,
} from "@/lib/game/stalls";
import type {
  AreaCrowd,
  BankQuote,
  BusyState,
  ContractView,
  Equipped,
  FestivalState,
  FestivalTitle,
  GameState,
  InventoryRow,
  MarketPrice,
  OrderBook,
  OrderRow,
  PlayerState,
  PricePoint,
  StallView,
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
  energy: number;
  energy_max: number;
  vp: number;
  gold_from_stalls: number;
  food_delivered: number;
  legendary_turnins: number;
  board_fills: number;
  gold_donated: number;
  donate_count: number;
  wardrobe_vp: number;
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
    const bits = grantSearchLoot(userId, {
      locationId: String(payload.locationId ?? player.location_id),
      luck: Number(payload.luck ?? 1),
      extraQty: Number(payload.extraQty ?? 0),
      double: Boolean(payload.double),
      itemId: payload.itemId ? String(payload.itemId) : undefined,
      qty: payload.qty != null ? Number(payload.qty) : undefined,
    });
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
      detail: "You can forage, trade, or visit a stall.",
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

function grantSearchLoot(
  userId: number,
  payload: {
    locationId: string;
    luck: number;
    extraQty: number;
    double: boolean;
    skipCommon?: boolean;
    itemId?: string;
    qty?: number;
  }
) {
  const rolls = payload.double ? 2 : 1;
  const finds: { itemId: string; qty: number }[] = [];
  if (payload.itemId) {
    finds.push({ itemId: payload.itemId, qty: Number(payload.qty ?? 0) });
  } else {
    for (let i = 0; i < rolls; i += 1) {
      const loot = rollSearchLoot(payload.locationId, payload.luck, payload.skipCommon);
      if (loot.itemId) {
        finds.push({ itemId: loot.itemId, qty: loot.qty + payload.extraQty });
      }
    }
  }
  const bits: string[] = [];
  for (const find of finds) {
    const item = itemById[find.itemId];
    if (!item || find.qty <= 0) continue;
    addItem(userId, item.id, find.qty);
    bits.push(`${item.emoji} ${item.name} ×${formatNumber(find.qty)}`);
  }
  return bits;
}

function rollSearchLoot(locationId: string, luck = 1, skipCommon = false) {
  let pool = materialsAt(locationId);
  if (skipCommon) {
    const filtered = pool.filter((item) => rarityOf(item.id) !== "common");
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) return { itemId: "", qty: 0 };
  const weights = pool.map((item) => {
    let weight = searchWeight(item);
    const rarity = rarityOf(item.id);
    if (luck > 1 && rarity === "legendary") {
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

function listForage(playerLocationId: string): AreaCrowd & { biasLocationId: string | null } {
  const strain = readStrain(FORAGE_STRAIN_ID);
  const row = getDb()
    .prepare("SELECT cools_at FROM area_strain WHERE location_id = ?")
    .get(FORAGE_STRAIN_ID) as { cools_at: number } | undefined;
  const cooldownMs = strain > 0 && row && row.cools_at > nowMs() ? row.cools_at - nowMs() : 0;
  const bias = locationById[playerLocationId]?.searchEnergy ? playerLocationId : null;
  return {
    locationId: FORAGE_STRAIN_ID,
    searchers: countSearchers(FORAGE_STRAIN_ID),
    strain,
    cooldownMs,
    nextSearchCost: searchEnergyCost(FORAGE_STRAIN_ID, strain),
    biasLocationId: bias,
  };
}

function listAreas(playerLocationId = "town"): AreaCrowd[] {
  const forage = listForage(playerLocationId);
  return [forage];
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
  if (buy.user_id !== sell.user_id) {
    awardFirstTradeVp(buy.user_id);
    awardFirstTradeVp(sell.user_id);
    getDb()
      .prepare("UPDATE players SET board_fills = COALESCE(board_fills, 0) + 1 WHERE user_id = ?")
      .run(sell.user_id);
  }
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
  requireIdle(userId);
}

function utcDayKey(now = nowMs()) {
  return new Date(now).toISOString().slice(0, 10);
}

function touchDaily(userId: number, dayKey: string) {
  getDb()
    .prepare(
      `INSERT INTO player_daily (user_id, day_key, first_trade, special_sold)
       VALUES (?, ?, 0, '')
       ON CONFLICT(user_id, day_key) DO NOTHING`
    )
    .run(userId, dayKey);
}

function awardVp(userId: number, amount: number) {
  if (amount <= 0) return;
  const db = getDb();
  db.prepare("UPDATE players SET vp = COALESCE(vp, 0) + ? WHERE user_id = ?").run(amount, userId);
  const row = loadPlayerRow(userId);
  if ((row.vp ?? 0) >= VP_TO_WIN && !row.has_won) {
    db.prepare("UPDATE players SET has_won = 1, won_at = ? WHERE user_id = ?").run(nowMs(), userId);
  }
}

function awardFirstTradeVp(userId: number) {
  const day = utcDayKey();
  touchDaily(userId, day);
  const row = getDb()
    .prepare("SELECT first_trade FROM player_daily WHERE user_id = ? AND day_key = ?")
    .get(userId, day) as { first_trade: number } | undefined;
  if (!row || row.first_trade) return;
  getDb()
    .prepare("UPDATE player_daily SET first_trade = 1 WHERE user_id = ? AND day_key = ?")
    .run(userId, day);
  awardVp(userId, 1);
}

function awardWardrobeVp(userId: number, slot: string) {
  const bit = slot === "hat" ? 1 : slot === "outfit" ? 2 : 4;
  const player = loadPlayerRow(userId);
  const mask = player.wardrobe_vp ?? 0;
  if (mask & bit) return;
  getDb().prepare("UPDATE players SET wardrobe_vp = ? WHERE user_id = ?").run(mask | bit, userId);
  awardVp(userId, 1);
}

function markRelicContract(userId: number) {
  const rows = getDb()
    .prepare("SELECT id FROM festival_contracts WHERE item_id = ? AND expires_at > ?")
    .all(WIN_ITEM_ID, nowMs()) as { id: string }[];
  for (const row of rows) {
    getDb()
      .prepare(
        `INSERT INTO contract_completions (contract_id, user_id, completed_at)
         VALUES (?, ?, ?)
         ON CONFLICT(contract_id, user_id) DO NOTHING`
      )
      .run(row.id, userId, nowMs());
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
  const food = foodById[itemId];
  if (food) {
    if (availableItem(userId, itemId) < 1) {
      throw new Error("You do not have a free one to eat.");
    }
    const player = loadPlayerRow(userId);
    const max = player.energy_max ?? ENERGY_MAX;
    if ((player.energy ?? 0) >= max) {
      throw new Error("You are already full.");
    }
    removeItem(userId, itemId, 1);
    const next = Math.min(max, (player.energy ?? 0) + food.energy);
    getDb().prepare("UPDATE players SET energy = ? WHERE user_id = ?").run(next, userId);
    const item = itemById[itemId];
    setEvent(
      userId,
      `You eat ${item.emoji} ${item.name}. +${food.energy} energy (${next}/${max}).`
    );
    return;
  }
  const consumable = consumableById[itemId];
  if (!consumable) throw new Error("That cannot be used.");
  if (availableItem(userId, itemId) < 1) {
    throw new Error("You do not have a free one to use.");
  }
  removeItem(userId, itemId, 1);
  const player = loadPlayerRow(userId);
  const max = player.energy_max ?? ENERGY_MAX;
  let healed = 0;
  if (consumable.energy) {
    const next = Math.min(max, (player.energy ?? 0) + consumable.energy);
    healed = next - (player.energy ?? 0);
    getDb().prepare("UPDATE players SET energy = ? WHERE user_id = ?").run(next, userId);
  }
  addBuff(userId, consumable.kind, consumable.charges, consumable.power);
  const item = itemById[itemId];
  const healNote = healed > 0 ? ` +${healed} energy.` : "";
  setEvent(
    userId,
    `${consumable.verb} ${item.emoji} ${item.name}.${healNote} ${buffLabel[consumable.kind]} is ready.`
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

const FORAGE_BIOMES = ["woods", "ridge", "shore", "fields"] as const;

function pickForageBiome(biasLocationId: string | null) {
  if (biasLocationId && FORAGE_BIOMES.includes(biasLocationId as (typeof FORAGE_BIOMES)[number])) {
    if (Math.random() < 0.7) return biasLocationId;
  }
  return FORAGE_BIOMES[Math.floor(Math.random() * FORAGE_BIOMES.length)];
}

export function startSearch(userId: number) {
  requireIdle(userId);
  const player = loadPlayerRow(userId);
  const strain = bumpStrain(FORAGE_STRAIN_ID);
  const calm = takeBuff(userId, "search_calm");
  const cheap = takeBuff(userId, "search_cheap");
  const yieldBuff = takeBuff(userId, "search_yield");
  const luck = takeBuff(userId, "search_luck");
  const double = takeBuff(userId, "search_double");
  const skipCommon = takeBuff(userId, "search_skip_common");
  const cost = cheap ? 1 : searchEnergyCost(FORAGE_STRAIN_ID, calm ? 0 : strain);
  const energy = player.energy ?? 0;
  const max = player.energy_max ?? ENERGY_MAX;
  if (energy < cost) {
    throw new Error(
      `You are too tired (${energy} energy). Eat berries, bread, fish, honey, or stew.`
    );
  }
  const nextEnergy = energy - cost;
  getDb()
    .prepare("UPDATE players SET energy = ? WHERE user_id = ?")
    .run(nextEnergy, userId);
  const bias = locationById[player.location_id]?.searchEnergy ? player.location_id : null;
  const biome = pickForageBiome(bias);
  const place = locationById[biome];
  const bits = grantSearchLoot(userId, {
    locationId: biome,
    extraQty: yieldBuff ? 1 : 0,
    luck: luck?.power ?? 1,
    double: Boolean(double),
    skipCommon: Boolean(skipCommon),
  });
  const extras = [
    cheap ? "easy pull" : null,
    calm ? "steady ground" : null,
    yieldBuff ? "deep pockets" : null,
    luck ? "lucky pull" : null,
    double ? "second find" : null,
    skipCommon ? "no commons" : null,
    bias ? `${place?.emoji ?? ""} lean` : null,
  ].filter(Boolean);
  const crowdNote = !calm && strain > 0 ? ` Crowded — ${cost} energy.` : ` −${cost} energy.`;
  const findNote = bits.length > 0 ? ` You pull ${bits.join(" and ")}.` : " Nothing this time.";
  setEvent(
    userId,
    `Searched the grounds (${place?.emoji ?? ""} ${place?.name ?? "wilds"}).${crowdNote}${findNote} ${nextEnergy}/${max} left.${
      extras.length ? ` (${extras.join(", ")})` : ""
    }`
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
    awardVp(userId, 8);
    markRelicContract(userId);
    setEvent(
      userId,
      "The plaza lanterns flare. You crafted the 🌟 Celestial Relic. +8 victory points."
    );
    return;
  }
  setEvent(userId, `Crafted ${output.emoji} ${output.name} ×${formatNumber(recipe.outputQty)}.`);
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
      ? `Bid posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)}.`
      : `Ask posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)}.`
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
  setEvent(userId, `Filled ${item.emoji} ${item.name} ×${formatNumber(fillQty)} at ${formatCoins(order.price)}.`);
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
    `Bank bought ${item.emoji} ${item.name} ×${formatNumber(quantity)} for ${formatCoins(payout.total)} (${pct}% of MV). Dumping more drops the rate until the window cools.`
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
  awardWardrobeVp(userId, slot);
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
  if (cosmeticId) awardWardrobeVp(userId, slot);
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

function requireOpenStall(stallId: string, clock: FestivalClock) {
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  if (!stallOpen(stall, clock)) {
    throw new Error(`${stall.name} is closed. Come back during ${stall.hoursLabel.toLowerCase()}`);
  }
  return stall;
}

function ensureContracts(clock: FestivalClock) {
  const week = weekId(clock.dateKey);
  const db = getDb();
  for (const template of contractsForWeek(week)) {
    const id = `${week}:${template.id}`;
    const existing = db.prepare("SELECT id FROM festival_contracts WHERE id = ?").get(id);
    if (existing) continue;
    db.prepare(
      `INSERT INTO festival_contracts
        (id, week_id, stall_id, title, detail, item_id, quantity, vp, gold, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      week,
      template.stallId,
      template.title,
      template.detail,
      template.itemId,
      template.quantity,
      template.vp,
      template.gold,
      nowMs() + template.hours * 3_600_000
    );
  }
}

function crateRow(stallId: string, key: string) {
  return getDb()
    .prepare("SELECT user_id, used FROM stall_crates WHERE stall_id = ? AND window_key = ?")
    .get(stallId, key) as { user_id: number; used: number } | undefined;
}

function usernameOf(userId: number) {
  const row = getDb().prepare("SELECT username FROM users WHERE id = ?").get(userId) as
    | { username: string }
    | undefined;
  return row?.username ?? "Someone";
}

function applySpecialHourVp(userId: number, stallId: string) {
  const day = utcDayKey();
  touchDaily(userId, day);
  const row = getDb()
    .prepare("SELECT special_sold FROM player_daily WHERE user_id = ? AND day_key = ?")
    .get(userId, day) as { special_sold: string } | undefined;
  const seen = new Set((row?.special_sold ?? "").split(",").filter(Boolean));
  if (seen.has(stallId)) return false;
  seen.add(stallId);
  getDb()
    .prepare("UPDATE player_daily SET special_sold = ? WHERE user_id = ? AND day_key = ?")
    .run([...seen].join(","), userId, day);
  awardVp(userId, 1);
  return true;
}

export function sellToStall(
  userId: number,
  stallId: string,
  itemId: string,
  quantity: number,
  timeZone?: string
) {
  requireIdle(userId);
  const clock = festivalClock(timeZone);
  const stall = requireOpenStall(stallId, clock);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a quantity.");
  if (!stall.buyIds.includes(itemId)) {
    throw new Error(`${stall.name} is not buying ${item.name} today.`);
  }
  if (availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock.");
  }
  const chalk = chalkboardItem(stall.id, clock.dateKey);
  let rate = stallBuyRate(stall, itemId, clock, chalk);
  const key = windowKey(stall.id, clock);
  const crate = crateRow(stall.id, key);
  const crateBonus = crate && crate.user_id === userId && !crate.used;
  if (crateBonus) rate += 0.1;
  const mv = marketPrice(itemId);
  const payEach = Math.max(1, Math.round(mv * rate));
  const total = payEach * quantity;
  removeItem(userId, itemId, quantity);
  getDb()
    .prepare(
      `UPDATE players
       SET gold = gold + ?,
           gold_from_stalls = COALESCE(gold_from_stalls, 0) + ?,
           food_delivered = COALESCE(food_delivered, 0) + ?,
           legendary_turnins = COALESCE(legendary_turnins, 0) + ?
       WHERE user_id = ?`
    )
    .run(
      total,
      total,
      isFoodItem(itemId) ? quantity : 0,
      isLegendaryItem(itemId) ? quantity : 0,
      userId
    );
  if (crateBonus) {
    getDb()
      .prepare("UPDATE stall_crates SET used = 1 WHERE stall_id = ? AND window_key = ?")
      .run(stall.id, key);
  }
  const special = itemId === chalk;
  const specialVp = special ? applySpecialHourVp(userId, stall.id) : false;
  setEvent(
    userId,
    `${stall.emoji} ${stall.name} bought ${item.emoji} ${item.name} ×${formatNumber(quantity)} for ${formatCoins(total)} (${Math.round(rate * 100)}% of MV).${
      crateBonus ? " Crate bonus applied." : ""
    }${specialVp ? " +1 VP for the chalkboard hour." : ""}`
  );
}

export function buyFromStall(
  userId: number,
  stallId: string,
  itemId: string,
  quantity: number,
  timeZone?: string
) {
  requireIdle(userId);
  const clock = festivalClock(timeZone);
  const stall = requireOpenStall(stallId, clock);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!stall.sellIds.includes(itemId)) {
    throw new Error(`${stall.name} is not selling ${item.name}.`);
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error("Choose a quantity from 1 to 20.");
  }
  const price = stallSellPrice(itemId, marketPrice(itemId));
  const total = price * quantity;
  if (availableGold(userId) < total) throw new Error("Not enough free coin.");
  getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(total, userId);
  addItem(userId, itemId, quantity);
  setEvent(
    userId,
    `Bought ${item.emoji} ${item.name} ×${formatNumber(quantity)} from ${stall.name} for ${formatCoins(total)}.`
  );
}

export function buyRumor(userId: number, stallId: string, timeZone?: string) {
  requireIdle(userId);
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  const clock = festivalClock(timeZone);
  const tomorrow = shiftDateKey(clock.dateKey, 1);
  const already = getDb()
    .prepare("SELECT 1 FROM player_rumors WHERE user_id = ? AND stall_id = ? AND for_date = ?")
    .get(userId, stallId, tomorrow);
  if (already) throw new Error("You already paid for tomorrow's chalkboard.");
  if (availableGold(userId) < RUMOR_COST) throw new Error("Not enough free coin for a rumor.");
  getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(RUMOR_COST, userId);
  getDb()
    .prepare("INSERT INTO player_rumors (user_id, stall_id, for_date) VALUES (?, ?, ?)")
    .run(userId, stallId, tomorrow);
  const item = itemById[chalkboardItem(stallId, tomorrow)];
  setEvent(
    userId,
    `${stall.name} leans in: tomorrow the chalkboard is ${item?.emoji ?? ""} ${item?.name ?? "something odd"}.`
  );
}

export function rentCrate(userId: number, stallId: string, timeZone?: string) {
  requireIdle(userId);
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  const clock = festivalClock(timeZone);
  const key = windowKey(stallId, clock);
  const existing = crateRow(stallId, key);
  if (existing) {
    throw new Error(
      existing.user_id === userId
        ? "You already rented that crate."
        : `${usernameOf(existing.user_id)} already reserved this window.`
    );
  }
  if (availableGold(userId) < CRATE_COST) throw new Error("Not enough free coin to rent a crate.");
  getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(CRATE_COST, userId);
  getDb()
    .prepare("INSERT INTO stall_crates (stall_id, window_key, user_id, used) VALUES (?, ?, ?, 0)")
    .run(stallId, key, userId);
  setEvent(
    userId,
    `You rented a crate at ${stall.name}'s next window. Your stack sells with a 10% bump.`
  );
}

function contractNeed(itemId: string, userId: number) {
  if (itemId === "*food") {
    return FOOD_ITEM_IDS.reduce((sum, id) => sum + availableItem(userId, id), 0);
  }
  return availableItem(userId, itemId);
}

function takeContractItems(userId: number, itemId: string, quantity: number) {
  if (itemId !== "*food") {
    removeItem(userId, itemId, quantity);
    return;
  }
  let left = quantity;
  for (const foodId of FOOD_ITEM_IDS) {
    if (left <= 0) break;
    const have = availableItem(userId, foodId);
    const take = Math.min(have, left);
    if (take > 0) {
      removeItem(userId, foodId, take);
      left -= take;
    }
  }
  if (left > 0) throw new Error("Not enough food for that contract.");
}

export function completeContract(userId: number, contractId: string, timeZone?: string) {
  requireIdle(userId);
  const clock = festivalClock(timeZone);
  const row = getDb()
    .prepare(
      `SELECT id, stall_id, title, item_id, quantity, vp, gold, expires_at
       FROM festival_contracts WHERE id = ?`
    )
    .get(contractId) as
    | {
        id: string;
        stall_id: string;
        title: string;
        item_id: string;
        quantity: number;
        vp: number;
        gold: number;
        expires_at: number;
      }
    | undefined;
  if (!row) throw new Error("That contract is gone.");
  if (row.expires_at <= nowMs()) throw new Error("That contract expired.");
  const done = getDb()
    .prepare("SELECT 1 FROM contract_completions WHERE contract_id = ? AND user_id = ?")
    .get(contractId, userId);
  if (done) throw new Error("You already finished that job.");
  if (row.item_id === WIN_ITEM_ID) {
    throw new Error("Craft the relic at the workshop. The lanterns score it when it is made.");
  }
  const stall = requireOpenStall(row.stall_id, clock);
  if (contractNeed(row.item_id, userId) < row.quantity) {
    throw new Error("You do not have enough for that job yet.");
  }
  takeContractItems(userId, row.item_id, row.quantity);
  if (row.gold > 0) {
    getDb()
      .prepare("UPDATE players SET gold = gold + ?, gold_from_stalls = COALESCE(gold_from_stalls, 0) + ? WHERE user_id = ?")
      .run(row.gold, row.gold, userId);
  }
  if (isFoodItem(row.item_id) || row.item_id === "*food") {
    getDb()
      .prepare("UPDATE players SET food_delivered = COALESCE(food_delivered, 0) + ? WHERE user_id = ?")
      .run(row.quantity, userId);
  }
  if (isLegendaryItem(row.item_id)) {
    getDb()
      .prepare("UPDATE players SET legendary_turnins = COALESCE(legendary_turnins, 0) + ? WHERE user_id = ?")
      .run(row.quantity, userId);
  }
  getDb()
    .prepare("INSERT INTO contract_completions (contract_id, user_id, completed_at) VALUES (?, ?, ?)")
    .run(contractId, userId, nowMs());
  awardVp(userId, row.vp);
  setEvent(
    userId,
    `${stall.emoji} ${stall.name} stamps "${row.title}". +${row.vp} VP${
      row.gold > 0 ? ` and ${formatCoins(row.gold)}` : ""
    }.`
  );
}

export function donateLanterns(userId: number) {
  requireIdle(userId);
  const player = loadPlayerRow(userId);
  const cost = donationCost(player.donate_count ?? 0);
  if (availableGold(userId) < cost) {
    throw new Error(`The festival desk wants ${formatCoins(cost)} for the next lantern.`);
  }
  getDb()
    .prepare(
      `UPDATE players
       SET gold = gold - ?, gold_donated = COALESCE(gold_donated, 0) + ?, donate_count = COALESCE(donate_count, 0) + 1
       WHERE user_id = ?`
    )
    .run(cost, cost, userId);
  awardVp(userId, 1);
  setEvent(userId, `You sponsor a plaza lantern for ${formatCoins(cost)}. +1 VP.`);
}

function listContracts(userId: number, clock: FestivalClock): ContractView[] {
  ensureContracts(clock);
  const rows = getDb()
    .prepare(
      `SELECT id, stall_id, title, detail, item_id, quantity, vp, gold, expires_at
       FROM festival_contracts
       WHERE expires_at > ?
       ORDER BY vp DESC, expires_at ASC`
    )
    .all(nowMs()) as {
    id: string;
    stall_id: string;
    title: string;
    detail: string;
    item_id: string;
    quantity: number;
    vp: number;
    gold: number;
    expires_at: number;
  }[];
  const doneIds = new Set(
    (
      getDb()
        .prepare("SELECT contract_id FROM contract_completions WHERE user_id = ?")
        .all(userId) as { contract_id: string }[]
    ).map((row) => row.contract_id)
  );
  return rows.map((row) => {
    const stall = stallById[row.stall_id];
    return {
      id: row.id,
      stallId: row.stall_id,
      stallName: stall?.name ?? row.stall_id,
      stallEmoji: stall?.emoji ?? "🏮",
      title: row.title,
      detail: row.detail,
      itemId: row.item_id,
      quantity: row.quantity,
      vp: row.vp,
      gold: row.gold,
      expiresAt: row.expires_at,
      remainingMs: Math.max(0, row.expires_at - nowMs()),
      done: doneIds.has(row.id),
    };
  });
}

function listStallViews(userId: number, clock: FestivalClock, prices: MarketPrice[]): StallView[] {
  const rumors = new Set(
    (
      getDb()
        .prepare("SELECT stall_id FROM player_rumors WHERE user_id = ? AND for_date = ?")
        .all(userId, shiftDateKey(clock.dateKey, 1)) as { stall_id: string }[]
    ).map((row) => row.stall_id)
  );
  return stalls.map((stall) => {
    const open = stallOpen(stall, clock);
    const change = nextStallChange(stall, clock);
    const chalk = chalkboardItem(stall.id, clock.dateKey);
    const tomorrow = chalkboardItem(stall.id, shiftDateKey(clock.dateKey, 1));
    const key = windowKey(stall.id, clock);
    const crate = crateRow(stall.id, key);
    const mvOf = (itemId: string) =>
      prices.find((row) => row.itemId === itemId)?.vwap ?? itemById[itemId]?.basePrice ?? 1;
    return {
      id: stall.id,
      emoji: stall.emoji,
      name: stall.name,
      role: stall.role,
      blurb: stall.blurb,
      hoursLabel: stall.hoursLabel,
      open,
      sundayMarket: sundayMarketOpen(clock) && open,
      nextChangeMs: Math.max(0, change.at - clock.now),
      nextOpens: change.opens,
      chalkboardItemId: chalk,
      tomorrowItemId: rumors.has(stall.id) ? tomorrow : null,
      buys: stall.buyIds.map((itemId) => {
        const rate = stallBuyRate(stall, itemId, clock, chalk);
        const mv = mvOf(itemId);
        return {
          itemId,
          rate,
          payEach: Math.max(1, Math.round(mv * rate)),
          special: itemId === chalk || rate > stall.baseBuyRate + 0.001,
        };
      }),
      sells: stall.sellIds.map((itemId) => ({
        itemId,
        price: stallSellPrice(itemId, mvOf(itemId)),
      })),
      crateReservedBy: crate ? usernameOf(crate.user_id) : null,
      crateYours: crate?.user_id === userId,
      crateUsed: Boolean(crate?.used),
      windowKey: key,
    };
  });
}

function listTitles(): FestivalTitle[] {
  const rows = getDb()
    .prepare(
      `SELECT u.username, p.vp, p.gold_from_stalls, p.gold_donated, p.food_delivered,
              p.legendary_turnins, p.board_fills
       FROM players p JOIN users u ON u.id = p.user_id`
    )
    .all() as {
    username: string;
    vp: number;
    gold_from_stalls: number;
    gold_donated: number;
    food_delivered: number;
    legendary_turnins: number;
    board_fills: number;
  }[];
  const pick = (score: (row: (typeof rows)[number]) => number) => {
    let best: (typeof rows)[number] | null = null;
    for (const row of rows) {
      const value = score(row) || 0;
      if (!best || value > score(best)) best = row;
    }
    return best && score(best) > 0 ? best.username : null;
  };
  return [
    { id: "champion", label: "Champion", username: pick((row) => row.vp ?? 0) },
    {
      id: "purse",
      label: "Purse",
      username: pick((row) => (row.gold_from_stalls ?? 0) + (row.gold_donated ?? 0)),
    },
    { id: "baker", label: "Baker’s friend", username: pick((row) => row.food_delivered ?? 0) },
    { id: "broker", label: "Night broker", username: pick((row) => row.legendary_turnins ?? 0) },
    { id: "ghost", label: "Board ghost", username: pick((row) => row.board_fills ?? 0) },
  ];
}

function playerTitles(username: string, titles: FestivalTitle[]) {
  return titles.filter((title) => title.username === username).map((title) => title.label);
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
    history: getPriceHistory(itemId),
  };
}

export function getPriceHistory(itemId: string): PricePoint[] {
  const base = itemById[itemId]?.basePrice ?? 1;
  const rows = getDb()
    .prepare(
      "SELECT created_at, price FROM trades WHERE item_id = ? ORDER BY created_at ASC, id ASC LIMIT 120"
    )
    .all(itemId) as { created_at: number; price: number }[];
  if (rows.length === 0) {
    const now = Date.now();
    return [
      { at: now - 60 * 60 * 1000, price: base },
      { at: now, price: base },
    ];
  }
  return [
    { at: rows[0].created_at - 1, price: base },
    ...rows.map((row) => ({ at: row.created_at, price: row.price })),
  ];
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

export function getGameState(userId: number, timeZone?: string): GameState {
  resolveBusy(userId);
  const clock = festivalClock(timeZone);
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
    energy: player.energy ?? ENERGY_MAX,
    energyMax: player.energy_max ?? ENERGY_MAX,
    buffs: listBuffs(userId),
    vp: player.vp ?? 0,
    goldFromStalls: player.gold_from_stalls ?? 0,
    foodDelivered: player.food_delivered ?? 0,
    legendaryTurnins: player.legendary_turnins ?? 0,
    boardFills: player.board_fills ?? 0,
    goldDonated: player.gold_donated ?? 0,
    titles: [],
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

  const prices = priceSheet();
  const titles = listTitles();
  playerState.titles = playerTitles(player.username, titles);
  const festival: FestivalState = {
    timeZone: clock.timeZone,
    clockLabel: clock.label,
    sundayMarket: sundayMarketOpen(clock),
    vpToWin: VP_TO_WIN,
    rumorCost: RUMOR_COST,
    crateCost: CRATE_COST,
    donationNextCost: donationCost(player.donate_count ?? 0),
    forage: listForage(player.location_id),
    stalls: listStallViews(userId, clock, prices),
    contracts: listContracts(userId, clock),
    titles,
    leaders: (
      getDb()
        .prepare(
          `SELECT u.username, COALESCE(p.vp, 0) AS vp
           FROM players p JOIN users u ON u.id = p.user_id
           ORDER BY p.vp DESC, p.won_at ASC, u.username ASC
           LIMIT 8`
        )
        .all() as { username: string; vp: number }[]
    ).filter((row) => row.vp > 0),
  };

  return {
    now: nowMs(),
    player: playerState,
    prices,
    myOrders,
    recentTrades,
    winners,
    areas: listAreas(player.location_id),
    bank: listBankQuotes(),
    festival,
  };
}
