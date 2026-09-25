export const DEFAULT_STIPEND_LADDER = [
  1_000, 2_000, 3_000, 5_000, 8_000, 15_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
  2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000,
  1_000_000_000, 2_500_000_000, 5_000_000_000, 10_000_000_000, 25_000_000_000, 50_000_000_000,
  100_000_000_000, 250_000_000_000, 500_000_000_000,
] as const;

export const MAX_STIPEND_RUNGS = 40;
export const MAX_STIPEND_AMOUNT = 1_000_000_000_000_000;

export function defaultStipendLadder(): number[] {
  return [...DEFAULT_STIPEND_LADDER];
}

export function parseCoinAmount(raw: string): number | null {
  const text = raw.trim().replace(/,/g, "").replace(/\s/g, "");
  if (!text) return null;
  const match = /^(\d+(?:\.\d+)?)([kKmMbBtT])?$/.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  const mul =
    suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : suffix === "t" ? 1_000_000_000_000 : 1;
  const value = Math.round(n * mul);
  if (!Number.isInteger(value) || value < 1 || value > MAX_STIPEND_AMOUNT) return null;
  return value;
}

export function normalizeStipendLadder(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : defaultStipendLadder();
  const ladder: number[] = [];
  for (const row of source) {
    const amount = typeof row === "number" ? Math.round(row) : parseCoinAmount(String(row));
    if (amount == null || !Number.isInteger(amount) || amount < 1 || amount > MAX_STIPEND_AMOUNT) continue;
    ladder.push(amount);
    if (ladder.length >= MAX_STIPEND_RUNGS) break;
  }
  return ladder.length > 0 ? ladder : defaultStipendLadder();
}

export function validateStipendLadder(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Add at least one coin-drop amount.");
  }
  if (raw.length > MAX_STIPEND_RUNGS) {
    throw new Error(`The ladder can have at most ${MAX_STIPEND_RUNGS} levels.`);
  }
  const ladder: number[] = [];
  for (const [index, row] of raw.entries()) {
    const amount = typeof row === "number" ? Math.round(row) : parseCoinAmount(String(row));
    if (amount == null || !Number.isInteger(amount) || amount < 1 || amount > MAX_STIPEND_AMOUNT) {
      throw new Error(`Drop ${index + 1} must be a whole number from 1 to ${MAX_STIPEND_AMOUNT.toLocaleString("en-US")}.`);
    }
    ladder.push(amount);
  }
  return ladder;
}

export function stipendAmountAt(ladder: number[], paymentNumber: number) {
  if (paymentNumber <= 0) return 0;
  const rungs = ladder.length > 0 ? ladder : defaultStipendLadder();
  if (paymentNumber >= rungs.length) return rungs[rungs.length - 1];
  return rungs[paymentNumber - 1];
}

export function stipendCatchUp(ladder: number[], alreadyPaid: number, tablePaid: number) {
  const from = Math.max(0, Math.floor(alreadyPaid));
  const through = Math.max(0, Math.floor(tablePaid));
  let sum = 0;
  for (let n = from + 1; n <= through; n += 1) sum += stipendAmountAt(ladder, n);
  return sum;
}

export function parseStipendSlotKey(key: string | null | undefined) {
  if (!key) return null;
  const match = /^slot:(\d+):(\d+)$/.exec(key);
  if (!match) return null;
  const ms = Number(match[1]);
  const start = Number(match[2]);
  if (!Number.isFinite(ms) || !Number.isFinite(start) || ms < 1) return null;
  return { ms, start };
}

export function stipendSlotStart(now: number, slotMs: number, dailyAtMin: number | null = null, timeZone = "UTC") {
  const ms = slotMs > 0 ? slotMs : 5 * 60 * 1000;
  if (ms === 24 * 60 * 60 * 1000 && dailyAtMin != null) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(now));
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const targetUtc = Date.UTC(Number(read("year")), Number(read("month")) - 1, Number(read("day")), Math.floor(dailyAtMin / 60), dailyAtMin % 60);
    const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(new Date(targetUtc)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    const match = /GMT([+-])(\d{2}):?(\d{2})/.exec(offset);
    const offsetMs = match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000 : 0;
    const target = targetUtc - offsetMs;
    return now >= target ? target : target - ms;
  }
  return Math.floor(now / ms) * ms;
}

export type CoinDropKind = "paid" | "next" | "later";

export type CoinDropRow = {
  drop: number;
  amount: number;
  at: number;
  kind: CoinDropKind;
};

export type CoinDropTimeline = {
  loginDays: number;
  nextDrop: number;
  nextAmount: number;
  nextAt: number;
  paidThisSlot: boolean;
  rows: CoinDropRow[];
};

export function buildCoinDropTimeline(input: {
  now: number;
  stipendMs: number;
  ladder: number[];
  loginDays: number;
  lastSlotKey?: string | null;
  paidThisSlot: boolean;
  dailyAtMin?: number | null;
  timeZone?: string;
  past?: number;
  future?: number;
}): CoinDropTimeline {
  const ms = input.stipendMs > 0 ? input.stipendMs : 5 * 60 * 1000;
  const loginDays = Math.max(0, Math.floor(input.loginDays));
  const currentStart = stipendSlotStart(input.now, ms, input.dailyAtMin, input.timeZone);
  const nextDrop = loginDays + 1;
  const nextAt = input.paidThisSlot ? currentStart + ms : currentStart;
  const nextAmount = stipendAmountAt(input.ladder, nextDrop);
  const pastCount = Math.max(0, input.past ?? 2);
  const futureCount = Math.max(1, input.future ?? 8);
  const lastParsed = parseStipendSlotKey(input.lastSlotKey ?? null);
  let lastPaidAt = currentStart - ms;
  if (input.paidThisSlot && loginDays > 0) lastPaidAt = currentStart;
  else if (lastParsed) lastPaidAt = lastParsed.start;

  const rows: CoinDropRow[] = [];
  const pastStart = Math.max(1, loginDays - pastCount + 1);
  for (let drop = pastStart; drop <= loginDays; drop += 1) {
    rows.push({
      drop,
      amount: stipendAmountAt(input.ladder, drop),
      at: lastPaidAt - (loginDays - drop) * ms,
      kind: "paid",
    });
  }
  for (let i = 0; i < futureCount; i += 1) {
    const drop = nextDrop + i;
    rows.push({
      drop,
      amount: stipendAmountAt(input.ladder, drop),
      at: nextAt + i * ms,
      kind: i === 0 ? "next" : "later",
    });
  }

  return {
    loginDays,
    nextDrop,
    nextAmount,
    nextAt,
    paidThisSlot: input.paidThisSlot,
    rows,
  };
}
