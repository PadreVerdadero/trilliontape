import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { items, STARTING_GOLD } from "@/lib/game/catalog";

const globalForDb = globalThis as unknown as {
  bazaarDb?: Database.Database;
};

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

    CREATE INDEX IF NOT EXISTS idx_orders_book ON orders(item_id, side, price, created_at);
    CREATE INDEX IF NOT EXISTS idx_trades_item ON trades(item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
}

function seedBanker(db: Database.Database) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("Banker") as { id: number } | undefined;
  if (existing) return;

  const now = Date.now();
  const passwordHash = bcrypt.hashSync(crypto.randomUUID(), 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
    )
    .run("Banker", passwordHash, now);
  const bankerId = Number(info.lastInsertRowid);

  db.prepare(
    "INSERT INTO players (user_id, gold, location_id) VALUES (?, ?, ?)"
  ).run(bankerId, 5000, "town");

  const stock: Record<string, number> = {
    wood: 24,
    wheat: 24,
    stone: 18,
    fish: 14,
    flax: 12,
    herbs: 10,
    salt: 10,
    flower: 10,
    shell: 8,
    coal: 6,
    iron: 4,
  };

  const insertInv = db.prepare(
    "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)"
  );
  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at) VALUES (?, ?, 'sell', ?, ?, ?)"
  );

  for (const [itemId, qty] of Object.entries(stock)) {
    insertInv.run(bankerId, itemId, qty);
    const item = items.find((entry) => entry.id === itemId);
    if (!item) continue;
    const lot = Math.min(4, qty);
    insertOrder.run(
      bankerId,
      itemId,
      Math.max(2, Math.round(item.basePrice * 1.25)),
      lot,
      now
    );
  }

  const bids: { itemId: string; price: number; qty: number }[] = [
    { itemId: "bread", price: 9, qty: 8 },
    { itemId: "planks", price: 11, qty: 6 },
    { itemId: "charm", price: 14, qty: 5 },
    { itemId: "brick", price: 14, qty: 4 },
    { itemId: "salve", price: 16, qty: 4 },
    { itemId: "basket", price: 14, qty: 4 },
  ];
  const insertBid = db.prepare(
    "INSERT INTO orders (user_id, item_id, side, price, remaining, created_at) VALUES (?, ?, 'buy', ?, ?, ?)"
  );
  for (const bid of bids) {
    insertBid.run(bankerId, bid.itemId, bid.price, bid.qty, now);
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
    seedBanker(db);
    globalForDb.bazaarDb = db;
  }
  return globalForDb.bazaarDb;
}

export function createPlayer(userId: number) {
  const db = getDb();
  db.prepare(
    "INSERT INTO players (user_id, gold, location_id, last_event) VALUES (?, ?, 'town', ?)"
  ).run(
    userId,
    STARTING_GOLD,
    "You arrive in Lantern Plaza with a light pack and a stall token."
  );
  const starter: Record<string, number> = { wheat: 3, wood: 2, flax: 1 };
  const insert = db.prepare(
    "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)"
  );
  for (const [itemId, qty] of Object.entries(starter)) {
    insert.run(userId, itemId, qty);
  }
}
