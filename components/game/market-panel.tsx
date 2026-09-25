"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemIcon } from "@/components/game/item-icon";
import { formatCoins, formatCompact, formatMilitaryTime, formatNumber } from "@/lib/game/format";
import { playItemMap, playItems } from "@/lib/game/shares";
import type { MarketSort, SortColumn, SortDir } from "@/lib/game/market-sort";
import {
  rarityClass,
  rarityLabel,
  rarityOf,
  rarityText,
  type RarityMap,
} from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import { describeTradingWindow, goodIsOpen } from "@/lib/game/hours";
import { CANDLE_PRESETS } from "@/lib/game/market";
import { useOrderBook } from "@/hooks/use-game";
import { PriceChart } from "@/components/game/price-chart";
import { SwapPanel } from "@/components/game/swap-panel";
import type { GameState, Item, OrderRow, OrderSide, TakeQuoteInput } from "@/lib/game/types";

function playerQuotes(rows: OrderRow[]) {
  return rows.filter((row) => !row.isGov);
}

function treasuryAtBest(rows: OrderRow[]) {
  const treasury = rows.filter((row) => row.isGov);
  if (treasury.length === 0) return null;
  const price = treasury[0].price;
  return {
    id: treasury[0].id,
    itemId: treasury[0].itemId,
    price,
    remaining: treasury.filter((row) => row.price === price).reduce((sum, row) => sum + row.remaining, 0),
  };
}

function TreasuryButton({
  kind,
  quote,
  pending,
  onTake,
}: {
  kind: "buy" | "sell";
  quote: { id: number; itemId: string; price: number; remaining: number };
  pending: boolean;
  onTake: (input: TakeQuoteInput) => void;
}) {
  const buy = kind === "buy";
  return (
    <button
      type="button"
      disabled={pending}
      title={`${buy ? "Buy" : "Sell"} ${formatNumber(quote.remaining)} at ${formatCoins(quote.price)}`}
      onClick={() =>
        onTake({
          orderId: quote.id,
          itemId: quote.itemId,
          side: buy ? "sell" : "buy",
          price: quote.price,
          treasury: true,
        })
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium ring-1 disabled:opacity-50",
        buy
          ? "bg-white text-zinc-950 ring-zinc-300 hover:bg-zinc-100"
          : "bg-black text-white ring-white/50 hover:bg-zinc-900"
      )}
    >
      {buy ? "Buy from treasury" : "Sell to treasury"}
      <span className={cn("tabular-nums", buy ? "text-zinc-600" : "text-white/75")}>
        {formatCoins(quote.price)} ×{formatNumber(quote.remaining)}
      </span>
    </button>
  );
}

function groupLadderRows(rows: OrderRow[], selfId: number) {
  const byPrice = new Map<number, { mine: OrderRow[]; other: OrderRow[] }>();
  for (const row of rows) {
    const bucket = byPrice.get(row.price) ?? { mine: [], other: [] };
    if (row.playerId === selfId && !row.isGov) bucket.mine.push(row);
    else bucket.other.push(row);
    byPrice.set(row.price, bucket);
  }
  return byPrice;
}

function groupStopRows(rows: OrderRow[]) {
  const buy = new Map<number, OrderRow[]>();
  const sell = new Map<number, OrderRow[]>();
  for (const row of rows) {
    const map = row.side === "buy" ? buy : sell;
    const list = map.get(row.price) ?? [];
    list.push(row);
    map.set(row.price, list);
  }
  return { buy, sell };
}

