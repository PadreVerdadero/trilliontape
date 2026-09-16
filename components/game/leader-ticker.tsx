"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ItemIcon } from "@/components/game/item-icon";
import { formatCompact, formatCompactNetWorth, formatNetWorth, formatPctChange } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { Item, LeaderRow, MarketPrice } from "@/lib/game/types";

export const TICKER_PLACES = 10;

type QuoteChip = {
  itemId: string;
  item: Pick<Item, "id" | "name" | "emoji" | "image">;
  last: number;
  lastQty: number;
  delta: number;
  pct: string;
  up: boolean;
  down: boolean;
  title: string;
};

function buildQuotes(items: Item[], prices: MarketPrice[]): QuoteChip[] {
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
    const pct = up || down ? formatPctChange(delta, open) : "";
    const title = traded
      ? `${item.name} · last ${formatCompact(last)}${up || down ? ` · ${up ? "up" : "down"} ${formatCompact(Math.abs(delta))} (${pct}) from the oldest of the last 25 prints` : " · unchanged from the oldest of the last 25 prints"}`
      : `${item.name} · no prints yet · ${formatCompact(item.basePrice)}`;
    return {
      itemId: item.id,
      item: { id: item.id, name: item.name, emoji: item.emoji, image: item.image },
      last,
      lastQty,
      delta,
      pct,
      up,
      down,
      title,
    };
  });
}

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

function quotesTape(quotes: QuoteChip[], copy: number, onSelectItem?: (itemId: string) => void) {
  return quotes.map((quote) => {
    const className = cn(
      "inline-flex shrink-0 items-baseline gap-1 border-r border-border/40 px-3 tracking-wide",
      quote.up && "text-emerald-300",
      quote.down && "text-rose-300",
      !quote.up && !quote.down && "text-sky-300"
    );
    const body = (
      <>
        <ItemIcon item={quote.item} className="self-center text-[13px]" />
        <span className="font-medium">{quote.item.name}</span>
        {quote.lastQty > 1 ? (
          <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
            {formatCompact(quote.lastQty)}
          </span>
        ) : null}
        <span className="text-muted-foreground">@</span>
        <span className="tabular-nums">{formatCompact(quote.last)}</span>
        {quote.up ? <span aria-hidden>▲</span> : quote.down ? <span aria-hidden>▼</span> : null}
        {quote.up || quote.down ? (
          <>
            <span className="tabular-nums">{formatCompact(Math.abs(quote.delta))}</span>
            <span className="tabular-nums">{quote.pct}</span>
          </>
        ) : null}
      </>
    );
    if (onSelectItem) {
      return (
        <button
          key={`${copy}-quote-${quote.itemId}`}
          type="button"
          title={quote.title}
          className={cn(className, "hover:bg-foreground/5")}
          onClick={() => onSelectItem(quote.itemId)}
        >
          {body}
        </button>
      );
    }
    return (
      <span key={`${copy}-quote-${quote.itemId}`} title={quote.title} className={className}>
        {body}
      </span>
    );
  });
}

function tapeCopy(
  quotes: QuoteChip[],
  leaders: LeaderRow[],
  you: string,
  copy: number,
  onSelectItem?: (itemId: string) => void
) {
  return (
    <>
      {quotesTape(quotes, copy, onSelectItem)}
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
  const quotes = useMemo(() => buildQuotes(items, prices), [items, prices]);
  const top = useMemo(
    () => leaders.filter((row) => row.place <= TICKER_PLACES).slice(0, TICKER_PLACES),
    [leaders]
  );

  const live = useMemo(() => ({ quotes, leaders: top, you }), [quotes, top, you]);
  const liveRef = useRef(live);
  liveRef.current = live;

  const [frozen, setFrozen] = useState(live);
  const [reduce, setReduce] = useState(false);
  const catalogKey = items.map((item) => item.id).join(",");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setFrozen(liveRef.current);
  }, [catalogKey]);

  if (items.length === 0 && top.length === 0) return null;

  const shown = reduce ? live : frozen;
  const seconds = Math.max(18, (items.length + Math.max(top.length, 1) + 1) * 2.4);

  return (
    <div className="flex items-stretch border-b border-border/70 bg-card/55">
      <p className="flex shrink-0 items-center border-r border-border/70 px-2.5 font-heading text-[11px] tracking-[0.14em] text-primary uppercase sm:px-3">
        Tape
      </p>
      <div
        className="leader-ticker min-w-0 flex-1 overflow-hidden"
        aria-label="Scrolling last prints for each good, then leaders by net worth."
      >
        <div
          className="leader-ticker-track flex w-max items-center py-1.5 text-[11px] sm:text-xs"
          style={{ animationDuration: `${seconds}s` }}
          onAnimationIteration={() => {
            if (reduce) return;
            setFrozen(liveRef.current);
          }}
        >
          <div className="flex items-center">
            {tapeCopy(shown.quotes, shown.leaders, shown.you, 0, onSelectItem)}
          </div>
          <div className="flex items-center" aria-hidden="true">
            {tapeCopy(shown.quotes, shown.leaders, shown.you, 1, onSelectItem)}
          </div>
        </div>
      </div>
    </div>
  );
}
