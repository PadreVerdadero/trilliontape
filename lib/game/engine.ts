import {
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
import { rarityFromHeld, rarityOf } from "@/lib/game/rarity";
import { getDb } from "@/lib/game/db";
import { BOT_PROFILES, botSpread } from "@/lib/game/bots";
import { computeFairValue } from "@/lib/game/market";
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
  SwapOffer,
  TradeRow,
  TravelerRow,
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
  is_gov: number;
  is_admin: number;
};

function nowMs() {
  return Date.now();
}

function loadPlayerRow(userId: number): PlayerRow {
  const row = getDb()
    .prepare(
      `SELECT p.*, u.username, COALESCE(u.is_gov, 0) AS is_gov, COALESCE(u.is_admin, 0) AS is_admin
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
  const map: Record<string, number> = {};
  const bump = (itemId: string, qty: number) => {
    map[itemId] = (map[itemId] ?? 0) + qty;
  };
  const listed = getDb()
    .prepare(
      "SELECT item_id, COALESCE(SUM(remaining), 0) AS qty FROM orders WHERE user_id = ? AND side = 'sell' AND remaining > 0 AND COALESCE(treasury, 0) = 0 GROUP BY item_id"
    )
    .all(userId) as { item_id: string; qty: number }[];
  for (const row of listed) bump(row.item_id, row.qty);
  const offered = getDb()
    .prepare(
      `SELECT l.item_id, COALESCE(SUM(l.quantity), 0) AS qty
       FROM swap_legs l
       JOIN swap_offers o ON o.id = l.offer_id
       WHERE o.from_user_id = ? AND o.status = 'open' AND l.side = 'give'
       GROUP BY l.item_id`
    )
    .all(userId) as { item_id: string; qty: number }[];
  for (const row of offered) bump(row.item_id, row.qty);
  return map;
}

function reservedGold(userId: number) {
  const bids = getDb()
    .prepare(
      "SELECT COALESCE(SUM(price * remaining), 0) AS gold FROM orders WHERE user_id = ? AND side = 'buy' AND remaining > 0 AND COALESCE(treasury, 0) = 0"
    )
    .get(userId) as { gold: number };
  const swaps = getDb()
    .prepare(
      "SELECT COALESCE(SUM(give_gold), 0) AS gold FROM swap_offers WHERE from_user_id = ? AND status = 'open'"
    )
    .get(userId) as { gold: number };
  return (bids.gold ?? 0) + (swaps.gold ?? 0);
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
  const rarityMap = rarityFromHeld(Object.keys(itemById), packTotals());
  if (skipCommon) {
    const filtered = pool.filter((item) => rarityOf(item.id, rarityMap) !== "common");
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) return { itemId: "", qty: 0 };
  const weights = pool.map((item) => {
    let weight = searchWeight(item);
    const rarity = rarityOf(item.id, rarityMap);
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

function marketPrints(itemId: string) {
  return getDb()
    .prepare("SELECT price, quantity FROM trades WHERE item_id = ? ORDER BY id DESC LIMIT 100")
    .all(itemId) as { price: number; quantity: number }[];
}

function marketPrice(itemId: string): number {
  const base = itemById[itemId]?.basePrice ?? 1;
  return computeFairValue(base, [...marketPrints(itemId)].reverse());
}

function isGov(userId: number) {
  const row = getDb()
    .prepare("SELECT COALESCE(is_gov, 0) AS is_gov FROM users WHERE id = ?")
    .get(userId) as { is_gov: number } | undefined;
  return Boolean(row?.is_gov);
}

function isBot(userId: number) {
  const row = getDb()
    .prepare("SELECT COALESCE(is_bot, 0) AS is_bot FROM users WHERE id = ?")
    .get(userId) as { is_bot: number } | undefined;
  return Boolean(row?.is_bot);
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
  buy: { id: number; user_id: number; price: number; remaining: number; treasury?: number },
  sell: { id: number; user_id: number; price: number; remaining: number; treasury?: number },
  itemId: string,
  quantity: number,
  price: number
) {
  const govBuy = Boolean(buy.treasury);
  const govSell = Boolean(sell.treasury);
  const db = getDb();
  if (!govBuy) {
    db.prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(
      price * quantity,
      buy.user_id
    );
  }
  if (!govSell) {
    db.prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(
      price * quantity,
      sell.user_id
    );
  }
  if (!govSell) removeItem(sell.user_id, itemId, quantity);
  if (!govBuy) addItem(buy.user_id, itemId, quantity);
  const buyLeft = buy.remaining - quantity;
  const sellLeft = sell.remaining - quantity;
  if (buyLeft <= 0) db.prepare("DELETE FROM orders WHERE id = ?").run(buy.id);
  else db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(buyLeft, buy.id);
  if (sellLeft <= 0) db.prepare("DELETE FROM orders WHERE id = ?").run(sell.id);
  else db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(sellLeft, sell.id);
  recordTrade(itemId, price, quantity, buy.user_id, sell.user_id);
  if (buy.user_id !== sell.user_id) {
    if (!isBot(buy.user_id)) awardFirstTradeVp(buy.user_id);
    if (!isBot(sell.user_id)) awardFirstTradeVp(sell.user_id);
    if (!isBot(sell.user_id)) {
      getDb()
        .prepare("UPDATE players SET board_fills = COALESCE(board_fills, 0) + 1 WHERE user_id = ?")
        .run(sell.user_id);
    }
  }
}

function matchItem(itemId: string) {
  const db = getDb();
  while (true) {
    const buy = db
      .prepare(
        `SELECT id, user_id, price, remaining, created_at, COALESCE(treasury, 0) AS treasury
         FROM orders
         WHERE item_id = ? AND side = 'buy' AND remaining > 0
           AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
         ORDER BY price DESC, created_at ASC, id ASC`
      )
      .all(itemId) as {
      id: number;
      user_id: number;
      price: number;
      remaining: number;
      created_at: number;
      treasury: number;
    }[];
    const sell = db
      .prepare(
        `SELECT id, user_id, price, remaining, created_at, COALESCE(treasury, 0) AS treasury
         FROM orders
         WHERE item_id = ? AND side = 'sell' AND remaining > 0
           AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
         ORDER BY price ASC, created_at ASC, id ASC`
      )
      .all(itemId) as {
      id: number;
      user_id: number;
      price: number;
      remaining: number;
      created_at: number;
      treasury: number;
    }[];

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
  if (amount <= 0 || isBot(userId)) return;
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

function insertLiveOrder(
  userId: number,
  itemId: string,
  side: "buy" | "sell",
  price: number,
  quantity: number,
  treasury: boolean
) {
  const info = getDb()
    .prepare(
      "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at, treasury) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(userId, itemId, side, price, quantity, nowMs(), treasury ? 1 : 0);
  return Number(info.lastInsertRowid);
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
  if (!Number.isInteger(price) || price < 1) {
    throw new Error("Price must be a whole number of at least 1.");
  }
  const treasury = isGov(userId);
  const maxQty = treasury ? 999 : 99;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQty) {
    throw new Error(
      treasury
        ? "Quantity must be a whole number from 1 to 999."
        : "Quantity must be a whole number from 1 to 99."
    );
  }
  if (side === "buy" && !treasury && availableGold(userId) < price * quantity) {
    throw new Error("Not enough free coin. Cancel a bid or sell something.");
  }
  if (side === "sell" && !treasury && availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock. Cancel a sell order first.");
  }
  for (let n = 0; n < quantity; n += 1) {
    insertLiveOrder(userId, itemId, side, price, 1, treasury);
  }
  matchItem(itemId);
  setEvent(
    userId,
    treasury
      ? side === "buy"
        ? `Treasury bid: will burn ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)} when it fills.`
        : `Treasury ask: will mint ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)} when it fills.`
      : side === "buy"
        ? `Bid posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)}.`
        : `Ask posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(price)}.`
  );
}

export function takeOrder(userId: number, orderId: number, quantity = 1) {
  resolveBusy(userId);
  const db = getDb();
  const order = db
    .prepare(
      "SELECT id, user_id, item_id, side, price, remaining, COALESCE(treasury, 0) AS treasury FROM orders WHERE id = ? AND remaining > 0"
    )
    .get(orderId) as
    | {
        id: number;
        user_id: number;
        item_id: string;
        side: string;
        price: number;
        remaining: number;
        treasury: number;
      }
    | undefined;
  if (!order) throw new Error("That order is gone.");
  if (order.user_id === userId) throw new Error("That is your own order.");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose how many to take.");
  }
  const fillQty = Math.min(quantity, order.remaining);

  if (order.side === "sell") {
    if (!isGov(userId) && availableGold(userId) < order.price * fillQty) {
      throw new Error("Not enough coin to take that ask.");
    }
    const buyId = insertLiveOrder(userId, order.item_id, "buy", order.price, fillQty, isGov(userId));
    executeFill(
      { id: buyId, user_id: userId, price: order.price, remaining: fillQty, treasury: isGov(userId) ? 1 : 0 },
      {
        id: order.id,
        user_id: order.user_id,
        price: order.price,
        remaining: order.remaining,
        treasury: order.treasury,
      },
      order.item_id,
      fillQty,
      order.price
    );
  } else {
    if (!isGov(userId) && availableItem(userId, order.item_id) < fillQty) {
      throw new Error("Not enough stock to fill that bid.");
    }
    const sellId = insertLiveOrder(userId, order.item_id, "sell", order.price, fillQty, isGov(userId));
    executeFill(
      {
        id: order.id,
        user_id: order.user_id,
        price: order.price,
        remaining: order.remaining,
        treasury: order.treasury,
      },
      { id: sellId, user_id: userId, price: order.price, remaining: fillQty, treasury: isGov(userId) ? 1 : 0 },
      order.item_id,
      fillQty,
      order.price
    );
  }
  const item = itemById[order.item_id];
  setEvent(
    userId,
    isGov(userId) && order.side === "buy"
      ? `Treasury minted ${item.emoji} ${item.name} ×${formatNumber(fillQty)} into the market at ${formatCoins(order.price)}.`
      : isGov(userId) && order.side === "sell"
        ? `Treasury bought and burned ${item.emoji} ${item.name} ×${formatNumber(fillQty)} at ${formatCoins(order.price)}.`
        : `Filled ${item.emoji} ${item.name} ×${formatNumber(fillQty)} at ${formatCoins(order.price)}.`
  );
}

export function cancelOrder(userId: number, orderId: number, quantity = 1) {
  resolveBusy(userId);
  const order = getDb()
    .prepare("SELECT id, user_id, remaining FROM orders WHERE id = ?")
    .get(orderId) as { id: number; user_id: number; remaining: number } | undefined;
  if (!order || order.user_id !== userId) throw new Error("You cannot cancel that.");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose how many to cancel.");
  }
  const pull = Math.min(quantity, order.remaining);
  if (pull >= order.remaining) {
    getDb().prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  } else {
    getDb()
      .prepare("UPDATE orders SET remaining = remaining - ? WHERE id = ?")
      .run(pull, orderId);
  }
  setEvent(userId, pull === 1 ? "Pulled 1 from the board." : `Pulled ${formatNumber(pull)} from the board.`);
}

export function setGovernment(userId: number, on: boolean) {
  resolveBusy(userId);
  if (isBot(userId)) throw new Error("Plaza regulars cannot hold office.");
  getDb().prepare("UPDATE users SET is_gov = ? WHERE id = ?").run(on ? 1 : 0, userId);
  if (on) {
    setEvent(
      userId,
      "You hold the treasury. It is unlimited and does not touch your purse. Asks mint new stock. Bids pay sellers with new coin and burn the goods."
    );
  } else {
    setEvent(
      userId,
      "You left office. Treasury quotes stay on the book until they fill or you cancel them. Volume changes when they trade, not when you post."
    );
  }
}

function isAdmin(userId: number) {
  const row = getDb()
    .prepare("SELECT COALESCE(is_admin, 0) AS is_admin FROM users WHERE id = ?")
    .get(userId) as { is_admin: number } | undefined;
  return Boolean(row?.is_admin);
}

function requireAdmin(userId: number) {
  if (!isAdmin(userId)) throw new Error("Admin mode is off.");
}

export function setAdmin(userId: number, on: boolean) {
  resolveBusy(userId);
  if (isBot(userId)) throw new Error("Plaza regulars cannot open admin.");
  getDb().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(on ? 1 : 0, userId);
  setEvent(userId, on ? "Admin mode on. You can set coins and pack quantities." : "Admin mode off.");
}

export function adminSetGold(userId: number, gold: number) {
  requireAdmin(userId);
  if (!Number.isInteger(gold) || gold < 0 || gold > 9_999_999) {
    throw new Error("Coins must be a whole number from 0 to 9,999,999.");
  }
  getDb().prepare("UPDATE players SET gold = ? WHERE user_id = ?").run(gold, userId);
  setEvent(userId, `Admin set coins to ${formatCoins(gold)}.`);
}

export function adminSetItem(userId: number, itemId: string, quantity: number) {
  requireAdmin(userId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9_999) {
    throw new Error("Quantity must be a whole number from 0 to 9,999.");
  }
  const db = getDb();
  if (quantity === 0) {
    db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  } else {
    db.prepare(
      `INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity`
    ).run(userId, itemId, quantity);
  }
  setEvent(userId, `Admin set ${item.emoji} ${item.name} to ${formatNumber(quantity)}.`);
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
  is_gov?: number;
}): OrderRow {
  const gov = Boolean(row.is_gov);
  return {
    id: row.id,
    playerId: row.user_id,
    username: gov ? "Government" : row.username,
    itemId: row.item_id,
    side: row.side,
    price: row.price,
    remaining: row.remaining,
    createdAt: row.created_at,
    isGov: gov,
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
    stallOpen(stall, clock)
      ? `You rented a crate at ${stall.name} for this window. Your next sale here gets a 10% bump.`
      : `You reserved a crate at ${stall.name}'s next window. Your stack sells with a 10% bump.`
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
       FROM players p JOIN users u ON u.id = p.user_id
       WHERE COALESCE(u.is_bot, 0) = 0`
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
      `SELECT o.id, o.user_id, u.username, o.item_id, o.side, o.price, o.remaining, o.created_at,
              COALESCE(o.treasury, 0) AS is_gov
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
    is_gov: number;
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

