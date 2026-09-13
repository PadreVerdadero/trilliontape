"use client";

import { useEffect, useState } from "react";
import { stipendLabel } from "@/lib/game/catalog";
import { formatCoins, formatCompact, formatDuration, formatEta, formatMilitaryTime } from "@/lib/game/format";
import { buildCoinDropTimeline } from "@/lib/game/stipend-ladder";
import { cn } from "@/lib/utils";
import type { CoinDropState } from "@/lib/game/types";

function untilLabel(ms: number, stipendMs: number) {
  if (ms <= 0) return "now";
  if (stipendMs < 60_000 || ms < 90_000) return formatDuration(ms);
  return formatEta(ms);
}

export function CoinDropTimeline({
  now,
  stipendMs,
  coinDrop,
}: {
  now: number;
  stipendMs: number;
  coinDrop: CoinDropState;
}) {
  const [clock, setClock] = useState(now);
  useEffect(() => {
    setClock(now);
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);
  const withSeconds = stipendMs < 60_000;
  const timeline = buildCoinDropTimeline({
    now: clock,
    stipendMs,
    ladder: coinDrop.ladder,
    loginDays: coinDrop.loginDays,
    lastSlotKey: coinDrop.lastSlotKey,
    paidThisSlot: coinDrop.paidThisSlot,
  });
  const untilNext = timeline.nextAt - now;

  return (
    <div className="mx-1.5 mt-2 border-t border-border/60 pt-2 sm:mx-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Coin drops
        </p>
        <p className="text-[10px] text-muted-foreground">Every {stipendLabel(stipendMs)}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {timeline.loginDays === 0
          ? `No drop yet. First is ${formatCoins(timeline.nextAmount)} at ${formatMilitaryTime(timeline.nextAt, withSeconds)}.`
          : `After drop ${timeline.loginDays}. Next is ${formatCoins(timeline.nextAmount)} at ${formatMilitaryTime(timeline.nextAt, withSeconds)}.`}
      </p>
      <p className="mb-2 text-xs font-medium text-primary">
        You are here · next {untilLabel(untilNext, stipendMs) === "now" ? "due now" : `in ${untilLabel(untilNext, stipendMs)}`}
      </p>
      <ol className="space-y-1">
        {timeline.rows.map((row) => {
          const showHere = row.kind === "next";
          return (
            <li key={`${row.kind}-${row.drop}`}>
              {showHere ? (
                <div className="my-1.5 flex items-center gap-2 text-[10px] tracking-wide text-amber-200 uppercase">
                  <span className="h-px flex-1 bg-amber-400/40" />
                  You are here
                  <span className="h-px flex-1 bg-amber-400/40" />
                </div>
              ) : null}
              <div
                className={cn(
                  "grid grid-cols-[1.7rem_minmax(0,1fr)_3.1rem] items-baseline gap-x-1.5 text-xs",
                  row.kind === "paid" && "text-muted-foreground",
                  row.kind === "next" && "font-medium text-primary",
                  row.kind === "later" && "text-foreground/80"
                )}
                title={`Drop ${row.drop} · ${formatCoins(row.amount)} · ${formatMilitaryTime(row.at, true)}`}
              >
                <span className="tabular-nums">#{row.drop}</span>
                <span className="min-w-0 truncate tabular-nums">{formatCompact(row.amount)}🪙</span>
                <span className="text-right tabular-nums">
                  {formatMilitaryTime(row.at, withSeconds)}
                </span>
              </div>
              {row.kind === "paid" ? (
                <p className="pl-[1.7rem] text-[10px] text-muted-foreground">Paid</p>
              ) : null}
              {row.kind === "next" ? (
                <p className="pl-[1.7rem] text-[10px] text-primary">
                  {untilNext <= 0 ? "Due now" : `In ${untilLabel(untilNext, stipendMs)}`}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
