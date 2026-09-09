import { itemById } from "@/lib/game/catalog";
import { formatMilitary, formatMilitaryRange } from "@/lib/game/format";

export const RUMOR_COST = 15;
export const CRATE_COST = 25;
export const STALL_SELL_MARKUP = 1.1;

export type FestivalClock = {
  timeZone: string;
  now: number;
  weekday: number;
  hour: number;
  minute: number;
  dateKey: string;
  label: string;
};

export type HourWindow = {
  days: number[];
  startHour: number;
  endHour: number;
};

export type StallDef = {
  id: string;
  emoji: string;
  name: string;
  role: string;
  blurb: string;
  hoursLabel: string;
  windows: HourWindow[];
  buyIds: string[];
  sellIds: string[];
  baseBuyRate: number;
  chalkRate: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const stalls: StallDef[] = [
  {
    id: "mira",
    emoji: "🍞",
    name: "Mira",
    role: "Baker",
    blurb: "Buys wheat. Wheat pays extra before breakfast on weekends.",
    hoursLabel: `Daily ${formatMilitaryRange(7, 10)}. Weekends until ${formatMilitary(12)}.`,
    windows: [
      { days: [1, 2, 3, 4, 5], startHour: 7, endHour: 10 },
      { days: [0, 6], startHour: 7, endHour: 12 },
    ],
    buyIds: ["wheat"],
    sellIds: [],
    baseBuyRate: 0.8,
    chalkRate: 1.3,
  },
  {
    id: "ket",
    emoji: "⚒️",
    name: "Old Ket",
    role: "Smith",
    blurb: "Buys coal and stone. Sells bricks. Coal pays better on forge weekdays.",
    hoursLabel: `Weekdays ${formatMilitaryRange(13, 17)}.`,
    windows: [{ days: [1, 2, 3, 4, 5], startHour: 13, endHour: 17 }],
    buyIds: ["coal", "stone"],
    sellIds: ["brick"],
    baseBuyRate: 0.8,
    chalkRate: 1.3,
  },
  {
    id: "han",
    emoji: "🐟",
    name: "Tide Han",
    role: "Fishmonger",
    blurb: "Buys fish and shells.",
    hoursLabel: `Daily ${formatMilitaryRange(5, 8)}. Saturday until ${formatMilitary(12)}.`,
    windows: [
      { days: [0, 1, 2, 3, 4, 5], startHour: 5, endHour: 8 },
      { days: [6], startHour: 5, endHour: 12 },
    ],
    buyIds: ["fish", "shell"],
    sellIds: [],
    baseBuyRate: 0.8,
    chalkRate: 1.6,
  },
  {
    id: "nim",
    emoji: "🌿",
    name: "Nim",
    role: "Herbalist",
    blurb: "Buys mushrooms and berries.",
    hoursLabel: `Mon, Wed, Fri ${formatMilitaryRange(17, 21)}.`,
    windows: [{ days: [1, 3, 5], startHour: 17, endHour: 21 }],
    buyIds: ["mushrooms", "berries"],
    sellIds: [],
    baseBuyRate: 0.8,
    chalkRate: 1.3,
  },
  {
    id: "lark",
    emoji: "🌸",
    name: "Lark",
    role: "Florist",
    blurb: "Buys flowers.",
    hoursLabel: `Nightly ${formatMilitaryRange(18, 23)}.`,
    windows: [{ days: [0, 1, 2, 3, 4, 5, 6], startHour: 18, endHour: 23 }],
    buyIds: ["flower"],
    sellIds: [],
    baseBuyRate: 0.8,
    chalkRate: 1.3,
  },
  {
    id: "broker",
    emoji: "🌙",
    name: "The Night Broker",
    role: "Night desk",
    blurb: "Friday after dark. Buys gems. Thin book, fat prices.",
    hoursLabel: `Friday ${formatMilitaryRange(18, 21)}.`,
    windows: [{ days: [5], startHour: 18, endHour: 21 }],
    buyIds: ["gem"],
    sellIds: [],
    baseBuyRate: 1.4,
    chalkRate: 1.8,
  },
];

export const stallById = Object.fromEntries(stalls.map((stall) => [stall.id, stall]));

export function safeTimeZone(timeZone: string | null | undefined) {
  const tz = String(timeZone ?? "UTC").trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return "UTC";
  }
}

export function festivalClock(timeZone: string | null | undefined, now = Date.now()): FestivalClock {
  const tz = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayName = read("weekday");
  const weekday = Math.max(0, WEEKDAYS.indexOf(weekdayName as (typeof WEEKDAYS)[number]));
  let hour = Number(read("hour"));
  const minute = Number(read("minute"));
  const period = read("dayPeriod").toLowerCase();
  if (period.startsWith("p") && hour < 12) hour += 12;
  if ((period.startsWith("a") && hour === 12) || hour === 24) hour = 0;
  const dateKey = `${read("year")}-${read("month")}-${read("day")}`;
  const label = `${weekdayName} ${formatMilitary(hour, minute)} (${tz})`;
  return { timeZone: tz, now, weekday, hour, minute, dateKey, label };
}