function bookDepth() {
  const map: Record<string, { listed: number; wanted: number }> = {};
  const rows = getDb()
    .prepare(
      `SELECT item_id, side, COALESCE(SUM(remaining), 0) AS qty
       FROM orders
       WHERE remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
       GROUP BY item_id, side`
    )
    .all() as { item_id: string; side: string; qty: number }[];
  for (const row of rows) {
    const cur = map[row.item_id] ?? { listed: 0, wanted: 0 };
    if (row.side === "sell") cur.listed = row.qty;
    else cur.wanted = row.qty;
    map[row.item_id] = cur;
  }
  return map;
}

function packTotals() {
  const rows = getDb()
    .prepare("SELECT item_id, COALESCE(SUM(quantity), 0) AS qty FROM inventory GROUP BY item_id")
    .all() as { item_id: string; qty: number }[];
  return Object.fromEntries(rows.map((row) => [row.item_id, row.qty])) as Record<string, number>;
}

function priceSheet(): MarketPrice[] {
  const db = getDb();
  const depth = bookDepth();
  const packs = packTotals();
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
    const prints = marketPrints(itemId);
    const vwap = computeFairValue(itemById[itemId].basePrice, [...prints].reverse());
    const book = depth[itemId] ?? { listed: 0, wanted: 0 };
    return {
      itemId,
      vwap,
      last: last?.price ?? null,
      volume: stats.volume ?? 0,
      prints: prints.length,
      listed: book.listed,
      wanted: book.wanted,
      held: packs[itemId] ?? 0,
      bestBid: bid.p,
      bestAsk: ask.p,
    };
  });
}

