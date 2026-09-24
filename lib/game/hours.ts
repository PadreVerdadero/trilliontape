import { formatMilitary } from "@/lib/game/format";

export type TradingWindow = {
  openMin: number;
  closeMin: number;
};

export type TradingBook = {
  timeZone: string;
  hours: Record<string, TradingWindow>;
};

const DAY_MINUTES = 24 * 60;

export function clampMinute(value: unknown) {
  const minute = Math.floor(Number(value));
  if (!Number.isInteger(minute) || minute < 0 || minute >= DAY_MINUTES) return null;
  return minute;
}

export function safeTimeZone(timeZone: string | null | undefined) {
  const tz = (timeZone || "").trim();
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

export function minuteOfDay(now: number, timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    hour12: false,
  }).formatToParts(new Date(now));
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

export function goodIsOpen(
  window: TradingWindow | null | undefined,
  now: number,
  timeZone: string
) {
  if (!window || window.openMin === window.closeMin) return true;
  const minute = minuteOfDay(now, timeZone);
  if (window.openMin < window.closeMin) {
    return minute >= window.openMin && minute < window.closeMin;
  }
  return minute >= window.openMin || minute < window.closeMin;
}

export function minutesToTimeInput(minute: number) {
  return formatMilitary(Math.floor(minute / 60), minute % 60);
}

export function describeTradingWindow(window: TradingWindow | null | undefined) {
  if (!window || window.openMin === window.closeMin) return "all day";
  return `${minutesToTimeInput(window.openMin)}–${minutesToTimeInput(window.closeMin)}`;
}

export function normalizeTradingBook(raw: unknown): TradingBook {
  const source = raw && typeof raw === "object" ? (raw as Partial<TradingBook>) : {};
  const hours: Record<string, TradingWindow> = {};
  const incoming = source.hours && typeof source.hours === "object" ? source.hours : {};
  for (const [itemId, window] of Object.entries(incoming)) {
    if (!window || typeof window !== "object") continue;
    const openMin = clampMinute((window as TradingWindow).openMin);
    const closeMin = clampMinute((window as TradingWindow).closeMin);
    if (openMin == null || closeMin == null || openMin === closeMin) continue;
    hours[itemId] = { openMin, closeMin };
  }
  return { timeZone: safeTimeZone(source.timeZone), hours };
}

export function emptyTradingBook(): TradingBook {
  return { timeZone: "UTC", hours: {} };
}
