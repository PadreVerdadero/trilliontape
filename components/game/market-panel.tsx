"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById, itemsByCommonness } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import { useOrderBook } from "@/hooks/use-game";
import { ItemChip } from "@/components/game/item-chip";
import { PriceChart } from "@/components/game/price-chart";
import { SwapPanel } from "@/components/game/swap-panel";
import { isBotUsername } from "@/lib/game/bots";
import type { GameState, OrderSide } from "@/lib/game/types";

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
}) {
  const selected = itemById[selectedItemId];
  const price = state.prices.find((row) => row.itemId === selectedItemId);
  const { book, reloadBook } = useOrderBook(selectedItemId);
  const [side, setSide] = useState<OrderSide>("buy");
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");

  const suggested = useMemo(() => {
    return String(Math.max(1, Math.round(Number(price?.bestAsk ?? price?.vwap ?? selected?.basePrice ?? 5))));
  }, [price, selected]);
  const draftQty = Number(qtyInput);
  const draftPrice = Number(priceInput || suggested);
  const draftTotal =
    Number.isFinite(draftQty) && draftQty > 0 && Number.isFinite(draftPrice) && draftPrice > 0
      ? draftQty * draftPrice
      : null;

  async function place() {
    if (!selected) return;
    await onOrder({
      itemId: selected.id,
      side,
      price: Number(priceInput || suggested),
      quantity: Number(qtyInput),
    });
    await reloadBook();
  }

  function pick(id: string) {
    onSelectItem(id);
    setPriceInput("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-2xl sm:text-3xl">Player market</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Post a buy or sell at any whole-coin price of 1 or more. Tap a listing to take one;
            tap your highlighted bid or ask to cancel it.
            MV is the average of the last 100 board trades. Bid/ask is units on the book
            (bids/asks). Volume is how many exist in packs — it rises when a treasury ask fills or
            regulars restock, and falls when a treasury bid fills. Posting a treasury quote does not
            change volume until it trades.
          </p>
        </div>
        {state.recentTrades[0] ? (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm">
            Last tape: {itemById[state.recentTrades[0].itemId]?.emoji}{" "}
            {formatNumber(state.recentTrades[0].quantity)} @{" "}
            {formatCoins(state.recentTrades[0].price)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No trades yet. Post the first order.</p>
        )}
      </div>

      {selected ? (
        <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-heading text-2xl">
                {selected.emoji} {selected.name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[24rem] sm:grid-cols-3 lg:grid-cols-5">
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
                hint="Units on bids / units on asks"
              />
              <Stat
                label="Volume"
                value={formatNumber(price?.held ?? 0)}
                tone="supply"
                hint="Total in packs that could trade"
              />
            </div>
            <p className="text-xs text-muted-foreground lg:max-w-[12rem] lg:text-right">
              {price?.prints
                ? `Average of the last ${formatNumber(price.prints)} board trade${price.prints === 1 ? "" : "s"}.`
                : "No board trades yet — using the catalog starting price."}
            </p>
          </div>

          <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
            <p className="mb-3 font-heading text-lg">Post your own order</p>
            {state.player.isGov ? (
              <p className="mb-3 text-xs leading-5 text-amber-100/90">
                Treasury desk: unlimited, and it does not spend your purse. Posting does not change
                volume yet. A white ask mints new units when someone buys it (volume up). A black
                bid burns goods when someone sells into it (volume down). Those quotes stay on the
                book after you leave office.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_auto]">
              <div className="space-y-1">
                <Label>I want to</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-11 flex-1 md:h-10"
                    variant={side === "buy" ? "default" : "outline"}
                    onClick={() => setSide("buy")}
                  >
                    Buy
                  </Button>
                  <Button
                    size="sm"
                    className="h-11 flex-1 md:h-10"
                    variant={side === "sell" ? "default" : "outline"}
                    onClick={() => setSide("sell")}
                  >
                    Sell
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="px">Price each</Label>
                <Input
                  id="px"
                  inputMode="numeric"
                  value={priceInput}
                  placeholder={suggested}
                  onChange={(event) => setPriceInput(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qty">How many</Label>
                <Input
                  id="qty"
                  inputMode="numeric"
                  value={qtyInput}
                  onChange={(event) => setQtyInput(event.target.value)}
                />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <Button className="h-11 w-full lg:min-w-40" disabled={pending} onClick={() => void place()}>
                  Post {side === "buy" ? "bid" : "ask"}
                </Button>
                {draftTotal != null ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {formatNumber(draftQty)} × {formatCoins(draftPrice)} = {formatCoins(draftTotal)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <PriceChart
            history={book?.history ?? []}
            basePrice={selected.basePrice}
            bestBid={price?.bestBid}
            bestAsk={price?.bestAsk}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-emerald-950/25 p-3 ring-1 ring-emerald-400/20">
              <p className="mb-2 font-heading text-lg text-emerald-100">Bids</p>
              <p className="mb-3 text-xs text-muted-foreground">Tap a row to sell them 1. Tap yours to cancel.</p>
              <OrderList
                empty="No bids. Post one above if you want this."
                side="buy"
                rows={book?.bids ?? []}
                selfId={state.player.id}
                pending={pending}
                actionLabel="Sell 1"
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
              <p className="mb-3 text-xs text-muted-foreground">Tap a row to buy 1 from them. Tap yours to cancel.</p>
              <OrderList
                empty="No asks. Post your own, or wait for a regular."
                side="sell"
                rows={book?.asks ?? []}
                selfId={state.player.id}
                pending={pending}
                actionLabel="Buy 1"
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
        <div className="grid grid-cols-[minmax(0,1.3fr)_1fr_1fr_0.85fr_0.9fr_0.7fr] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:px-4">
          <span>Item</span>
          <span className="text-emerald-200/90">Best bid</span>
          <span className="text-rose-200/90">Best ask</span>
          <span className="text-sky-200/90">MV</span>
          <span className="text-amber-200/90">Bid/Ask</span>
          <span className="text-violet-200/90">Volume</span>
        </div>
        <div className="max-h-[min(72vh,40rem)] overflow-auto">
          {itemsByCommonness.map((item) => {
            const quote = state.prices.find((row) => row.itemId === item.id);
            const active = item.id === selectedItemId;
            const wanted = quote?.wanted ?? 0;
            const listed = quote?.listed ?? 0;
            const volume = quote?.held ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1.3fr)_1fr_1fr_0.85fr_0.9fr_0.7fr] items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-background/50 sm:px-4 sm:py-3",
                  active && "bg-primary/15"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("text-xl", rarityClass(item.id))}>{item.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className={cn("text-[10px] uppercase tracking-wide", rarityText[rarityOf(item.id)])}>
                      {rarityLabel[rarityOf(item.id)]}
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
                  {formatNumber(wanted)}/{formatNumber(listed)}
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
        <p className="mb-3 font-heading text-lg">Your open orders</p>
        {state.myOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing resting on the board. Post a buy or sell above.
          </p>
        ) : (
          <ul className="space-y-2">
            {state.myOrders.map((order) => {
              const govAsk = order.isGov && order.side === "sell";
              const govBid = order.isGov && order.side === "buy";
              return (
              <li
                key={order.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                  govAsk && "bg-white text-zinc-950 ring-2 ring-white",
                  govBid && "bg-black text-white ring-2 ring-white/70",
                  !order.isGov && order.itemId === selectedItemId && "bg-primary/25 ring-2 ring-primary",
                  !order.isGov && order.itemId !== selectedItemId && "bg-background/40"
                )}
              >
                <span>
                  {order.side === "buy" ? "Buying" : "Selling"}{" "}
                  <ItemChip itemId={order.itemId} qty={order.remaining} /> @ {formatCoins(order.price)}
                  {order.remaining > 1 ? (
                    <span className={cn(govBid ? "text-white/70" : govAsk ? "text-zinc-600" : "text-muted-foreground")}>
                      {" "}
                      · {formatCoins(order.remaining * order.price)} total
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  className={cn(
                    "h-10 md:h-8",
                    govAsk && "text-zinc-950 hover:bg-zinc-200",
                    govBid && "text-white hover:bg-white/15"
                  )}
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void onCancel(order.id)}
                >
                  Cancel
                </Button>
              </li>
              );
            })}
          </ul>
        )}
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
  hint,
}: {
  label: string;
  value: string;
  tone?: "bid" | "ask" | "mv" | "vol" | "supply";
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 ring-1 ring-foreground/10",
        tone === "bid" && "bg-emerald-950/30",
        tone === "ask" && "bg-rose-950/25",
        tone === "mv" && "bg-sky-950/30",
        tone === "vol" && "bg-amber-950/30",
        tone === "supply" && "bg-violet-950/30"
      )}
    >
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-heading text-lg",
          tone === "bid" && "text-emerald-200",
          tone === "ask" && "text-rose-200",
          tone === "mv" && "text-sky-200",
          tone === "vol" && "text-amber-200",
          tone === "supply" && "text-violet-200"
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function OrderList({
  rows,
  empty,
  selfId,
  pending,
  side,
  actionLabel,
  onTake,
  onCancel,
}: {
  rows: { id: number; username: string; price: number; remaining: number; playerId: number; isGov?: boolean }[];
  empty: string;
  selfId: number;
  pending: boolean;
  side: OrderSide;
  actionLabel: string;
  onTake: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const yours = row.playerId === selfId;
        const govAsk = Boolean(row.isGov) && side === "sell";
        const govBid = Boolean(row.isGov) && side === "buy";
        return (
          <li key={row.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => (yours ? onCancel(row.id) : onTake(row.id))}
              className={cn(
                "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ring-1 disabled:opacity-100",
                govAsk && "bg-white text-zinc-950 ring-2 ring-white hover:bg-zinc-100",
                govBid && "bg-black text-white ring-2 ring-white/70 hover:bg-zinc-900",
                !row.isGov && yours && "bg-primary/25 ring-2 ring-primary hover:bg-primary/35",
                !row.isGov && !yours && "bg-background/60 ring-foreground/10 hover:bg-background"
              )}
            >
              <span>
                <span className="block text-base font-medium">
                  {formatNumber(row.remaining)} @ {formatCoins(row.price)}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    govAsk && "text-zinc-600",
                    govBid && "text-white/70",
                    !row.isGov && "text-muted-foreground"
                  )}
                >
                  {row.isGov ? (yours ? "treasury · tap to cancel" : "Government") : yours ? "your order" : isBotUsername(row.username)
                    ? `${row.username} · regular`
                    : row.username}
                  {row.remaining > 1 ? ` · ${formatCoins(row.remaining * row.price)} total` : ""}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-medium",
                  govAsk && "text-zinc-950",
                  govBid && "text-white",
                  !row.isGov && "text-primary"
                )}
              >
                {yours ? "Cancel" : actionLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
