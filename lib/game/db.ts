import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import {
  ENERGY_MAX,
  RETIRED_ITEM_IDS,
  STARTING_ENERGY,
  STARTING_GOLD,
  seatGold,
  itemById,
} from "@/lib/game/catalog";
import { BOT_PROFILES, MAX_COMPUTERS } from "@/lib/game/bots";
import { OFFICE_USERNAME } from "@/lib/game/office";
import {
  defaultGoal,
  normalizeGoal,
  type GameOverState,
  type GoalConfig,
} from "@/lib/game/goal";

export const DESK_USERNAME = "Government";

const BOOTSTRAP_REV = 13;

const globalForDb = globalThis as unknown as {
  bazaarDb?: Database.Database;
  bazaarBootstrapRev?: number;
};

function rotateIds(ids: number[], salt: string) {
  if (ids.length === 0) return ids;
  let hash = 0;
  for (let i = 0; i < salt.length; i += 1) hash = (hash * 31 + salt.charCodeAt(i)) >>> 0;
  const start = hash % ids.length;
  return [...ids.slice(start), ...ids.slice(0, start)];
}

function migrate(db: Database.Database) {
  db.exec(`
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
  ensureColumn(db, "users", "is_bot", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "is_gov", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "orders", "treasury", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "energy", `INTEGER NOT NULL DEFAULT ${ENERGY_MAX}`);
  ensureColumn(db, "players", "energy_max", `INTEGER NOT NULL DEFAULT ${ENERGY_MAX}`);
  ensureColumn(db, "players", "vp", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "gold_from_stalls", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "food_delivered", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "legendary_turnins", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "board_fills", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "gold_donated", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "donate_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "wardrobe_vp", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "inventory", "cost_basis", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "player_daily", "login_paid", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "login_days", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "players", "at_table", "INTEGER NOT NULL DEFAULT 1");
  seedInventoryCostBasis(db);
}

function ensureColumn(db: Database.Database, table: string, column: string, sql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sql}`);
    return true;
  }
  return false;
}

function seedInventoryCostBasis(db: Database.Database) {
  const stacks = db
    .prepare(
      "SELECT user_id, item_id, quantity FROM inventory WHERE quantity > 0 AND COALESCE(cost_basis, 0) = 0"
    )
    .all() as { user_id: number; item_id: string; quantity: number }[];
  if (stacks.length === 0) return;
  const avgs = db
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
    upd.run(Math.max(0, Math.round(avg * row.quantity)), row.user_id, row.item_id);
  }
}

function clearBankerBook(db: Database.Database) {
  db.prepare(
    "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE username = ?)"
  ).run("Banker");
}

function takeFromPack(db: Database.Database, userId: number, itemId: string, qty: number) {
  if (qty <= 0) return 0;
  const row = db
    .prepare(
      "SELECT quantity, COALESCE(cost_basis, 0) AS cost_basis FROM inventory WHERE user_id = ? AND item_id = ?"
    )
    .get(userId, itemId) as { quantity: number; cost_basis: number } | undefined;
  const have = row?.quantity ?? 0;
  const take = Math.min(have, qty);
  if (take <= 0) return 0;
  const left = have - take;
  if (left <= 0) db.prepare("DELETE FROM inventory WHERE user_id = ? AND item_id = ?").run(userId, itemId);
  else {
    const nextBasis = Math.round((row?.cost_basis ?? 0) * (left / have));
    db.prepare(
      "UPDATE inventory SET quantity = ?, cost_basis = ? WHERE user_id = ? AND item_id = ?"
    ).run(left, nextBasis, userId, itemId);
  }
  return take;
}

function bankerRecipients(db: Database.Database) {
  const guest = db.prepare("SELECT id FROM users WHERE username = ?").get("Guest") as
    | { id: number }
    | undefined;
  const bots = db
    .prepare("SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1 ORDER BY username COLLATE NOCASE")
    .all() as { id: number }[];
  return [...(guest ? [guest.id] : []), ...bots.map((row) => row.id)];
}