function shufflePick<T>(list: T[], count: number) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const botClock = globalThis as unknown as { bazaarBotTick?: number };

function restockBot(userId: number, gold: number, specialty: string[], thin: boolean) {
  if (availableGold(userId) < 350) {
    getDb()
      .prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?")
      .run(Math.max(400, Math.round(gold * 0.35)), userId);
  }
  for (const itemId of specialty) {
    if (!itemById[itemId]) continue;
    if (availableItem(userId, itemId) < 3) addItem(userId, itemId, thin ? 4 : 10);
  }
}

export function tickBots() {
  const now = nowMs();
  if (botClock.bazaarBotTick && now - botClock.bazaarBotTick < 3500) return;
  botClock.bazaarBotTick = now;
  const db = getDb();
  db.prepare(
    "DELETE FROM orders WHERE created_at < ? AND user_id IN (SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1)"
  ).run(now - 150_000);
  for (const profile of shufflePick(BOT_PROFILES, 14)) {
    const user = db
      .prepare("SELECT id FROM users WHERE username = ? AND COALESCE(is_bot, 0) = 1")
      .get(profile.username) as { id: number } | undefined;
    if (!user) continue;
    try {
      restockBot(user.id, profile.gold, profile.specialty, profile.style === "thin");
      const itemId = profile.specialty[Math.floor(Math.random() * profile.specialty.length)];
      const item = itemById[itemId];
      if (!item) continue;
      const fair = marketPrice(itemId);
      const spread = botSpread(profile.style);
      const ask = db
        .prepare(
          `SELECT id, price FROM orders
           WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND user_id != ?
           ORDER BY price ASC, id ASC LIMIT 1`
        )
        .get(itemId, user.id) as { id: number; price: number } | undefined;
      if (ask && ask.price <= Math.round(fair * (1 - spread.take)) && availableGold(user.id) >= ask.price) {
        takeOrder(user.id, ask.id, 1);
        continue;
      }
      const bid = db
        .prepare(
          `SELECT id, price FROM orders
           WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND user_id != ?
           ORDER BY price DESC, id ASC LIMIT 1`
        )
        .get(itemId, user.id) as { id: number; price: number } | undefined;
      if (bid && bid.price >= Math.round(fair * (1 + spread.take)) && availableItem(user.id, itemId) >= 1) {
        takeOrder(user.id, bid.id, 1);
        continue;
      }
      const live = db
        .prepare("SELECT COALESCE(SUM(remaining), 0) AS n FROM orders WHERE user_id = ? AND remaining > 0")
        .get(user.id) as { n: number };
      if (live.n >= 8) continue;
      const qty = profile.style === "thin" || profile.style === "wild" ? 1 : 1 + Math.floor(Math.random() * 3);
      const quoteBoth = live.n <= 4 && Math.random() < 0.45;
      const chase = Math.random() < (profile.style === "wild" ? 0.7 : 0.5);
      const drift = 0.9 + Math.random() * 0.2;
      const buySide = Math.random() < 0.5;
      if (quoteBoth || buySide) {
        const bidPx = Math.max(
          1,
          Math.round(fair * (chase ? 1.08 + Math.random() * 0.32 : spread.bid * drift))
        );
        if (availableGold(user.id) >= bidPx * qty) placeOrder(user.id, itemId, "buy", bidPx, qty);
      }
      if (quoteBoth || !buySide) {
        const askPx = Math.max(
          1,
          Math.round(fair * (chase ? 0.55 + Math.random() * 0.32 : spread.ask * drift))
        );
        if (availableItem(user.id, itemId) >= qty) {
          placeOrder(user.id, itemId, "sell", askPx, qty);
        }
      }
    } catch {
      // One noisy step should not stall the plaza.
    }
  }
}