export function startOfLocalDayMs(timeZone: string | null | undefined, now = Date.now()) {
  const tz = safeTimeZone(timeZone);
  const today = festivalClock(tz, now).dateKey;
  let left = now - 36 * 3_600_000;
  let right = now;
  while (right - left > 1) {
    const mid = Math.floor((left + right) / 2);
    if (festivalClock(tz, mid).dateKey === today) right = mid;
    else left = mid;
  }
  return right;
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekId(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const shift = new Date(Date.UTC(year, 0, 1));
  const diff = Math.floor((utc.getTime() - shift.getTime()) / 86_400_000);
  return `${year}-W${Math.floor(diff / 7) + 1}`;
}

function inWindow(window: HourWindow, weekday: number, hour: number) {
  return window.days.includes(weekday) && hour >= window.startHour && hour < window.endHour;
}

export function sundayMarketOpen(clock: FestivalClock) {
  return clock.weekday === 0 && clock.hour >= 10 && clock.hour < 14;
}

export function stallOpen(stall: StallDef, clock: FestivalClock) {
  if (sundayMarketOpen(clock)) return true;
  return stall.windows.some((window) => inWindow(window, clock.weekday, clock.hour));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function chalkboardItem(stallId: string, dateKey: string) {
  const stall = stallById[stallId];
  if (!stall || stall.buyIds.length === 0) return "";
  return stall.buyIds[hashString(`${dateKey}:${stallId}`) % stall.buyIds.length];
}

export function stallBuyRate(stall: StallDef, itemId: string, clock: FestivalClock, chalkId: string) {
  if (!stall.buyIds.includes(itemId)) return 0;
  let rate = stall.baseBuyRate;
  if (itemId === chalkId) rate = Math.max(rate, stall.chalkRate);
  if (
    stall.id === "mira" &&
    itemId === "wheat" &&
    (clock.weekday === 0 || clock.weekday === 6) &&
    clock.hour < 10
  ) {
    rate = Math.max(rate, 1.5);
  }
  if (stall.id === "ket" && itemId === "coal" && clock.weekday >= 1 && clock.weekday <= 5) {
    rate = Math.max(rate, 1.2);
  }
  return rate;
}

export function stallSellPrice(itemId: string, marketValue: number) {
  const base = itemById[itemId]?.basePrice ?? marketValue;
  return Math.max(1, Math.round(Math.max(marketValue, base) * STALL_SELL_MARKUP));
}

function clockAtHour(timeZone: string, now: number, addHours: number): FestivalClock {
  return festivalClock(timeZone, now + addHours * 3_600_000);
}

export function nextStallChange(stall: StallDef, clock: FestivalClock) {
  const openNow = stallOpen(stall, clock);
  for (let hour = 0; hour <= 24 * 8; hour += 1) {
    const probe = clockAtHour(clock.timeZone, clock.now, hour);
    if (stallOpen(stall, probe) !== openNow) {
      const at = clock.now + hour * 3_600_000 - clock.minute * 60_000;
      return {
        at: Math.max(clock.now, at),
        opens: !openNow,
      };
    }
  }
  return { at: clock.now + 86_400_000, opens: !openNow };
}

export function windowKey(stallId: string, clock: FestivalClock) {
  const stall = stallById[stallId];
  if (!stall) return `${clock.dateKey}:${stallId}:none`;
  if (stallOpen(stall, clock)) {
    if (sundayMarketOpen(clock)) return `${clock.dateKey}:${stallId}:sunday`;
    const current = stall.windows.find((window) => inWindow(window, clock.weekday, clock.hour));
    return `${clock.dateKey}:${stallId}:${current?.startHour ?? clock.hour}`;
  }
  const next = nextStallChange(stall, clock);
  const nextClock = festivalClock(clock.timeZone, next.at + 60_000);
  if (sundayMarketOpen(nextClock)) return `${nextClock.dateKey}:${stallId}:sunday`;
  const current = stall.windows.find((window) => inWindow(window, nextClock.weekday, nextClock.hour));
  return `${nextClock.dateKey}:${stallId}:${current?.startHour ?? nextClock.hour}`;
}

export const CONTRACT_TEMPLATES = [
  {
    id: "wheat-run",
    stallId: "mira",
    itemId: "wheat",
    quantity: 6,
    vp: 2,
    gold: 40,
    hours: 48,
    title: "Breakfast rush",
    detail: "Mira needs six wheat before the morning window closes for good.",
  },
  {
    id: "brick-order",
    stallId: "ket",
    itemId: "brick",
    quantity: 1,
    vp: 4,
    gold: 80,
    hours: 72,
    title: "Forge commission",
    detail: "Old Ket promised a brick by Thursday.",
  },
  {
    id: "sick-week",
    stallId: "nim",
    itemId: "mushrooms",
    quantity: 3,
    vp: 3,
    gold: 50,
    hours: 48,
    title: "Fever going around",
    detail: "Nim will take three mushrooms while the story lasts.",
  },
  {
    id: "night-gem",
    stallId: "broker",
    itemId: "gem",
    quantity: 1,
    vp: 4,
    gold: 90,
    hours: 72,
    title: "Friday case",
    detail: "The night broker wants a gem on the desk.",
  },
  {
    id: "feed-night",
    stallId: "mira",
    itemId: "*food",
    quantity: 10,
    vp: 2,
    gold: 35,
    hours: 48,
    title: "Feed the night market",
    detail: "Any mix of berries or fish — ten bites total.",
  },
  {
    id: "han-fish",
    stallId: "han",
    itemId: "fish",
    quantity: 8,
    vp: 2,
    gold: 40,
    hours: 72,
    title: "Standing: fish for the tide",
    detail: "Han’s standing order. Eight fish before the slip expires.",
  },
  {
    id: "lark-bloom",
    stallId: "lark",
    itemId: "flower",
    quantity: 4,
    vp: 1,
    gold: 20,
    hours: 24,
    title: "Lantern garlands",
    detail: "Lark is short four flowers for the evening strings.",
  },
] as const;

export function contractsForWeek(week: string) {
  const offset = hashString(week) % CONTRACT_TEMPLATES.length;
  return Array.from({ length: 5 }, (_, index) => CONTRACT_TEMPLATES[(offset + index) % CONTRACT_TEMPLATES.length]);
}

export function donationCost(donateCount: number) {
  return 50 * 2 ** Math.max(0, donateCount);
}