function dealStacksEvenly(
  db: Database.Database,
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
    grant.run(recipients[i % recipients.length], units[i], 1);
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

function shareBankerHoldings(db: Database.Database) {
  const banker = db.prepare("SELECT id FROM users WHERE username = ?").get("Banker") as
    | { id: number }
    | undefined;
  if (!banker) return;
  const note = db.prepare("SELECT last_event FROM players WHERE user_id = ?").get(banker.id) as
    | { last_event: string | null }
    | undefined;
  if (note?.last_event === BANKER_SPLIT_DONE) return;

  const recipients = bankerRecipients(db);
  if (recipients.length === 0) return;

  const live = db
    .prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ? AND quantity > 0")
    .all(banker.id) as { item_id: string; quantity: number }[];

  db.transaction(() => {
    let stacks = live;
    if (stacks.length === 0 && note?.last_event === BANKER_SPLIT_V1) {
      const recovered: Record<string, number> = {};
      const v1Order = bankerRecipients(db);
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
          const got = takeFromPack(db, order[i], stack.item_id, qty);
          if (got > 0) recovered[stack.item_id] = (recovered[stack.item_id] ?? 0) + got;
        }
      }
      stacks = Object.entries(recovered).map(([item_id, quantity]) => ({ item_id, quantity }));
    }
    if (stacks.length === 0) return;
    dealStacksEvenly(db, recipients, stacks);
    db.prepare("DELETE FROM inventory WHERE user_id = ?").run(banker.id);
    db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(BANKER_SPLIT_DONE, banker.id);
  })();
  clearBankerBook(db);
}

function seedDesk(db: Database.Database) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?").get(DESK_USERNAME) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE users SET is_gov = 1 WHERE id = ?").run(existing.id);
    return;
  }
  const now = Date.now();
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, created_at, is_gov) VALUES (?, ?, ?, 1)"
    )
    .run(DESK_USERNAME, bcrypt.hashSync(`desk-${now}`, 10), now);
  const userId = Number(info.lastInsertRowid);
  db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, 0, 'town', ?, ?, ?)"
  ).run(userId, STARTING_ENERGY, ENERGY_MAX, "The treasury desk is open.");
}

function seedGuest(db: Database.Database) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("Guest") as { id: number } | undefined;
  if (existing) return;
  const now = Date.now();
  const info = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run("Guest", bcrypt.hashSync("play", 10), now);
  createPlayerWithDb(db, Number(info.lastInsertRowid));
}

function createPlayerWithDb(db: Database.Database, userId: number) {
  const gold = seatGold(computersEnabled(db));
  db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, ?, 'town', ?, ?, ?)"
  ).run(
    userId,
    gold,
    STARTING_ENERGY,
    ENERGY_MAX,
    `You arrive with ${gold.toLocaleString("en-US")} coins and a place at the desk.`
  );
}

function purgeRetiredItems(db: Database.Database) {
  const retired = [...RETIRED_ITEM_IDS];
  if (retired.length === 0) return;
  const slots = retired.map(() => "?").join(", ");
  db.transaction(() => {
    const offerIds = db
      .prepare(`SELECT DISTINCT offer_id FROM swap_legs WHERE item_id IN (${slots})`)
      .all(...retired) as { offer_id: number }[];
    for (const row of offerIds) {
      db.prepare("DELETE FROM swap_legs WHERE offer_id = ?").run(row.offer_id);
      db.prepare("DELETE FROM swap_offers WHERE id = ?").run(row.offer_id);
    }
    db.prepare(`DELETE FROM inventory WHERE item_id IN (${slots})`).run(...retired);
    db.prepare(`DELETE FROM orders WHERE item_id IN (${slots})`).run(...retired);
    db.prepare(`DELETE FROM trades WHERE item_id IN (${slots})`).run(...retired);
    db.prepare(`DELETE FROM festival_contracts WHERE item_id IN (${slots})`).run(...retired);
  })();
}

export function seedBots(db: Database.Database = getDb()) {
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
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(bot.username) as { id: number } | undefined;
    if (!existing) {
      const info = insertUser.run(bot.username, hash, now);
      insertPlayer.run(
        Number(info.lastInsertRowid),
        ENERGY_MAX,
        ENERGY_MAX,
        "Sitting this table out."
      );
    } else {
      markBot.run(existing.id);
    }
  }
}

function lockOffice(db: Database.Database) {
  db.prepare("UPDATE users SET is_admin = 0 WHERE username != ?").run(OFFICE_USERNAME);
  db.prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run(OFFICE_USERNAME);
  db.prepare(
    "UPDATE users SET is_gov = 0 WHERE username NOT IN (?, ?) AND COALESCE(is_gov, 0) = 1"
  ).run(OFFICE_USERNAME, DESK_USERNAME);
}

function bootstrap(db: Database.Database) {
  migrate(db);
  clearBankerBook(db);
  seedGuest(db);
  seedDesk(db);
  seedBots(db);
  purgeRetiredItems(db);
  shareBankerHoldings(db);
  lockOffice(db);
}