type SwapDraft = {
  toUsername?: string | null;
  giveGold?: number;
  wantGold?: number;
  give?: { itemId: string; quantity: number }[];
  want?: { itemId: string; quantity: number }[];
};

function mergeLegs(rows: { itemId: string; quantity: number }[] | undefined) {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!itemById[row.itemId]) throw new Error(`Unknown item: ${row.itemId}.`);
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) {
      throw new Error("Each stack in a deal must be a whole number from 1 to 99.");
    }
    map.set(row.itemId, (map.get(row.itemId) ?? 0) + row.quantity);
  }
  return [...map.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

function loadSwap(offerId: number) {
  const row = getDb()
    .prepare(
      `SELECT o.id, o.from_user_id, o.to_user_id, o.give_gold, o.want_gold, o.status, o.created_at,
              f.username AS from_name, t.username AS to_name
       FROM swap_offers o
       JOIN users f ON f.id = o.from_user_id
       LEFT JOIN users t ON t.id = o.to_user_id
       WHERE o.id = ?`
    )
    .get(offerId) as
    | {
        id: number;
        from_user_id: number;
        to_user_id: number | null;
        give_gold: number;
        want_gold: number;
        status: string;
        created_at: number;
        from_name: string;
        to_name: string | null;
      }
    | undefined;
  if (!row) throw new Error("That deal is gone.");
  const legs = getDb()
    .prepare("SELECT side, item_id, quantity FROM swap_legs WHERE offer_id = ?")
    .all(offerId) as { side: string; item_id: string; quantity: number }[];
  return {
    ...row,
    give: legs.filter((leg) => leg.side === "give").map((leg) => ({ itemId: leg.item_id, quantity: leg.quantity })),
    want: legs.filter((leg) => leg.side === "want").map((leg) => ({ itemId: leg.item_id, quantity: leg.quantity })),
  };
}

function describeBundle(gold: number, legs: { itemId: string; quantity: number }[]) {
  const bits = legs.map((leg) => {
    const item = itemById[leg.itemId];
    return `${item?.emoji ?? ""} ${item?.name ?? leg.itemId} ×${formatNumber(leg.quantity)}`;
  });
  if (gold > 0) bits.push(formatCoins(gold));
  return bits.length ? bits.join(", ") : "nothing";
}

export function proposeSwap(userId: number, draft: SwapDraft) {
  resolveBusy(userId);
  const giveGold = Number(draft.giveGold ?? 0);
  const wantGold = Number(draft.wantGold ?? 0);
  if (!Number.isInteger(giveGold) || giveGold < 0 || !Number.isInteger(wantGold) || wantGold < 0) {
    throw new Error("Gold in a deal must be a whole number, 0 or more.");
  }
  const give = mergeLegs(draft.give);
  const want = mergeLegs(draft.want);
  if (give.length === 0 && want.length === 0) {
    throw new Error("A deal needs at least one item. Coin can ride along.");
  }
  let toId: number | null = null;
  const targetName = String(draft.toUsername ?? "").trim();
  if (targetName) {
    const target = getDb()
      .prepare("SELECT id, username, COALESCE(is_bot, 0) AS is_bot FROM users WHERE username = ?")
      .get(targetName) as { id: number; username: string; is_bot: number } | undefined;
    if (!target) throw new Error("No traveler by that name.");
    if (target.id === userId) throw new Error("You cannot send a deal to yourself.");
    if (target.is_bot) {
      throw new Error("Plaza regulars do not take private bundles. Name a traveler, or leave the deal open.");
    }
    toId = target.id;
  }
  if (giveGold > 0 && availableGold(userId) < giveGold) {
    throw new Error("Not enough free coin to put on that deal.");
  }
  for (const leg of give) {
    if (availableItem(userId, leg.itemId) < leg.quantity) {
      throw new Error(`Not enough unbound ${itemById[leg.itemId]?.name ?? leg.itemId}.`);
    }
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO swap_offers (from_user_id, to_user_id, give_gold, want_gold, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`
    )
    .run(userId, toId, giveGold, wantGold, nowMs());
  const offerId = Number(info.lastInsertRowid);
  const insertLeg = db.prepare(
    "INSERT INTO swap_legs (offer_id, side, item_id, quantity) VALUES (?, ?, ?, ?)"
  );
  for (const leg of give) insertLeg.run(offerId, "give", leg.itemId, leg.quantity);
  for (const leg of want) insertLeg.run(offerId, "want", leg.itemId, leg.quantity);
  const who = toId ? loadPlayerRow(toId).username : "anyone on the board";
  setEvent(
    userId,
    `Deal posted to ${who}: you give ${describeBundle(giveGold, give)} for ${describeBundle(wantGold, want)}.`
  );
}

export function cancelSwap(userId: number, offerId: number) {
  resolveBusy(userId);
  const offer = loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.from_user_id !== userId) throw new Error("Only the sender can pull that deal.");
  getDb().prepare("UPDATE swap_offers SET status = 'cancelled' WHERE id = ?").run(offerId);
  setEvent(userId, "Deal pulled. Your pack is free again.");
}

export function declineSwap(userId: number, offerId: number) {
  resolveBusy(userId);
  const offer = loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.to_user_id !== userId) throw new Error("That deal was not sent to you.");
  getDb().prepare("UPDATE swap_offers SET status = 'declined' WHERE id = ?").run(offerId);
  setEvent(offer.from_user_id, `${loadPlayerRow(userId).username} declined your deal.`);
  setEvent(userId, `You declined ${offer.from_name}'s deal.`);
}

export function acceptSwap(userId: number, offerId: number) {
  resolveBusy(userId);
  const offer = loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.from_user_id === userId) throw new Error("You cannot take your own deal.");
  if (offer.to_user_id != null && offer.to_user_id !== userId) {
    throw new Error("That deal was sent to someone else.");
  }
  if (offer.want_gold > 0 && availableGold(userId) < offer.want_gold) {
    throw new Error("Not enough free coin to take that deal.");
  }
  for (const leg of offer.want) {
    if (availableItem(userId, leg.itemId) < leg.quantity) {
      throw new Error(`Need more ${itemById[leg.itemId]?.name ?? leg.itemId} to take that deal.`);
    }
  }
  for (const leg of offer.give) {
    const have = inventoryMap(offer.from_user_id).get(leg.itemId) ?? 0;
    if (have < leg.quantity) {
      throw new Error("The sender no longer has those goods.");
    }
  }
  if (offer.give_gold > 0 && loadPlayerRow(offer.from_user_id).gold < offer.give_gold) {
    throw new Error("The sender no longer has the coin on that deal.");
  }
  for (const leg of offer.give) {
    removeItem(offer.from_user_id, leg.itemId, leg.quantity);
    addItem(userId, leg.itemId, leg.quantity);
  }
  for (const leg of offer.want) {
    removeItem(userId, leg.itemId, leg.quantity);
    addItem(offer.from_user_id, leg.itemId, leg.quantity);
  }
  if (offer.give_gold > 0) {
    getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(offer.give_gold, offer.from_user_id);
    getDb().prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(offer.give_gold, userId);
  }
  if (offer.want_gold > 0) {
    getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(offer.want_gold, userId);
    getDb().prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(offer.want_gold, offer.from_user_id);
  }
  getDb().prepare("UPDATE swap_offers SET status = 'accepted' WHERE id = ?").run(offerId);
  const taker = loadPlayerRow(userId).username;
  setEvent(
    offer.from_user_id,
    `${taker} took your deal. You gave ${describeBundle(offer.give_gold, offer.give)} for ${describeBundle(offer.want_gold, offer.want)}.`
  );
  setEvent(
    userId,
    `You took ${offer.from_name}'s deal. You gave ${describeBundle(offer.want_gold, offer.want)} for ${describeBundle(offer.give_gold, offer.give)}.`
  );
}

function listTravelers(userId: number): TravelerRow[] {
  return (
    getDb()
      .prepare(
        `SELECT u.id, u.username, COALESCE(u.is_bot, 0) AS is_bot
         FROM users u JOIN players p ON p.user_id = u.id
         WHERE u.id != ? AND u.username != 'Banker' AND COALESCE(u.is_bot, 0) = 0 AND COALESCE(u.is_gov, 0) = 0
         ORDER BY u.username COLLATE NOCASE ASC`
      )
      .all(userId) as { id: number; username: string; is_bot: number }[]
  ).map((row) => ({ id: row.id, username: row.username, bot: Boolean(row.is_bot) }));
}

function decorateLegs(legs: { itemId: string; quantity: number }[]) {
  return legs.map((leg) => {
    const item = itemById[leg.itemId];
    return {
      itemId: leg.itemId,
      name: item?.name ?? leg.itemId,
      emoji: item?.emoji ?? "",
      quantity: leg.quantity,
    };
  });
}

function mapSwap(row: ReturnType<typeof loadSwap>, userId: number): SwapOffer {
  const yours = row.from_user_id === userId;
  const incoming = row.to_user_id === userId;
  return {
    id: row.id,
    fromId: row.from_user_id,
    fromName: row.from_name,
    toId: row.to_user_id,
    toName: row.to_name,
    giveGold: row.give_gold,
    wantGold: row.want_gold,
    give: decorateLegs(row.give),
    want: decorateLegs(row.want),
    createdAt: row.created_at,
    yours,
    incoming,
    role: yours ? "mine" : incoming ? "inbox" : "open",
  };
}

function listSwaps(userId: number): SwapOffer[] {
  const ids = getDb()
    .prepare(
      `SELECT id FROM swap_offers
       WHERE status = 'open' AND (from_user_id = ? OR to_user_id = ? OR to_user_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 40`
    )
    .all(userId, userId) as { id: number }[];
  return ids.map((row) => mapSwap(loadSwap(row.id), userId));
}

export function getGameState(userId: number, timeZone?: string): GameState {
  tickBots();
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
    isGov: Boolean(player.is_gov),
    isAdmin: Boolean(player.is_admin),
  };

  const myOrders = (
    getDb()
      .prepare(
      `SELECT o.id, o.user_id, u.username, o.item_id, o.side, o.price, o.remaining, o.created_at,
              COALESCE(o.treasury, 0) AS is_gov
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
           WHERE COALESCE(u.is_bot, 0) = 0
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
    festival,
    swaps: listSwaps(userId),
    travelers: listTravelers(userId),
  };
}
