import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { ENERGY_MAX, STARTING_ENERGY, STARTING_GOLD, WIN_ITEM_ID, itemById } from "@/lib/game/catalog";
import { BOT_PROFILES } from "@/lib/game/bots";

const globalForDb = globalThis as unknown as {
  bazaarDb?: Database.Database;
  bazaarRelicSweep?: boolean;
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
}

function ensureColumn(db: Database.Database, table: string, column: string, sql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sql}`);
  }
}

function clearBankerBook(db: Database.Database) {
  db.prepare(
    "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE username = ?)"
  ).run("Banker");
}

function shareBankerHoldings(db: Database.Database) {
  const banker = db.prepare("SELECT id FROM users WHERE username = ?").get("Banker") as
    | { id: number }
    | undefined;
  if (!banker) return;
  const stacks = db
    .prepare("SELECT item_id, quantity FROM inventory WHERE user_id = ? AND quantity > 0")
    .all(banker.id) as { item_id: string; quantity: number }[];
  if (stacks.length === 0) return;

  const bots = db
    .prepare("SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1 ORDER BY username COLLATE NOCASE")
    .all() as { id: number }[];
  const guest = db.prepare("SELECT id FROM users WHERE username = ?").get("Guest") as
    | { id: number }
    | undefined;
  const recipients = [...bots.map((row) => row.id), ...(guest ? [guest.id] : [])];
  if (recipients.length === 0) return;

  const grant = db.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`
  );

  db.transaction(() => {
    for (const stack of stacks) {
      const order = rotateIds(recipients, stack.item_id);
      const each = Math.floor(stack.quantity / order.length);
      let leftover = stack.quantity % order.length;
      for (let i = 0; i < order.length; i += 1) {
        const qty = each + (leftover > 0 ? 1 : 0);
        if (leftover > 0) leftover -= 1;
        if (qty > 0) grant.run(order[i], stack.item_id, qty);
      }
    }
    db.prepare("DELETE FROM inventory WHERE user_id = ?").run(banker.id);
    db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(
      "The bank closed. Remaining stock was split across the desk.",
      banker.id
    );
  })();
  clearBankerBook(db);
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
  db.prepare(
    "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, ?, 'town', ?, ?, ?)"
  ).run(
    userId,
    STARTING_GOLD,
    STARTING_ENERGY,
    ENERGY_MAX,
    "You arrive with a light pack and a place at the desk."
  );
  const starter: Record<string, number> = { wheat: 3, wood: 2, flax: 1, berries: 3 };
  const insert = db.prepare(
    "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)"
  );
  for (const [itemId, qty] of Object.entries(starter)) {
    insert.run(userId, itemId, qty);
  }
}

function sweepBotRelicMints(db: Database.Database) {
  if (globalForDb.bazaarRelicSweep) return;
  globalForDb.bazaarRelicSweep = true;
  db.prepare(
    `DELETE FROM inventory
     WHERE item_id = ?
       AND user_id IN (SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1)`
  ).run(WIN_ITEM_ID);
  db.prepare(
    `UPDATE orders
     SET remaining = 0
     WHERE item_id = ? AND side = 'sell' AND remaining > 0
       AND user_id IN (SELECT id FROM users WHERE COALESCE(is_bot, 0) = 1)`
  ).run(WIN_ITEM_ID);
}

function seedBots(db: Database.Database) {
  const already = db.prepare("SELECT COUNT(*) AS n FROM users WHERE COALESCE(is_bot, 0) = 1").get() as {
    n: number;
  };
  if (already.n >= BOT_PROFILES.length) return;
  const hash = bcrypt.hashSync("bot-not-for-login", 6);
  const now = Date.now();
  const insertUser = db.prepare(
    "INSERT INTO users (username, password_hash, created_at, is_bot) VALUES (?, ?, ?, 1)"
  );
  const insertInv = db.prepare(
    `INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = MAX(quantity, excluded.quantity)`
  );
  for (const bot of BOT_PROFILES) {
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(bot.username) as { id: number } | undefined;
    let userId = existing?.id;
    if (!userId) {
      const info = insertUser.run(bot.username, hash, now);
      userId = Number(info.lastInsertRowid);
      db.prepare(
        "INSERT INTO players (user_id, gold, location_id, energy, energy_max, last_event) VALUES (?, ?, 'town', ?, ?, ?)"
      ).run(userId, bot.gold, ENERGY_MAX, ENERGY_MAX, "A computer trader keeping the book honest.");
    } else {
      db.prepare("UPDATE users SET is_bot = 1 WHERE id = ?").run(userId);
    }
    for (const itemId of bot.specialty) {
      if (!itemById[itemId] || itemId === WIN_ITEM_ID) continue;
      insertInv.run(userId, itemId, bot.style === "thin" ? 6 : 22);
    }
  }
}

export function getDb() {
  if (!globalForDb.bazaarDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "bazaar.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    clearBankerBook(db);
    seedGuest(db);
    seedBots(db);
    sweepBotRelicMints(db);
    shareBankerHoldings(db);
    globalForDb.bazaarDb = db;
  } else {
    migrate(globalForDb.bazaarDb);
    clearBankerBook(globalForDb.bazaarDb);
    seedBots(globalForDb.bazaarDb);
    sweepBotRelicMints(globalForDb.bazaarDb);
    shareBankerHoldings(globalForDb.bazaarDb);
  }
  return globalForDb.bazaarDb;
}

export function createPlayer(userId: number) {
  createPlayerWithDb(getDb(), userId);
}
