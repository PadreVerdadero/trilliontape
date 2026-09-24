import { NET_WORTH_GOAL, itemById, items } from "@/lib/game/catalog";
import { formatCoins, formatCompact, formatNumber } from "@/lib/game/format";
import type { LeaderRow } from "@/lib/game/types";

export type GoalMode = "threshold" | "timed";
export type GoalScore = "netWorth" | "gold" | "items";

export type GoalNeed = {
  itemId: string;
  quantity: number;
};

export type GoalConfig = {
  mode: GoalMode;
  score: GoalScore;
  threshold: number;
  durationMs: number;
  startsAt: number | null;
  endsAt: number | null;
  needs: GoalNeed[];
};

export type GameOverState = {
  over: boolean;
  winner: string | null;
  endedAt: number | null;
  reason: "threshold" | "time" | null;
};

export const GOAL_TIME_PRESETS = [
  { ms: 60_000, label: "1 minute" },
  { ms: 5 * 60_000, label: "5 minutes" },
  { ms: 15 * 60_000, label: "15 minutes" },
  { ms: 30 * 60_000, label: "30 minutes" },
  { ms: 60 * 60_000, label: "1 hour" },
  { ms: 6 * 60 * 60_000, label: "6 hours" },
  { ms: 24 * 60 * 60_000, label: "1 day" },
  { ms: 3 * 24 * 60 * 60_000, label: "3 days" },
  { ms: 7 * 24 * 60 * 60_000, label: "7 days" },
  { ms: 14 * 24 * 60 * 60_000, label: "2 weeks" },
  { ms: 30 * 24 * 60 * 60_000, label: "1 month" },
];

export function defaultGoal(): GoalConfig {
  return {
    mode: "threshold",
    score: "netWorth",
    threshold: NET_WORTH_GOAL,
    durationMs: 15 * 60_000,
    startsAt: null,
    endsAt: null,
    needs: [],
  };
}

function clampNeed(row: { itemId?: string; quantity?: number }): GoalNeed | null {
  const itemId = String(row.itemId ?? "");
  if (!itemById[itemId]) return null;
  const quantity = Math.floor(Number(row.quantity ?? 0));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99_999) return null;
  return { itemId, quantity };
}

export function normalizeGoal(raw: Partial<GoalConfig> | null | undefined, now = Date.now()): GoalConfig {
  const base = defaultGoal();
  const mode = raw?.mode === "timed" ? "timed" : "threshold";
  const score = raw?.score === "gold" || raw?.score === "items" ? raw.score : "netWorth";
  const threshold = Math.floor(Number(raw?.threshold ?? base.threshold));
  const durationMs = Math.floor(Number(raw?.durationMs ?? base.durationMs));
  const needs = (raw?.needs ?? []).map(clampNeed).filter((row): row is GoalNeed => Boolean(row));
  const unique = new Map<string, GoalNeed>();
  for (const need of needs) unique.set(need.itemId, need);
  let startsAt = raw?.startsAt == null ? null : Math.floor(Number(raw.startsAt));
  if (startsAt != null && !Number.isFinite(startsAt)) startsAt = null;
  let endsAt = raw?.endsAt == null ? null : Math.floor(Number(raw.endsAt));
  if (endsAt != null && !Number.isFinite(endsAt)) endsAt = null;
  return {
    mode,
    score,
    threshold: Number.isFinite(threshold) && threshold >= 1 ? threshold : base.threshold,
    durationMs: Number.isFinite(durationMs) && durationMs >= 1_000 ? durationMs : base.durationMs,
    startsAt,
    endsAt,
    needs: [...unique.values()].sort((a, b) => {
      const ia = items.findIndex((item) => item.id === a.itemId);
      const ib = items.findIndex((item) => item.id === b.itemId);
      return ia - ib;
    }),
  };
}

const MAX_CLOCK_MS = 30 * 24 * 60 * 60_000;

export function validateGoalDraft(raw: Partial<GoalConfig>, now = Date.now()) {
  const goal = normalizeGoal(raw);
  if (goal.score === "items" && goal.needs.length === 0) {
    throw new Error("Pick at least one good and how many of it.");
  }
  if (goal.mode === "threshold" && goal.score !== "items" && goal.threshold < 1) {
    throw new Error("The mark must be at least 1.");
  }
  if (goal.mode !== "timed") {
    return { ...goal, startsAt: null, endsAt: null };
  }
  const hasStart = raw.startsAt != null && Number.isFinite(Number(raw.startsAt));
  const hasEnd = raw.endsAt != null && Number.isFinite(Number(raw.endsAt));
  const startsAt = hasStart ? Math.floor(Number(raw.startsAt)) : now;
  const endsAt = hasEnd ? Math.floor(Number(raw.endsAt)) : startsAt + goal.durationMs;
  if (endsAt <= startsAt) throw new Error("The clock must end after it starts.");
  const span = endsAt - startsAt;
  if (span < 1_000 || span > MAX_CLOCK_MS) {
    throw new Error("The clock must run between 1 second and 30 days.");
  }
  return { ...goal, startsAt, endsAt, durationMs: span };
}

