import {
  FOOD_ITEM_IDS,
  FORAGE_STRAIN_ID,
  isFoodItem,
  isLegendaryItem,
  itemById,
  items,
  locationById,
  materialsAt,
  ENERGY_MAX,
  SEARCH_COOLDOWN_MS,
  NET_WORTH_GOAL,
  MAX_STARTING_GOLD,
  dailyDeposit,
  stipendLabel,
  stipendSlotKey,
  STIPEND_PRESETS,
  searchEnergyCost,
  searchWeight,
  travelSeconds,
  VP_TO_WIN,
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
import {
  DESK_USERNAME,
  clearGameOver,
  computerCount,
  getDb,
  readGameOver,
  readGoal,
  readCandleMs,
  readTradingHours,
  seedBots,
  setComputerCount,
  writeGameOver,
  writeGoal,
  setStipendMs,
  stipendMs,
  readStipendLadder,
  writeStipendLadder,
  getItemAuthorized,
  setItemAuthorized,
  insertShareType,
  removeShareType,
  hydrateShareCatalog,
  startingGold,
  setStartingGold,
  tablePaidDrops,
  markStipendSlotPaid,
  readGamePhase,
  writeGamePhase,
  readScheduledStartAt,
  writeScheduledStartAt,
  readInviteCode,
  writeInviteCode,
} from "@/lib/game/db";
import bcrypt from "bcryptjs";
import { normalizeUsername, validatePassword, validateUsername } from "@/lib/game/auth";
import { parseStipendSlotKey, stipendCatchUp, validateStipendLadder } from "@/lib/game/stipend-ladder";
import {
  MAX_SHARE_TYPES,
  MIN_SHARE_TYPES,
  shareIdFromName,
  validateShareDraft,
} from "@/lib/game/shares";
import {
  BOT_PROFILES,
  MAX_COMPUTERS,
  botLossChance,
  botQuoteMultipliers,
  botSpread,
  botAskSize,
  botWillTake,
  hopeCoins,
  chaseAskPrice,
  chaseBidPrice,
  chaseSlack,
  waitSteps,
  type BotProfile,
} from "@/lib/game/bots";
import { isOfficeUsername, OFFICE_USERNAME } from "@/lib/game/office";
import { describeGoal, meetsGoal, sortByGoal, validateGoalDraft, type GoalConfig } from "@/lib/game/goal";
import { computeFairValue, CHART_MINUTES, MINUTE_MS, MV_PRINTS } from "@/lib/game/market";
import { coalesceTrades, lastTapeQty } from "@/lib/game/prints";
import {
  chalkboardItem,
  contractsForWeek,
  CRATE_COST,
  donationCost,
  festivalClock,
  startOfLocalDayMs,
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
  LeaderRow,
  MarketPrice,
  OrderBook,
  OrderRow,
  PlayerState,
  PricePoint,
  StallView,
  SwapOffer,
  TradeRow,
  TravelerRow,
  AdminSeat,
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

async function loadPlayerRow(userId: number): Promise<PlayerRow> {
  const row = await getDb()
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

async function inventoryMap(userId: number) {
  const rows = await getDb()
    .prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ?")
    .all(userId) as { item_id: string; quantity: number }[];
  return new Map(rows.map((row) => [row.item_id, row.quantity]));
}

async function reservedItems(userId: number) {
  const map: Record<string, number> = {};
  const bump = (itemId: string, qty: number) => {
    map[itemId] = (map[itemId] ?? 0) + qty;
  };
  const listed = await getDb()
    .prepare(
      "SELECT item_id, COALESCE(SUM(remaining), 0) AS qty FROM orders WHERE user_id = ? AND side = 'sell' AND remaining > 0 AND COALESCE(treasury, 0) = 0 GROUP BY item_id"
    )
    .all(userId) as { item_id: string; qty: number }[];
  for (const row of listed) bump(row.item_id, row.qty);
  const offered = await getDb()
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

async function reservedGold(userId: number) {
  const bids = await getDb()
    .prepare(
      "SELECT COALESCE(SUM(price * remaining), 0) AS gold FROM orders WHERE user_id = ? AND side = 'buy' AND remaining > 0 AND COALESCE(treasury, 0) = 0"
    )
    .get(userId) as { gold: number };
  const swaps = await getDb()
    .prepare(
      "SELECT COALESCE(SUM(give_gold), 0) AS gold FROM swap_offers WHERE from_user_id = ? AND status = 'open'"
    )
    .get(userId) as { gold: number };
  return (bids.gold ?? 0) + (swaps.gold ?? 0);
}

async function availableItem(userId: number, itemId: string) {
  const have = (await inventoryMap(userId)).get(itemId) ?? 0;
  const held = (await reservedItems(userId))[itemId] ?? 0;
  return have - held;
}

async function availableGold(userId: number) {
  const gold = (await loadPlayerRow(userId)).gold;
  return gold - (await reservedGold(userId));
}

async function addItem(userId: number, itemId: string, qty: number, unitCost?: number) {
  if (qty <= 0) return;
  const unit = Math.max(0, Math.round(unitCost ?? await marketPrice(itemId)));
  const addedCost = unit * qty;
  await getDb()
    .prepare(
      `INSERT INTO inventory (user_id, item_id, quantity, cost_basis) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET
         quantity = quantity + excluded.quantity,
         cost_basis = COALESCE(cost_basis, 0) + excluded.cost_basis`
    )
    .run(userId, itemId, qty, addedCost);
}

async function removeItem(userId: number, itemId: string, qty: number) {
  const row = await getDb()
    .prepare(
      "SELECT quantity, COALESCE(cost_basis, 0) AS cost_basis FROM inventory WHERE user_id = ? AND item_id = ?"
    )
    .get(userId, itemId) as { quantity: number; cost_basis: number } | undefined;
  const have = row?.quantity ?? 0;
  if (have < qty) throw new Error(`Not enough ${itemById[itemId]?.name ?? itemId}.`);
  const next = have - qty;
  const db = getDb();
  if (next === 0) {
    await db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  } else {
    const nextBasis = Math.round((row?.cost_basis ?? 0) * (next / have));
    await db.prepare(
      "UPDATE inventory SET quantity = ?, cost_basis = ? WHERE user_id = ? AND item_id = ?"
    ).run(next, nextBasis, userId, itemId);
  }
}

async function setEvent(userId: number, message: string) {
  await getDb().prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(message, userId);
}

async function clearBusy(userId: number) {
  await getDb()
    .prepare(
      "UPDATE players SET busy_type = 'idle', busy_until = NULL, busy_payload = NULL WHERE user_id = ?"
    )
    .run(userId);
}

export async function resolveBusy(userId: number) {
  const player = await loadPlayerRow(userId);
  if (player.busy_type === "idle" || !player.busy_until) return;
  if (player.busy_until > nowMs()) return;

  const payload = player.busy_payload ? JSON.parse(player.busy_payload) : {};
  if (player.busy_type === "travel") {
    const dest = String(payload.locationId ?? "");
    const location = locationById[dest];
    if (location) {
      await getDb()
        .prepare("UPDATE players SET location_id = ? WHERE user_id = ?")
        .run(dest, userId);
      await setEvent(userId, `You arrive at ${location.emoji} ${location.name}.`);
    }
  }
  if (player.busy_type === "mine" || player.busy_type === "search") {
    const bits = await grantSearchLoot(userId, {
      locationId: String(payload.locationId ?? player.location_id),
      luck: Number(payload.luck ?? 1),
      extraQty: Number(payload.extraQty ?? 0),
      double: Boolean(payload.double),
      itemId: payload.itemId ? String(payload.itemId) : undefined,
      qty: payload.qty != null ? Number(payload.qty) : undefined,
    });
    if (bits.length > 0) {
      await setEvent(userId, `You pull ${bits.join(" and ")} from the search.`);
    }
  }
  await clearBusy(userId);
}

function busyState(player: PlayerRow): BusyState {
  const remaining = player.busy_until ? Math.max(0, player.busy_until - nowMs()) : 0;
  if (player.busy_type === "idle" || remaining <= 0) {
    return {
      type: "idle",
      endsAt: null,
      remainingMs: 0,
      label: "Ready",
      detail: "Post a bid or ask, or take a quote on the board.",
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

async function grantSearchLoot(
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
      const loot = await rollSearchLoot(payload.locationId, payload.luck, payload.skipCommon);
      if (loot.itemId) {
        finds.push({ itemId: loot.itemId, qty: loot.qty + payload.extraQty });
      }
    }
  }
  const bits: string[] = [];
  for (const find of finds) {
    const item = itemById[find.itemId];
    if (!item || find.qty <= 0) continue;
    await addItem(userId, item.id, find.qty);
    bits.push(`${item.emoji} ${item.name} ×${formatNumber(find.qty)}`);
  }
  return bits;
}

async function rollSearchLoot(locationId: string, luck = 1, skipCommon = false) {
  let pool = materialsAt(locationId);
  const rarityMap = rarityFromHeld(Object.keys(itemById), await packTotals());
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

async function readStrain(locationId: string) {
  const row = await getDb()
    .prepare("SELECT strain, cools_at FROM area_strain WHERE location_id = ?")
    .get(locationId) as { strain: number; cools_at: number } | undefined;
  if (!row || row.cools_at <= nowMs()) return 0;
  return row.strain;
}

async function bumpStrain(locationId: string) {
  const current = await readStrain(locationId);
  const next = current + 1;
  await getDb()
    .prepare(
      `INSERT INTO area_strain (location_id, strain, cools_at) VALUES (?, ?, ?)
       ON CONFLICT(location_id) DO UPDATE SET strain = excluded.strain, cools_at = excluded.cools_at`
    )
    .run(locationId, next, nowMs() + SEARCH_COOLDOWN_MS);
  return current;
}

async function countSearchers(locationId: string) {
  const row = await getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM players
       WHERE location_id = ? AND busy_type IN ('search', 'mine') AND busy_until IS NOT NULL AND busy_until > ?`
    )
    .get(locationId, nowMs()) as { n: number };
  return row.n;
}

async function listForage(playerLocationId: string): Promise<AreaCrowd & { biasLocationId: string | null }> {
  const strain = await readStrain(FORAGE_STRAIN_ID);
  const row = await getDb()
    .prepare("SELECT cools_at FROM area_strain WHERE location_id = ?")
    .get(FORAGE_STRAIN_ID) as { cools_at: number } | undefined;
  const cooldownMs = strain > 0 && row && row.cools_at > nowMs() ? row.cools_at - nowMs() : 0;
  const bias = locationById[playerLocationId]?.searchEnergy ? playerLocationId : null;
  return {
    locationId: FORAGE_STRAIN_ID,
    searchers: await countSearchers(FORAGE_STRAIN_ID),
    strain,
    cooldownMs,
    nextSearchCost: searchEnergyCost(FORAGE_STRAIN_ID, strain),
    biasLocationId: bias,
  };
}

async function listAreas(playerLocationId = "town"): Promise<AreaCrowd[]> {
  const forage = await listForage(playerLocationId);
  return [forage];
}

async function marketPrints(itemId: string, limit = MV_PRINTS) {
  return await getDb()
    .prepare(
      `SELECT price, quantity, buy_user_id, sell_user_id FROM trades WHERE item_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(itemId, limit) as { price: number; quantity: number; buy_user_id: number; sell_user_id: number }[];
}

async function marketPrice(itemId: string) {
  const base = itemById[itemId]?.basePrice ?? 1;
  return computeFairValue(base, [...(await marketPrints(itemId))].reverse());
}

async function isGov(userId: number) {
  const row = await getDb()
    .prepare("SELECT COALESCE(is_gov, 0) AS is_gov FROM users WHERE id = ?")
    .get(userId) as { is_gov: number } | undefined;
  return Boolean(row?.is_gov);
}

async function isBot(userId: number) {
  const row = await getDb()
    .prepare("SELECT COALESCE(is_bot, 0) AS is_bot FROM users WHERE id = ?")
    .get(userId) as { is_bot: number } | undefined;
  return Boolean(row?.is_bot);
}

function tradeDeskName(username: string, treasury: boolean) {
  if (treasury || username === DESK_USERNAME || username === "Banker") return DESK_USERNAME;
  return username;
}

async function recordTrade(
  itemId: string,
  price: number,
  quantity: number,
  buyUserId: number,
  sellUserId: number,
  buyTreasury = false,
  sellTreasury = false
) {
  const deskId = buyTreasury || sellTreasury ? await ensureDeskUser() : 0;
  await getDb()
    .prepare(
      `INSERT INTO trades (item_id, price, quantity, buy_user_id, sell_user_id, created_at, buy_treasury, sell_treasury)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      itemId,
      price,
      quantity,
      buyTreasury ? deskId : buyUserId,
      sellTreasury ? deskId : sellUserId,
      nowMs(),
      buyTreasury ? 1 : 0,
      sellTreasury ? 1 : 0
    );
}

async function executeFill(
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
    await db.prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(
      price * quantity,
      buy.user_id
    );
  }
  if (!govSell) {
    await db.prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(
      price * quantity,
      sell.user_id
    );
  }
  if (!govSell) await removeItem(sell.user_id, itemId, quantity);
  if (!govBuy) await addItem(buy.user_id, itemId, quantity, price);
  const buyLeft = buy.remaining - quantity;
  const sellLeft = sell.remaining - quantity;
  if (buyLeft <= 0) await db.prepare("DELETE FROM orders WHERE id = ?").run(buy.id);
  else await db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(buyLeft, buy.id);
  if (sellLeft <= 0) await db.prepare("DELETE FROM orders WHERE id = ?").run(sell.id);
  else await db.prepare("UPDATE orders SET remaining = ? WHERE id = ?").run(sellLeft, sell.id);
  await recordTrade(itemId, price, quantity, buy.user_id, sell.user_id, govBuy, govSell);
  bustPriceSheet();
  if (buy.user_id !== sell.user_id) {
    if (!await isBot(buy.user_id)) await awardFirstTradeVp(buy.user_id);
    if (!await isBot(sell.user_id)) await awardFirstTradeVp(sell.user_id);
    if (!await isBot(sell.user_id)) {
      await getDb()
        .prepare("UPDATE players SET board_fills = COALESCE(board_fills, 0) + 1 WHERE user_id = ?")
        .run(sell.user_id);
    }
  }
  await noteIssuedCap(itemId);
}

async function matchItem(itemId: string) {
  const db = getDb();
  while (true) {
    const buy = await db
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
    const sell = await db
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
      const ask = sell.find((row) => {
        if (bid.price < row.price) return false;
        if (row.user_id !== bid.user_id) return true;
        return Boolean(row.treasury) !== Boolean(bid.treasury);
      });
      if (ask) {
        pair = { buy: bid, sell: ask };
        break;
      }
    }
    if (!pair) break;
    let qty = Math.min(pair.buy.remaining, pair.sell.remaining);
    if (pair.sell.treasury) {
      const room = await remainingToIssue(itemId);
      if (room <= 0) {
        await db.prepare("DELETE FROM orders WHERE id = ?").run(pair.sell.id);
        continue;
      }
      qty = Math.min(qty, room);
    }
    await executeFill(pair.buy, pair.sell, itemId, qty, pair.sell.price);
  }
  bustPriceSheet();
}

async function requireIdle(userId: number) {
  await resolveBusy(userId);
  const player = await loadPlayerRow(userId);
  if (player.busy_type !== "idle" && player.busy_until && player.busy_until > nowMs()) {
    throw new Error("You are already busy. Wait, or leave and come back later.");
  }
}

function utcDayKey(now = nowMs()) {
  return new Date(now).toISOString().slice(0, 10);
}

async function touchDaily(userId: number, dayKey: string) {
  await getDb()
    .prepare(
      `INSERT INTO player_daily (user_id, day_key, first_trade, special_sold, login_paid)
       VALUES (?, ?, 0, '', 0)
       ON CONFLICT(user_id, day_key) DO NOTHING`
    )
    .run(userId, dayKey);
}

async function grantDailyLogin(userId: number, _timeZone?: string) {
  const name = (await loadPlayerRow(userId)).username;
  if (name === "Banker" || name === DESK_USERNAME) return null;
  const slot = stipendSlotKey(Date.now(), await stipendMs());
  await touchDaily(userId, slot);
  const row = await getDb()
    .prepare(
      "SELECT COALESCE(login_paid, 0) AS login_paid FROM player_daily WHERE user_id = ? AND day_key = ?"
    )
    .get(userId, slot) as { login_paid: number } | undefined;
  const paidDays = await getDb()
    .prepare("SELECT COALESCE(login_days, 0) AS login_days FROM players WHERE user_id = ?")
    .get(userId) as { login_days: number } | undefined;
  if (row?.login_paid) return null;
  const created = await getDb()
    .prepare("SELECT created_at FROM users WHERE id = ?")
    .get(userId) as { created_at: number } | undefined;
  if (created && stipendSlotKey(created.created_at, await stipendMs()) === slot) {
    await getDb()
      .prepare("UPDATE player_daily SET login_paid = 1 WHERE user_id = ? AND day_key = ?")
      .run(userId, slot);
    return null;
  }
  const next = (paidDays?.login_days ?? 0) + 1;
  const amount = dailyDeposit(next, await readStipendLadder());
  await getDb()
    .prepare("UPDATE players SET gold = gold + ?, login_days = ? WHERE user_id = ?")
    .run(amount, next, userId);
  await getDb()
    .prepare("UPDATE player_daily SET login_paid = 1 WHERE user_id = ? AND day_key = ?")
    .run(userId, slot);
  if (!await isBot(userId)) {
    await setEvent(userId, `Coin drop: +${formatCoins(amount)} (drop ${formatNumber(next)}).`);
  }
  return { amount, day: next, justPaid: !await isBot(userId) };
}

async function seatedBotUsernames(db: ReturnType<typeof getDb> = getDb()) {
  return BOT_PROFILES.slice(0, await computerCount(db)).map((bot) => bot.username);
}

function humanAtTableSql() {
  return `COALESCE(is_bot, 0) = 0 AND COALESCE(is_gov, 0) = 0 AND username NOT IN ('Banker', 'Government', 'Guest')
    AND COALESCE((SELECT at_table FROM players WHERE user_id = id), 1) = 1`;
}

async function tableSeatWhere(db: ReturnType<typeof getDb> = getDb()) {
  const names = await seatedBotUsernames(db);
  if (names.length === 0) {
    return {
      sql: humanAtTableSql(),
      params: [] as string[],
    };
  }
  const slots = names.map(() => "?").join(", ");
  return {
    sql: `(${humanAtTableSql()} OR username IN (${slots}))`,
    params: names,
  };
}

async function travelerCount(db: ReturnType<typeof getDb> = getDb()) {
  return (
    await db
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE ${humanAtTableSql()}`)
      .get() as { n: number }
  ).n;
}

async function tableSeatIds() {
  const { sql, params } = await tableSeatWhere();
  return await getDb()
    .prepare(`SELECT id FROM users WHERE ${sql} ORDER BY username COLLATE NOCASE`)
    .all(...params) as { id: number }[];
}

async function payTableStipends(viewerId: number, timeZone?: string) {
  let mine: { amount: number; day: number; justPaid: boolean } | null = null;
  for (const row of await tableSeatIds()) {
    const notice = await grantDailyLogin(row.id, timeZone);
    if (row.id === viewerId) mine = notice;
  }
  return mine;
}

async function awardVp(userId: number, amount: number) {
  if (amount <= 0 || await isBot(userId)) return;
  await getDb().prepare("UPDATE players SET vp = COALESCE(vp, 0) + ? WHERE user_id = ?").run(amount, userId);
}

async function awardFirstTradeVp(userId: number) {
  const day = utcDayKey();
  await touchDaily(userId, day);
  const row = await getDb()
    .prepare("SELECT first_trade FROM player_daily WHERE user_id = ? AND day_key = ?")
    .get(userId, day) as { first_trade: number } | undefined;
  if (!row || row.first_trade) return;
  await getDb()
    .prepare("UPDATE player_daily SET first_trade = 1 WHERE user_id = ? AND day_key = ?")
    .run(userId, day);
  await awardVp(userId, 1);
}

async function addBuff(userId: number, kind: BuffKind, charges: number, power: number) {
  const row = await getDb()
    .prepare("SELECT charges, power FROM player_buffs WHERE user_id = ? AND kind = ?")
    .get(userId, kind) as { charges: number; power: number } | undefined;
  if (!row) {
    await getDb()
      .prepare(
        "INSERT INTO player_buffs (user_id, kind, charges, power) VALUES (?, ?, ?, ?)"
      )
      .run(userId, kind, charges, power);
    return;
  }
  await getDb()
    .prepare(
      "UPDATE player_buffs SET charges = ?, power = ? WHERE user_id = ? AND kind = ?"
    )
    .run(row.charges + charges, Math.max(row.power, power), userId, kind);
}

async function takeBuff(userId: number, kind: BuffKind) {
  const row = await getDb()
    .prepare("SELECT charges, power FROM player_buffs WHERE user_id = ? AND kind = ?")
    .get(userId, kind) as { charges: number; power: number } | undefined;
  if (!row || row.charges <= 0) return null;
  if (row.charges <= 1) {
    await getDb().prepare("DELETE FROM player_buffs WHERE user_id = ? AND kind = ?").run(userId, kind);
  } else {
    await getDb()
      .prepare("UPDATE player_buffs SET charges = charges - 1 WHERE user_id = ? AND kind = ?")
      .run(userId, kind);
  }
  return { power: row.power };
}

async function listBuffs(userId: number) {
  const rows = await getDb()
    .prepare("SELECT kind, charges, power FROM player_buffs WHERE user_id = ? AND charges > 0")
    .all(userId) as { kind: BuffKind; charges: number; power: number }[];
  return rows.map((row) => ({
    kind: row.kind,
    charges: row.charges,
    power: row.power,
    label: describeBuff(row.kind, row.charges, row.power),
  }));
}

export async function consumeItem(userId: number, itemId: string) {
  await resolveBusy(userId);
  const food = foodById[itemId];
  if (food) {
    if (await availableItem(userId, itemId) < 1) {
      throw new Error("You do not have a free one to eat.");
    }
    const player = await loadPlayerRow(userId);
    const max = player.energy_max ?? ENERGY_MAX;
    if ((player.energy ?? 0) >= max) {
      throw new Error("You are already full.");
    }
    await removeItem(userId, itemId, 1);
    const next = Math.min(max, (player.energy ?? 0) + food.energy);
    await getDb().prepare("UPDATE players SET energy = ? WHERE user_id = ?").run(next, userId);
    const item = itemById[itemId];
    await setEvent(
      userId,
      `You eat ${item.emoji} ${item.name}. +${food.energy} energy (${next}/${max}).`
    );
    return;
  }
  const consumable = consumableById[itemId];
  if (!consumable) throw new Error("That cannot be used.");
  if (await availableItem(userId, itemId) < 1) {
    throw new Error("You do not have a free one to use.");
  }
  await removeItem(userId, itemId, 1);
  const player = await loadPlayerRow(userId);
  const max = player.energy_max ?? ENERGY_MAX;
  let healed = 0;
  if (consumable.energy) {
    const next = Math.min(max, (player.energy ?? 0) + consumable.energy);
    healed = next - (player.energy ?? 0);
    await getDb().prepare("UPDATE players SET energy = ? WHERE user_id = ?").run(next, userId);
  }
  await addBuff(userId, consumable.kind, consumable.charges, consumable.power);
  const item = itemById[itemId];
  const healNote = healed > 0 ? ` +${healed} energy.` : "";
  await setEvent(
    userId,
    `${consumable.verb} ${item.emoji} ${item.name}.${healNote} ${buffLabel[consumable.kind]} is ready.`
  );
}

export async function arriveAt(userId: number, locationId: string) {
  await resolveBusy(userId);
  const dest = locationById[locationId];
  if (!dest) throw new Error("Unknown place. That check-in code is not on the map.");
  const player = await loadPlayerRow(userId);
  if (player.location_id === locationId) {
    await setEvent(userId, `You are already at ${dest.emoji} ${dest.name}.`);
    return;
  }
  const interrupted =
    player.busy_type !== "idle" && Boolean(player.busy_until && player.busy_until > nowMs());
  await getDb()
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

export async function startTravel(userId: number, locationId: string) {
  await requireIdle(userId);
  const dest = locationById[locationId];
  if (!dest) throw new Error("Unknown place on the map.");
  const player = await loadPlayerRow(userId);
  if (player.location_id === locationId) throw new Error("You are already there.");
  let seconds = travelSeconds(player.location_id, locationId);
  const haste = await takeBuff(userId, "travel_haste");
  if (haste) {
    seconds = Math.max(6, Math.round((seconds * haste.power) / 100));
  }
  const ends = nowMs() + seconds * 1000;
  await getDb()
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

export async function startSearch(userId: number) {
  await requireIdle(userId);
  const player = await loadPlayerRow(userId);
  const strain = await bumpStrain(FORAGE_STRAIN_ID);
  const calm = await takeBuff(userId, "search_calm");
  const cheap = await takeBuff(userId, "search_cheap");
  const yieldBuff = await takeBuff(userId, "search_yield");
  const luck = await takeBuff(userId, "search_luck");
  const double = await takeBuff(userId, "search_double");
  const skipCommon = await takeBuff(userId, "search_skip_common");
  const cost = cheap ? 1 : searchEnergyCost(FORAGE_STRAIN_ID, calm ? 0 : strain);
  const energy = player.energy ?? 0;
  const max = player.energy_max ?? ENERGY_MAX;
  if (energy < cost) {
    throw new Error(
      `You are too tired (${energy} energy). Eat berries or fish.`
    );
  }
  const nextEnergy = energy - cost;
  await getDb()
    .prepare("UPDATE players SET energy = ? WHERE user_id = ?")
    .run(nextEnergy, userId);
  const bias = locationById[player.location_id]?.searchEnergy ? player.location_id : null;
  const biome = pickForageBiome(bias);
  const place = locationById[biome];
  const bits = await grantSearchLoot(userId, {
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
  await setEvent(
    userId,
    `Searched the grounds (${place?.emoji ?? ""} ${place?.name ?? "wilds"}).${crowdNote}${findNote} ${nextEnergy}/${max} left.${
      extras.length ? ` (${extras.join(", ")})` : ""
    }`
  );
}

export async function startMine(userId: number) {
  await startSearch(userId);
}

async function insertLiveOrder(
  userId: number,
  itemId: string,
  side: "buy" | "sell",
  price: number,
  quantity: number,
  treasury: boolean
) {
  const info = await getDb()
    .prepare(
      "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at, treasury) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(userId, itemId, side, price, quantity, nowMs(), treasury ? 1 : 0);
  return Number(info.lastInsertRowid);
}

async function requireOpenGame() {
  await maybeStartScheduledGame();
  if ((await readGamePhase()) === "lobby") {
    throw new Error("The desk is in the lobby. Trading starts when Jesse’s clock hits the start time.");
  }
  if ((await readGameOver()).over) throw new Error("The game is over. Jesse can start a new game from Admin.");
}

export async function placeOrder(
  userId: number,
  itemId: string,
  side: "buy" | "sell",
  price: number,
  quantity: number
) {
  await resolveBusy(userId);
  await requireOpenGame();
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  const treasury = await isGov(userId);
  const px = treasury ? Math.max(1, Math.round(await marketPrice(itemId))) : price;
  if (!treasury && (!Number.isInteger(price) || price < 1)) {
    throw new Error("Price must be a whole number of at least 1.");
  }
  const maxQty = treasury ? 999 : 99;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQty) {
    throw new Error(
      treasury
        ? "Quantity must be a whole number from 1 to 999."
        : "Quantity must be a whole number from 1 to 99."
    );
  }
  if (side === "buy" && !treasury && await availableGold(userId) < px * quantity) {
    throw new Error("Not enough free coin. Cancel a bid or sell something.");
  }
  if (side === "sell" && !treasury && await availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock. Cancel a sell order first.");
  }
  if (treasury && side === "sell") {
    const room = Math.max(0, await remainingToIssue(itemId) - await listedTreasuryAsks(itemId));
    if (quantity > room) {
      throw new Error(
        room <= 0
          ? `Nothing left to issue. Outstanding already meets Authorized (${formatNumber(await authorizedOf(itemId))}).`
          : `Only ${formatNumber(room)} left to issue under Authorized (${formatNumber(await authorizedOf(itemId))}).`
      );
    }
  }
  const ids: number[] = [];
  for (let n = 0; n < quantity; n += 1) {
    ids.push(await insertLiveOrder(userId, itemId, side, px, 1, treasury));
  }
  await matchItem(itemId);
  let resting = 0;
  for (const id of ids) {
    const live = await loadLiveOrder(id);
    if (live) resting += live.remaining;
  }
  const filled = Math.max(0, quantity - resting);
  await setEvent(
    userId,
    treasury
      ? side === "buy"
        ? `Treasury bid: will burn ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(px)} (MV).`
        : `Treasury ask: will mint ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(px)} (MV).`
      : filled > 0 && resting === 0
        ? `Filled ${item.emoji} ${item.name} ×${formatNumber(filled)} at ${formatCoins(px)}.`
        : filled > 0
          ? `Filled ${item.emoji} ${item.name} ×${formatNumber(filled)} at ${formatCoins(px)}; ${formatNumber(resting)} still on the book.`
          : side === "buy"
            ? `Bid posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(px)}.`
            : `Ask posted: ${item.emoji} ${item.name} ×${formatNumber(quantity)} at ${formatCoins(px)}.`
  );
  return { filled, resting };
}

type LiveOrder = {
  id: number;
  user_id: number;
  item_id: string;
  side: string;
  price: number;
  remaining: number;
  treasury: number;
};

async function loadLiveOrder(orderId: number) {
  return (await getDb()
    .prepare(
      "SELECT id, user_id, item_id, side, price, remaining, COALESCE(treasury, 0) AS treasury FROM orders WHERE id = ? AND remaining > 0"
    )
    .get(orderId)) as LiveOrder | undefined;
}

async function findLiveQuote(
  userId: number,
  hint?: {
    itemId?: string;
    side?: string;
    price?: number;
    treasury?: boolean;
  }
) {
  const itemId = hint?.itemId;
  const side = hint?.side;
  const price = hint?.price;
  if (!itemId || (side !== "buy" && side !== "sell") || !Number.isInteger(price) || (price ?? 0) < 1) {
    return undefined;
  }
  const treasury = hint.treasury ? 1 : 0;
  return (await getDb()
    .prepare(
      `SELECT id, user_id, item_id, side, price, remaining, COALESCE(treasury, 0) AS treasury
       FROM orders
       WHERE item_id = ? AND side = ? AND price = ? AND remaining > 0
         AND COALESCE(treasury, 0) = ?
         AND user_id != ?
       ORDER BY created_at ASC, id ASC
       LIMIT 1`
    )
    .get(itemId, side, price, treasury, userId)) as LiveOrder | undefined;
}

export async function takeOrder(
  userId: number,
  orderId: number,
  quantity = 1,
  hint?: { itemId?: string; side?: string; price?: number; treasury?: boolean }
) {
  await resolveBusy(userId);
  await requireOpenGame();
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose how many to take.");
  }
  await getDb().transaction(async () => {
    let order = await loadLiveOrder(orderId);
    if (!order) order = await findLiveQuote(userId, hint);
    if (!order) {
      throw new Error("That quote just filled. The book moved — tap another.");
    }
    const treasuryQuote = Boolean(order.treasury);
    if (order.user_id === userId && !treasuryQuote) throw new Error("That is your own order.");
    let fillQty = Math.min(quantity, order.remaining);
    if (order.side === "sell" && treasuryQuote) {
      const room = await remainingToIssue(order.item_id);
      if (room <= 0) throw new Error("Nothing left to issue under Authorized.");
      fillQty = Math.min(fillQty, room);
    }

    if (order.side === "sell") {
      if (await availableGold(userId) < order.price * fillQty) {
        throw new Error("Not enough coin to take that ask.");
      }
      const buyId = await insertLiveOrder(userId, order.item_id, "buy", order.price, fillQty, false);
      await executeFill(
        { id: buyId, user_id: userId, price: order.price, remaining: fillQty, treasury: 0 },
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
      if (await availableItem(userId, order.item_id) < fillQty) {
        throw new Error("Not enough stock to fill that bid.");
      }
      const sellId = await insertLiveOrder(userId, order.item_id, "sell", order.price, fillQty, false);
      await executeFill(
        {
          id: order.id,
          user_id: order.user_id,
          price: order.price,
          remaining: order.remaining,
          treasury: order.treasury,
        },
        { id: sellId, user_id: userId, price: order.price, remaining: fillQty, treasury: 0 },
        order.item_id,
        fillQty,
        order.price
      );
    }
    const item = itemById[order.item_id];
    await setEvent(
      userId,
      treasuryQuote && order.side === "sell"
        ? `Treasury minted ${item.emoji} ${item.name} ×${formatNumber(fillQty)} into your pack at ${formatCoins(order.price)}.`
        : treasuryQuote && order.side === "buy"
          ? `Sold into the treasury: ${item.emoji} ${item.name} ×${formatNumber(fillQty)} at ${formatCoins(order.price)}.`
          : `Filled ${item.emoji} ${item.name} ×${formatNumber(fillQty)} at ${formatCoins(order.price)}.`
    );
  });
}

export async function cancelOrder(userId: number, orderId: number, quantity = 1) {
  await cancelOrders(userId, [orderId], quantity);
}

export async function cancelOrders(userId: number, orderIds: number[], quantity = Infinity) {
  await resolveBusy(userId);
  const ids = [...new Set(orderIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) throw new Error("Choose what to pull.");
  let left = Number.isFinite(quantity) ? quantity : Number.POSITIVE_INFINITY;
  if (Number.isFinite(quantity) && (!Number.isInteger(quantity) || quantity < 1)) {
    throw new Error("Choose how many to cancel.");
  }
  let pulled = 0;
  for (const orderId of ids) {
    if (left < 1) break;
    const order = await getDb()
      .prepare("SELECT id, user_id, remaining FROM orders WHERE id = ?")
      .get(orderId) as { id: number; user_id: number; remaining: number } | undefined;
    if (!order || order.user_id !== userId) continue;
    const pull = Math.min(order.remaining, left);
    if (pull < 1) continue;
    if (pull >= order.remaining) {
      await getDb().prepare("DELETE FROM orders WHERE id = ?").run(orderId);
    } else {
      await getDb()
        .prepare("UPDATE orders SET remaining = remaining - ? WHERE id = ?")
        .run(pull, orderId);
    }
    pulled += pull;
    left -= pull;
  }
  if (pulled < 1) throw new Error("You cannot cancel that.");
  await setEvent(userId, pulled === 1 ? "Pulled 1 from the board." : `Pulled ${formatNumber(pulled)} from the board.`);
}

export async function canHoldOffice(userId: number) {
  const row = await getDb()
    .prepare("SELECT username FROM users WHERE id = ?")
    .get(userId) as { username: string } | undefined;
  return Boolean(row && isOfficeUsername(row.username));
}

async function requireOffice(userId: number) {
  if (!await canHoldOffice(userId)) throw new Error("That office is locked.");
}

export async function setGovernment(userId: number, on: boolean) {
  await resolveBusy(userId);
  await requireOffice(userId);
  if (await isBot(userId)) throw new Error("Plaza regulars cannot hold office.");
  await getDb().prepare("UPDATE users SET is_gov = ? WHERE id = ?").run(on ? 1 : 0, userId);
  if (on) {
    await setEvent(
      userId,
      "You hold the treasury. Quotes always sit at MV. Asks mint until Outstanding reaches Authorized. Bids pay sellers with new coin and burn the goods."
    );
  } else {
    await setEvent(
      userId,
      "You left office. Treasury quotes stay on the book until they fill or you cancel them. Outstanding changes when they trade, not when you post."
    );
  }
}

async function isAdmin(userId: number) {
  const row = await getDb()
    .prepare("SELECT COALESCE(is_admin, 0) AS is_admin FROM users WHERE id = ?")
    .get(userId) as { is_admin: number } | undefined;
  return Boolean(row?.is_admin);
}

async function requireAdmin(userId: number) {
  if (!await canHoldOffice(userId)) throw new Error("Admin mode is off.");
}

export async function setAdmin(userId: number, on: boolean) {
  await resolveBusy(userId);
  await requireOffice(userId);
  if (await isBot(userId)) throw new Error("Plaza regulars cannot open admin.");
  await getDb().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(on ? 1 : 0, userId);
  await setEvent(userId, on ? "Admin mode on. Set coins, pack qty, or start a new game." : "Admin mode off.");
}

export async function enterDesk(userId: number) {
  const db = getDb();
  if (await isGov(userId)) await db.prepare("UPDATE users SET is_gov = 0 WHERE id = ?").run(userId);
  if (await isAdmin(userId)) await db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
  if (await isBot(userId)) return;
  const row = await db
    .prepare(
      "SELECT COALESCE(at_table, 1) AS at_table, gold, COALESCE(login_days, 0) AS login_days FROM players WHERE user_id = ?"
    )
    .get(userId) as { at_table: number; gold: number; login_days: number } | undefined;
  if (!row || row.at_table) return;
  const start = await startingGold(db);
  const tablePaid = await tablePaidDrops(db, userId);
  const extra = stipendCatchUp(await readStipendLadder(db), row.login_days, tablePaid);
  const gold = Math.max(row.gold, start) + extra;
  const loginDays = Math.max(row.login_days, tablePaid);
  const note =
    extra > 0
      ? `You sat down with ${formatCoins(start)} plus ${formatNumber(tablePaid - row.login_days)} coin drop${
          tablePaid - row.login_days === 1 ? "" : "s"
        } the table already had (${formatCoins(extra)}). The opening split already went out.`
      : `You sat down with ${formatCoins(Math.max(row.gold, start))} and an empty pack. The opening split already went out.`;
  await db.prepare(
    "UPDATE players SET at_table = 1, gold = ?, login_days = ?, last_event = ? WHERE user_id = ?"
  ).run(gold, loginDays, note, userId);
  await markStipendSlotPaid(userId, db);
}

export async function enterAdmin(userId: number) {
  await resolveBusy(userId);
  await requireOffice(userId);
  if (await isBot(userId)) throw new Error("Plaza regulars cannot open admin.");
  const db = getDb();
  if (await isGov(userId)) await db.prepare("UPDATE users SET is_gov = 0 WHERE id = ?").run(userId);
  if (!await isAdmin(userId)) {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(userId);
    await setEvent(userId, "You are in the admin office.");
  }
}

export async function enterGovernment(userId: number) {
  await resolveBusy(userId);
  await requireOffice(userId);
  if (await isBot(userId)) throw new Error("Plaza regulars cannot hold office.");
  const db = getDb();
  if (await isAdmin(userId)) await db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
  if (!await isGov(userId)) {
    await db.prepare("UPDATE users SET is_gov = 1 WHERE id = ?").run(userId);
    await setEvent(
      userId,
      "You hold the treasury. Quotes always sit at MV. Asks mint until Outstanding reaches Authorized. Bids pay sellers with new coin and burn the goods."
    );
  }
}

export async function adminSetStartingGold(userId: number, gold: number) {
  await requireAdmin(userId);
  if (!Number.isInteger(gold) || gold < 0 || gold > MAX_STARTING_GOLD) {
    throw new Error(`Starting coins must be a whole number from 0 to ${MAX_STARTING_GOLD.toLocaleString("en-US")}.`);
  }
  await setStartingGold(gold);
  await setEvent(userId, `New travelers now start with ${formatCoins(gold)}. Late joiners also get coin drops the table already had.`);
}

export async function adminSetStipend(userId: number, ms: number) {
  await requireAdmin(userId);
  if (!STIPEND_PRESETS.some((row) => row.ms === ms)) {
    throw new Error("Pick a listed coin-drop interval.");
  }
  await setStipendMs(ms);
  await setEvent(userId, `Coin drops now every ${stipendLabel(ms)}.`);
}

export async function adminSetStipendLadder(userId: number, amounts: number[]) {
  await requireAdmin(userId);
  const ladder = validateStipendLadder(amounts);
  await writeStipendLadder(ladder);
  await setEvent(
    userId,
    `Coin drop ladder saved. ${formatNumber(ladder.length)} level${ladder.length === 1 ? "" : "s"}. First drop ${formatCoins(ladder[0])}.`
  );
}

async function coinDropSnapshot(userId: number) {
  const ms = await stipendMs();
  const now = nowMs();
  const slot = stipendSlotKey(now, ms);
  const paid = await getDb()
    .prepare("SELECT COALESCE(login_paid, 0) AS login_paid FROM player_daily WHERE user_id = ? AND day_key = ?")
    .get(userId, slot) as { login_paid: number } | undefined;
  const days = await getDb()
    .prepare("SELECT COALESCE(login_days, 0) AS login_days FROM players WHERE user_id = ?")
    .get(userId) as { login_days: number } | undefined;
  const keys = await getDb()
    .prepare("SELECT day_key FROM player_daily WHERE user_id = ? AND COALESCE(login_paid, 0) = 1")
    .all(userId) as { day_key: string }[];
  let lastSlotKey: string | null = paid?.login_paid ? slot : null;
  let lastStart = lastSlotKey ? parseStipendSlotKey(lastSlotKey)?.start ?? 0 : 0;
  for (const row of keys) {
    const parsed = parseStipendSlotKey(row.day_key);
    if (!parsed) continue;
    if (!lastSlotKey || parsed.start > lastStart) {
      lastSlotKey = row.day_key;
      lastStart = parsed.start;
    }
  }
  return {
    ladder: await readStipendLadder(),
    loginDays: days?.login_days ?? 0,
    lastSlotKey,
    paidThisSlot: Boolean(paid?.login_paid),
  };
}

async function adminSeat(actorId: number, targetUserId?: number) {
  await requireAdmin(actorId);
  const id = targetUserId && Number.isInteger(targetUserId) && targetUserId > 0 ? targetUserId : actorId;
  const row = await getDb()
    .prepare("SELECT id, username FROM users WHERE id = ?")
    .get(id) as { id: number; username: string } | undefined;
  if (!row) throw new Error("No such traveler.");
  if (row.username === "Banker" || row.username === DESK_USERNAME) {
    throw new Error("Leave the desk accounts alone.");
  }
  return row;
}

export async function adminUpdateAccount(
  actorId: number,
  targetUserId: number,
  username: string,
  password?: string
) {
  await requireAdmin(actorId);
  const db = getDb();
  const target = await db
    .prepare("SELECT id, username, COALESCE(is_bot, 0) AS is_bot FROM users WHERE id = ?")
    .get(targetUserId) as { id: number; username: string; is_bot: number } | undefined;
  if (
    !target ||
    target.is_bot ||
    ["Banker", DESK_USERNAME, "Guest"].some(
      (reserved) => target.username.localeCompare(reserved, undefined, { sensitivity: "base" }) === 0
    )
  ) {
    throw new Error("Choose a human traveler account.");
  }
  if (target.username.localeCompare(OFFICE_USERNAME, undefined, { sensitivity: "accent" }) === 0) {
    throw new Error("The admin account cannot be edited here.");
  }

  const nextUsername = normalizeUsername(username);
  const usernameError = validateUsername(nextUsername);
  if (usernameError) throw new Error(usernameError);
  const nextPassword = password == null ? "" : String(password);
  if (nextPassword) {
    const passwordError = validatePassword(nextPassword);
    if (passwordError) throw new Error(passwordError);
  }
  const duplicate = await db
    .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?")
    .get(nextUsername, target.id) as { id: number } | undefined;
  if (duplicate) throw new Error("That traveler name is already taken.");

  if (nextPassword) {
    await db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?").run(
      nextUsername,
      bcrypt.hashSync(nextPassword, 10),
      target.id
    );
  } else {
    await db.prepare("UPDATE users SET username = ? WHERE id = ?").run(nextUsername, target.id);
  }
  await setEvent(
    actorId,
    target.id === actorId
      ? "Admin updated your account."
      : `Admin updated ${nextUsername}'s account.`
  );
}

export async function adminSetGold(userId: number, gold: number, targetUserId?: number) {
  const target = await adminSeat(userId, targetUserId);
  if (!Number.isInteger(gold) || gold < 0 || gold > 9_999_999) {
    throw new Error("Coins must be a whole number from 0 to 9,999,999.");
  }
  await getDb().prepare("UPDATE players SET gold = ? WHERE user_id = ?").run(gold, target.id);
  await setEvent(
    userId,
    target.id === userId
      ? `Admin set coins to ${formatCoins(gold)}.`
      : `Admin set ${target.username}'s coins to ${formatCoins(gold)}.`
  );
}

export async function adminSetItem(userId: number, itemId: string, quantity: number, targetUserId?: number) {
  const target = await adminSeat(userId, targetUserId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9_999) {
    throw new Error("Quantity must be a whole number from 0 to 9,999.");
  }
  const db = getDb();
  if (quantity === 0) {
    await db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(target.id, itemId);
  } else {
    const unit = await marketPrice(itemId);
    await db.prepare(
      `INSERT INTO inventory (user_id, item_id, quantity, cost_basis) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity, cost_basis = excluded.cost_basis`
    ).run(target.id, itemId, quantity, unit * quantity);
  }
  await alignIssuedToAuthorized();
  await setEvent(
    userId,
    target.id === userId
      ? `Admin set ${item.emoji} ${item.name} to ${formatNumber(quantity)}.`
      : `Admin set ${target.username}'s ${item.emoji} ${item.name} to ${formatNumber(quantity)}.`
  );
}

export async function adminSetIssued(userId: number, itemId: string, authorized: number) {
  await requireAdmin(userId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(authorized) || authorized < 1 || authorized > 99_999) {
    throw new Error("Issued must be a whole number from 1 to 99,999.");
  }
  await setItemAuthorized(itemId, authorized);
  await clampFloatedToAuthorized(itemId, authorized);
  await alignIssuedToAuthorized(true);
  await setEvent(userId, `Issued ${item.emoji} ${item.name} is now ${formatNumber(authorized)}.`);
}

export async function adminAddShare(
  userId: number,
  draft: { name: string; emoji?: string; image?: string | null }
) {
  await requireAdmin(userId);
  if (items.length >= MAX_SHARE_TYPES) {
    throw new Error(`The table can list at most ${MAX_SHARE_TYPES} share types.`);
  }
  const next = validateShareDraft(draft);
  const id = shareIdFromName(
    next.name,
    items.map((item) => item.id)
  );
  await insertShareType({
    id,
    name: next.name,
    emoji: next.emoji,
    image: next.image,
    basePrice: 10,
    authorized: 15,
  });
  await alignIssuedToAuthorized(true);
  const item = itemById[id];
  await setEvent(
    userId,
    `Added ${item?.emoji ?? next.emoji} ${next.name} to the share structure. Issued 15 at MV 10. Set Issued if you want a different float.`
  );
}

export async function adminRemoveShare(userId: number, itemId: string) {
  await requireAdmin(userId);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown share type.");
  if (items.length <= MIN_SHARE_TYPES) {
    throw new Error("Keep at least one share type on the table.");
  }
  const goal = await readGoal();
  const needs = goal.needs.filter((need) => need.itemId !== itemId);
  if (needs.length !== goal.needs.length) await writeGoal({ ...goal, needs });
  await removeShareType(itemId);
  await alignIssuedToAuthorized(true);
  await setEvent(userId, `Removed ${item.emoji} ${item.name} from the share structure.`);
}

async function dealOpeningShares(db: ReturnType<typeof getDb>, travelerIds: number[]) {
  const seats = travelerIds.length;
  if (seats === 0) return;
  const grant = db.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity, cost_basis) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET
       quantity = excluded.quantity,
       cost_basis = excluded.cost_basis`
  );
  for (const item of items) {
    const issued = await authorizedOf(item.id);
    if (issued < 1) continue;
    const each = Math.floor(issued / seats);
    if (each < 1) continue;
    const unit = Math.max(1, Math.round(item.basePrice));
    for (const travelerId of travelerIds) {
      await grant.run(travelerId, item.id, each, unit * each);
    }
  }
}

function formatStartClock(atMs: number, timeZone?: string) {
  try {
    return new Date(atMs).toLocaleString("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return new Date(atMs).toISOString();
  }
}

async function officeUserId() {
  const row = (await getDb()
    .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
    .get(OFFICE_USERNAME)) as { id: number } | undefined;
  return row?.id ?? 0;
}

const startClock = globalThis as unknown as { bazaarScheduledStart?: Promise<boolean> };

export async function maybeStartScheduledGame() {
  if (startClock.bazaarScheduledStart) return startClock.bazaarScheduledStart;
  const run = (async () => {
    if ((await readGamePhase()) !== "lobby") return false;
    const at = await readScheduledStartAt();
    if (at == null || Date.now() < at) return false;
    const actor = await officeUserId();
    await runNewGame(actor, undefined);
    await writeGamePhase("live");
    await writeScheduledStartAt(null);
    return true;
  })();
  startClock.bazaarScheduledStart = run;
  try {
    return await run;
  } finally {
    if (startClock.bazaarScheduledStart === run) startClock.bazaarScheduledStart = undefined;
  }
}

async function runNewGame(userId: number, count?: number) {
  if (count != null && (!Number.isInteger(count) || count < 0 || count > MAX_COMPUTERS)) {
    throw new Error(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
  }
  const db = getDb();
  const dayKey = stipendSlotKey(Date.now(), await stipendMs());
    await db.transaction(async () => {
    await seedBots(db);
    await setComputerCount(count ?? await computerCount(db), db);
    await clearGameOver(db);
    const goal = await readGoal(db);
    await writeGoal(
      {
        ...goal,
        endsAt: goal.mode === "timed" ? Date.now() + goal.durationMs : null,
      },
      db
    );
    await db.exec(`
      DELETE FROM swap_legs;
      DELETE FROM swap_offers;
      DELETE FROM orders;
      DELETE FROM trades;
      DELETE FROM inventory;
      DELETE FROM item_float;
      DELETE FROM player_buffs;
      DELETE FROM player_daily;
      DELETE FROM player_rumors;
      DELETE FROM stall_crates;
      DELETE FROM contract_completions;
      DELETE FROM festival_contracts;
      DELETE FROM area_strain;
    `);
    const { sql, params } = await tableSeatWhere(db);
    const seats = await db
      .prepare(`SELECT id FROM users WHERE ${sql} ORDER BY username COLLATE NOCASE`)
      .all(...params) as { id: number }[];
    const seatIds = seats.map((row) => row.id);
    await db.prepare(
      `UPDATE players SET gold = ?, energy = ?, energy_max = ?, busy_type = 'idle', busy_until = NULL,
         busy_payload = NULL, last_event = ?, login_days = 0, has_won = 0, won_at = NULL
       WHERE user_id IN (
         SELECT id FROM users WHERE ${sql}
       )`
    ).run(
      await startingGold(db),
      ENERGY_MAX,
      ENERGY_MAX,
      `A new game. ${formatNumber(await startingGold(db))} coins and an even opening pack for every traveler and seated computer.`,
      ...params
    );
    const seatedNames = await seatedBotUsernames(db);
    if (seatedNames.length === 0) {
      await db.prepare(
        `UPDATE players SET gold = 0, last_event = 'Sitting this table out.'
         WHERE user_id IN (SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1)`
      ).run();
    } else {
      const slots = seatedNames.map(() => "?").join(", ");
      await db.prepare(
        `UPDATE players SET gold = 0, last_event = 'Sitting this table out.'
         WHERE user_id IN (
           SELECT id FROM users
           WHERE COALESCE(is_bot, 0) = 1 AND username NOT IN (${slots})
         )`
      ).run(...seatedNames);
    }
    await db.prepare(
      `UPDATE players SET gold = 0, last_event = 'Sitting this table out.'
       WHERE COALESCE(at_table, 1) = 0
         AND user_id IN (
           SELECT id FROM users
           WHERE COALESCE(is_bot, 0) = 0 AND username NOT IN ('Banker', 'Government', 'Guest')
         )`
    ).run();
    await db.prepare(
      `UPDATE players SET gold = 0, last_event = 'The treasury desk is open.'
       WHERE user_id IN (SELECT id FROM users WHERE username IN ('Banker', 'Government'))`
    ).run();
    await dealOpeningShares(db, seatIds);
    const mark = db.prepare(
      `INSERT INTO player_daily (user_id, day_key, first_trade, special_sold, login_paid)
       VALUES (?, ?, 0, '', 1)
       ON CONFLICT(user_id, day_key) DO UPDATE SET login_paid = 1`
    );
    for (const row of seats) await mark.run(row.id, dayKey);
  });
  deskClock.bazaarDeskFloat = 0;
  await alignIssuedToAuthorized(true);
  const bots = await computerCount();
  const leftoverNote =
    " Leftover units stay in the treasury for the government to sell at MV.";
  await setEvent(
    userId,
    bots > 0
      ? `New game started. Every traveler and ${formatNumber(bots)} computer${
          bots === 1 ? "" : "s"
        } got ${formatNumber(await startingGold())} coins and floor(Issued ÷ seats) of each good.${leftoverNote}`
      : `New game started. Every traveler got ${formatNumber(await startingGold())} coins and floor(Issued ÷ seats) of each good.${leftoverNote}`
  );
}

export async function adminStartGame(userId: number, _timeZone?: string, count?: number) {
  await requireAdmin(userId);
  await runNewGame(userId, count);
  await writeGamePhase("live");
  await writeScheduledStartAt(null);
}

export async function adminScheduleStart(
  userId: number,
  atMs: number,
  timeZone?: string,
  count?: number
) {
  await requireAdmin(userId);
  if (count != null && (!Number.isInteger(count) || count < 0 || count > MAX_COMPUTERS)) {
    throw new Error(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
  }
  if (count != null) await setComputerCount(count);
  const when = Math.floor(Number(atMs));
  if (!Number.isFinite(when) || when < 1) {
    throw new Error("Pick a start time.");
  }
  if (when <= Date.now() + 1500) {
    await runNewGame(userId, count);
    await writeGamePhase("live");
    await writeScheduledStartAt(null);
    return;
  }
  await writeScheduledStartAt(when);
  await writeGamePhase("lobby");
  await setEvent(
    userId,
    `Lobby is open. New game starts at ${formatStartClock(when, timeZone)}.`
  );
}

export async function adminClearSchedule(userId: number) {
  await requireAdmin(userId);
  await writeScheduledStartAt(null);
  await writeGamePhase("live");
  await setEvent(userId, "Start time cleared. The desk is live again.");
}

export async function adminSetInviteCode(userId: number, code: string) {
  await requireAdmin(userId);
  const next = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,24}$/.test(next)) {
    throw new Error("Invite code: 4–24 letters or numbers.");
  }
  await writeInviteCode(next);
  await setEvent(userId, `Invite code is now ${next}.`);
}

async function applyComputerSeats(db: ReturnType<typeof getDb>, count: number) {
  await seedBots(db);
  const next = await setComputerCount(count, db);
  const seated = new Set(await seatedBotUsernames(db));
  const bots = await db
    .prepare("SELECT id, username FROM users WHERE COALESCE(is_bot, 0) = 1")
    .all() as { id: number; username: string }[];
  const sitOutIds: number[] = [];
  const seatIds: number[] = [];
  for (const row of bots) {
    if (seated.has(row.username)) seatIds.push(row.id);
    else sitOutIds.push(row.id);
  }
  if (sitOutIds.length > 0) {
    const slots = sitOutIds.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM orders WHERE user_id IN (${slots})`).run(...sitOutIds);
    await db.prepare(`DELETE FROM inventory WHERE user_id IN (${slots})`).run(...sitOutIds);
    await db.prepare(
      `UPDATE players SET gold = 0, last_event = 'Sitting this table out.' WHERE user_id IN (${slots})`
    ).run(...sitOutIds);
  }
  if (seatIds.length > 0) {
    const pay = db.prepare(
      `UPDATE players SET gold = ?, last_event = ?
       WHERE user_id = ? AND gold = 0`
    );
    for (const id of seatIds) {
      await pay.run(await startingGold(db), "A computer trader keeping the book honest.", id);
    }
  }
  return next;
}

export async function adminSetComputerCount(userId: number, count: number) {
  await requireAdmin(userId);
  if (!Number.isInteger(count) || count < 0 || count > MAX_COMPUTERS) {
    throw new Error(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
  }
  const db = getDb();
  let next = count;
  await db.transaction(async () => {
    next = await applyComputerSeats(db, count);
  });
  deskClock.bazaarDeskFloat = 0;
  await alignIssuedToAuthorized(true);
  await setEvent(
    userId,
    next === 0
      ? "All computers sat out. Their packs went back to the treasury."
      : `${formatNumber(next)} computer${next === 1 ? "" : "s"} at the table. Sitting-out packs went back to the treasury.`
  );
}

export async function adminSetComputers(userId: number, on: boolean) {
  const seated = await computerCount();
  await adminSetComputerCount(userId, on ? (seated > 0 ? seated : MAX_COMPUTERS) : 0);
}

export async function adminSitOtherTravelers(userId: number) {
  await requireAdmin(userId);
  const db = getDb();
  const others = await db
    .prepare(
      `SELECT id FROM users
       WHERE id != ? AND COALESCE(is_bot, 0) = 0 AND COALESCE(is_gov, 0) = 0
         AND username NOT IN ('Banker', 'Government')`
    )
    .all(userId) as { id: number }[];
  if (others.length === 0) {
    await db.prepare("UPDATE players SET at_table = 1 WHERE user_id = ?").run(userId);
    await setEvent(userId, "You are the only traveler at the table.");
    return;
  }
  const ids = others.map((row) => row.id);
  await db.transaction(async () => {
    await db.prepare("UPDATE players SET at_table = 1 WHERE user_id = ?").run(userId);
    const slots = ids.map(() => "?").join(", ");
    await db.prepare(`DELETE FROM orders WHERE user_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM inventory WHERE user_id IN (${slots})`).run(...ids);
    await db.prepare(
      `UPDATE players SET at_table = 0, gold = 0, last_event = 'Sitting this table out.'
       WHERE user_id IN (${slots})`
    ).run(...ids);
  });
  deskClock.bazaarDeskFloat = 0;
  await alignIssuedToAuthorized(true);
  await setEvent(
    userId,
    `${formatNumber(ids.length)} other traveler${ids.length === 1 ? "" : "s"} sat out. Their packs went back to the treasury. You are the only traveler at the table.`
  );
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

function mapTrade(row: {
  id: number;
  item_id: string;
  price: number;
  quantity: number;
  created_at: number;
  buy_name: string;
  sell_name: string;
  buy_treasury?: number;
  sell_treasury?: number;
}): TradeRow {
  return {
    id: row.id,
    itemId: row.item_id,
    price: row.price,
    quantity: row.quantity,
    createdAt: row.created_at,
    buyUsername: tradeDeskName(row.buy_name, Boolean(row.buy_treasury)),
    sellUsername: tradeDeskName(row.sell_name, Boolean(row.sell_treasury)),
  };
}

async function loadRecentTrades(limit: number, itemId?: string): Promise<TradeRow[]> {
  const sql = `SELECT t.id, t.item_id, t.price, t.quantity, t.created_at,
              b.username AS buy_name, s.username AS sell_name,
              COALESCE(t.buy_treasury, 0) AS buy_treasury,
              COALESCE(t.sell_treasury, 0) AS sell_treasury
       FROM trades t
       JOIN users b ON b.id = t.buy_user_id
       JOIN users s ON s.id = t.sell_user_id
       ${itemId ? "WHERE t.item_id = ?" : ""}
       ORDER BY t.id DESC
       LIMIT ?`;
  const rows = (
    itemId
      ? await getDb().prepare(sql).all(itemId, limit)
      : await getDb().prepare(sql).all(limit)
  ) as {
    id: number;
    item_id: string;
    price: number;
    quantity: number;
    created_at: number;
    buy_name: string;
    sell_name: string;
    buy_treasury: number;
    sell_treasury: number;
  }[];
  return rows.map(mapTrade);
}

async function loadItemChartTrades(itemId: string): Promise<TradeRow[]> {
  const since = nowMs() - (CHART_MINUTES + 1) * MINUTE_MS;
  const sql = `SELECT t.id, t.item_id, t.price, t.quantity, t.created_at,
              b.username AS buy_name, s.username AS sell_name,
              COALESCE(t.buy_treasury, 0) AS buy_treasury,
              COALESCE(t.sell_treasury, 0) AS sell_treasury
       FROM trades t
       JOIN users b ON b.id = t.buy_user_id
       JOIN users s ON s.id = t.sell_user_id
       WHERE t.item_id = ? AND t.created_at >= ?
       ORDER BY t.id ASC`;
  const rows = await getDb()
    .prepare(sql)
    .all(itemId, since) as {
    id: number;
    item_id: string;
    price: number;
    quantity: number;
    created_at: number;
    buy_name: string;
    sell_name: string;
    buy_treasury: number;
    sell_treasury: number;
  }[];
  if (rows.length > 0) return rows.map(mapTrade);
  return [...(await loadRecentTrades(80, itemId))].reverse();
}

function requireOpenStall(stallId: string, clock: FestivalClock) {
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  if (!stallOpen(stall, clock)) {
    throw new Error(`${stall.name} is closed. Come back during ${stall.hoursLabel.toLowerCase()}`);
  }
  return stall;
}

async function ensureContracts(clock: FestivalClock) {
  const week = weekId(clock.dateKey);
  const db = getDb();
  for (const template of contractsForWeek(week)) {
    const id = `${week}:${template.id}`;
    const existing = await db.prepare("SELECT id FROM festival_contracts WHERE id = ?").get(id);
    if (existing) continue;
    await db.prepare(
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

async function crateRow(stallId: string, key: string) {
  return await getDb()
    .prepare("SELECT user_id, used FROM stall_crates WHERE stall_id = ? AND window_key = ?")
    .get(stallId, key) as { user_id: number; used: number } | undefined;
}

async function usernameOf(userId: number) {
  const row = await getDb().prepare("SELECT username FROM users WHERE id = ?").get(userId) as
    | { username: string }
    | undefined;
  return row?.username ?? "Someone";
}

async function applySpecialHourVp(userId: number, stallId: string) {
  const day = utcDayKey();
  await touchDaily(userId, day);
  const row = await getDb()
    .prepare("SELECT special_sold FROM player_daily WHERE user_id = ? AND day_key = ?")
    .get(userId, day) as { special_sold: string } | undefined;
  const seen = new Set((row?.special_sold ?? "").split(",").filter(Boolean));
  if (seen.has(stallId)) return false;
  seen.add(stallId);
  await getDb()
    .prepare("UPDATE player_daily SET special_sold = ? WHERE user_id = ? AND day_key = ?")
    .run([...seen].join(","), userId, day);
  await awardVp(userId, 1);
  return true;
}

export async function sellToStall(
  userId: number,
  stallId: string,
  itemId: string,
  quantity: number,
  timeZone?: string
) {
  await requireIdle(userId);
  const clock = festivalClock(timeZone);
  const stall = requireOpenStall(stallId, clock);
  const item = itemById[itemId];
  if (!item) throw new Error("Unknown item.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a quantity.");
  if (!stall.buyIds.includes(itemId)) {
    throw new Error(`${stall.name} is not buying ${item.name} today.`);
  }
  if (await availableItem(userId, itemId) < quantity) {
    throw new Error("Not enough unbound stock.");
  }
  const chalk = chalkboardItem(stall.id, clock.dateKey);
  let rate = stallBuyRate(stall, itemId, clock, chalk);
  const key = windowKey(stall.id, clock);
  const crate = await crateRow(stall.id, key);
  const crateBonus = crate && crate.user_id === userId && !crate.used;
  if (crateBonus) rate += 0.1;
  const mv = await marketPrice(itemId);
  const payEach = Math.max(1, Math.round(mv * rate));
  const total = payEach * quantity;
  await removeItem(userId, itemId, quantity);
  await getDb()
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
    await getDb()
      .prepare("UPDATE stall_crates SET used = 1 WHERE stall_id = ? AND window_key = ?")
      .run(stall.id, key);
  }
  const special = itemId === chalk;
  const specialVp = special ? await applySpecialHourVp(userId, stall.id) : false;
  await setEvent(
    userId,
    `${stall.emoji} ${stall.name} bought ${item.emoji} ${item.name} ×${formatNumber(quantity)} for ${formatCoins(total)} (${Math.round(rate * 100)}% of MV).${
      crateBonus ? " Crate bonus applied." : ""
    }${specialVp ? " +1 VP for the chalkboard hour." : ""}`
  );
}

export async function buyFromStall(
  userId: number,
  stallId: string,
  itemId: string,
  quantity: number,
  timeZone?: string
) {
  await requireIdle(userId);
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
  const price = stallSellPrice(itemId, await marketPrice(itemId));
  const total = price * quantity;
  if (await availableGold(userId) < total) throw new Error("Not enough free coin.");
  await getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(total, userId);
  await addItem(userId, itemId, quantity, price);
  await setEvent(
    userId,
    `Bought ${item.emoji} ${item.name} ×${formatNumber(quantity)} from ${stall.name} for ${formatCoins(total)}.`
  );
}

export async function buyRumor(userId: number, stallId: string, timeZone?: string) {
  await requireIdle(userId);
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  const clock = festivalClock(timeZone);
  const tomorrow = shiftDateKey(clock.dateKey, 1);
  const already = await getDb()
    .prepare("SELECT 1 FROM player_rumors WHERE user_id = ? AND stall_id = ? AND for_date = ?")
    .get(userId, stallId, tomorrow);
  if (already) throw new Error("You already paid for tomorrow's chalkboard.");
  if (await availableGold(userId) < RUMOR_COST) throw new Error("Not enough free coin for a rumor.");
  await getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(RUMOR_COST, userId);
  await getDb()
    .prepare("INSERT INTO player_rumors (user_id, stall_id, for_date) VALUES (?, ?, ?)")
    .run(userId, stallId, tomorrow);
  const item = itemById[chalkboardItem(stallId, tomorrow)];
  await setEvent(
    userId,
    `${stall.name} leans in: tomorrow the chalkboard is ${item?.emoji ?? ""} ${item?.name ?? "something odd"}.`
  );
}

export async function rentCrate(userId: number, stallId: string, timeZone?: string) {
  await requireIdle(userId);
  const stall = stallById[stallId];
  if (!stall) throw new Error("That stall is not on the plaza.");
  const clock = festivalClock(timeZone);
  const key = windowKey(stallId, clock);
  const existing = await crateRow(stallId, key);
  if (existing) {
    throw new Error(
      existing.user_id === userId
        ? "You already rented that crate."
        : `${await usernameOf(existing.user_id)} already reserved this window.`
    );
  }
  if (await availableGold(userId) < CRATE_COST) throw new Error("Not enough free coin to rent a crate.");
  await getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(CRATE_COST, userId);
  await getDb()
    .prepare("INSERT INTO stall_crates (stall_id, window_key, user_id, used) VALUES (?, ?, ?, 0)")
    .run(stallId, key, userId);
  await setEvent(
    userId,
    stallOpen(stall, clock)
      ? `You rented a crate at ${stall.name} for this window. Your next sale here gets a 10% bump.`
      : `You reserved a crate at ${stall.name}'s next window. Your stack sells with a 10% bump.`
  );
}

async function contractNeed(itemId: string, userId: number) {
  if (itemId === "*food") {
    let sum = 0;
    for (const id of FOOD_ITEM_IDS) sum += await availableItem(userId, id);
    return sum;
  }
  return availableItem(userId, itemId);
}

async function takeContractItems(userId: number, itemId: string, quantity: number) {
  if (itemId !== "*food") {
    await removeItem(userId, itemId, quantity);
    return;
  }
  let left = quantity;
  for (const foodId of FOOD_ITEM_IDS) {
    if (left <= 0) break;
    const have = await availableItem(userId, foodId);
    const take = Math.min(have, left);
    if (take > 0) {
      await removeItem(userId, foodId, take);
      left -= take;
    }
  }
  if (left > 0) throw new Error("Not enough food for that contract.");
}

export async function completeContract(userId: number, contractId: string, timeZone?: string) {
  await requireIdle(userId);
  const clock = festivalClock(timeZone);
  const row = await getDb()
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
  const done = await getDb()
    .prepare("SELECT 1 FROM contract_completions WHERE contract_id = ? AND user_id = ?")
    .get(contractId, userId);
  if (done) throw new Error("You already finished that job.");
  const stall = requireOpenStall(row.stall_id, clock);
  if (await contractNeed(row.item_id, userId) < row.quantity) {
    throw new Error("You do not have enough for that job yet.");
  }
  await takeContractItems(userId, row.item_id, row.quantity);
  if (row.gold > 0) {
    await getDb()
      .prepare("UPDATE players SET gold = gold + ?, gold_from_stalls = COALESCE(gold_from_stalls, 0) + ? WHERE user_id = ?")
      .run(row.gold, row.gold, userId);
  }
  if (isFoodItem(row.item_id) || row.item_id === "*food") {
    await getDb()
      .prepare("UPDATE players SET food_delivered = COALESCE(food_delivered, 0) + ? WHERE user_id = ?")
      .run(row.quantity, userId);
  }
  if (isLegendaryItem(row.item_id)) {
    await getDb()
      .prepare("UPDATE players SET legendary_turnins = COALESCE(legendary_turnins, 0) + ? WHERE user_id = ?")
      .run(row.quantity, userId);
  }
  await getDb()
    .prepare("INSERT INTO contract_completions (contract_id, user_id, completed_at) VALUES (?, ?, ?)")
    .run(contractId, userId, nowMs());
  await awardVp(userId, row.vp);
  await setEvent(
    userId,
    `${stall.emoji} ${stall.name} stamps "${row.title}". +${row.vp} VP${
      row.gold > 0 ? ` and ${formatCoins(row.gold)}` : ""
    }.`
  );
}

export async function donateLanterns(userId: number) {
  await requireIdle(userId);
  const player = await loadPlayerRow(userId);
  const cost = donationCost(player.donate_count ?? 0);
  if (await availableGold(userId) < cost) {
    throw new Error(`The festival desk wants ${formatCoins(cost)} for the next lantern.`);
  }
  await getDb()
    .prepare(
      `UPDATE players
       SET gold = gold - ?, gold_donated = COALESCE(gold_donated, 0) + ?, donate_count = COALESCE(donate_count, 0) + 1
       WHERE user_id = ?`
    )
    .run(cost, cost, userId);
  await awardVp(userId, 1);
  await setEvent(userId, `You sponsor a plaza lantern for ${formatCoins(cost)}. +1 VP.`);
}

async function listContracts(userId: number, clock: FestivalClock): Promise<ContractView[]> {
  await ensureContracts(clock);
  const rows = await getDb()
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
      await getDb()
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

async function listStallViews(userId: number, clock: FestivalClock, prices: MarketPrice[]): Promise<StallView[]> {
  const rumors = new Set(
    (
      await getDb()
        .prepare("SELECT stall_id FROM player_rumors WHERE user_id = ? AND for_date = ?")
        .all(userId, shiftDateKey(clock.dateKey, 1)) as { stall_id: string }[]
    ).map((row) => row.stall_id)
  );
  const views: StallView[] = [];
  for (const stall of stalls) {
    const open = stallOpen(stall, clock);
    const change = nextStallChange(stall, clock);
    const chalk = chalkboardItem(stall.id, clock.dateKey);
    const tomorrow = chalkboardItem(stall.id, shiftDateKey(clock.dateKey, 1));
    const key = windowKey(stall.id, clock);
    const crate = await crateRow(stall.id, key);
    const mvOf = (itemId: string) =>
      prices.find((row) => row.itemId === itemId)?.vwap ?? itemById[itemId]?.basePrice ?? 1;
    views.push({
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
      crateReservedBy: crate ? await usernameOf(crate.user_id) : null,
      crateYours: crate?.user_id === userId,
      crateUsed: Boolean(crate?.used),
      windowKey: key,
    });
  }
  return views;
}

async function listTitles(): Promise<FestivalTitle[]> {
  const rows = await getDb()
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

export async function getOrderBook(itemId: string): Promise<OrderBook> {
  const rows = await getDb()
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
    history: await getPriceHistory(itemId),
    trades: coalesceTrades(await loadRecentTrades(80, itemId)).slice(0, 25),
    chartTrades: await loadItemChartTrades(itemId),
  };
}

export async function getPriceHistory(itemId: string): Promise<PricePoint[]> {
  const rows = await getDb()
    .prepare(
      `SELECT created_at, price FROM trades WHERE item_id = ? ORDER BY id DESC LIMIT ${MV_PRINTS}`
    )
    .all(itemId) as { created_at: number; price: number }[];
  return [...rows].reverse().map((row) => ({ at: row.created_at, price: row.price }));
}

async function bookDepth() {
  const map: Record<string, { listed: number; wanted: number }> = {};
  const rows = await getDb()
    .prepare(
      `SELECT item_id, side, COALESCE(SUM(remaining), 0) AS qty
       FROM orders
       WHERE remaining > 0 AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
         AND COALESCE(treasury, 0) = 0
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

async function packTotals() {
  const rows = await getDb()
    .prepare(
      `SELECT i.item_id, COALESCE(SUM(i.quantity), 0) AS qty
       FROM inventory i JOIN users u ON u.id = i.user_id
       WHERE u.username NOT IN ('Banker', 'Government')
       GROUP BY i.item_id`
    )
    .all() as { item_id: string; qty: number }[];
  return Object.fromEntries(rows.map((row) => [row.item_id, row.qty])) as Record<string, number>;
}

async function qtyByItem(sql: string, params: unknown[] = []) {
  const rows = await getDb()
    .prepare(sql)
    .all(...params) as { item_id: string; qty: number }[];
  const map: Record<string, number> = {};
  for (const row of rows) map[row.item_id] = row.qty;
  return map;
}

async function authorizedOf(itemId: string) {
  return await getItemAuthorized(itemId);
}

async function outstandingOf(itemId: string) {
  const row = await getDb()
    .prepare(
      `SELECT COALESCE(SUM(i.quantity), 0) AS qty
       FROM inventory i JOIN users u ON u.id = i.user_id
       WHERE i.item_id = ? AND u.username NOT IN ('Banker', 'Government')`
    )
    .get(itemId) as { qty: number };
  return row.qty;
}

async function listedTreasuryAsks(itemId: string) {
  const row = await getDb()
    .prepare(
      `SELECT COALESCE(SUM(remaining), 0) AS qty FROM orders
       WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND COALESCE(treasury, 0) = 1
         AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')`
    )
    .get(itemId) as { qty: number };
  return row.qty;
}

async function listedTreasuryBids(itemId: string) {
  const row = await getDb()
    .prepare(
      `SELECT COALESCE(SUM(remaining), 0) AS qty FROM orders
       WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND COALESCE(treasury, 0) = 1
         AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')`
    )
    .get(itemId) as { qty: number };
  return row.qty;
}

async function remainingToIssue(itemId: string) {
  return Math.max(0, await authorizedOf(itemId) - await outstandingOf(itemId));
}

async function shareStructure(itemId: string, outstanding: number) {
  const authorized = await authorizedOf(itemId);
  const issued = authorized;
  return {
    authorized,
    issued,
    treasury: Math.max(0, issued - outstanding),
  };
}

async function ensureDeskUser() {
  const db = getDb();
  const row = await db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(DESK_USERNAME) as { id: number } | undefined;
  if (!row) throw new Error("Treasury desk is missing.");
  await db.prepare("UPDATE users SET is_gov = 1 WHERE id = ?").run(row.id);
  return row.id;
}

async function clearDeskBook(userId: number, itemId: string, side: "buy" | "sell") {
  await getDb()
    .prepare(
      "DELETE FROM orders WHERE user_id = ? AND item_id = ? AND side = ? AND COALESCE(treasury, 0) = 1"
    )
    .run(userId, itemId, side);
}

async function postDeskQuotes(userId: number, itemId: string, side: "buy" | "sell", quantity: number, price: number) {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty < 1 || price < 1) return;
  for (let n = 0; n < qty; n += 1) {
    await insertLiveOrder(userId, itemId, side, price, 1, true);
  }
  await matchItem(itemId);
}

const deskClock = globalThis as unknown as { bazaarDeskFloat?: number };

async function listedDeskQty(deskId: number, itemId: string, side: "buy" | "sell") {
  const row = await getDb()
    .prepare(
      `SELECT COALESCE(SUM(remaining), 0) AS qty FROM orders
       WHERE user_id = ? AND item_id = ? AND side = ? AND remaining > 0 AND COALESCE(treasury, 0) = 1`
    )
    .get(deskId, itemId, side) as { qty: number };
  return row.qty;
}

async function listedDeskPrice(deskId: number, itemId: string, side: "buy" | "sell") {
  const row = await getDb()
    .prepare(
      `SELECT price FROM orders
       WHERE user_id = ? AND item_id = ? AND side = ? AND remaining > 0 AND COALESCE(treasury, 0) = 1
       LIMIT 1`
    )
    .get(deskId, itemId, side) as { price: number } | undefined;
  return row?.price ?? null;
}

async function snapTreasuryPricesToMv() {
  const db = getDb();
  for (const item of items) {
    const mv = Math.max(1, Math.round(await marketPrice(item.id)));
    const info = await db
      .prepare(
        `UPDATE orders SET price = ?
         WHERE remaining > 0 AND COALESCE(treasury, 0) = 1 AND item_id = ? AND price != ?`
      )
      .run(mv, item.id, mv);
    if (info.changes > 0) await matchItem(item.id);
  }
}

async function clampFloatedToAuthorized(itemId: string, authorized: number) {
  const stored = await floatedOf(itemId);
  if (stored <= authorized) return;
  await getDb()
    .prepare("UPDATE item_float SET floated = ? WHERE item_id = ?")
    .run(Math.min(await outstandingOf(itemId), authorized), itemId);
}

async function alignIssuedToAuthorized(force = false) {
  const deskId = await ensureDeskUser();
  for (const item of items) {
    const authorized = await authorizedOf(item.id);
    await clampFloatedToAuthorized(item.id, authorized);
    await noteIssuedCap(item.id);
    const mv = Math.max(1, Math.round(await marketPrice(item.id)));
    const outstanding = await outstandingOf(item.id);
    const floated = await floatedOf(item.id);
    let wantBuy = 0;
    let wantSell = 0;
    if (outstanding > authorized) wantBuy = outstanding - authorized;
    else if (outstanding < authorized && floated < authorized) wantSell = authorized - outstanding;
    const deskBids = await listedDeskQty(deskId, item.id, "buy");
    const deskAsks = await listedDeskQty(deskId, item.id, "sell");
    const otherBids = Math.max(0, await listedTreasuryBids(item.id) - deskBids);
    const otherAsks = Math.max(0, await listedTreasuryAsks(item.id) - deskAsks);
    const needBuy = Math.max(0, wantBuy - otherBids);
    const needSell = Math.max(0, wantSell - otherAsks);
    const bidPx = await listedDeskPrice(deskId, item.id, "buy");
    const askPx = await listedDeskPrice(deskId, item.id, "sell");
    const buyOk = deskBids === needBuy && (needBuy === 0 || bidPx === mv);
    const sellOk = deskAsks === needSell && (needSell === 0 || askPx === mv);
    if (force || !buyOk || !sellOk) {
      await clearDeskBook(deskId, item.id, "buy");
      await clearDeskBook(deskId, item.id, "sell");
      if (needBuy > 0) await postDeskQuotes(deskId, item.id, "buy", needBuy, mv);
      if (needSell > 0) await postDeskQuotes(deskId, item.id, "sell", needSell, mv);
    }
  }
  await snapTreasuryPricesToMv();
}

async function floatedOf(itemId: string) {
  const row = await getDb()
    .prepare("SELECT floated FROM item_float WHERE item_id = ?")
    .get(itemId) as { floated: number } | undefined;
  return row?.floated ?? 0;
}

async function setFloated(itemId: string, floated: number) {
  await getDb()
    .prepare(
      `INSERT INTO item_float (item_id, floated) VALUES (?, ?)
       ON CONFLICT(item_id) DO UPDATE SET floated = MAX(item_float.floated, excluded.floated)`
    )
    .run(itemId, floated);
}

async function noteIssuedCap(itemId: string) {
  const authorized = await authorizedOf(itemId);
  if (authorized <= 0) return;
  if (await outstandingOf(itemId) < authorized) return;
  await setFloated(itemId, authorized);
  const desk = await getDb()
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(DESK_USERNAME) as { id: number } | undefined;
  if (desk) await clearDeskBook(desk.id, itemId, "sell");
}

async function netWorthLeaders(prices: MarketPrice[]): Promise<LeaderRow[]> {
  const db = getDb();
  const mv = new Map(prices.map((row) => [row.itemId, row.vwap]));
  const { sql, params } = await tableSeatWhere(db);
  const purses = await db
    .prepare(
      `SELECT u.id, u.username, p.gold
       FROM players p JOIN users u ON u.id = p.user_id
       WHERE ${sql}`
    )
    .all(...params) as { id: number; username: string; gold: number }[];
  const stacks = await db
    .prepare("SELECT user_id, item_id, quantity FROM inventory WHERE quantity > 0")
    .all() as { user_id: number; item_id: string; quantity: number }[];
  const goods = new Map<number, number>();
  const holdings = new Map<number, Record<string, number>>();
  for (const row of stacks) {
    const unit = mv.get(row.item_id) ?? itemById[row.item_id]?.basePrice ?? 0;
    goods.set(row.user_id, (goods.get(row.user_id) ?? 0) + row.quantity * unit);
    const bag = holdings.get(row.user_id) ?? {};
    bag[row.item_id] = (bag[row.item_id] ?? 0) + row.quantity;
    holdings.set(row.user_id, bag);
  }
  return purses
    .map((row) => {
      const itemValue = goods.get(row.id) ?? 0;
      return {
        username: row.username,
        gold: row.gold,
        goods: itemValue,
        holdings: holdings.get(row.id) ?? {},
        netWorth: row.gold + itemValue,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username))
    .map((row, index) => ({
      place: index + 1,
      username: row.username,
      gold: row.gold,
      goods: row.goods,
      holdings: row.holdings,
      netWorth: row.netWorth,
    }));
}

async function markWinnerName(username: string, now: number) {
  const user = await getDb()
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: number } | undefined;
  if (!user) return;
  await getDb()
    .prepare("UPDATE players SET has_won = 1, won_at = COALESCE(won_at, ?) WHERE user_id = ?")
    .run(now, user.id);
}

async function resolveGoal(leaders: LeaderRow[], viewerId: number) {
  const now = nowMs();
  let goal = await readGoal();
  const current = await readGameOver();
  if (current.over) return { goal, over: current };
  if (goal.mode === "timed") {
    const endsAt = goal.endsAt ?? now + goal.durationMs;
    if (goal.endsAt == null) {
      goal = { ...goal, endsAt };
      await writeGoal(goal);
    }
    if (now < endsAt) return { goal, over: current };
    const winner = sortByGoal(leaders, goal)[0]?.username ?? null;
    const over = { over: true, winner, endedAt: now, reason: "time" as const };
    await writeGameOver(over);
    if (winner) await markWinnerName(winner, now);
    if (winner === (await loadPlayerRow(viewerId)).username) {
      await setEvent(viewerId, `Game over. You had the most ${goal.score === "gold" ? "coins" : goal.score === "items" ? "of those goods" : "net worth"}.`);
    }
    return { goal, over };
  }
  const crossed = sortByGoal(
    leaders.filter((row) => meetsGoal(row, goal)),
    goal
  );
  const winner = crossed[0]?.username;
  if (!winner) return { goal, over: current };
  const over = { over: true, winner, endedAt: now, reason: "threshold" as const };
  await writeGameOver(over);
  await markWinnerName(winner, now);
  if (winner === (await loadPlayerRow(viewerId)).username) {
    await setEvent(viewerId, "Game over. You hit the mark.");
  }
  return { goal, over };
}

export async function adminSetGoal(userId: number, draft: Partial<GoalConfig>) {
  await requireAdmin(userId);
  const now = nowMs();
  const goal = validateGoalDraft(draft);
  const next: GoalConfig = {
    ...goal,
    endsAt: goal.mode === "timed" ? now + goal.durationMs : null,
  };
  await writeGoal(next);
  await clearGameOver();
  await setEvent(userId, `Goal set. ${describeGoal(next)}`);
}

async function priceSheet(timeZone?: string): Promise<MarketPrice[]> {
  const tz = timeZone || "UTC";
  const hit = sheetCache.bazaarSheet;
  if (hit && hit.tz === tz && Date.now() - hit.at < 450) return hit.data;
  const data = await buildPriceSheet(tz);
  sheetCache.bazaarSheet = { at: Date.now(), tz, data };
  return data;
}

const sheetCache = globalThis as unknown as {
  bazaarSheet?: { at: number; tz: string; data: MarketPrice[] };
};

function bustPriceSheet() {
  sheetCache.bazaarSheet = undefined;
}

async function buildPriceSheet(timeZone: string): Promise<MarketPrice[]> {
  const db = getDb();
  const dayStart = startOfLocalDayMs(timeZone);
  const [depth, packs, todayRows, statRows, lastRows, bidRows, askRows, capRows] = await Promise.all([
    bookDepth(),
    packTotals(),
    db
      .prepare(
        "SELECT item_id, COUNT(*) AS qty FROM trades WHERE created_at >= ? GROUP BY item_id"
      )
      .all(dayStart) as Promise<{ item_id: string; qty: number }[]>,
    db
      .prepare(
        "SELECT item_id, SUM(price * quantity) AS notional, SUM(quantity) AS volume, MAX(id) AS last_id FROM trades GROUP BY item_id"
      )
      .all() as Promise<{ item_id: string; notional: number | null; volume: number | null; last_id: number | null }[]>,
    db
      .prepare(
        `SELECT t.item_id, t.price FROM trades t
         JOIN (SELECT item_id, MAX(id) AS last_id FROM trades GROUP BY item_id) x ON t.id = x.last_id`
      )
      .all() as Promise<{ item_id: string; price: number }[]>,
    db
      .prepare(
        `SELECT item_id, MAX(price) AS p FROM orders
         WHERE side = 'buy' AND remaining > 0 AND COALESCE(treasury, 0) = 0
           AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
         GROUP BY item_id`
      )
      .all() as Promise<{ item_id: string; p: number | null }[]>,
    db
      .prepare(
        `SELECT item_id, MIN(price) AS p FROM orders
         WHERE side = 'sell' AND remaining > 0 AND COALESCE(treasury, 0) = 0
           AND user_id NOT IN (SELECT id FROM users WHERE username = 'Banker')
         GROUP BY item_id`
      )
      .all() as Promise<{ item_id: string; p: number | null }[]>,
    db.prepare("SELECT item_id, authorized FROM item_caps").all() as Promise<
      { item_id: string; authorized: number }[]
    >,
  ]);
  const tradesToday: Record<string, number> = {};
  for (const row of todayRows) tradesToday[row.item_id] = row.qty;
  const stats = new Map(statRows.map((row) => [row.item_id, row]));
  const lastPrice = new Map(lastRows.map((row) => [row.item_id, row.price]));
  const bids = new Map(bidRows.map((row) => [row.item_id, row.p]));
  const asks = new Map(askRows.map((row) => [row.item_id, row.p]));
  const caps = new Map(capRows.map((row) => [row.item_id, row.authorized]));
  const printLists = await Promise.all(items.map((item) => marketPrints(item.id, 120)));
  const sheet: MarketPrice[] = [];
  for (const [index, item] of items.entries()) {
    const itemId = item.id;
    const tapePrints = printLists[index] ?? [];
    const prints = tapePrints.slice(0, MV_PRINTS);
    const lastPrint = prints[0];
    const vwap = computeFairValue(itemById[itemId]?.basePrice ?? item.basePrice, [...prints].reverse());
    const book = depth[itemId] ?? { listed: 0, wanted: 0 };
    const outstanding = packs[itemId] ?? 0;
    const authorized =
      caps.get(itemId) && Number.isInteger(caps.get(itemId)) && (caps.get(itemId) ?? 0) > 0
        ? (caps.get(itemId) as number)
        : item.authorized ?? 0;
    const issued = authorized;
    sheet.push({
      itemId,
      vwap,
      last: lastPrint?.price ?? lastPrice.get(itemId) ?? null,
      lastQty: lastTapeQty(
        tapePrints.map((row) => ({
          price: row.price,
          quantity: row.quantity,
          buyUserId: row.buy_user_id,
          sellUserId: row.sell_user_id,
        }))
      ),
      windowOpen: prints.length ? prints[prints.length - 1].price : null,
      volume: stats.get(itemId)?.volume ?? 0,
      tradesToday: tradesToday[itemId] ?? 0,
      prints: prints.length,
      listed: book.listed,
      wanted: book.wanted,
      held: outstanding,
      authorized,
      issued,
      treasury: Math.max(0, issued - outstanding),
      bestBid: bids.get(itemId) ?? null,
      bestAsk: asks.get(itemId) ?? null,
    });
  }
  return sheet;
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

type BotQuoteRow = {
  id: number;
  item_id: string;
  side: "buy" | "sell";
  price: number;
  remaining: number;
  created_at: number;
};

async function chaseOneBotQuote(
  userId: number,
  style: BotProfile["style"],
  now: number,
  quote: BotQuoteRow
) {
  const waitMs = now - quote.created_at;
  const steps = waitSteps(waitMs);
  if (steps < 1) return false;
  if (steps === 1 && Math.random() < 0.35) return false;

  const itemId = quote.item_id;
  const fair = await marketPrice(itemId);
  const spread = botSpread(style);
  const slack = chaseSlack(spread, fair, waitMs);
  const impatient =
    steps >= 2 || Math.random() < Math.min(0.97, botLossChance(spread, fair) + steps * 0.1);
  const db = getDb();

  if (quote.side === "buy") {
    const ask = await db
      .prepare(
        `SELECT id, price, created_at FROM orders
         WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND user_id != ?
           AND COALESCE(treasury, 0) = 0
         ORDER BY price ASC, id ASC LIMIT 1`
      )
      .get(itemId, userId) as { id: number; price: number; created_at: number } | undefined;
    if (
      ask &&
      impatient &&
      botWillTake(spread, fair, "liftAsk", ask.price, true, slack, now - ask.created_at)
    ) {
      if (await availableGold(userId) < ask.price) return false;
      await cancelOrders(userId, [quote.id]);
      if (await availableGold(userId) >= ask.price) {
        await takeOrder(userId, ask.id, 1);
        return true;
      }
    }
    const next = chaseBidPrice(quote.price, fair, slack, steps);
    if (next > quote.price) {
      const extra = (next - quote.price) * quote.remaining;
      if (await availableGold(userId) < extra) return false;
      await db.prepare("UPDATE orders SET price = ? WHERE id = ?").run(next, quote.id);
      await matchItem(itemId);
      return true;
    }
    return false;
  }

  const bid = await db
    .prepare(
      `SELECT id, price FROM orders
       WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND user_id != ?
         AND COALESCE(treasury, 0) = 0
       ORDER BY price DESC, id ASC LIMIT 1`
    )
    .get(itemId, userId) as { id: number; price: number } | undefined;
  if (
    bid &&
    impatient &&
    botWillTake(spread, fair, "hitBid", bid.price, true, slack)
  ) {
    await cancelOrders(userId, [quote.id]);
    if (await availableItem(userId, itemId) >= 1) {
      await takeOrder(userId, bid.id, 1);
      return true;
    }
  }
  const next = chaseAskPrice(quote.price, fair, slack, steps);
  if (next < quote.price) {
    await db.prepare("UPDATE orders SET price = ? WHERE id = ?").run(next, quote.id);
    await matchItem(itemId);
    return true;
  }
  return false;
}

async function chaseStaleBotQuote(userId: number, style: BotProfile["style"], now: number) {
  const rows = await getDb()
    .prepare(
      `SELECT id, item_id, side, price, remaining, created_at
       FROM orders
       WHERE user_id = ? AND remaining > 0
       ORDER BY created_at ASC`
    )
    .all(userId) as BotQuoteRow[];
  let chased = 0;
  for (const quote of rows) {
    if (chased >= 4) break;
    if (await chaseOneBotQuote(userId, style, now, quote)) chased += 1;
  }
  return chased > 0;
}

export async function tickBots() {
  if ((await readGamePhase()) === "lobby") return;
  if ((await readGameOver()).over) return;
  if (!humanOnDesk()) return;
  const seated = await computerCount();
  if (seated < 1) return;
  const now = nowMs();
  if (botClock.bazaarBotTick && now - botClock.bazaarBotTick < 1200) return;
  botClock.bazaarBotTick = now;
  const db = getDb();
  const seatedProfiles = BOT_PROFILES.slice(0, seated);
  const picked = shufflePick(seatedProfiles, Math.min(seatedProfiles.length, 10));
  for (const profile of picked) {
    const user = await db
      .prepare("SELECT id FROM users WHERE username = ? AND COALESCE(is_bot, 0) = 1")
      .get(profile.username) as { id: number } | undefined;
    if (!user) continue;
    try {
      await chaseStaleBotQuote(user.id, profile.style, now);
      const held: string[] = [];
      for (const item of items) {
        if ((await availableItem(user.id, item.id)) >= 1) held.push(item.id);
      }
      const focus =
        held.length > 0
          ? shufflePick(held, Math.min(5, held.length))
          : [profile.specialty[Math.floor(Math.random() * profile.specialty.length)]];
      for (const itemId of focus) {
        const item = itemById[itemId];
        if (!item) continue;
        const fair = await marketPrice(itemId);
        const spread = botSpread(profile.style);
        const feelingLucky = Math.random() < botLossChance(spread, fair);
        const ask = await db
          .prepare(
            `SELECT id, price, created_at FROM orders
             WHERE item_id = ? AND side = 'sell' AND remaining > 0 AND user_id != ?
               AND COALESCE(treasury, 0) = 0
             ORDER BY price ASC, id ASC LIMIT 1`
          )
          .get(itemId, user.id) as { id: number; price: number; created_at: number } | undefined;
        if (
          ask &&
          await availableGold(user.id) >= ask.price &&
          botWillTake(
            spread,
            fair,
            "liftAsk",
            ask.price,
            feelingLucky,
            hopeCoins(spread, fair),
            now - ask.created_at
          )
        ) {
          await takeOrder(user.id, ask.id, 1);
        }
        const bid = await db
          .prepare(
            `SELECT id, price FROM orders
             WHERE item_id = ? AND side = 'buy' AND remaining > 0 AND user_id != ?
               AND COALESCE(treasury, 0) = 0
             ORDER BY price DESC, id ASC LIMIT 1`
          )
          .get(itemId, user.id) as { id: number; price: number } | undefined;
        if (
          bid &&
          await availableItem(user.id, itemId) >= 1 &&
          botWillTake(spread, fair, "hitBid", bid.price, feelingLucky)
        ) {
          await takeOrder(user.id, bid.id, 1);
        }
        const live = await db
          .prepare("SELECT COALESCE(SUM(remaining), 0) AS n FROM orders WHERE user_id = ? AND remaining > 0")
          .get(user.id) as { n: number };
        if (live.n >= 80) continue;
        const quote = botQuoteMultipliers(spread, fair);
        const have = await availableItem(user.id, itemId);
        const askQty = Math.min(have, Math.max(1, botAskSize(profile.style, quote.kind)));
        if (askQty >= 1) {
          const askPx = Math.max(1, Math.round(fair * quote.ask));
          await placeOrder(user.id, itemId, "sell", askPx, askQty);
        }
        if (live.n <= 30 && Math.random() < 0.62) {
          const bidQty = 1 + Math.floor(Math.random() * 3);
          const bidPx = Math.max(1, Math.round(fair * quote.bid));
          if (await availableGold(user.id) >= bidPx * bidQty) {
            await placeOrder(user.id, itemId, "buy", bidPx, bidQty);
          }
        }
      }
    } catch {
      // One noisy step should not stall the book.
    }
  }
}

const deskWork = globalThis as unknown as {
  bazaarDeskTimer?: ReturnType<typeof setInterval>;
  bazaarDeskBusy?: boolean;
  bazaarHumanAt?: number;
};

const HUMAN_IDLE_MS = 25_000;

function noteHumanOnDesk() {
  deskWork.bazaarHumanAt = Date.now();
}

function humanOnDesk() {
  return Boolean(deskWork.bazaarHumanAt && Date.now() - deskWork.bazaarHumanAt < HUMAN_IDLE_MS);
}

export function startDeskWork() {
  if (deskWork.bazaarDeskTimer) return;
  deskWork.bazaarDeskTimer = setInterval(() => {
    void runDeskWork();
  }, 1600);
  void runDeskWork();
}

async function runDeskWork() {
  if (deskWork.bazaarDeskBusy) return;
  deskWork.bazaarDeskBusy = true;
  try {
    if ((await readGamePhase()) !== "live") return;
    if ((await readGameOver()).over) return;
    if (!humanOnDesk()) return;
    await tickBots();
    await alignIssuedToAuthorized();
    for (const row of await tableSeatIds()) {
      await grantDailyLogin(row.id);
    }
  } catch {
    // Keep serving the desk even if a background tick fails.
  } finally {
    deskWork.bazaarDeskBusy = false;
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

async function loadSwap(offerId: number) {
  const row = await getDb()
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
  const legs = await getDb()
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

export async function proposeSwap(userId: number, draft: SwapDraft) {
  await resolveBusy(userId);
  await requireOpenGame();
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
    const target = await getDb()
      .prepare("SELECT id, username, COALESCE(is_bot, 0) AS is_bot FROM users WHERE username = ?")
      .get(targetName) as { id: number; username: string; is_bot: number } | undefined;
    if (!target) throw new Error("No traveler by that name.");
    if (target.id === userId) throw new Error("You cannot send a deal to yourself.");
    if (target.is_bot) {
      throw new Error("Plaza regulars do not take private bundles. Name a traveler, or leave the deal open.");
    }
    toId = target.id;
  }
  if (giveGold > 0 && await availableGold(userId) < giveGold) {
    throw new Error("Not enough free coin to put on that deal.");
  }
  for (const leg of give) {
    if (await availableItem(userId, leg.itemId) < leg.quantity) {
      throw new Error(`Not enough unbound ${itemById[leg.itemId]?.name ?? leg.itemId}.`);
    }
  }
  const db = getDb();
  const info = await db
    .prepare(
      `INSERT INTO swap_offers (from_user_id, to_user_id, give_gold, want_gold, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`
    )
    .run(userId, toId, giveGold, wantGold, nowMs());
  const offerId = Number(info.lastInsertRowid);
  const insertLeg = db.prepare(
    "INSERT INTO swap_legs (offer_id, side, item_id, quantity) VALUES (?, ?, ?, ?)"
  );
  for (const leg of give) await insertLeg.run(offerId, "give", leg.itemId, leg.quantity);
  for (const leg of want) await insertLeg.run(offerId, "want", leg.itemId, leg.quantity);
  const who = toId ? (await loadPlayerRow(toId)).username : "anyone on the board";
  await setEvent(
    userId,
    `Deal posted to ${who}: you give ${describeBundle(giveGold, give)} for ${describeBundle(wantGold, want)}.`
  );
}

export async function cancelSwap(userId: number, offerId: number) {
  await resolveBusy(userId);
  const offer = await loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.from_user_id !== userId) throw new Error("Only the sender can pull that deal.");
  await getDb().prepare("UPDATE swap_offers SET status = 'cancelled' WHERE id = ?").run(offerId);
  await setEvent(userId, "Deal pulled. Your pack is free again.");
}

export async function declineSwap(userId: number, offerId: number) {
  await resolveBusy(userId);
  const offer = await loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.to_user_id !== userId) throw new Error("That deal was not sent to you.");
  await getDb().prepare("UPDATE swap_offers SET status = 'declined' WHERE id = ?").run(offerId);
  await setEvent(offer.from_user_id, `${(await loadPlayerRow(userId)).username} declined your deal.`);
  await setEvent(userId, `You declined ${offer.from_name}'s deal.`);
}

export async function acceptSwap(userId: number, offerId: number) {
  await resolveBusy(userId);
  await requireOpenGame();
  const offer = await loadSwap(offerId);
  if (offer.status !== "open") throw new Error("That deal is already closed.");
  if (offer.from_user_id === userId) throw new Error("You cannot take your own deal.");
  if (offer.to_user_id != null && offer.to_user_id !== userId) {
    throw new Error("That deal was sent to someone else.");
  }
  if (offer.want_gold > 0 && await availableGold(userId) < offer.want_gold) {
    throw new Error("Not enough free coin to take that deal.");
  }
  for (const leg of offer.want) {
    if (await availableItem(userId, leg.itemId) < leg.quantity) {
      throw new Error(`Need more ${itemById[leg.itemId]?.name ?? leg.itemId} to take that deal.`);
    }
  }
  for (const leg of offer.give) {
    const have = (await inventoryMap(offer.from_user_id)).get(leg.itemId) ?? 0;
    if (have < leg.quantity) {
      throw new Error("The sender no longer has those goods.");
    }
  }
  if (offer.give_gold > 0 && (await loadPlayerRow(offer.from_user_id)).gold < offer.give_gold) {
    throw new Error("The sender no longer has the coin on that deal.");
  }
  for (const leg of offer.give) {
    await removeItem(offer.from_user_id, leg.itemId, leg.quantity);
    await addItem(userId, leg.itemId, leg.quantity);
  }
  for (const leg of offer.want) {
    await removeItem(userId, leg.itemId, leg.quantity);
    await addItem(offer.from_user_id, leg.itemId, leg.quantity);
  }
  if (offer.give_gold > 0) {
    await getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(offer.give_gold, offer.from_user_id);
    await getDb().prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(offer.give_gold, userId);
  }
  if (offer.want_gold > 0) {
    await getDb().prepare("UPDATE players SET gold = gold - ? WHERE user_id = ?").run(offer.want_gold, userId);
    await getDb().prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(offer.want_gold, offer.from_user_id);
  }
  await getDb().prepare("UPDATE swap_offers SET status = 'accepted' WHERE id = ?").run(offerId);
  const taker = (await loadPlayerRow(userId)).username;
  await setEvent(
    offer.from_user_id,
    `${taker} took your deal. You gave ${describeBundle(offer.give_gold, offer.give)} for ${describeBundle(offer.want_gold, offer.want)}.`
  );
  await setEvent(
    userId,
    `You took ${offer.from_name}'s deal. You gave ${describeBundle(offer.want_gold, offer.want)} for ${describeBundle(offer.give_gold, offer.give)}.`
  );
}

async function listAdminRoster(): Promise<AdminSeat[]> {
  const seatedBots = new Set(await seatedBotUsernames());
  const people = await getDb()
    .prepare(
      `SELECT u.id, u.username, p.gold, COALESCE(u.is_bot, 0) AS is_bot,
              COALESCE(p.at_table, 1) AS at_table
       FROM users u JOIN players p ON p.user_id = u.id
       WHERE u.username NOT IN ('Banker', 'Government')
       ORDER BY COALESCE(u.is_bot, 0) ASC, u.username COLLATE NOCASE`
    )
    .all() as { id: number; username: string; gold: number; is_bot: number; at_table: number }[];
  const packs = await getDb()
    .prepare(
      `SELECT user_id, item_id, quantity FROM inventory WHERE quantity > 0`
    )
    .all() as { user_id: number; item_id: string; quantity: number }[];
  const byUser = new Map<number, Record<string, number>>();
  for (const row of packs) {
    const bag = byUser.get(row.user_id) ?? {};
    bag[row.item_id] = row.quantity;
    byUser.set(row.user_id, bag);
  }
  return people.map((row) => ({
    id: row.id,
    username: row.username,
    gold: row.gold,
    bot: Boolean(row.is_bot),
    seated: row.is_bot ? seatedBots.has(row.username) : Boolean(row.at_table),
    holdings: byUser.get(row.id) ?? {},
  }));
}

async function listLobbyTravelers(): Promise<TravelerRow[]> {
  return (
    await getDb()
      .prepare(
        `SELECT u.id, u.username, COALESCE(u.is_bot, 0) AS is_bot
         FROM users u JOIN players p ON p.user_id = u.id
         WHERE u.username NOT IN ('Banker', 'Guest') AND COALESCE(u.is_bot, 0) = 0 AND COALESCE(u.is_gov, 0) = 0
           AND COALESCE(p.at_table, 1) = 1
         ORDER BY u.username COLLATE NOCASE ASC`
      )
      .all() as { id: number; username: string; is_bot: number }[]
  ).map((row) => ({ id: row.id, username: row.username, bot: Boolean(row.is_bot) }));
}

async function listTravelers(userId: number): Promise<TravelerRow[]> {
  return (
    await getDb()
      .prepare(
        `SELECT u.id, u.username, COALESCE(u.is_bot, 0) AS is_bot
         FROM users u JOIN players p ON p.user_id = u.id
         WHERE u.id != ? AND u.username != 'Banker' AND COALESCE(u.is_bot, 0) = 0 AND COALESCE(u.is_gov, 0) = 0
           AND COALESCE(p.at_table, 1) = 1
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

function mapSwap(row: Awaited<ReturnType<typeof loadSwap>>, userId: number): SwapOffer {
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

async function listSwaps(userId: number): Promise<SwapOffer[]> {
  const ids = await getDb()
    .prepare(
      `SELECT id FROM swap_offers
       WHERE status = 'open' AND (from_user_id = ? OR to_user_id = ? OR to_user_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 40`
    )
    .all(userId, userId) as { id: number }[];
  return Promise.all(ids.map(async (row) => mapSwap(await loadSwap(row.id), userId)));
}

export async function getGameState(
  userId: number,
  timeZone?: string,
  options?: { tick?: boolean }
): Promise<GameState> {
  if (!await isBot(userId)) noteHumanOnDesk();
  startDeskWork();
  await hydrateShareCatalog();
  await maybeStartScheduledGame();
  const gamePhase = await readGamePhase();
  if (options?.tick !== false && gamePhase === "live") {
    void runDeskWork();
  }
  await resolveBusy(userId);
  const depositNotice = gamePhase === "live" ? await grantDailyLogin(userId, timeZone) : null;
  const office = await canHoldOffice(userId);
  const player = await loadPlayerRow(userId);
  const stacks = await getDb()
    .prepare(
      "SELECT item_id, quantity, COALESCE(cost_basis, 0) AS cost_basis FROM inventory WHERE user_id = ? AND quantity > 0"
    )
    .all(userId) as { item_id: string; quantity: number; cost_basis: number }[];
  const reserved = await reservedItems(userId);
  const inventory: InventoryRow[] = stacks
    .map((row) => ({
      itemId: row.item_id,
      quantity: row.quantity,
      avgCost:
        row.cost_basis > 0 && row.quantity > 0
          ? Math.max(1, Math.round(row.cost_basis / row.quantity))
          : null,
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  const owned = await getDb()
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
    availableGold: player.gold - await reservedGold(userId),
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
    buffs: await listBuffs(userId),
    vp: player.vp ?? 0,
    goldFromStalls: player.gold_from_stalls ?? 0,
    foodDelivered: player.food_delivered ?? 0,
    legendaryTurnins: player.legendary_turnins ?? 0,
    boardFills: player.board_fills ?? 0,
    goldDonated: player.gold_donated ?? 0,
    titles: [],
    isGov: Boolean(player.is_gov),
    isAdmin: Boolean(player.is_admin),
    canOffice: office,
  };

  const myOrders = (
    await getDb()
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

  const recentTrades = coalesceTrades(await loadRecentTrades(40)).slice(0, 18);

  const prices = await priceSheet(timeZone);
  const leaders = await netWorthLeaders(prices);
  const { goal, over } =
    gamePhase === "lobby"
      ? { goal: await readGoal(), over: await readGameOver() }
      : await resolveGoal(leaders, userId);
  const winners = await getDb()
    .prepare(
      `SELECT u.username, p.won_at AS wonAt
       FROM players p JOIN users u ON u.id = p.user_id
       WHERE p.has_won = 1 AND p.won_at IS NOT NULL
       ORDER BY p.won_at ASC
       LIMIT 12`
    )
    .all() as { username: string; wonAt: number }[];
  const botsSeated = await computerCount();
  const computers = botsSeated > 0;
  const { sql: seatSql, params: seatParams } = await tableSeatWhere();
  const coinVolume = (
    await getDb()
      .prepare(
        `SELECT COALESCE(SUM(p.gold), 0) AS gold
         FROM players p JOIN users u ON u.id = p.user_id
         WHERE ${seatSql}`
      )
      .get(...seatParams) as { gold: number }
  ).gold;
  const festival: FestivalState = {
    timeZone: timeZone || "UTC",
    clockLabel: "",
    sundayMarket: false,
    vpToWin: VP_TO_WIN,
    rumorCost: 0,
    crateCost: 0,
    donationNextCost: 0,
    forage: {
      locationId: player.location_id,
      searchers: 0,
      strain: 0,
      cooldownMs: 0,
      nextSearchCost: 0,
      biasLocationId: null,
    },
    stalls: [],
    contracts: [],
    titles: [],
    leaders: [],
  };

  const trading = await readTradingHours();
  return {
    now: nowMs(),
    player: playerState,
    prices,
    myOrders,
    recentTrades,
    winners,
    areas: await listAreas(player.location_id),
    festival,
    swaps: await listSwaps(userId),
    travelers: await listTravelers(userId),
    coinVolume,
    computers,
    computerCount: botsSeated,
    travelerCount: await travelerCount(),
    stipendMs: await stipendMs(),
    startingGold: await startingGold(),
    coinDrop: await coinDropSnapshot(userId),
    adminRoster: office ? await listAdminRoster() : [],
    gamePhase,
    scheduledStartAt: await readScheduledStartAt(),
    lobbyTravelers: await listLobbyTravelers(),
    inviteCode: office ? await readInviteCode() : null,
    netWorthGoal: goal.score === "netWorth" ? goal.threshold : NET_WORTH_GOAL,
    candleMs: await readCandleMs(),
    tradingHours: trading.hours,
    tradingTimeZone: trading.timeZone,
    goal: { ...goal, label: describeGoal(goal, timeZone) },
    gameOver: over,
    leaders,
    items: items.map((item) => ({ ...item })),
    deposit:
      depositNotice?.justPaid
        ? { amount: depositNotice.amount, day: depositNotice.day, gold: player.gold }
        : null,
  };
}
