"use client";

import { formatCoins, formatCompact } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { LeaderRow } from "@/lib/game/types";

function tape(leaders: LeaderRow[], you: string, copy: number) {
  return leaders.map((row, index) => {
    const mine = row.username === you;
    return (
      <span
        key={`${copy}-${index}-${row.place}-${row.username}`}
        className={cn(
          "inline-flex shrink-0 items-baseline gap-1.5 border-r border-border/40 px-3 font-medium tracking-wide",
          mine ? "text-primary" : "text-foreground/90"
        )}
        title={`${row.username} · place ${row.place} · ${formatCoins(row.netWorth)}`}
      >
        <span className={cn("tabular-nums", mine ? "text-primary" : "text-muted-foreground")}>
          #{row.place}
        </span>
        <span className="max-w-[9rem] truncate">{row.username}</span>
        <span className="tabular-nums text-primary/90">{formatCompact(row.netWorth)}🪙</span>
      </span>
    );
  });
}

export function LeaderTicker({
  leaders,
  you,
}: {
  leaders: LeaderRow[];
  you: string;
}) {
  if (leaders.length === 0) return null;

  const padded = [...leaders];
  while (padded.length < 10) padded.push(...leaders);
  const seconds = Math.max(28, padded.length * 2.4);

  return (
    <div className="flex items-stretch border-b border-border/70 bg-card/55">
      <p className="flex shrink-0 items-center border-r border-border/70 px-2.5 font-heading text-[11px] tracking-[0.14em] text-primary uppercase sm:px-3">
        Leaders
      </p>
      <div
        className="leader-ticker min-w-0 flex-1 overflow-hidden"
        aria-label="Net worth leaderboard"
      >
        <div
          className="leader-ticker-track flex w-max items-center py-1.5 text-[11px] sm:text-xs"
          style={{ animationDuration: `${seconds}s` }}
        >
          <div className="flex items-center">{tape(padded, you, 0)}</div>
          <div className="flex items-center" aria-hidden="true">
            {tape(padded, you, 1)}
          </div>
        </div>
      </div>
    </div>
  );
}