function PriceLadder({
  bids,
  asks,
  myStops,
  marketValue,
  bestBid,
  bestAsk,
  selfId,
  pending,
  onSelect,
  onPlaceLimit,
  onPlaceStop,
  onMarket,
  onCancel,
}: {
  bids: OrderRow[];
  asks: OrderRow[];
  myStops: OrderRow[];
  marketValue: number;
  bestBid?: number | null;
  bestAsk?: number | null;
  selfId: number;
  pending: boolean;
  onSelect: (price: number) => void;
  onPlaceLimit: (side: OrderSide, price: number) => void;
  onPlaceStop: (side: OrderSide, price: number) => void;
  onMarket: (row: OrderRow, side: OrderSide) => void;
  onCancel: (id: number) => void;
}) {
  const center = Math.max(1, Math.round(marketValue));
  const [min, setMin] = useState(Math.max(1, center - 100));
  const [max, setMax] = useState(center + 100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const bidGroups = groupLadderRows(bids, selfId);
  const askGroups = groupLadderRows(asks, selfId);
  const stopGroups = groupStopRows(myStops);
  const prices = Array.from({ length: max - min + 1 }, (_, index) => max - index);

  useEffect(() => {
    setMin(Math.max(1, center - 100));
    setMax(center + 100);
  }, [center]);

  useEffect(() => {
    centerRef.current?.scrollIntoView({ block: "center" });
  }, [min, max]);

  function buyAction(price: number): { kind: "stop" | "market" | "limit"; label: string } {
    if (bestAsk != null && price > bestAsk) return { kind: "stop", label: "Buy STP" };
    if (bestAsk != null && price === bestAsk) return { kind: "market", label: "Buy MKT" };
    return { kind: "limit", label: "Bid" };
  }

  function sellAction(price: number): { kind: "stop" | "market" | "limit"; label: string } {
    if (bestBid != null && price < bestBid) return { kind: "stop", label: "Sell STP" };
    if (bestBid != null && price === bestBid) return { kind: "market", label: "Sell MKT" };
    return { kind: "limit", label: "Ask" };
  }

  function handleBuy(price: number) {
    const action = buyAction(price);
    if (action.kind === "market") {
      const row = askGroups.get(price)?.other[0];
      if (row) onMarket(row, "sell");
      return;
    }
    if (action.kind === "stop") onPlaceStop("buy", price);
    else onPlaceLimit("buy", price);
  }

  function handleSell(price: number) {
    const action = sellAction(price);
    if (action.kind === "market") {
      const row = bidGroups.get(price)?.other[0];
      if (row) onMarket(row, "buy");
      return;
    }
    if (action.kind === "stop") onPlaceStop("sell", price);
    else onPlaceLimit("sell", price);
  }

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-background/30 p-2">
      <p className="mb-1 text-[10px] text-muted-foreground">
        Scroll without a price limit. Tap the middle price to edit it, the left/right buttons to place a
        bid/ask (auto Buy/Sell STP beyond the book, auto market at the touch), or a resting quote to take
        it or cancel yours.
      </p>
      <div
        ref={scrollRef}
        className="max-h-[min(55dvh,32rem)] overflow-y-auto rounded-md border border-border/60"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (element.scrollTop < 240 && min > 1) setMin(Math.max(1, min - 200));
          if (element.scrollHeight - element.scrollTop - element.clientHeight < 240) setMax(max + 200);
        }}
      >
        {prices.map((price) => {
          const buy = buyAction(price);
          const sell = sellAction(price);
          const bidGroup = bidGroups.get(price);
          const askGroup = askGroups.get(price);
          const myBuyStops = stopGroups.buy.get(price);
          const mySellStops = stopGroups.sell.get(price);
          return (
            <div
              key={price}
              ref={price === center ? centerRef : undefined}
              className={cn(
                "grid min-h-9 grid-cols-[1fr_5.5rem_1fr] items-stretch border-b border-border/30 text-xs last:border-0",
                price === center && "bg-sky-950/30"
              )}
            >
              <button
                type="button"
                disabled={pending}
                className="text-left text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-50"
                onClick={() => handleBuy(price)}
              >
                {buy.label}
              </button>
              <button
                type="button"
                className="border-x border-border/40 text-center font-medium tabular-nums text-sky-200 hover:bg-sky-400/15"
                onClick={() => {
                  onSelect(price);
                  scrollRef.current?.querySelector<HTMLInputElement>("#px")?.focus();
                }}
              >
                {formatCoins(price)}
                {price === center ? " · MV" : ""}
              </button>
              <button
                type="button"
                disabled={pending}
                className="text-right text-rose-300 hover:bg-rose-400/15 disabled:opacity-50"
                onClick={() => handleSell(price)}
              >
                {sell.label}
              </button>
              {bidGroup || askGroup || myBuyStops || mySellStops ? (
                <div className="col-span-3 flex items-center justify-between gap-1 px-1 pb-1">
                  <div className="flex gap-1">
                    {bidGroup?.mine.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Cancel your bid"
                        className="rounded bg-amber-400/25 px-1.5 text-[10px] font-medium text-amber-200 hover:bg-amber-400/40"
                        onClick={() => onCancel(bidGroup.mine[bidGroup.mine.length - 1].id)}
                      >
                        ×{bidGroup.mine.length}
                      </button>
                    ) : null}
                    {bidGroup?.other.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Sell into this bid"
                        className="rounded bg-emerald-950/50 px-1.5 text-[10px] text-emerald-200 hover:bg-emerald-900/60"
                        onClick={() => onMarket(bidGroup.other[0], "buy")}
                      >
                        ×{bidGroup.other.length}
                      </button>
                    ) : null}
                    {myBuyStops?.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Cancel your Buy STP"
                        className="rounded bg-purple-400/25 px-1.5 text-[10px] font-medium text-purple-200 hover:bg-purple-400/40"
                        onClick={() => onCancel(myBuyStops[myBuyStops.length - 1].id)}
                      >
                        ×{myBuyStops.length}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    {mySellStops?.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Cancel your Sell STP"
                        className="rounded bg-purple-400/25 px-1.5 text-[10px] font-medium text-purple-200 hover:bg-purple-400/40"
                        onClick={() => onCancel(mySellStops[mySellStops.length - 1].id)}
                      >
                        ×{mySellStops.length}
                      </button>
                    ) : null}
                    {askGroup?.other.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Buy from this ask"
                        className="rounded bg-rose-950/40 px-1.5 text-[10px] text-rose-200 hover:bg-rose-900/50"
                        onClick={() => onMarket(askGroup.other[0], "sell")}
                      >
                        ×{askGroup.other.length}
                      </button>
                    ) : null}
                    {askGroup?.mine.length ? (
                      <button
                        type="button"
                        disabled={pending}
                        title="Cancel your ask"
                        className="rounded bg-amber-400/25 px-1.5 text-[10px] font-medium text-amber-200 hover:bg-amber-400/40"
                        onClick={() => onCancel(askGroup.mine[askGroup.mine.length - 1].id)}
                      >
                        ×{askGroup.mine.length}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function nudgeWhole(raw: string, delta: number, fallback: number) {
  const n = Number(raw);
  const base = Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  return String(Math.max(1, base + delta));
}

const NUDGE_STEP_MAX = 1_000_000;

function nextNudgeStep(step: number, dir: 1 | -1) {
  if (dir > 0) return Math.min(NUDGE_STEP_MAX, step * 10);
  return Math.max(1, Math.floor(step / 10));
}

function orderFieldFocused(
  priceEl: HTMLInputElement | null,
  qtyEl: HTMLInputElement | null
): "px" | "qty" | null {
  const active = document.activeElement;
  if (!active) return null;
  if (active === priceEl || (active instanceof HTMLElement && active.id === "px")) return "px";
  if (active === qtyEl || (active instanceof HTMLElement && active.id === "qty")) return "qty";
  if (active instanceof HTMLElement) {
    if (priceEl && priceEl.contains(active)) return "px";
    if (qtyEl && qtyEl.contains(active)) return "qty";
  }
  return null;
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

function stackUnitRows<
  T extends { id: number; remaining: number; playerId: number; price: number; isGov?: boolean },
>(rows: T[]) {
  const units = unitRows(rows);
  const stacks: (T & { remaining: number; unit: number; count: number; ids: number[] })[] = [];
  for (const row of units) {
    const prev = stacks[stacks.length - 1];
    if (
      prev &&
      prev.playerId === row.playerId &&
      prev.price === row.price &&
      Boolean(prev.isGov) === Boolean(row.isGov)
    ) {
      prev.count += 1;
      prev.ids.push(row.id);
      continue;
    }
    stacks.push({ ...row, count: 1, ids: [row.id] });
  }
  return stacks;
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
  onSetCandle,
  compact = false,
}: {
  state: GameState;
  pending: boolean;
  onOrder: (input: {
    itemId: string;
    side: OrderSide;
    price: number;
    quantity: number;
    orderType?: "limit" | "stop";
  }) => Promise<unknown>;
  onTake: (input: TakeQuoteInput) => Promise<unknown>;
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
  onSetCandle: (ms: number) => Promise<unknown>;
  compact?: boolean;
}) {
  const catalogById = playItemMap(playItems(state.items));
  const selected = catalogById[selectedItemId];
  const price = state.prices.find((row) => row.itemId === selectedItemId);
  const { book, reloadBook } = useOrderBook(selectedItemId);
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [orderType, setOrderType] = useState<"limit" | "stop">("limit");
  const [nudgeStep, setNudgeStep] = useState(1);
  const [customCandleMinutes, setCustomCandleMinutes] = useState("");
  const [candleChoice, setCandleChoice] = useState<string>(
    CANDLE_PRESETS.some((row) => row.ms === state.candleMs) ? String(state.candleMs) : "custom"
  );

  useEffect(() => {
    setCandleChoice(
      CANDLE_PRESETS.some((row) => row.ms === state.candleMs) ? String(state.candleMs) : "custom"
    );
  }, [state.candleMs]);
  const priceRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const focusAfter = useRef<"px" | "qty" | null>(null);

  const suggested = useMemo(() => {
    const mv = Math.max(1, Math.round(Number(price?.vwap ?? selected?.basePrice ?? 5)));
    if (state.player.isGov) return String(mv);
    return String(Math.max(1, Math.round(Number(price?.bestAsk ?? price?.vwap ?? selected?.basePrice ?? 5))));
  }, [price, selected, state.player.isGov]);
  const deskAsk = treasuryAtBest(book?.asks ?? []);
  const deskBid = treasuryAtBest(book?.bids ?? []);
  const mvCoins = Math.max(1, Math.round(Number(price?.vwap ?? selected?.basePrice ?? 1)));
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
      orderType,
    });
    await reloadBook();
  }

  async function placeAt(next: OrderSide, price: number, nextOrderType: "limit" | "stop") {
    if (!selected) return;
    setPriceInput(String(price));
    await onOrder({
      itemId: selected.id,
      side: next,
      price,
      quantity: Number(qtyInput),
      orderType: nextOrderType,
    });
    await reloadBook();
  }

  function pick(id: string) {
    onSelectItem(id);
    setPriceInput("");
  }

  function focusPreparedField(id: "px" | "qty") {
    withPreservedScroll(() =>
      focusOrderField(id === "px" ? priceRef.current : qtyRef.current, id)
    );
  }

  function prepareOrderField(id: "px" | "qty", value: string) {
    const current = id === "px" ? priceInput : qtyInput;
    if (current === value) {
      focusPreparedField(id);
      return;
    }
    focusAfter.current = id;
    if (id === "px") setPriceInput(value);
    else setQtyInput(value);
  }

  useLayoutEffect(() => {
    const which = focusAfter.current;
    if (!which) return;
    focusAfter.current = null;
    focusPreparedField(which);
  }, [priceInput, qtyInput]);

  function firstTakeable(side: "buy" | "ask") {
    const rows = side === "buy" ? playerQuotes(book?.bids ?? []) : playerQuotes(book?.asks ?? []);
    return rows.find((row) => row.playerId !== state.player.id) ?? null;
  }

  async function takeQuote(input: TakeQuoteInput) {
    const shot = snapshotScrolls();
    await onTake(input);
    await reloadBook();
    restoreScrolls(shot);
    requestAnimationFrame(() => restoreScrolls(shot));
  }

  async function takeBest(side: "buy" | "ask") {
    const row = firstTakeable(side);
    if (!row) return;
    await takeQuote({
      orderId: row.id,
      itemId: row.itemId,
      side: row.side,
      price: row.price,
      treasury: row.isGov,
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (shortcutTargetIsText(event.target)) return;
      if (event.key === "Shift") {
        if (!event.repeat) {
          event.preventDefault();
          setNudgeStep((prev) => nextNudgeStep(prev, 1));
        }
        return;
      }
      if (event.key === "Control") {
        if (!event.repeat) {
          event.preventDefault();
          setNudgeStep((prev) => nextNudgeStep(prev, -1));
        }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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
        prepareOrderField("px", String(mvCoins));
        return;
      }
      if (key === "d") {
        event.preventDefault();
        prepareOrderField("qty", "1");
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const field = orderFieldFocused(priceRef.current, qtyRef.current);
        if (!field) return;
        event.preventDefault();
        const delta = (event.key === "ArrowUp" ? 1 : -1) * nudgeStep;
        if (field === "px") {
          setPriceInput((prev) => nudgeWhole(prev, delta, mvCoins));
        } else {
          setQtyInput((prev) => nudgeWhole(prev, delta, 1));
        }
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
        return;
      }
      if (key === "q") {
        event.preventDefault();
        if (!pending) void takeBest("buy");
        return;
      }
      if (key === "e") {
        event.preventDefault();
        if (!pending) void takeBest("ask");
        return;
      }
      if (key === "t") {
        event.preventDefault();
        if (!pending && deskAsk) {
          void takeQuote({
            orderId: deskAsk.id,
            itemId: deskAsk.itemId,
            side: "sell",
            price: deskAsk.price,
            treasury: true,
          });
        }
        return;
      }
      if (key === "r") {
        event.preventDefault();
        if (!pending && deskBid) {
          void takeQuote({
            orderId: deskBid.id,
            itemId: deskBid.itemId,
            side: "buy",
            price: deskBid.price,
            treasury: true,
          });
        }
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
            {compact
              ? "Crossing bids fill at the ask. Tap a column to sort, then tap a row to trade that good."
              : "Crossing bids fill at the ask. Bid/Ask is units on the book. Volume is trades today. Tap a column to sort. Bid/Ask: two taps on bids, then two on asks. Pack on the left follows this order. W/S select · A fills MV · D qty 1 · arrows nudge · Shift/Ctrl step place · V buy · X sell · Q take bid · E take ask · T buy treasury · R sell treasury."}
          </p>
        </div>
        {state.recentTrades[0] ? (
          <p className="rounded-lg bg-primary/10 px-2 py-1 text-xs">
            Last tape: {formatMilitaryTime(state.recentTrades[0].createdAt, true)} ·{" "}
            <ItemIcon item={catalogById[state.recentTrades[0].itemId]} />{" "}
            {formatNumber(state.recentTrades[0].quantity)} @{" "}
            {formatCoins(state.recentTrades[0].price)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No trades yet. Post the first order.</p>
        )}
      </div>

      {selected ? (
        <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <div className="space-y-2">
            <div className="min-w-0">
              <p className="font-heading text-xl">
                <ItemIcon item={selected} /> {selected.name}
              </p>
              {(() => {
                const window = state.tradingHours[selected.id];
                const open = goodIsOpen(window, state.now, state.tradingTimeZone);
                return (
                  <p className={cn("text-xs", open ? "text-emerald-400" : "text-amber-300")}>
                    {open ? "Trading open" : "Trading closed"} · {describeTradingWindow(window)}
                  </p>
                );
              })()}
            </div>
            <div
              className={cn(
                "grid grid-cols-2 gap-2 sm:grid-cols-4",
                state.player.isAdmin ? "xl:grid-cols-8" : "xl:grid-cols-7"
              )}
            >
              <Stat
                label="Price"
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
                value={formatNumber(price?.tradesToday ?? 0)}
                tone="supply"
                title="Board prints today (local midnight)"
              />
              {state.player.isAdmin ? (
                <Stat
                  label="Authorized/Issued"
                  value={`${formatNumber(price?.authorized ?? 0)}/${formatNumber(price?.issued ?? 0)}`}
                  tone="shareAuth"
                  compactLabel
                  title="Max that can be issued / already issued"
                />
              ) : null}
              <Stat
                label="Outstanding/Treasury"
                value={`${formatNumber(price?.held ?? 0)}/${formatNumber(price?.treasury ?? 0)}`}
                tone="shareAuth"
                compactLabel
                title="Purchased and in packs / issued but not yet purchased"
              />
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] lg:items-start">
            <div className="rounded-lg bg-background/40 p-2 ring-1 ring-foreground/10">
              <p className="mb-1 font-heading text-sm">Post your own order</p>
              {compact ? null : (
              <p className="mb-1 text-[10px] leading-4 text-muted-foreground">
                <kbd className="text-foreground">A</kbd> MV · arrows ±{formatNumber(nudgeStep)} · Shift/Ctrl
                place · <kbd className="text-foreground">D</kbd> qty 1 ·{" "}
                <kbd className="text-foreground">V</kbd> buy · <kbd className="text-foreground">X</kbd> sell
              </p>
              )}
              {state.player.isGov ? (
                <p className="mb-1 text-[10px] leading-4 text-amber-100/90">
                  Treasury always quotes at MV. Asks mint on fill until Outstanding reaches
                  Authorized. Bids burn on fill.
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
                    className={compact ? "h-11 text-base" : "h-8 md:h-7"}
                    inputMode="numeric"
                    value={state.player.isGov ? String(mvCoins) : priceInput}
                    placeholder={suggested}
                    readOnly={state.player.isGov}
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
                    className={compact ? "h-11 text-base" : "h-8 md:h-7"}
                    inputMode="numeric"
                    value={qtyInput}
                    onChange={(event) => setQtyInput(event.target.value)}
                  />
                </div>
                <Button
                  className={cn(
                    "bg-emerald-600 text-white hover:bg-emerald-500",
                    compact ? "h-11 text-base" : "h-8"
                  )}
                  disabled={pending}
                  onClick={() => void place("buy")}
                >
                  {orderType === "stop" ? "Buy STP" : "Bid"} <span className="sr-only"> / Buy limit</span>
                </Button>
                <Button
                  className={cn(
                    "bg-rose-600 text-white hover:bg-rose-500",
                    compact ? "h-11 text-base" : "h-8"
                  )}
                  disabled={pending}
                  onClick={() => void place("sell")}
                >
                  {orderType === "stop" ? "Sell STP" : "Ask"} <span className="sr-only"> / Sell limit</span>
                </Button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{orderType === "stop" ? "Stop order triggers at MV; it then takes the best available quote." : "Limit order rests at your chosen price."}</span>
                <select
                  value={orderType}
                  onChange={(event) => setOrderType(event.target.value as "limit" | "stop")}
                  className="h-7 rounded border border-border bg-background px-1.5 text-foreground"
                  aria-label="Order type"
                >
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>
              {draftTotal != null ? (
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  {formatNumber(draftQty)} × {formatCoins(draftPrice)} = {formatCoins(draftTotal)}
                </p>
              ) : null}
            </div>

            <div>
              <p className="mb-1 font-heading text-sm">
                Recent <ItemIcon item={selected} /> {selected.name} trades
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
                                <span
                                  className="shrink-0 tabular-nums text-muted-foreground"
                                  title={formatMilitaryTime(trade.createdAt, true)}
                                >
                                  {formatMilitaryTime(trade.createdAt)}
                                </span>
                                <span
                                  className="shrink-0 tabular-nums"
                                  title={formatCoins(trade.price)}
                                >
                                  {trade.quantity > 1 ? `${formatCompact(trade.quantity)} @ ` : null}
                                  {formatCompact(trade.price)}
                                </span>
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

          {compact ? (
            <PriceLadder
              bids={book?.bids ?? []}
              asks={book?.asks ?? []}
              myStops={state.myOrders.filter(
                (row) => row.itemId === selected.id && row.orderType === "stop"
              )}
              marketValue={price?.vwap ?? selected.basePrice}
              bestBid={price?.bestBid}
              bestAsk={price?.bestAsk}
              selfId={state.player.id}
              pending={pending}
              onSelect={(value) => setPriceInput(String(value))}
              onPlaceLimit={(side, value) => void placeAt(side, value, "limit")}
              onPlaceStop={(side, value) => void placeAt(side, value, "stop")}
              onMarket={(row, side) =>
                void takeQuote({
                  orderId: row.id,
                  itemId: row.itemId,
                  side,
                  price: row.price,
                  treasury: row.isGov,
                })
              }
              onCancel={(id) => {
                void (async () => {
                  await onCancel(id);
                  await reloadBook();
                })();
              }}
            />
          ) : null}

          <PriceChart
            trades={book?.chartTrades ?? book?.trades ?? []}
            basePrice={selected.basePrice}
            mv={price?.vwap ?? selected.basePrice}
            bestBid={price?.bestBid}
            bestAsk={price?.bestAsk}
            compact={compact}
            now={state.now}
            candleMs={state.candleMs}
          />
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <label htmlFor="player-candle">Your candle size</label>
            <select
              id="player-candle"
              className="h-8 rounded-md border border-border bg-background px-2 text-foreground"
              value={candleChoice}
              onChange={(event) => {
                const choice = event.target.value;
                setCandleChoice(choice);
                if (choice !== "custom") {
                  setCustomCandleMinutes("");
                  void onSetCandle(Number(choice));
                } else {
                  setCustomCandleMinutes(String(Math.round(state.candleMs / 60_000)));
                }
              }}
            >
              {CANDLE_PRESETS.filter((row) => row.ms <= 60 * 60_000).map((row) => (
                <option key={row.ms} value={row.ms}>{row.label}</option>
              ))}
              <option value="custom">Custom minutes</option>
            </select>
            {candleChoice === "custom" ? (
              <input
                inputMode="numeric"
                className="h-8 w-20 rounded-md border border-border bg-background px-2 text-foreground"
                value={customCandleMinutes}
                placeholder={String(Math.round(state.candleMs / 60_000))}
                onChange={(event) => setCustomCandleMinutes(event.target.value)}
                onBlur={() => {
                  const minutes = Number(customCandleMinutes);
                  if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440) {
                    void onSetCandle(minutes * 60_000);
                  }
                }}
                aria-label="Custom candle minutes"
              />
            ) : null}
          </div>

          <div className={cn("grid gap-4 lg:grid-cols-2", compact && "hidden")}>
            <div className="rounded-xl bg-emerald-950/25 p-3 ring-1 ring-emerald-400/20">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-heading text-lg text-emerald-100">Bids</p>
                {deskBid ? (
                  <TreasuryButton
                    kind="sell"
                    quote={deskBid}
                    pending={pending}
                    onTake={(input) => void takeQuote(input)}
                  />
                ) : null}
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tap a row for a <strong>market order</strong> to sell 1. Tap yours to cancel 1. <kbd className="text-foreground">Q</kbd> takes
                the best traveler bid. <kbd className="text-foreground">R</kbd> sells 1 to the treasury.
              </p>
              <OrderList
                empty="No traveler bids. Post one above if you want this."
                side="buy"
                rows={playerQuotes(book?.bids ?? [])}
                selfId={state.player.id}
                pending={pending}
                onTake={(input) => void takeQuote(input)}
                onCancel={async (id) => {
                  await onCancel(id);
                  await reloadBook();
                }}
              />
            </div>
            <div className="rounded-xl bg-rose-950/20 p-3 ring-1 ring-rose-400/20">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-heading text-lg text-rose-100">Asks</p>
                {deskAsk ? (
                  <TreasuryButton
                    kind="buy"
                    quote={deskAsk}
                    pending={pending}
                    onTake={(input) => void takeQuote(input)}
                  />
                ) : null}
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tap a row for a <strong>market order</strong> to buy 1. Tap yours to cancel 1. <kbd className="text-foreground">E</kbd> takes
                the best traveler ask. <kbd className="text-foreground">T</kbd> buys 1 from the treasury.
              </p>
              <OrderList
                empty="No traveler asks. Post your own, or buy from the treasury if it is offering."
                side="sell"
                rows={playerQuotes(book?.asks ?? [])}
                selfId={state.player.id}
                pending={pending}
                onTake={(input) => void takeQuote(input)}
                onCancel={async (id) => {
                  await onCancel(id);
                  await reloadBook();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
        <div
          className={cn(
            "grid gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:px-4",
            compact
              ? "grid-cols-[minmax(0,1.3fr)_4.5rem_4.5rem_4.5rem]"
              : "min-w-[52rem] grid-cols-[minmax(7rem,0.9fr)_minmax(9rem,1.25fr)_minmax(9rem,1.25fr)_minmax(8.5rem,1.15fr)_minmax(4.5rem,0.55fr)_minmax(4.5rem,0.55fr)]"
          )}
        >
          <SortHead label="Item" column="item" sort={sort} dir={sortDir} onSort={cycleSort} />
          <SortHead
            label="Bid"
            column="bid"
            sort={sort}
            dir={sortDir}
            onSort={cycleSort}
            className="text-emerald-200/90"
          />
          <SortHead
            label="Ask"
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
          {compact ? null : (
            <>
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
            </>
          )}
        </div>
        <div className={cn(compact ? "max-h-none" : "max-h-[min(72vh,40rem)] overflow-auto")}>
          {rankedItems.map((item) => {
            const quote = state.prices.find((row) => row.itemId === item.id);
            const active = item.id === selectedItemId;
            const wanted = quote?.wanted ?? 0;
            const listed = quote?.listed ?? 0;
            const volume = quote?.tradesToday ?? 0;
            const rarity = rarityOf(item.id, rarityMap);
            return (
              <button
                key={item.id}
                type="button"
                data-market-item={item.id}
                onClick={() => pick(item.id)}
                className={cn(
                  "grid w-full items-center gap-2 border-b border-border/40 px-3 text-left text-sm last:border-b-0 hover:bg-background/50 sm:px-4",
                  compact
                    ? "grid-cols-[minmax(0,1.3fr)_4.5rem_4.5rem_4.5rem] py-3"
                    : "min-w-[52rem] grid-cols-[minmax(7rem,0.9fr)_minmax(9rem,1.25fr)_minmax(9rem,1.25fr)_minmax(8.5rem,1.15fr)_minmax(4.5rem,0.55fr)_minmax(4.5rem,0.55fr)] py-2.5 sm:py-3",
                  active && "bg-primary/15"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("text-xl", rarityClass(item.id, rarityMap))}>
                    <ItemIcon item={item} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className={cn("text-[10px] uppercase tracking-wide", rarityText[rarity])}>
                      {rarityLabel[rarity]}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 truncate font-medium tabular-nums text-emerald-200" title={quote?.bestBid != null ? formatCoins(quote.bestBid) : undefined}>
                  {quote?.bestBid != null ? (compact ? formatCompact(quote.bestBid) : formatCoins(quote.bestBid)) : "—"}
                </span>
                <span className="min-w-0 truncate font-medium tabular-nums text-rose-200" title={quote?.bestAsk != null ? formatCoins(quote.bestAsk) : undefined}>
                  {quote?.bestAsk != null ? (compact ? formatCompact(quote.bestAsk) : formatCoins(quote.bestAsk)) : "—"}
                </span>
                <span className="min-w-0 truncate font-medium tabular-nums text-sky-200" title={formatCoins(quote?.vwap ?? item.basePrice)}>
                  {compact ? formatCompact(quote?.vwap ?? item.basePrice) : formatCoins(quote?.vwap ?? item.basePrice)}
                </span>
                {compact ? null : (
                  <>
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
                  {formatNumber(volume)}
                </span>
                  </>
                )}
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
              const item = catalogById[trade.itemId];
              return (
                <li key={trade.id} className="text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {formatMilitaryTime(trade.createdAt, true)}
                  </span>{" "}
                  · <ItemIcon item={item} /> {item?.name} · {formatNumber(trade.quantity)} @ {formatCoins(trade.price)}{" "}
                  · {trade.buyUsername} bought from {trade.sellUsername}
                </li>
              );
            })}
          </ul>
        )}
        {state.winners.length > 0 ? (
          <p className="pt-3 text-xs text-muted-foreground">
            Worth a trillion: {state.winners.map((row) => row.username).join(", ")}
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
        prices={state.prices}
        catalog={playItems(state.items)}
        onPropose={onProposeSwap}
        onAccept={onAcceptSwap}
        onCancel={onCancelSwap}
        onDecline={onDeclineSwap}
      />
    </div>
  );
}

function valueSizeClass(value: string) {
  const len = value.length;
  if (len <= 9) return "text-base sm:text-lg";
  if (len <= 13) return "text-sm sm:text-base";
  if (len <= 18) return "text-xs sm:text-sm";
  return "text-[10px] sm:text-xs";
}

function Stat({
  label,
  value,
  tone,
  title,
  compactLabel,
}: {
  label: string;
  value: string;
  tone?:
    | "valueNone"
    | "valueUp"
    | "valueDown"
    | "bid"
    | "ask"
    | "mv"
    | "vol"
    | "supply"
    | "shareAuth"
    | "shareIssued"
    | "shareOut"
    | "shareTreas";
  title?: string;
  compactLabel?: boolean;
}) {
  return (
    <div
      title={title}
      className={cn(
        "min-w-0 overflow-hidden rounded-xl px-2 py-2 ring-1 ring-foreground/10 sm:px-3",
        tone === "valueDown" && "bg-zinc-800 text-zinc-100 ring-zinc-600",
        tone === "valueUp" && "bg-zinc-200 text-zinc-900 ring-zinc-400",
        tone === "valueNone" && "bg-zinc-700 text-zinc-100 ring-zinc-500",
        tone === "bid" && "bg-emerald-950/30",
        tone === "ask" && "bg-rose-950/25",
        tone === "mv" && "bg-sky-950/30",
        tone === "vol" && "bg-amber-950/30",
        tone === "supply" && "bg-violet-950/30",
        tone === "shareAuth" && "bg-slate-950/40",
        tone === "shareIssued" && "bg-indigo-950/35",
        tone === "shareOut" && "bg-teal-950/35",
        tone === "shareTreas" && "bg-stone-950/40"
      )}
    >
      <p
        className={cn(
          "uppercase leading-tight",
          compactLabel
            ? "text-[8px] tracking-tight sm:text-[9px]"
            : "text-[11px] tracking-wide",
          tone === "valueDown" || tone === "valueNone"
            ? "text-zinc-300"
            : tone === "valueUp"
              ? "text-zinc-600"
              : "text-muted-foreground"
        )}
      >
        {compactLabel && label.includes("/") ? (
          <>
            {label.slice(0, label.indexOf("/") + 1)}
            <br />
            {label.slice(label.indexOf("/") + 1)}
          </>
        ) : (
          label
        )}
      </p>
      <p
        className={cn(
          "font-heading tabular-nums whitespace-nowrap",
          valueSizeClass(value),
          tone === "valueDown" && "text-zinc-50",
          tone === "valueUp" && "text-zinc-900",
          tone === "valueNone" && "text-zinc-100",
          tone === "bid" && "text-emerald-200",
          tone === "ask" && "text-rose-200",
          tone === "mv" && "text-sky-200",
          tone === "vol" && "text-amber-200",
          tone === "supply" && "text-violet-200",
          tone === "shareAuth" && "text-slate-200",
          tone === "shareIssued" && "text-indigo-200",
          tone === "shareOut" && "text-teal-200",
          tone === "shareTreas" && "text-stone-200"
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
  rows: {
    id: number;
    itemId: string;
    username: string;
    price: number;
    remaining: number;
    playerId: number;
    isGov?: boolean;
  }[];
  empty: string;
  selfId: number;
  pending: boolean;
  side: OrderSide;
  onTake: (input: TakeQuoteInput) => void;
  onCancel: (id: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }

  const units = stackUnitRows(rows);
  return (
    <ul className="space-y-0.5 pr-0.5">
      {units.map((row) => {
        const yours = row.playerId === selfId && !row.isGov;
        const govAsk = Boolean(row.isGov) && side === "sell";
        const govBid = Boolean(row.isGov) && side === "buy";
        const name = row.isGov ? "Government" : yours ? "you" : row.username;
        const liveId = row.ids[row.ids.length - 1] ?? row.id;
        return (
          <li key={`${row.id}-${row.unit}`}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                yours
                  ? onCancel(liveId)
                  : onTake({
                      orderId: liveId,
                      itemId: row.itemId,
                      side,
                      price: row.price,
                      treasury: Boolean(row.isGov),
                    })
              }
              className={cn(
                "flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm ring-1 disabled:opacity-100",
                govAsk && "bg-white text-zinc-950 ring-zinc-300 hover:bg-zinc-100",
                govBid && "bg-black text-white ring-white/50 hover:bg-zinc-900",
                !row.isGov && yours && "bg-primary/25 ring-primary hover:bg-primary/35",
                !row.isGov && !yours && "bg-background/60 ring-foreground/10 hover:bg-background"
              )}
            >
              <span className="tabular-nums font-medium">
                {formatCoins(row.price)}
                {row.count > 1 ? (
                  <span
                    className={cn(
                      "ml-1 text-[11px] font-normal",
                      govAsk && "text-zinc-600",
                      govBid && "text-white/75",
                      !row.isGov && "text-muted-foreground"
                    )}
                  >
                    ×{row.count}
                  </span>
                ) : null}
              </span>
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
