import bcrypt from "bcryptjs";
import { createGameDb, databaseTarget, type GameDb } from "@/lib/game/sql";
import {
  ENERGY_MAX,
  RETIRED_ITEM_IDS,
  STARTING_ENERGY,
  STARTING_GOLD,
  MAX_STARTING_GOLD,
  stipendSlotKey,
  itemById,
  defaultShareItems,
  setLiveItems,
} from "@/lib/game/catalog";
import { BOT_PROFILES, MAX_COMPUTERS } from "@/lib/game/bots";
import { OFFICE_USERNAME } from "@/lib/game/office";
import {
  defaultGoal,
  normalizeGoal,
  type GameOverState,
  type GoalConfig,
} from "@/lib/game/goal";
import { defaultStipendLadder, normalizeStipendLadder, stipendCatchUp } from "@/lib/game/stipend-ladder";

export const DESK_USERNAME = "Government";

export type GamePhase = "lobby" | "live";

const BOOTSTRAP_REV = 19;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const globalForDb = globalThis as unknown as {
  bazaarDb?: GameDb;
  bazaarBootstrapRev?: number;
  bazaarBootstrapping?: number;
};

function rotateIds(ids: number[], salt: string) {
  if (ids.length === 0) return ids;
  let hash = 0;
  for (let i = 0; i < salt.length; i += 1) hash = (hash * 31 + salt.charCodeAt(i)) >>> 0;
  const start = hash % ids.length;
  return [...ids.slice(start), ...ids.slice(0, start)];
}

