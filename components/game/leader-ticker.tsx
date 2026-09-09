"use client";

import Link from "next/link";
import { formatCompactNetWorth, formatNetWorth } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { LeaderRow } from "@/lib/game/types";

export const TICKER_PLACES = 10;

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
        title={`${row.username} · place ${row.place} · ${formatNetWorth(row.netWorth)}`}
      >
        <span className={cn("tabular-nums", mine ? "text-primary" : "text-muted-foreground")}>
          #{row.place}
        </span>
        <span className="max-w-[9rem] truncate">{row.username}</span>
        <span className="tabular-nums text-primary/90">{formatCompactNetWorth(row.netWorth)}</span>
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
  const top = leaders.filter((row) => row.place <= TICKER_PLACES).slice(0, TICKER_PLACES);
  if (top.length === 0) return null;

  const padded = [...top];
  while (padded.length < 8) padded.push(...top);
  const seconds = Math.max(22, padded.length * 2.6);

  return (
    <Link
      href="/leaders"
      className="flex items-stretch border-b border-border/70 bg-card/55 outline-none transition-colors hover:bg-card/80 focus-visible:bg-card/80"
      title="Open the leaderboard"
    >
      <p className="flex shrink-0 items-center border-r border-border/70 px-2.5 font-heading text-[11px] tracking-[0.14em] text-primary uppercase sm:px-3">
        Leaders
      </p>
      <div
        className="leader-ticker min-w-0 flex-1 overflow-hidden"
        aria-label="Top ten net worth. Open the full leaderboard."
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
    </Link>
  );
}
