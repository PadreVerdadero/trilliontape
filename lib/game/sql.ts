import { AsyncLocalStorage } from "node:async_hooks";
import fs from "fs";
import path from "path";
import type { Client, InValue, Row, Transaction } from "@libsql/client";

export type RunResult = {
  lastInsertRowid: number;
  changes: number;
};

export type GameStmt = {
  get: (...params: unknown[]) => Promise<Record<string, unknown> | undefined>;
  all: (...params: unknown[]) => Promise<Record<string, unknown>[]>;
  run: (...params: unknown[]) => Promise<RunResult>;
};

export type GameDb = {
  prepare: (sql: string) => GameStmt;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: () => Promise<T> | T) => Promise<T>;
  bindReady: (ready: Promise<void>) => void;
  runInit: <T>(fn: () => Promise<T> | T) => Promise<T>;
};

const txStore = new AsyncLocalStorage<Transaction>();
const initStore = new AsyncLocalStorage<boolean>();

const LOCAL_FILE = "file:data/bazaar.db";

const DESK_HOSTS = new Set([
  "trilliontape.fly.dev",
  "trilliontape.com",
  "www.trilliontape.com",
]);

function envUrl() {
  let raw = process.env.TRILLIONTAPE_DATABASE_URL?.trim() ?? "";
  if (!raw) return LOCAL_FILE;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;
  let host = "";
  try {
    host = new URL(raw.replace(/^libsql:/i, "https:")).hostname.toLowerCase();
  } catch {
    return LOCAL_FILE;
  }
  // Desk hostnames are the website. A pasted fly.dev with no https used to
  // crash signup with URL_INVALID. Use the local book until data-host is set.
  if (DESK_HOSTS.has(host) || host === "localhost") return LOCAL_FILE;
  return raw;
}

function envToken() {
  const raw = process.env.TRILLIONTAPE_AUTH_TOKEN?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function isRemote(url: string) {
  return /^(libsql|https|http|wss):/i.test(url);
}

function fileUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const rest = url.slice("file:".length);
  if (rest.startsWith("//")) return url;
  const abs = path.resolve(process.cwd(), rest);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs}`;
}

function asValue(value: unknown): InValue {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  return String(value);
}

function asRecord(row: Row) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "length" || /^\d+$/.test(key)) continue;
    out[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return out;
}

async function loadClient(url: string, authToken?: string): Promise<Client> {
  if (isRemote(url)) {
    const { createClient } = await import("@libsql/client/http");
    if (!authToken) {
      throw new Error(
        "TRILLIONTAPE_AUTH_TOKEN is required for a hosted database. Create a new Turso database named trilliontape — do not reuse another project’s token."
      );
    }
    return createClient({ url, authToken, intMode: "number" });
  }
  const { createClient } = await import("@libsql/client");
  return createClient({ url: fileUrl(url), intMode: "number" });
}

export function createGameDb(): GameDb {
  const url = envUrl();
  const authToken = envToken();
  let clientPromise: Promise<Client> | null = null;
  let schemaReady = Promise.resolve();

  async function gate() {
    if (!initStore.getStore()) await schemaReady;
  }

  async function conn() {
    const tx = txStore.getStore();
    if (tx) return tx;
    if (!clientPromise) clientPromise = loadClient(url, authToken);
    return clientPromise;
  }

  function prepare(sql: string): GameStmt {
    const exec = async (params: unknown[]) => {
      await gate();
      const c = await conn();
      return c.execute({ sql, args: params.map(asValue) });
    };
    return {
      async get(...params: unknown[]) {
        const rs = await exec(params);
        const row = rs.rows[0];
        return row ? asRecord(row) : undefined;
      },
      async all(...params: unknown[]) {
        const rs = await exec(params);
        return rs.rows.map(asRecord);
      },
      async run(...params: unknown[]) {
        const rs = await exec(params);
        return {
          lastInsertRowid: Number(rs.lastInsertRowid ?? 0),
          changes: rs.rowsAffected ?? 0,
        };
      },
    };
  }

  return {
    prepare,
    async exec(sql: string) {
      await gate();
      const c = await conn();
      if ("executeMultiple" in c && typeof c.executeMultiple === "function") {
        await c.executeMultiple(sql);
        return;
      }
      for (const part of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
        await c.execute(part);
      }
    },
    async transaction<T>(fn: () => Promise<T> | T) {
      await gate();
      if (txStore.getStore()) return fn();
      const c = await conn();
      if (!("transaction" in c) || typeof c.transaction !== "function") {
        return fn();
      }
      const tx = await c.transaction("write");
      try {
        const result = await txStore.run(tx, fn);
        await tx.commit();
        return result;
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          /* ignore */
        }
        throw error;
      }
    },
    bindReady(ready: Promise<void>) {
      schemaReady = ready;
    },
    async runInit<T>(fn: () => Promise<T> | T) {
      return initStore.run(true, async () => await fn());
    },
  };
}

export function databaseTarget() {
  const url = envUrl();
  return isRemote(url) ? "hosted" : "local-file";
}