async function migrate(db: GameDb) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      gold INTEGER NOT NULL,
      location_id TEXT NOT NULL,
      busy_type TEXT NOT NULL DEFAULT 'idle',
      busy_until INTEGER,
      busy_payload TEXT,
      hat TEXT,
      outfit TEXT,
      accessory TEXT,
      has_won INTEGER NOT NULL DEFAULT 0,
      won_at INTEGER,
      last_event TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      cost_basis INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS cosmetics (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cosmetic_id TEXT NOT NULL,
      PRIMARY KEY (user_id, cosmetic_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      side TEXT NOT NULL,
      price INTEGER NOT NULL,
      remaining INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      buy_user_id INTEGER NOT NULL,
      sell_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS area_strain (
      location_id TEXT PRIMARY KEY,
      strain INTEGER NOT NULL,
      cools_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bank_intake (
      item_id TEXT PRIMARY KEY,
      units INTEGER NOT NULL,
      cools_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_buffs (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      charges INTEGER NOT NULL,
      power INTEGER NOT NULL,
      PRIMARY KEY (user_id, kind)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_book ON orders(item_id, side, price, created_at);
    CREATE INDEX IF NOT EXISTS idx_trades_item ON trades(item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS festival_contracts (
      id TEXT PRIMARY KEY,
      week_id TEXT NOT NULL,
      stall_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      vp INTEGER NOT NULL,
      gold INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_completions (
      contract_id TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at INTEGER NOT NULL,
      PRIMARY KEY (contract_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS player_rumors (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stall_id TEXT NOT NULL,
      for_date TEXT NOT NULL,
      PRIMARY KEY (user_id, stall_id, for_date)
    );

    CREATE TABLE IF NOT EXISTS stall_crates (
      stall_id TEXT NOT NULL,
      window_key TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (stall_id, window_key)
    );

    CREATE TABLE IF NOT EXISTS player_daily (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_key TEXT NOT NULL,
      first_trade INTEGER NOT NULL DEFAULT 0,
      special_sold TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, day_key)
    );

    CREATE TABLE IF NOT EXISTS swap_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      give_gold INTEGER NOT NULL DEFAULT 0,
      want_gold INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS swap_legs (
      offer_id INTEGER NOT NULL REFERENCES swap_offers(id) ON DELETE CASCADE,
      side TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_swap_offers_open ON swap_offers(status, from_user_id, to_user_id);
    CREATE INDEX IF NOT EXISTS idx_swap_legs_offer ON swap_legs(offer_id);

    CREATE TABLE IF NOT EXISTS item_float (
      item_id TEXT PRIMARY KEY,
      floated INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS game_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_caps (
      item_id TEXT PRIMARY KEY,
      authorized INTEGER NOT NULL
    );
  `);
  await ensureColumn(db, "users", "is_bot", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "users", "is_gov", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "orders", "treasury", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "energy", `INTEGER NOT NULL DEFAULT ${ENERGY_MAX}`);
  await ensureColumn(db, "players", "energy_max", `INTEGER NOT NULL DEFAULT ${ENERGY_MAX}`);
  await ensureColumn(db, "players", "vp", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "gold_from_stalls", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "food_delivered", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "legendary_turnins", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "board_fills", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "gold_donated", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "donate_count", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "wardrobe_vp", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "inventory", "cost_basis", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "player_daily", "login_paid", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "login_days", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "players", "at_table", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "trades", "buy_treasury", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "trades", "sell_treasury", "INTEGER NOT NULL DEFAULT 0");
  await seedInventoryCostBasis(db);
}

async function ensureColumn(db: GameDb, table: string, column: string, sql: string) {
  const cols = await db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sql}`);
    return true;
  }
  return false;
}

async function seedInventoryCostBasis(db: GameDb) {
  const stacks = await db
    .prepare(
      "SELECT user_id, item_id, quantity FROM inventory WHERE quantity > 0 AND COALESCE(cost_basis, 0) = 0"
    )
    .all() as { user_id: number; item_id: string; quantity: number }[];
  if (stacks.length === 0) return;
  const avgs = await db
    .prepare(
      `SELECT buy_user_id, item_id, SUM(price * quantity) AS paid, SUM(quantity) AS qty
       FROM trades GROUP BY buy_user_id, item_id`
    )
    .all() as { buy_user_id: number; item_id: string; paid: number; qty: number }[];
  const avgPaid = new Map(
    avgs
      .filter((row) => row.qty > 0)
      .map((row) => [`${row.buy_user_id}:${row.item_id}`, row.paid / row.qty])
  );
  const upd = db.prepare(
    "UPDATE inventory SET cost_basis = ? WHERE user_id = ? AND item_id = ?"
  );
  for (const row of stacks) {
    const avg =
      avgPaid.get(`${row.user_id}:${row.item_id}`) ?? itemById[row.item_id]?.basePrice ?? 1;
    await upd.run(Math.max(0, Math.round(avg * row.quantity)), row.user_id, row.item_id);
  }
}

async function clearBankerBook(db: GameDb) {
  await db.prepare(
    "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE username = ?)"
  ).run("Banker");
}

async function takeFromPack(db: GameDb, userId: number, itemId: string, qty: number) {
  if (qty <= 0) return 0;
  const row = await db
    .prepare(
      "SELECT quantity, COALESCE(cost_basis, 0) AS cost_basis FROM inventory WHERE user_id = ? AND item_id = ?"
    )
    .get(userId, itemId) as { quantity: number; cost_basis: number } | undefined;
  const have = row?.quantity ?? 0;
  const take = Math.min(have, qty);
  if (take <= 0) return 0;
  const left = have - take;
  if (left <= 0) await db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  else {
    const nextBasis = Math.round((row?.cost_basis ?? 0) * (left / have));
    await db.prepare(
      "UPDATE inventory SET quantity = ?, cost_basis = ? WHERE user_id = ? AND item_id = ?"
    ).run(left, nextBasis, userId, itemId);
  }
  return take;
}

async function bankerRecipients(db: GameDb) {
  const guest = await db.prepare("SELECT id FROM users WHERE username = ?").get("Guest") as
    | { id: number }
    | undefined;
  const bots = await db
    .prepare("SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1 ORDER BY username COLLATE NOCASE")
    .all() as { id: number }[];
  return [...(guest ? [guest.id] : []), ...bots.map((row) => row.id)];
}

async function dealStacksEvenly(
  db: GameDb,
  recipients: number[],
  stacks: { item_id: string; quantity: number }[]
) {
  if (recipients.length === 0) return;
  const grant = db.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  );
  const units: string[] = [];
  for (const stack of stacks) {
    for (let n = 0; n < stack.quantity; n += 1) units.push(stack.item_id);
  }
  for (let i = 0; i < units.length; i += 1) {
    await grant.run(recipients[i % recipients.length], units[i], 1);
  }
}

const BANKER_V1_STACKS: { item_id: string; quantity: number }[] = [
  { item_id: "wheat", quantity: 23 },
  { item_id: "wood", quantity: 23 },
  { item_id: "stone", quantity: 18 },
  { item_id: "fish", quantity: 14 },
  { item_id: "flax", quantity: 12 },
  { item_id: "flower", quantity: 10 },
  { item_id: "herbs", quantity: 10 },
  { item_id: "salt", quantity: 10 },
  { item_id: "shell", quantity: 8 },
  { item_id: "coal", quantity: 6 },
  { item_id: "iron", quantity: 4 },
  { item_id: "bread", quantity: 2 },
];

const BANKER_SPLIT_DONE = "The bank closed. Remaining stock was split evenly by count.";
const BANKER_SPLIT_V1 = "The bank closed. Remaining stock was split across the desk.";

async function shareBankerHoldings(db: GameDb) {
  const banker = await db.prepare("SELECT id FROM users WHERE username = ?").get("Banker") as
    | { id: number }
    | undefined;
  if (!banker) return;
  const note = await db.prepare("SELECT last_event FROM players WHERE user_id = ?").get(banker.id) as
    | { last_event: string | null }
    | undefined;
  if (note?.last_event === BANKER_SPLIT_DONE) return;

  const recipients = await bankerRecipients(db);
  if (recipients.length === 0) return;

  const live = await db
    .prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ? AND quantity > 0")
    .all(banker.id) as { item_id: string; quantity: number }[];

  await db.transaction(async () => {
    let stacks = live;
    if (stacks.length === 0 && note?.last_event === BANKER_SPLIT_V1) {
      const recovered: Record<string, number> = {};
      const v1Order = await bankerRecipients(db);
      const guest = v1Order[0];
      const botsOnly = v1Order.filter((id) => id !== guest);
      const oldRecipients = [...botsOnly, ...(guest ? [guest] : [])];
      for (const stack of BANKER_V1_STACKS) {
        const order = rotateIds(oldRecipients, stack.item_id);
        const each = Math.floor(stack.quantity / order.length);
        let leftover = stack.quantity % order.length;
        for (let i = 0; i < order.length; i += 1) {
          const qty = each + (leftover > 0 ? 1 : 0);
          if (leftover > 0) leftover -= 1;
          const got = await takeFromPack(db, order[i], stack.item_id, qty);
          if (got > 0) recovered[stack.item_id] = (recovered[stack.item_id] ?? 0) + got;
        }
      }
      stacks = Object.entries(recovered).map(([item_id, quantity]) => ({ item_id, quantity }));
    }
    if (stacks.length === 0) return;
    await dealStacksEvenly(db, recipients, stacks);
    await db.prepare("DELETE FROM inventory WHERE user_id = ?").run(banker.id);
    await db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(BANKER_SPLIT_DONE, banker.id);
  });
  await clearBankerBook(db);
}

async function seedDesk(db: GameDb) {
  const existing = await db
    .prepare("SELECT id FROM users WHERE username = ?").get(DESK_USERNAME) as { id: number } | undefined;
  if (existing) {
    await db.prepare("UPDATE users SET is_gov = 1 WHERE id = ?").run(existing.id);
    return;
  }
  const now = Date.now();
  const info = await db
    .prepare(
      "INSERT INTO users (username, password_hash, created_at, is_gov) VALUES (?, ?, ?, 1)"
    )
    .run(DESK_USERNAME, bcrypt.hashSync(`desk-${now}`, 10), now);
  const userId = Number(info.lastInsertRowid);
  await db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, 0, 'town', ?, ?, ?)"
  ).run(userId, STARTING_ENERGY, ENERGY_MAX, "The treasury desk is open.");
}

function generateInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "";
  for (const byte of bytes) out += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  return out;
}

export async function readInviteCode(db: GameDb = getDb()) {
  const row = (await db.prepare("SELECT value FROM game_meta WHERE key = 'invite_code'").get()) as
    | { value: string }
    | undefined;
  return row?.value?.trim() ? row.value.trim().toUpperCase() : null;
}

export async function writeInviteCode(code: string, db: GameDb = getDb()) {
  const next = code.trim().toUpperCase();
  await db
    .prepare(
      `INSERT INTO game_meta (key, value) VALUES ('invite_code', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(next);
  return next;
}

async function ensureInviteCode(db: GameDb) {
  if (await readInviteCode(db)) return;
  await writeInviteCode(generateInviteCode(), db);
}

export async function humanTravelerCount(db: GameDb = getDb()) {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users
       WHERE COALESCE(is_bot, 0) = 0 AND COALESCE(is_gov, 0) = 0
         AND username NOT IN ('Banker', 'Government', 'Guest')`
    )
    .get()) as { n: number };
  return Math.max(0, Math.floor(row?.n ?? 0));
}

export async function inviteRequired(db: GameDb = getDb()) {
  return (await humanTravelerCount(db)) > 0;
}

export async function readGamePhase(db: GameDb = getDb()): Promise<GamePhase> {
  const row = (await db.prepare("SELECT value FROM game_meta WHERE key = 'game_phase'").get()) as
    | { value: string }
    | undefined;
  return row?.value === "lobby" ? "lobby" : "live";
}

export async function writeGamePhase(phase: GamePhase, db: GameDb = getDb()) {
  await db
    .prepare(
      `INSERT INTO game_meta (key, value) VALUES ('game_phase', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(phase);
}

export async function readScheduledStartAt(db: GameDb = getDb()) {
  const row = (await db
    .prepare("SELECT value FROM game_meta WHERE key = 'scheduled_start_at'")
    .get()) as { value: string } | undefined;
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function writeScheduledStartAt(at: number | null, db: GameDb = getDb()) {
  if (at == null) {
    await db.prepare("DELETE FROM game_meta WHERE key = 'scheduled_start_at'").run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO game_meta (key, value) VALUES ('scheduled_start_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(String(Math.floor(at)));
}

async function createPlayerWithDb(db: GameDb, userId: number) {
  const start = await startingGold(db);
  const tablePaid = await tablePaidDrops(db, userId);
  const extra = stipendCatchUp(await readStipendLadder(db), 0, tablePaid);
  const gold = start + extra;
  const note =
    tablePaid > 0
      ? `You arrive with ${start.toLocaleString("en-US")} coins plus ${tablePaid} coin drop${
          tablePaid === 1 ? "" : "s"
        } the table already had (${extra.toLocaleString("en-US")}).`
      : `You arrive with ${start.toLocaleString("en-US")} coins and a place at the desk.`;
  await db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, login_days, last_event) VALUES (?, ?, 'town', ?, ?, ?, ?)"
  ).run(userId, gold, STARTING_ENERGY, ENERGY_MAX, tablePaid, note);
  await markStipendSlotPaid(userId, db);
}

async function purgeItemIds(db: GameDb, ids: string[]) {
  if (ids.length === 0) return;
  const slots = ids.map(() => "?").join(", ");
  await db.transaction(async () => {
    const offerIds = await db
      .prepare(`SELECT DISTINCT offer_id FROM swap_legs WHERE item_id IN (${slots})`)
      .all(...ids) as { offer_id: number }[];
    for (const row of offerIds) {
      await db.prepare("DELETE FROM swap_legs WHERE offer_id = ?").run(row.offer_id);
      await db.prepare("DELETE FROM swap_offers WHERE id = ?").run(row.offer_id);
    }
    await db.prepare(`DELETE FROM inventory WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM orders WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM trades WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM festival_contracts WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM item_caps WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM item_float WHERE item_id IN (${slots})`).run(...ids);
    await db.prepare(`DELETE FROM bank_intake WHERE item_id IN (${slots})`).run(...ids);
  });
}

async function purgeRetiredItems(db: GameDb) {
  await purgeItemIds(db, [...RETIRED_ITEM_IDS]);
}

async function ensureShareTypesTable(db: GameDb) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS share_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      image TEXT,
      base_price INTEGER NOT NULL,
      authorized INTEGER NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `);
}

export async function readShareTypes(db: GameDb = getDb()) {
  await ensureShareTypesTable(db);
  await ensureItemCaps(db);
  const rows = await db
    .prepare(
      "SELECT id, name, emoji, image, base_price, authorized, sort_order FROM share_types ORDER BY sort_order ASC, name COLLATE NOCASE ASC"
    )
    .all() as {
    id: string;
    name: string;
    emoji: string;
    image: string | null;
    base_price: number;
    authorized: number;
    sort_order: number;
  }[];
  const out = [];
  for (const row of rows) {
    const cap = (await db
      .prepare("SELECT authorized FROM item_caps WHERE item_id = ?")
      .get(row.id)) as { authorized: number } | undefined;
    const authorized =
      cap && Number.isInteger(cap.authorized) && cap.authorized > 0 ? cap.authorized : row.authorized;
    out.push({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      image: row.image || null,
      kind: "material" as const,
      purpose: "Trade it on the board.",
      description: row.name,
      basePrice: row.base_price,
      authorized,
    });
  }
  return out;
}

export async function hydrateShareCatalog(db: GameDb = getDb()) {
  await ensureShareTypesTable(db);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM share_types").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(
      `INSERT INTO share_types (id, name, emoji, image, base_price, authorized, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [index, item] of defaultShareItems().entries()) {
      await insert.run(
        item.id,
        item.name,
        item.emoji,
        item.image ?? null,
        item.basePrice,
        (await getItemAuthorized(item.id, db)) || item.authorized || 15,
        index
      );
    }
  }
  setLiveItems(await readShareTypes(db));
}

export async function insertShareType(
  item: {
    id: string;
    name: string;
    emoji: string;
    image: string | null;
    basePrice: number;
    authorized: number;
  },
  db: GameDb = getDb()
) {
  await hydrateShareCatalog(db);
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS n FROM share_types").get() as { n: number };
  await db.prepare(
    `INSERT INTO share_types (id, name, emoji, image, base_price, authorized, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(item.id, item.name, item.emoji, item.image, item.basePrice, item.authorized, max.n + 1);
  await setItemAuthorized(item.id, item.authorized, db);
  await hydrateShareCatalog(db);
}

export async function removeShareType(itemId: string, db: GameDb = getDb()) {
  await ensureShareTypesTable(db);
  await purgeItemIds(db, [itemId]);
  await db.prepare("DELETE FROM share_types WHERE id = ?").run(itemId);
  await hydrateShareCatalog(db);
}

export async function seedBots(db: GameDb = getDb()) {
  const hash = bcrypt.hashSync("bot-not-for-login", 6);
  const now = Date.now();
  const insertUser = db.prepare(
    "INSERT INTO users (username, password_hash, created_at, is_bot) VALUES (?, ?, ?, 1)"
  );
  const insertPlayer = db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, 0, 'town', ?, ?, ?)"
  );
  const markBot = db.prepare("UPDATE users SET is_bot = 1 WHERE id = ?");
  for (const bot of BOT_PROFILES) {
    const existing = await db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(bot.username) as { id: number } | undefined;
    if (!existing) {
      const info = await insertUser.run(bot.username, hash, now);
      await insertPlayer.run(
        Number(info.lastInsertRowid),
        ENERGY_MAX,
        ENERGY_MAX,
        "Sitting this table out."
      );
    } else {
      await markBot.run(existing.id);
    }
  }
}

async function lockOffice(db: GameDb) {
  await db.prepare("UPDATE users SET is_admin = 0 WHERE username != ?").run(OFFICE_USERNAME);
  await db.prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run(OFFICE_USERNAME);
  await db.prepare(
    "UPDATE users SET is_gov = 0 WHERE username NOT IN (?, ?) AND COALESCE(is_gov, 0) = 1"
  ).run(OFFICE_USERNAME, DESK_USERNAME);
}

async function retireGuest(db: GameDb) {
  await db
    .prepare(
      `UPDATE players SET at_table = 0, last_event = ?
       WHERE user_id IN (SELECT id FROM users WHERE username = 'Guest' COLLATE NOCASE)`
    )
    .run("Guest play is closed.");
}

async function bootstrap(db: GameDb) {
  await migrate(db);
  await clearBankerBook(db);
  await seedDesk(db);
  await ensureInviteCode(db);
  await seedBots(db);
  await purgeRetiredItems(db);
  await shareBankerHoldings(db);
  await lockOffice(db);
  await retireGuest(db);
  await hydrateShareCatalog(db);
}

async function writeComputerMeta(count: number, db: GameDb) {
  const n = Math.max(0, Math.min(MAX_COMPUTERS, Math.floor(count)));
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('computer_count', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(n));
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('computers', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(n > 0 ? "1" : "0");
  return n;
}

export async function computerCount(db: GameDb = getDb()) {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'computer_count'").get() as
    | { value: string }
    | undefined;
  if (row != null) {
    const n = Number(row.value);
    if (Number.isFinite(n)) return Math.max(0, Math.min(MAX_COMPUTERS, Math.floor(n)));
  }
  const flag = await db.prepare("SELECT value FROM game_meta WHERE key = 'computers'").get() as
    | { value: string }
    | undefined;
  const fallback = flag?.value === "0" ? 0 : MAX_COMPUTERS;
  await writeComputerMeta(fallback, db);
  return fallback;
}

export async function computersEnabled(db: GameDb = getDb()) {
  return await computerCount(db) > 0;
}

export async function setComputerCount(count: number, db: GameDb = getDb()) {
  return await writeComputerMeta(count, db);
}

export async function setComputersEnabled(on: boolean, db: GameDb = getDb()) {
  if (!on) {
    await writeComputerMeta(0, db);
    return;
  }
  const current = await computerCount(db);
  await writeComputerMeta(current > 0 ? current : MAX_COMPUTERS, db);
}

export async function startingGold(db: GameDb = getDb()) {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'starting_gold'").get() as
    | { value: string }
    | undefined;
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_STARTING_GOLD ? n : STARTING_GOLD;
}

export async function setStartingGold(gold: number, db: GameDb = getDb()) {
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('starting_gold', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(gold));
}

export async function tablePaidDrops(db: GameDb = getDb(), excludeUserId = 0) {
  const bots = BOT_PROFILES.slice(0, await computerCount(db)).map((bot) => bot.username);
  const botSql = bots.length > 0 ? `OR (COALESCE(u.is_bot, 0) = 1 AND u.username IN (${bots.map(() => "?").join(", ")}))` : "";
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(p.login_days), 0) AS n
       FROM players p JOIN users u ON u.id = p.user_id
       WHERE p.user_id != ?
         AND (
           (
             COALESCE(u.is_bot, 0) = 0 AND COALESCE(u.is_gov, 0) = 0
             AND u.username NOT IN ('Banker', 'Government')
             AND COALESCE(p.at_table, 1) = 1
           )
           ${botSql}
         )`
    )
    .get(excludeUserId, ...bots) as { n: number };
  return Math.max(0, Math.floor(row?.n ?? 0));
}

export async function markStipendSlotPaid(userId: number, db: GameDb = getDb()) {
  const slot = stipendSlotKey(Date.now(), await stipendMs(db));
  await db.prepare(
    `INSERT INTO player_daily (user_id, day_key, first_trade, special_sold, login_paid)
     VALUES (?, ?, 0, '', 1)
     ON CONFLICT(user_id, day_key) DO UPDATE SET login_paid = 1`
  ).run(userId, slot);
}

export async function stipendMs(db: GameDb = getDb()) {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'stipend_ms'").get() as
    | { value: string }
    | undefined;
  const ms = Number(row?.value);
  return Number.isFinite(ms) && ms >= 1_000 ? ms : 5 * 60 * 1000;
}

export async function readStipendLadder(db: GameDb = getDb()) {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'stipend_ladder'").get() as
    | { value: string }
    | undefined;
  if (!row) return defaultStipendLadder();
  try {
    return normalizeStipendLadder(JSON.parse(row.value) as unknown);
  } catch {
    return defaultStipendLadder();
  }
}

export async function writeStipendLadder(ladder: number[], db: GameDb = getDb()) {
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('stipend_ladder', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(normalizeStipendLadder(ladder)));
}

export async function readGoal(db: GameDb = getDb()): Promise<GoalConfig> {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'goal'").get() as
    | { value: string }
    | undefined;
  if (!row) return defaultGoal();
  try {
    return normalizeGoal(JSON.parse(row.value) as Partial<GoalConfig>);
  } catch {
    return defaultGoal();
  }
}

export async function writeGoal(goal: GoalConfig, db: GameDb = getDb()) {
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('goal', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(goal));
}

export async function readGameOver(db: GameDb = getDb()): Promise<GameOverState> {
  const row = await db.prepare("SELECT value FROM game_meta WHERE key = 'game_over'").get() as
    | { value: string }
    | undefined;
  if (!row) return { over: false, winner: null, endedAt: null, reason: null };
  try {
    const parsed = JSON.parse(row.value) as Partial<GameOverState>;
    return {
      over: Boolean(parsed.over),
      winner: parsed.winner ? String(parsed.winner) : null,
      endedAt: parsed.endedAt != null ? Number(parsed.endedAt) : null,
      reason: parsed.reason === "threshold" || parsed.reason === "time" ? parsed.reason : null,
    };
  } catch {
    return { over: false, winner: null, endedAt: null, reason: null };
  }
}

export async function writeGameOver(state: GameOverState, db: GameDb = getDb()) {
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('game_over', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(state));
}

export async function clearGameOver(db: GameDb = getDb()) {
  await writeGameOver({ over: false, winner: null, endedAt: null, reason: null }, db);
}

export async function setStipendMs(ms: number, db: GameDb = getDb()) {
  await db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('stipend_ms', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(ms));
}

async function ensureItemCaps(db: GameDb) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS item_caps (
      item_id TEXT PRIMARY KEY,
      authorized INTEGER NOT NULL
    )
  `);
}

