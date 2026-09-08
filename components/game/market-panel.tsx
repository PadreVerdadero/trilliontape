"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import type { MarketSort, SortColumn, SortDir } from "@/lib/game/market-sort";
import {
  rarityClass,
  rarityLabel,
  rarityOf,
  rarityText,
  type RarityMap,
} from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import { useOrderBook } from "@/hooks/use-game";
import { PriceChart } from "@/components/game/price-chart";
import { SwapPanel } from "@/components/game/swap-panel";
import type { GameState, Item, OrderSide } from "@/lib/game/types";

function SortHead({
  label,
  column,
  sort,
  dir,
  onSort,
  className,
  active: activeOverride,
  emphasize = true,
}: {
  label: ReactNode;
  column: SortColumn;
  sort: MarketSort;
  dir: "asc" | "desc";
  onSort: (column: SortColumn) => void;
  className?: string;
  active?: boolean;
  emphasize?: boolean;
}) {
  const active =
    activeOverride ?? (column === "book" ? sort === "bookBid" || sort === "bookAsk" : sort === column);
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "grid w-full min-w-0 grid-cols-[0.7rem_minmax(0,1fr)] items-center gap-0.5 rounded-md text-left uppercase transition-colors hover:text-foreground",
        className,
        active && emphasize && "text-foreground"
      )}
    >
      <span
        className={cn("flex h-3 w-3 items-center justify-center", !active && "invisible")}
        aria-hidden
      >
        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-current">
          {dir === "desc" ? <path d="M1 2.5h8L5 8.5z" /> : <path d="M1 8.5h8L5 2.5z" />}
        </svg>
      </span>
      <span className="min-w-0 truncate tracking-wide">{label}</span>
    </button>
  );
}

function snapshotScrolls() {
  const win = { x: window.scrollX, y: window.scrollY };
  const panels = [...document.querySelectorAll<HTMLElement>("[data-keep-scroll]")].map((el) => ({
    el,
    left: el.scrollLeft,
    top: el.scrollTop,
  }));
  return { win, panels };
}

function restoreScrolls(shot: ReturnType<typeof snapshotScrolls>) {
  window.scrollTo(shot.win.x, shot.win.y);
  for (const panel of shot.panels) {
    panel.el.scrollLeft = panel.left;
    panel.el.scrollTop = panel.top;
  }
}

function withPreservedScroll(run: () => void) {
  const shot = snapshotScrolls();
  run();
  restoreScrolls(shot);
  requestAnimationFrame(() => {
    restoreScrolls(shot);
    requestAnimationFrame(() => restoreScrolls(shot));
  });
}

function focusOrderField(el: HTMLInputElement | null, fallbackId?: string) {
  const field =
    el ??
    (fallbackId ? document.getElementById(fallbackId) : null);
  if (!(field instanceof HTMLInputElement)) return;
  field.focus({ preventScroll: true });
  field.select();
}

function shortcutTargetIsText(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const field = target.closest("input, textarea, select");
  if (!field || !(field instanceof HTMLElement)) return false;
  return field.id !== "px" && field.id !== "qty";
}

function unitRows<T extends { remaining: number }>(rows: T[]) {
  return rows.flatMap((row) =>
    Array.from({ length: Math.max(0, row.remaining) }, (_, unit) => ({
      ...row,
      remaining: 1,
      unit,
    }))
  );
}

