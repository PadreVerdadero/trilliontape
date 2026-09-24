import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createPlayer, getDb, inviteRequired, readInviteCode } from "@/lib/game/db";

export const SESSION_COOKIE = "bazaar_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

function sessionCookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function normalizeUsername(raw: string) {
  return raw.trim();
}

export function validateUsername(username: string) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return "Use 3–20 letters, numbers, or underscores.";
  }
  const lower = username.toLowerCase();
  if (lower === "banker" || lower === "government" || lower === "guest") {
    return "That name is reserved.";
  }
  return null;
}

export function validatePassword(password: string) {
  if (password.length < 4) {
    return "Password must be at least 4 characters.";
  }
  return null;
}

export function validateCredentials(username: string, password: string) {
  return validateUsername(username) ?? validatePassword(password);
}

export function validateInviteCode(code: string) {
  const next = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,24}$/.test(next)) {
    return "Invite code: 4–24 letters or numbers.";
  }
  return null;
}

export async function registerUser(username: string, password: string, inviteCode = "") {
  const name = normalizeUsername(username);
  const secret = String(password);
  const error = validateCredentials(name, secret);
  if (error) throw new Error(error);

  const db = getDb();
  if (await inviteRequired(db)) {
    const expected = await readInviteCode(db);
    const given = inviteCode.trim().toUpperCase();
    if (!expected || given !== expected) {
      throw new Error("That invite code is wrong. Ask Jesse for the current code.");
    }
  }

  const exists = (await db
    .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
    .get(name)) as { id: number } | undefined;
  if (exists) throw new Error("That traveler name is already taken.");

  const now = Date.now();
  const hash = bcrypt.hashSync(secret, 10);
  const info = await db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(name, hash, now);
  const userId = Number(info.lastInsertRowid);
  await createPlayer(userId);
  return createSession(userId);
}

export async function loginUser(username: string, password: string) {
  const name = normalizeUsername(username);
  const secret = String(password);
  const db = getDb();
  const user = (await db
    .prepare("SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE")
    .get(name)) as { id: number; password_hash: string } | undefined;
  let ok = false;
  try {
    ok = Boolean(user) && bcrypt.compareSync(secret, String(user?.password_hash ?? ""));
  } catch {
    ok = false;
  }
  if (!user || !ok) {
    throw new Error("Unknown name or wrong password.");
  }
  return createSession(user.id);
}

export async function createSession(userId: number) {
  const db = getDb();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_MS;
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...sessionCookieBase(),
    expires: new Date(expiresAt),
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  jar.set(SESSION_COOKIE, "", {
    ...sessionCookieBase(),
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function getSessionUserId() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = (await getDb()
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?")
    .get(token)) as { user_id: number; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) {
    if (token) await getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return row.user_id;
}