export async function getItemAuthorized(itemId: string, db: GameDb = getDb()) {
  await ensureItemCaps(db);
  const row = await db
    .prepare("SELECT authorized FROM item_caps WHERE item_id = ?")
    .get(itemId) as { authorized: number } | undefined;
  if (row && Number.isInteger(row.authorized) && row.authorized > 0) return row.authorized;
  return itemById[itemId]?.authorized ?? 0;
}

export async function setItemAuthorized(itemId: string, authorized: number, db: GameDb = getDb()) {
  await ensureItemCaps(db);
  await db.prepare(
    `INSERT INTO item_caps (item_id, authorized) VALUES (?, ?)
     ON CONFLICT(item_id) DO UPDATE SET authorized = excluded.authorized`
  ).run(itemId, authorized);
}

function bindBootstrap(db: GameDb) {
  if (globalForDb.bazaarBootstrapping === BOOTSTRAP_REV) return;
  globalForDb.bazaarBootstrapping = BOOTSTRAP_REV;
  const ready = db
    .runInit(() => bootstrap(db))
    .then(() => {
      globalForDb.bazaarBootstrapRev = BOOTSTRAP_REV;
    })
    .catch((error) => {
      globalForDb.bazaarBootstrapping = undefined;
      globalForDb.bazaarBootstrapRev = -1;
      throw error;
    });
  db.bindReady(ready);
}

export function getDb() {
  if (!globalForDb.bazaarDb) {
    const db = createGameDb();
    globalForDb.bazaarDb = db;
    bindBootstrap(db);
  } else if (globalForDb.bazaarBootstrapRev !== BOOTSTRAP_REV) {
    bindBootstrap(globalForDb.bazaarDb);
  }
  return globalForDb.bazaarDb;
}

export { databaseTarget };

export async function createPlayer(userId: number) {
  await createPlayerWithDb(await getDb(), userId);
}