function writeComputerMeta(count: number, db: Database.Database) {
  const n = Math.max(0, Math.min(MAX_COMPUTERS, Math.floor(count)));
  db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('computer_count', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(n));
  db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('computers', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(n > 0 ? "1" : "0");
  return n;
}

export function computerCount(db: Database.Database = getDb()) {
  const row = db.prepare("SELECT value FROM game_meta WHERE key = 'computer_count'").get() as
    | { value: string }
    | undefined;
  if (row != null) {
    const n = Number(row.value);
    if (Number.isFinite(n)) return Math.max(0, Math.min(MAX_COMPUTERS, Math.floor(n)));
  }
  const flag = db.prepare("SELECT value FROM game_meta WHERE key = 'computers'").get() as
    | { value: string }
    | undefined;
  const fallback = flag?.value === "0" ? 0 : MAX_COMPUTERS;
  writeComputerMeta(fallback, db);
  return fallback;
}

export function computersEnabled(db: Database.Database = getDb()) {
  return computerCount(db) > 0;
}

export function setComputerCount(count: number, db: Database.Database = getDb()) {
  return writeComputerMeta(count, db);
}

export function setComputersEnabled(on: boolean, db: Database.Database = getDb()) {
  if (!on) {
    writeComputerMeta(0, db);
    return;
  }
  const current = computerCount(db);
  writeComputerMeta(current > 0 ? current : MAX_COMPUTERS, db);
}

export function stipendMs(db: Database.Database = getDb()) {
  const row = db.prepare("SELECT value FROM game_meta WHERE key = 'stipend_ms'").get() as
    | { value: string }
    | undefined;
  const ms = Number(row?.value);
  return Number.isFinite(ms) && ms >= 1_000 ? ms : 5 * 60 * 1000;
}

export function readGoal(db: Database.Database = getDb()): GoalConfig {
  const row = db.prepare("SELECT value FROM game_meta WHERE key = 'goal'").get() as
    | { value: string }
    | undefined;
  if (!row) return defaultGoal();
  try {
    return normalizeGoal(JSON.parse(row.value) as Partial<GoalConfig>);
  } catch {
    return defaultGoal();
  }
}

export function writeGoal(goal: GoalConfig, db: Database.Database = getDb()) {
  db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('goal', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(goal));
}

export function readGameOver(db: Database.Database = getDb()): GameOverState {
  const row = db.prepare("SELECT value FROM game_meta WHERE key = 'game_over'").get() as
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

export function writeGameOver(state: GameOverState, db: Database.Database = getDb()) {
  db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('game_over', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(state));
}

export function clearGameOver(db: Database.Database = getDb()) {
  writeGameOver({ over: false, winner: null, endedAt: null, reason: null }, db);
}

export function setStipendMs(ms: number, db: Database.Database = getDb()) {
  db.prepare(
    `INSERT INTO game_meta (key, value) VALUES ('stipend_ms', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(ms));
}

function ensureItemCaps(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_caps (
      item_id TEXT PRIMARY KEY,
      authorized INTEGER NOT NULL
    )
  `);
}

export function getItemAuthorized(itemId: string, db: Database.Database = getDb()) {
  ensureItemCaps(db);
  const row = db
    .prepare("SELECT authorized FROM item_caps WHERE item_id = ?")
    .get(itemId) as { authorized: number } | undefined;
  if (row && Number.isInteger(row.authorized) && row.authorized > 0) return row.authorized;
  return itemById[itemId]?.authorized ?? 0;
}

export function setItemAuthorized(itemId: string, authorized: number, db: Database.Database = getDb()) {
  ensureItemCaps(db);
  db.prepare(
    `INSERT INTO item_caps (item_id, authorized) VALUES (?, ?)
     ON CONFLICT(item_id) DO UPDATE SET authorized = excluded.authorized`
  ).run(itemId, authorized);
}

export function getDb() {
  if (!globalForDb.bazaarDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "bazaar.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    bootstrap(db);
    globalForDb.bazaarDb = db;
    globalForDb.bazaarBootstrapRev = BOOTSTRAP_REV;
  } else if (globalForDb.bazaarBootstrapRev !== BOOTSTRAP_REV) {
    bootstrap(globalForDb.bazaarDb);
    globalForDb.bazaarBootstrapRev = BOOTSTRAP_REV;
  }
  return globalForDb.bazaarDb;
}

export function createPlayer(userId: number) {
  createPlayerWithDb(getDb(), userId);
}
