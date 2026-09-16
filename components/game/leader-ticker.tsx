"use client";

import Link from "next/link";
import { ItemIcon } from "@/components/game/item-icon";
import { formatCompact, formatCompactNetWorth, formatNetWorth, formatPctChange } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { Item, LeaderRow, MarketPrice } from "@/lib/game/types";

export const TICKER_PLACES = 10;

function leadersTape(leaders: LeaderRow[], you: string, copy: number) {
  return leaders.map((row, index) => {
    const mine = row.username === you;
    return (
      <Link
        key={`${copy}-leader-${index}-${row.place}-${row.username}`}
        href="/leaders"
        className={cn(
          "inline-flex shrink-0 items-baseline gap-1.5 border-r border-border/40 px-3 font-medium tracking-wide hover:bg-foreground/5",
          mine ? "text-primary" : "text-foreground/90"
        )}
        title={`${row.username} · place ${row.place} · ${formatNetWorth(row.netWorth)}`}
      >
        <span className={cn("tabular-nums", mine ? "text-primary" : "text-muted-foreground")}>
          #{row.place}
        </span>
        <span className="max-w-[9rem] truncate">{row.username}</span>
        <span className="tabular-nums text-primary/90">{formatCompactNetWorth(row.netWorth)}</span>
      </Link>
    );
  });
}

function quotesTape(
  items: Item[],
  prices: MarketPrice[],
  copy: number,
  onSelectItem?: (itemId: string) => void
) {
  const byId = new Map(prices.map((row) => [row.itemId, row]));
  return items.map((item) => {
    const quote = byId.get(item.id);
    const last = quote?.last ?? item.basePrice;
    const open = quote?.windowOpen ?? last;
    const delta = last - open;
    const up = delta > 0;
    const down = delta < 0;
    const lastQty = quote?.lastQty ?? 0;
    const traded = quote?.last != null;
    const title = traded
      ? `${item.name} · last ${formatCompact(last)} · ${up ? "up" : down ? "down" : "unchanged"} ${formatCompact(Math.abs(delta))} (${formatPctChange(delta, open)}) from the oldest of the last 25 prints`
      : `${item.name} · no prints yet · ${formatCompact(item.basePrice)}`;
    const className = cn(
      "inline-flex shrink-0 items-baseline gap-1 border-r border-border/40 px-3 tracking-wide",
      up && "text-emerald-300",
      down && "text-rose-300",
      !up && !down && "text-sky-300"
    );
    const body = (
      <>
        <ItemIcon item={item} className="self-center text-[13px]" />
        <span className="font-medium">{item.name}</span>
        {lastQty > 1 ? (
          <span className="text-[10px] leading-none text-muted-foreground tabular-nums">{formatCompact(lastQty)}</span>
        ) : null}
        <span className="text-muted-foreground">@</span>
        <span className="tabular-nums">{formatCompact(last)}</span>
        {up ? <span aria-hidden>▲</span> : down ? <span aria-hidden>▼</span> : null}
        <span className="tabular-nums">{formatCompact(Math.abs(delta))}</span>
        <span className="tabular-nums">{formatPctChange(delta, open)}</span>
      </>
    );
    if (onSelectItem) {
      return (
        <button
          key={`${copy}-quote-${item.id}`}
          type="button"
          title={title}
          className={cn(className, "hover:bg-foreground/5")}
          onClick={() => onSelectItem(item.id)}
        >
          {body}
        </button>
      );
    }
    return (
      <span key={`${copy}-quote-${item.id}`} title={title} className={className}>
        {body}
      </span>
    );
  });
}

function tapeCopy(
  items: Item[],
  prices: MarketPrice[],
  leaders: LeaderRow[],
  you: string,
  copy: number,
  onSelectItem?: (itemId: string) => void
) {
  return (
    <>
      {quotesTape(items, prices, copy, onSelectItem)}
      {leaders.length > 0 ? (
        <Link
          href="/leaders"
          className="inline-flex shrink-0 items-center border-r border-border/40 px-3 font-heading text-[11px] tracking-[0.14em] text-primary uppercase hover:text-primary/80"
          title="Open the leaderboard"
        >
          Leaders
        </Link>
      ) : null}
      {leadersTape(leaders, you, copy)}
    </>
  );
}

export function LeaderTicker({
  leaders,
  you,
  items = [],
  prices = [],
  onSelectItem,
}: {
  leaders: LeaderRow[];
  you: string;
  items?: Item[];
  prices?: MarketPrice[];
  onSelectItem?: (itemId: string) => void;
}) {
  const top = leaders.filter((row) => row.place <= TICKER_PLACES).slice(0, TICKER_PLACES);
  if (items.length === 0 && top.length === 0) return null;

  const paddedLeaders = [...top];
  while (paddedLeaders.length > 0 && paddedLeaders.length < 8) paddedLeaders.push(...top);
  const seconds = Math.max(28, (items.length + Math.max(paddedLeaders.length, top.length) + 1) * 2.4);

  return (
    <div className="flex items-stretch border-b border-border/70 bg-card/55">
      <p className="flex shrink-0 items-center border-r border-border/70 px-2.5 font-heading text-[11px] tracking-[0.14em] text-primary uppercase sm:px-3">
        Tape
      </p>
      <div
        className="leader-ticker min-w-0 flex-1 overflow-hidden"
        aria-label="Scrolling last prints for each good, then top ten net worth."
      >
        <div
          className="leader-ticker-track flex w-max items-center py-1.5 text-[11px] sm:text-xs"
          style={{ animationDuration: `${seconds}s` }}
        >
          <div className="flex items-center">{tapeCopy(items, prices, paddedLeaders, you, 0, onSelectItem)}</div>
          <div className="flex items-center" aria-hidden="true">
            {tapeCopy(items, prices, paddedLeaders, you, 1, onSelectItem)}
          </div>
        </div>
      </div>
    </div>
  );
}
