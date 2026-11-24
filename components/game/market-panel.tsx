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
import { useConfirmClick } from "@/hooks/use-confirm-click";
import { PriceChart, type ChartOrderGroup } from "@/components/game/price-chart";
import { DepthChart } from "@/components/game/depth-chart";
import { OrderBookPanel } from "@/components/game/order-book";
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
  view = "market",
  pack = null,
  orders = null,
  onOpenMarket,
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
  view?: "market" | "stocks" | "deals" | "chart" | "trade" | "book" | "orders";
  pack?: ReactNode;
  orders?: ReactNode;
  onOpenMarket?: () => void;
}) {
  const catalogById = playItemMap(playItems(state.items));
  const selected = catalogById[selectedItemId];
  const price = state.prices.find((row) => row.itemId === selectedItemId);
  const { book, reloadBook } = useOrderBook(selectedItemId);
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [orderType, setOrderType] = useState<"limit" | "stop">("limit");
  const [nudgeStep, setNudgeStep] = useState(1);
  const [confirmClick, setConfirmClick] = useConfirmClick(Boolean(compact));
  const [customCandleMinutes, setCustomCandleMinutes] = useState("");
  const [candleChoice, setCandleChoice] = useState<string>(
    CANDLE_PRESETS.some((row) => row.ms === state.candleMs) ? String(state.candleMs) : "custom"
  );

  const [seenCandleMs, setSeenCandleMs] = useState(state.candleMs);
  if (seenCandleMs !== state.candleMs) {
    setSeenCandleMs(state.candleMs);
    setCandleChoice(
      CANDLE_PRESETS.some((row) => row.ms === state.candleMs) ? String(state.candleMs) : "custom"
    );
  }
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

  function chartKind(side: "buy" | "sell", at: number): "stop" | "market" | "limit" {
    if (side === "buy") {
      if (price?.bestAsk != null && at > price.bestAsk) return "stop";
      if (price?.bestAsk != null && at === price.bestAsk) return "market";
      return "limit";
    }
    if (price?.bestBid != null && at < price.bestBid) return "stop";
    if (price?.bestBid != null && at === price.bestBid) return "market";
    return "limit";
  }

  function describeChart(side: "buy" | "sell", at: number) {
    const kind = chartKind(side, at);
    if (kind === "stop") return side === "buy" ? "Buy STP" : "Sell STP";
    if (kind === "market") return side === "buy" ? "Buy MKT" : "Sell MKT";
    return side === "buy" ? "Bid" : "Ask";
  }

  async function chartPlace(side: "buy" | "sell", at: number) {
    if (!selected || pending) return;
    const kind = chartKind(side, at);
    if (kind === "market") {
      const rows = side === "buy" ? book?.asks ?? [] : book?.bids ?? [];
      const row = rows.find(
        (entry) => entry.price === at && (entry.isGov || entry.playerId !== state.player.id)
      );
      if (!row) return;
      await takeQuote({
        orderId: row.id,
        itemId: row.itemId,
        side: row.side,
        price: row.price,
        treasury: row.isGov,
      });
      return;
    }
    await placeAt(side, at, kind);
  }

  async function chartMove(group: ChartOrderGroup, toPrice: number) {
    if (!selected || pending) return;
    for (const id of group.ids) {
      if ((await onCancel(id)) === null) {
        await reloadBook();
        return;
      }
    }
    const placed = await onOrder({
      itemId: selected.id,
      side: group.side,
      price: toPrice,
      quantity: group.qty,
      orderType: group.orderType,
    });
    if (placed === null) {
      // The new price was rejected; put the order back where it was.
      await onOrder({
        itemId: selected.id,
        side: group.side,
        price: group.price,
        quantity: group.qty,
        orderType: group.orderType,
      });
    }
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

  const statGrid = (className: string) =>
    selected ? (
      <div className={className}>
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
    ) : null;

  const ticketBox = (
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
  );

  const chartEl = (fill: boolean) =>
    selected ? (
          <PriceChart
            key={selected.id}
            trades={book?.chartTrades ?? book?.trades ?? []}
            basePrice={selected.basePrice}
            mv={price?.vwap ?? selected.basePrice}
            bestBid={price?.bestBid}
            bestAsk={price?.bestAsk}
            myOrders={state.myOrders.filter((row) => row.itemId === selected.id)}
            quantity={Math.max(1, Number(qtyInput) || 1)}
            confirm={confirmClick}
            onPlaceAt={(side, at) => void chartPlace(side, at)}
            describeAt={describeChart}
            onMoveOrder={(group, to) => void chartMove(group, to)}
            onCancel={(id) => {
              void (async () => {
                await onCancel(id);
                await reloadBook();
              })();
            }}
            compact={compact}
            fill={fill}
            now={state.now}
            candleMs={state.candleMs}
          />
    ) : null;

  const controlsRow = (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={confirmClick}
          onChange={(event) => setConfirmClick(event.target.checked)}
        />
        {compact ? "Confirm taps" : "Confirm chart orders with a second tap"}
      </label>
      <label className="flex items-center gap-1.5">
        Chart quantity
        <input
          type="number"
          min={1}
          inputMode="numeric"
          className="h-7 w-16 rounded-md border border-border bg-background px-2 text-foreground"
          value={qtyInput}
          onChange={(event) => setQtyInput(event.target.value)}
          aria-label="Chart order quantity"
        />
      </label>
      <span className="flex items-center gap-1.5">
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
      </span>
    </div>
  );

  const stockList = (
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
        <div>
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
                onClick={() => {
                  pick(item.id);
                  if (view === "stocks") onOpenMarket?.();
                }}
                className={cn(
                  "grid w-full items-center gap-2 border-b border-border/40 px-3 text-left text-sm last:border-b-0 hover:bg-background/50 sm:px-4",
                  compact
                    ? "grid-cols-[minmax(0,1.3fr)_4.5rem_4.5rem_4.5rem] py-1"
                    : "min-w-[52rem] grid-cols-[minmax(7rem,0.9fr)_minmax(9rem,1.25fr)_minmax(9rem,1.25fr)_minmax(8.5rem,1.15fr)_minmax(4.5rem,0.55fr)_minmax(4.5rem,0.55fr)] py-1.5",
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
  );

  const tapeBox = (
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
  );

  const swapBox = (wide: boolean) => (
      <SwapPanel
        wide={wide}
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
  );

  const depthEl = (heightClass: string) =>
    selected ? (
      <DepthChart
        bids={book?.bids ?? []}
        asks={book?.asks ?? []}
        mv={price?.vwap ?? selected.basePrice}
        compact={compact}
        heightClass={heightClass}
      />
    ) : null;

  const recentList = selected ? (
    <div>
      <p className="mb-1 font-heading text-sm">
        Recent <ItemIcon item={selected} /> {selected.name} trades
      </p>
      {(book?.trades ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No prints for this item yet.</p>
      ) : (
        <ul className="space-y-0.5 text-xs">
          {(book?.trades ?? []).slice(0, 14).map((trade) => (
            <li key={trade.id} className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 tabular-nums text-muted-foreground" title={formatMilitaryTime(trade.createdAt, true)}>
                {formatMilitaryTime(trade.createdAt)}
              </span>
              <span className="shrink-0 tabular-nums" title={formatCoins(trade.price)}>
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
  ) : null;

  const itemStrip = (
    <div className="flex shrink-0 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rankedItems.map((item) => {
        const active = item.id === selectedItemId;
        return (
          <button
            key={item.id}
            type="button"
            title={item.name}
            aria-label={item.name}
            aria-current={active}
            onClick={() => pick(item.id)}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-xl ring-1 transition-colors",
              rarityClass(item.id, rarityMap),
              active ? "bg-primary/25 ring-primary" : "bg-background/60 ring-foreground/10 hover:bg-background"
            )}
          >
            <ItemIcon item={item} />
          </button>
        );
      })}
    </div>
  );

  const phoneHead = selected ? (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <p className="min-w-0 truncate font-heading text-base leading-tight">
        <ItemIcon item={selected} /> {selected.name}
      </p>
      <p
        className={cn(
          "shrink-0 text-[11px]",
          goodIsOpen(state.tradingHours[selected.id], state.now, state.tradingTimeZone)
            ? "text-emerald-400"
            : "text-amber-300"
        )}
      >
        {goodIsOpen(state.tradingHours[selected.id], state.now, state.tradingTimeZone) ? "Open" : "Closed"} ·{" "}
        {describeTradingWindow(state.tradingHours[selected.id])}
      </p>
    </div>
  ) : null;

  if (compact) {
    const wrap = "flex h-full min-h-0 flex-col gap-1.5 overflow-hidden p-2";
    if (view === "stocks") {
      return (
        <div className="h-full min-h-0 overflow-y-auto p-2" data-keep-scroll>
          {stockList}
        </div>
      );
    }
    if (view === "deals") {
      return (
        <div className="h-full min-h-0 overflow-y-auto p-2" data-keep-scroll>
          {swapBox(false)}
        </div>
      );
    }
    if (view === "orders") {
      return <div className="h-full min-h-0 overflow-hidden">{orders}</div>;
    }
    if (view === "book") {
      return (
        <div className="h-full min-h-0 overflow-hidden">
          {selected ? (
            <OrderBookPanel
              asks={book?.asks ?? []}
              bids={book?.bids ?? []}
              myStops={state.myOrders.filter((row) => row.itemId === selected.id && row.orderType === "stop")}
              selfId={state.player.id}
              pending={pending}
              mv={Math.round(price?.vwap ?? selected.basePrice)}
              onTake={(row) =>
                void takeQuote({
                  orderId: row.id,
                  itemId: row.itemId,
                  side: row.side,
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
        </div>
      );
    }
    if (view === "trade") {
      return (
        <div className={wrap}>
          {itemStrip}
          {phoneHead}
          {statGrid("grid shrink-0 grid-cols-4 gap-1")}
          <div className="shrink-0">{ticketBox}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{recentList}</div>
        </div>
      );
    }
    return (
      <div className={wrap}>
        {itemStrip}
        {phoneHead}
        {selected ? (
          <p className="shrink-0 text-xs tabular-nums">
            <span className="text-muted-foreground">Last </span>
            {price?.last != null ? formatNumber(price.last) : "—"}
            <span className="text-emerald-300"> · Bid {price?.bestBid != null ? formatNumber(price.bestBid) : "—"}</span>
            <span className="text-rose-300"> · Ask {price?.bestAsk != null ? formatNumber(price.bestAsk) : "—"}</span>
            <span className="text-sky-300"> · MV {formatNumber(Math.round(price?.vwap ?? selected.basePrice))}</span>
            <span className="text-muted-foreground"> · Vol {formatNumber(price?.tradesToday ?? 0)}</span>
          </p>
        ) : null}
        <div className="min-h-0 flex-1">{chartEl(true)}</div>
        <div className="shrink-0">{depthEl("h-12 w-full")}</div>
        <div className="shrink-0">{controlsRow}</div>
      </div>
    );
  }

  if (!compact) {
    if (view === "stocks") {
      return (
        <div className="grid h-full min-h-0 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-h-0 space-y-2">
            <div>
              <p className="font-heading text-xl">Stocks</p>
              <p className="text-xs text-muted-foreground">
                Tap a column to sort. Tap a row to open that stock on the Market tab. Bid/Ask is units on the book.
                Volume is trades today.
              </p>
            </div>
            {stockList}
          </div>
          <div className="min-h-0 overflow-y-auto">{tapeBox}</div>
        </div>
      );
    }
    if (view === "deals") {
      return <div className="h-full min-h-0 p-3">{swapBox(true)}</div>;
    }
    const hours = selected ? state.tradingHours[selected.id] : undefined;
    const tradingOpen = selected ? goodIsOpen(hours, state.now, state.tradingTimeZone) : true;
    return (
      <div className="grid h-full min-h-0 grid-cols-[minmax(14rem,19rem)_minmax(0,1fr)_minmax(15rem,20rem)] overflow-hidden">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border/70 bg-card/40">
          <div className="min-h-0 shrink overflow-y-auto" data-keep-scroll>
            {pack}
          </div>
          <div className="shrink-0 border-t border-border/70 p-2">{ticketBox}</div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 p-2">{recentList}</div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden p-2">
          {selected ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading text-lg leading-tight">
                    <ItemIcon item={selected} /> {selected.name}
                  </p>
                  <p className={cn("text-xs", tradingOpen ? "text-emerald-400" : "text-amber-300")}>
                    {tradingOpen ? "Trading open" : "Trading closed"} · {describeTradingWindow(hours)}
                  </p>
                </div>
                <div className="flex max-w-full gap-1 overflow-x-auto">
                  {rankedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.name}
                      aria-label={item.name}
                      aria-current={item.id === selectedItemId}
                      onClick={() => pick(item.id)}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-lg ring-1 transition-colors",
                        item.id === selectedItemId
                          ? "bg-primary/25 ring-primary"
                          : "bg-background/60 ring-foreground/10 hover:bg-background"
                      )}
                    >
                      <ItemIcon item={item} />
                    </button>
                  ))}
                </div>
              </div>
              {statGrid("grid shrink-0 grid-cols-4 gap-1.5 xl:grid-cols-8")}
              <div className="min-h-0 flex-1">{chartEl(true)}</div>
              <div className="shrink-0">{depthEl("h-24 w-full")}</div>
              <div className="shrink-0">{controlsRow}</div>
            </>
          ) : null}
        </main>
        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-border/70 bg-card/40">
          <div className="flex max-h-[40%] min-h-0 shrink-0 flex-col overflow-hidden border-b border-border/70">
            {orders}
          </div>
          <div className="min-h-0 flex-1">
            {selected ? (
              <OrderBookPanel
                asks={book?.asks ?? []}
                bids={book?.bids ?? []}
                myStops={state.myOrders.filter((row) => row.itemId === selected.id && row.orderType === "stop")}
                selfId={state.player.id}
                pending={pending}
                mv={Math.round(price?.vwap ?? selected.basePrice)}
                onTake={(row) =>
                  void takeQuote({
                    orderId: row.id,
                    itemId: row.itemId,
                    side: row.side,
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
          </div>
        </aside>
      </div>
    );
  }

  return null;
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