export function MarketPanel({
  state,
  pending,
  onOrder,
  onTake,
  onCancel,
  onProposeSwap,
  onAcceptSwap,
  onCancelSwap,
  onDeclineSwap,
  selectedItemId,
  onSelectItem,
  rankedItems,
  rarityMap,
  sort,
  sortDir,
  cycleSort,
}: {
  state: GameState;
  pending: boolean;
  onOrder: (input: {
    itemId: string;
    side: OrderSide;
    price: number;
    quantity: number;
  }) => Promise<unknown>;
  onTake: (orderId: number) => Promise<unknown>;
  onCancel: (orderId: number) => Promise<unknown>;
  onProposeSwap: (input: {
    toUsername: string | null;
    giveGold: number;
    wantGold: number;
    give: { itemId: string; quantity: number }[];
    want: { itemId: string; quantity: number }[];
  }) => Promise<unknown>;
  onAcceptSwap: (offerId: number) => Promise<unknown>;
  onCancelSwap: (offerId: number) => Promise<unknown>;
  onDeclineSwap: (offerId: number) => Promise<unknown>;
  selectedItemId: string;
  onSelectItem: (itemId: string) => void;
  rankedItems: Item[];
  rarityMap: RarityMap;
  sort: MarketSort;
  sortDir: SortDir;
  cycleSort: (column: SortColumn) => void;
}) {
  const selected = itemById[selectedItemId];
  const price = state.prices.find((row) => row.itemId === selectedItemId);
  const { book, reloadBook } = useOrderBook(selectedItemId);
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const priceRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const suggested = useMemo(() => {
    return String(Math.max(1, Math.round(Number(price?.bestAsk ?? price?.vwap ?? selected?.basePrice ?? 5))));
  }, [price, selected]);
  const draftQty = Number(qtyInput);
  const draftPrice = Number(priceInput || suggested);
  const draftTotal =
    Number.isFinite(draftQty) && draftQty > 0 && Number.isFinite(draftPrice) && draftPrice > 0
      ? draftQty * draftPrice
      : null;

  async function place(next: OrderSide) {
    if (!selected) return;
    await onOrder({
      itemId: selected.id,
      side: next,
      price: Number(priceInput || suggested),
      quantity: Number(qtyInput),
    });
    await reloadBook();
  }

  function pick(id: string) {
    onSelectItem(id);
    setPriceInput("");
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (shortcutTargetIsText(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "s") {
        event.preventDefault();
        const ids = rankedItems.map((item) => item.id);
        if (ids.length === 0) return;
        const at = ids.indexOf(selectedItemId);
        const index = at < 0 ? 0 : at;
        const next =
          key === "w" ? Math.max(0, index - 1) : Math.min(ids.length - 1, index + 1);
        if (next === index && at >= 0) return;
        withPreservedScroll(() => pick(ids[next]));
        return;
      }
      if (key === "a") {
        event.preventDefault();
        withPreservedScroll(() => focusOrderField(priceRef.current, "px"));
        return;
      }
      if (key === "d") {
        event.preventDefault();
        withPreservedScroll(() => focusOrderField(qtyRef.current, "qty"));
        return;
      }
      if (event.repeat) return;
      if (key === "v") {
        event.preventDefault();
        if (!pending) void place("buy");
        return;
      }
      if (key === "x") {
        event.preventDefault();
        if (!pending) void place("sell");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-xl sm:text-2xl">Player market</p>
          <p className="text-xs text-muted-foreground">
            Crossing bids fill at the ask. Bid/Ask is units on the book. Volume is stock in packs.
            Tap a column to sort. Bid/Ask: two taps on bids, then two on asks. Pack on the left
            follows this order. W/S select · A price · D qty · V buy · X sell.
          </p>
        </div>
        {state.recentTrades[0] ? (
          <p className="rounded-lg bg-primary/10 px-2 py-1 text-xs">
            Last tape: {itemById[state.recentTrades[0].itemId]?.emoji}{" "}
            {formatNumber(state.recentTrades[0].quantity)} @{" "}
            {formatCoins(state.recentTrades[0].price)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No trades yet. Post the first order.</p>
        )}
      </div>

      {selected ? (
        <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="font-heading text-xl">
                {selected.emoji} {selected.name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[28rem] sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Value"
                value={price?.last != null ? formatCoins(price.last) : "none"}
                tone={
                  price?.last == null
                    ? "valueNone"
                    : price.last < (price.vwap ?? selected.basePrice)
                      ? "valueDown"
                      : "valueUp"
                }
                title="Last board print"
              />
              <Stat
                label="Best bid"
                value={price?.bestBid != null ? formatCoins(price.bestBid) : "none"}
                tone="bid"
              />
              <Stat
                label="Best ask"
                value={price?.bestAsk != null ? formatCoins(price.bestAsk) : "none"}
                tone="ask"
              />
              <Stat label="MV" value={formatCoins(price?.vwap ?? selected.basePrice)} tone="mv" />
              <Stat
                label="Bid/Ask"
                value={`${formatNumber(price?.wanted ?? 0)}/${formatNumber(price?.listed ?? 0)}`}
                tone="vol"
                title="Units on bids / units on asks"
              />
              <Stat
                label="Volume"
                value={formatNumber(price?.held ?? 0)}
                tone="supply"
                title="Total in packs that could trade"
              />
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] lg:items-start">
            <div className="rounded-lg bg-background/40 p-2 ring-1 ring-foreground/10">
              <p className="mb-1 font-heading text-sm">Post your own order</p>
              <p className="mb-1 text-[10px] leading-4 text-muted-foreground">
                <kbd className="text-foreground">A</kbd> price · <kbd className="text-foreground">D</kbd> qty
                · <kbd className="text-foreground">V</kbd> buy · <kbd className="text-foreground">X</kbd> sell
              </p>
              {state.player.isGov ? (
                <p className="mb-1 text-[10px] leading-4 text-amber-100/90">
                  Treasury is unlimited. Asks mint on fill, bids burn on fill.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label htmlFor="px" className="text-xs">
                    <span aria-hidden>🪙</span>
                    <span className="sr-only">Price each</span>
                  </Label>
                  <Input
                    id="px"
                    ref={priceRef}
                    className="h-8 md:h-7"
                    inputMode="numeric"
                    value={priceInput}
                    placeholder={suggested}
                    onChange={(event) => setPriceInput(event.target.value)}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="qty" className="text-xs">
                    <span aria-hidden>#</span>
                    <span className="sr-only">How many</span>
                  </Label>
                  <Input
                    id="qty"
                    ref={qtyRef}
                    className="h-8 md:h-7"
                    inputMode="numeric"
                    value={qtyInput}
                    onChange={(event) => setQtyInput(event.target.value)}
                  />
                </div>
                <Button
                  className="h-8 bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={pending}
                  onClick={() => void place("buy")}
                >
                  Buy
                </Button>
                <Button
                  className="h-8 bg-rose-600 text-white hover:bg-rose-500"
                  disabled={pending}
                  onClick={() => void place("sell")}
                >
                  Sell
                </Button>
              </div>
              {draftTotal != null ? (
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  {formatNumber(draftQty)} × {formatCoins(draftPrice)} = {formatCoins(draftTotal)}
                </p>
              ) : null}
            </div>

            <div>
              <p className="mb-1 font-heading text-sm">
                Recent {selected.emoji} {selected.name} trades
              </p>
              {(book?.trades ?? []).length === 0 ? (
                <p className="rounded-lg bg-background/40 p-2 text-xs text-muted-foreground ring-1 ring-foreground/10">
                  No prints for this item yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((column) => {
                    const slice = (book?.trades ?? []).slice(column * 5, column * 5 + 5);
                    return (
                      <div
                        key={column}
                        className="rounded-lg bg-background/40 p-2 ring-1 ring-foreground/10"
                      >
                        {slice.length === 0 ? (
                          <p className="text-xs text-muted-foreground">—</p>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {slice.map((trade) => (
                              <li key={trade.id} className="flex min-w-0 items-baseline gap-1.5">
                                <span className="shrink-0 tabular-nums">{formatCoins(trade.price)}</span>
                                <span className="min-w-0 truncate">
                                  <span className="text-emerald-200">{trade.buyUsername}</span>
                                  <span className="text-muted-foreground"> – </span>
                                  <span className="text-rose-200">{trade.sellUsername}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <PriceChart
            trades={book?.trades ?? []}
            basePrice={selected.basePrice}
            mv={price?.vwap ?? selected.basePrice}
            bestBid={price?.bestBid}
            bestAsk={price?.bestAsk}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-emerald-950/25 p-3 ring-1 ring-emerald-400/20">
              <p className="mb-2 font-heading text-lg text-emerald-100">Bids</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tap a row to sell 1. Tap yours to cancel 1.
              </p>
              <OrderList
                empty="No bids. Post one above if you want this."
                side="buy"
                rows={book?.bids ?? []}
                selfId={state.player.id}
                pending={pending}
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
                onCancel={async (id) => {
                  await onCancel(id);
                  await reloadBook();
                }}
              />
            </div>
            <div className="rounded-xl bg-rose-950/20 p-3 ring-1 ring-rose-400/20">
              <p className="mb-2 font-heading text-lg text-rose-100">Asks</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tap a row to buy 1. Tap yours to cancel 1.
              </p>
              <OrderList
                empty="No asks. Post your own, or wait for a regular."
                side="sell"
                rows={book?.asks ?? []}
                selfId={state.player.id}
                pending={pending}
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
                onCancel={async (id) => {
                  await onCancel(id);
                  await reloadBook();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:px-4">
          <SortHead label="Item" column="item" sort={sort} dir={sortDir} onSort={cycleSort} />
          <SortHead
            label="Best bid"
            column="bid"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-emerald-200/90"
          />
          <SortHead
            label="Best ask"
            column="ask"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-rose-200/90"
          />
          <SortHead
            label="MV"
            column="mv"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-sky-200/90"
          />
          <SortHead
            label={
              <>
                <span
                  className={cn(
                    sort === "bookBid" && "text-emerald-300",
                    sort === "bookAsk" && "opacity-40"
                  )}
                >
                  Bid
                </span>
                /
                <span
                  className={cn(
                    sort === "bookAsk" && "text-rose-300",
                    sort === "bookBid" && "opacity-40"
                  )}
                >
                  Ask
                </span>
              </>
            }
            column="book"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-amber-200/90"
            emphasize={false}
          />
          <SortHead
            label="Volume"
            column="volume"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-violet-200/90"
          />
        </div>
        <div className="max-h-[min(72vh,40rem)] overflow-auto">
          {rankedItems.map((item) => {
            const quote = state.prices.find((row) => row.itemId === item.id);
            const active = item.id === selectedItemId;
            const wanted = quote?.wanted ?? 0;
            const listed = quote?.listed ?? 0;
            const volume = quote?.held ?? 0;
            const rarity = rarityOf(item.id, rarityMap);
            return (
              <button
                key={item.id}
                type="button"
                data-market-item={item.id}
                onClick={() => pick(item.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.85fr)] items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-background/50 sm:px-4 sm:py-3",
                  active && "bg-primary/15"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("text-xl", rarityClass(item.id, rarityMap))}>{item.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className={cn("text-[10px] uppercase tracking-wide", rarityText[rarity])}>
                      {rarityLabel[rarity]}
                    </span>
                  </span>
                </span>
                <span className="font-medium text-emerald-200">
                  {quote?.bestBid != null ? formatCoins(quote.bestBid) : "—"}
                </span>
                <span className="font-medium text-rose-200">
                  {quote?.bestAsk != null ? formatCoins(quote.bestAsk) : "—"}
                </span>
                <span className="font-medium text-sky-200">
                  {formatCoins(quote?.vwap ?? item.basePrice)}
                </span>
                <span className="font-medium tabular-nums text-amber-200">
                  <span
                    className={cn(
                      sort === "bookBid" && "text-emerald-200",
                      sort === "bookAsk" && "opacity-40"
                    )}
                  >
                    {formatNumber(wanted)}
                  </span>
                  /
                  <span
                    className={cn(
                      sort === "bookAsk" && "text-rose-200",
                      sort === "bookBid" && "opacity-40"
                    )}
                  >
                    {formatNumber(listed)}
                  </span>
                </span>
                <span className="font-medium text-violet-200">
                  {volume > 0 ? formatNumber(volume) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="mb-3 font-heading text-lg">Recent trades</p>
        {state.recentTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">The tape is empty.</p>
        ) : (
          <ul className="space-y-2">
            {state.recentTrades.map((trade) => {
              const item = itemById[trade.itemId];
              return (
                <li key={trade.id} className="text-sm">
                  {item?.emoji} {item?.name} · {formatNumber(trade.quantity)} @ {formatCoins(trade.price)}{" "}
                  ·{" "}
                  {trade.buyUsername} bought from {trade.sellUsername}
                </li>
              );
            })}
          </ul>
        )}
        {state.winners.length > 0 ? (
          <p className="pt-3 text-xs text-muted-foreground">
            Champions: {state.winners.map((row) => row.username).join(", ")}
          </p>
        ) : null}
      </div>

      <SwapPanel
        inventory={state.player.inventory}
        gold={state.player.availableGold}
        swaps={state.swaps ?? []}
        travelers={state.travelers ?? []}
        pending={pending}
        rarityMap={rarityMap}
        onPropose={onProposeSwap}
        onAccept={onAcceptSwap}
        onCancel={onCancelSwap}
        onDecline={onDeclineSwap}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone?: "valueNone" | "valueUp" | "valueDown" | "bid" | "ask" | "mv" | "vol" | "supply";
  title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "rounded-xl px-3 py-2 ring-1 ring-foreground/10",
        tone === "valueDown" && "bg-zinc-800 text-zinc-100 ring-zinc-600",
        tone === "valueUp" && "bg-zinc-200 text-zinc-900 ring-zinc-400",
        tone === "valueNone" && "bg-zinc-700 text-zinc-100 ring-zinc-500",
        tone === "bid" && "bg-emerald-950/30",
        tone === "ask" && "bg-rose-950/25",
        tone === "mv" && "bg-sky-950/30",
        tone === "vol" && "bg-amber-950/30",
        tone === "supply" && "bg-violet-950/30"
      )}
    >
      <p
        className={cn(
          "text-[11px] tracking-wide uppercase",
          tone === "valueDown" || tone === "valueNone"
            ? "text-zinc-300"
            : tone === "valueUp"
              ? "text-zinc-600"
              : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-heading text-lg tabular-nums",
          tone === "valueDown" && "text-zinc-50",
          tone === "valueUp" && "text-zinc-900",
          tone === "valueNone" && "text-zinc-100",
          tone === "bid" && "text-emerald-200",
          tone === "ask" && "text-rose-200",
          tone === "mv" && "text-sky-200",
          tone === "vol" && "text-amber-200",
          tone === "supply" && "text-violet-200"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderList({
  rows,
  empty,
  selfId,
  pending,
  side,
  onTake,
  onCancel,
}: {
  rows: { id: number; username: string; price: number; remaining: number; playerId: number; isGov?: boolean }[];
  empty: string;
  selfId: number;
  pending: boolean;
  side: OrderSide;
  onTake: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }
  const units = unitRows(rows);
  return (
    <ul className="space-y-0.5 pr-0.5">
      {units.map((row) => {
        const yours = row.playerId === selfId && !row.isGov;
        const govAsk = Boolean(row.isGov) && side === "sell";
        const govBid = Boolean(row.isGov) && side === "buy";
        const name = row.isGov ? "Government" : yours ? "you" : row.username;
        return (
          <li key={`${row.id}-${row.unit}`}>
            <button
              type="button"
              disabled={pending}
              onClick={() => (yours ? onCancel(row.id) : onTake(row.id))}
              className={cn(
                "flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm ring-1 disabled:opacity-100",
                govAsk && "bg-white text-zinc-950 ring-zinc-300 hover:bg-zinc-100",
                govBid && "bg-black text-white ring-white/50 hover:bg-zinc-900",
                !row.isGov && yours && "bg-primary/25 ring-primary hover:bg-primary/35",
                !row.isGov && !yours && "bg-background/60 ring-foreground/10 hover:bg-background"
              )}
            >
              <span className="tabular-nums font-medium">{formatCoins(row.price)}</span>
              <span
                className={cn(
                  "min-w-0 truncate text-right text-[11px]",
                  govAsk && "text-zinc-600",
                  govBid && "text-white/80",
                  !row.isGov && "text-muted-foreground"
                )}
              >
                {name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