export function goalScore(row: LeaderRow, goal: GoalConfig) {
  if (goal.score === "gold") return row.gold;
  if (goal.score === "items") {
    const ids = goal.needs.length > 0 ? goal.needs.map((need) => need.itemId) : items.map((item) => item.id);
    return ids.reduce((sum, id) => sum + (row.holdings[id] ?? 0), 0);
  }
  return row.netWorth;
}

export function meetsGoal(row: LeaderRow, goal: GoalConfig) {
  if (goal.score === "items") {
    return goal.needs.length > 0 && goal.needs.every((need) => (row.holdings[need.itemId] ?? 0) >= need.quantity);
  }
  if (goal.score === "gold") return row.gold >= goal.threshold;
  return row.netWorth >= goal.threshold;
}

export function sortByGoal(leaders: LeaderRow[], goal: GoalConfig) {
  return [...leaders].sort((a, b) => {
    const diff = goalScore(b, goal) - goalScore(a, goal);
    if (diff !== 0) return diff;
    return a.username.localeCompare(b.username);
  });
}

export function describeNeeds(needs: GoalNeed[]) {
  return needs
    .map((need) => {
      const item = itemById[need.itemId];
      return `${item?.emoji ?? ""} ${item?.name ?? need.itemId} ×${formatNumber(need.quantity)}`.trim();
    })
    .join(" and ");
}

export function describeScore(goal: GoalConfig) {
  if (goal.score === "gold") return "coins";
  if (goal.score === "items") {
    if (goal.needs.length === 0) return "goods";
    if (goal.mode === "timed") {
      return goal.needs
        .map((need) => itemById[need.itemId]?.name ?? need.itemId)
        .join(" + ");
    }
    return describeNeeds(goal.needs);
  }
  return "net worth";
}

export function formatGoalStamp(ms: number, timeZone?: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || undefined,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      hour12: false,
    }).formatToParts(new Date(ms));
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    let hour = read("hour");
    if (hour === "24") hour = "00";
    return `${read("day")} ${read("month")} ${hour}:${read("minute")}`;
  } catch {
    if (timeZone) return formatGoalStamp(ms);
    return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
  }
}

export function describeGoal(goal: GoalConfig, timeZone?: string) {
  if (goal.mode === "timed") {
    if (goal.startsAt != null && goal.endsAt != null) {
      return `Most ${describeScore(goal)} from ${formatGoalStamp(goal.startsAt, timeZone)} to ${formatGoalStamp(goal.endsAt, timeZone)}.`;
    }
    return `Most ${describeScore(goal)} when the clock runs out (${goalTimeLabel(goal.durationMs)}).`;
  }
  if (goal.score === "items") return `First to hold ${describeNeeds(goal.needs)}.`;
  if (goal.score === "gold") return `First to ${formatCoins(goal.threshold)}.`;
  return `First to ${formatCompact(goal.threshold)} net worth.`;
}

export function formatGoalScore(value: number, goal: GoalConfig) {
  if (goal.score === "gold" || goal.score === "netWorth") return formatNumber(value);
  return formatNumber(value);
}

export function goalTimeLabel(ms: number) {
  const preset = GOAL_TIME_PRESETS.find((row) => row.ms === ms);
  if (preset) return preset.label;
  if (ms % (24 * 60 * 60_000) === 0) {
    const days = ms / (24 * 60 * 60_000);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (ms % (60 * 60_000) === 0) return `${ms / (60 * 60_000)} hour${ms === 60 * 60_000 ? "" : "s"}`;
  if (ms % 60_000 === 0) return `${ms / 60_000} minute${ms === 60_000 ? "" : "s"}`;
  return `${Math.max(1, Math.round(ms / 1000))} seconds`;
}

export function formatClock(endsAt: number | null, now: number) {
  if (endsAt == null) return "—";
  const left = Math.max(0, endsAt - now);
  const totalSec = Math.floor(left / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function describeGameOver(over: GameOverState, goal: GoalConfig) {
  if (!over.over || !over.winner) return "The game is over.";
  if (over.reason === "time") return `${over.winner} had the most ${describeScore(goal)} when the clock ran out.`;
  if (goal.score === "items") return `${over.winner} was first to hold ${describeNeeds(goal.needs)}.`;
  if (goal.score === "gold") return `${over.winner} was first to ${formatCoins(goal.threshold)}.`;
  return `${over.winner} was first to ${formatCompact(goal.threshold)} net worth.`;
}
