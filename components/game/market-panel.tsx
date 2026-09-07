"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById, items } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import { useOrderBook } from "@/hooks/use-game";
import { ItemChip } from "@/components/game/item-chip";
import { PriceChart } from "@/components/game/price-chart";
import type { GameState, OrderSide } from "@/lib/game/types";

export function MarketPanel({
  state,
  pending,
  onOrder,
  onTake,
  onCancel,
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
    return String(price?.bestAsk ?? price?.vwap ?? selected?.basePrice ?? 5);
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
            Pick an item, post a buy or sell at the top, then tap a listing to take one. Crossing
            trades clear at the ask — the lower price.
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

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.name}
            onClick={() => pick(item.id)}
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-xl text-xl ring-1 hover:bg-card",
              item.id === selectedItemId ? "bg-primary/20" : "bg-card/60",
              rarityClass(item.id)
            )}
          >
            {item.emoji}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-heading text-2xl">
                {selected.emoji} {selected.name}
              </p>
              <p className="text-sm text-foreground">{selected.purpose}</p>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[20rem]">
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
            </div>
          </div>

          <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
            <p className="mb-3 font-heading text-lg">Post your own order</p>
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

          <PriceChart history={book?.history ?? []} basePrice={selected.basePrice} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-emerald-950/25 p-3 ring-1 ring-emerald-400/20">
              <p className="mb-2 font-heading text-lg text-emerald-100">People buying</p>
              <p className="mb-3 text-xs text-muted-foreground">Tap a row to sell them 1.</p>
              <OrderList
                empty="No bids. Post one above if you want this."
                rows={book?.bids ?? []}
                selfId={state.player.id}
                pending={pending}
                actionLabel="Sell 1"
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
              />
            </div>
            <div className="rounded-xl bg-rose-950/20 p-3 ring-1 ring-rose-400/20">
              <p className="mb-2 font-heading text-lg text-rose-100">People selling</p>
              <p className="mb-3 text-xs text-muted-foreground">Tap a row to buy 1 from them.</p>
              <OrderList
                empty="No asks. Gather it, craft it, or post your own."
                rows={book?.asks ?? []}
                selfId={state.player.id}
                pending={pending}
                actionLabel="Buy 1"
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:px-4">
          <span>Item</span>
          <span className="text-emerald-200/90">Best bid</span>
          <span className="text-rose-200/90">Best ask</span>
          <span className="text-sky-200/90">MV</span>
        </div>
        <div className="max-h-[min(40vh,22rem)] overflow-auto">
          {items.map((item) => {
            const quote = state.prices.find((row) => row.itemId === item.id);
            const active = item.id === selectedItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-background/50 sm:px-4 sm:py-3",
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
            {state.myOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2 text-sm"
              >
                <span>
                  {order.side === "buy" ? "Buying" : "Selling"}{" "}
                  <ItemChip itemId={order.itemId} qty={order.remaining} /> @ {formatCoins(order.price)}
                  {order.remaining > 1 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatCoins(order.remaining * order.price)} total
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  className="h-10 md:h-8"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void onCancel(order.id)}
                >
                  Cancel
                </Button>
              </li>
            ))}
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
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bid" | "ask" | "mv";
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 ring-1 ring-foreground/10",
        tone === "bid" && "bg-emerald-950/30",
        tone === "ask" && "bg-rose-950/25",
        tone === "mv" && "bg-sky-950/30"
      )}
    >
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-heading text-lg",
          tone === "bid" && "text-emerald-200",
          tone === "ask" && "text-rose-200",
          tone === "mv" && "text-sky-200"
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
  actionLabel,
  onTake,
}: {
  rows: { id: number; username: string; price: number; remaining: number; playerId: number }[];
  empty: string;
  selfId: number;
  pending: boolean;
  actionLabel: string;
  onTake: (id: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const yours = row.playerId === selfId;
        return (
          <li key={row.id}>
            <button
              type="button"
              disabled={pending || yours}
              onClick={() => onTake(row.id)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-background/60 px-3 py-3 text-left ring-1 ring-foreground/10 hover:bg-background disabled:opacity-60"
            >
              <span>
                <span className="block text-base font-medium">
                  {formatNumber(row.remaining)} @ {formatCoins(row.price)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {yours ? "your order" : row.username}
                  {row.remaining > 1 ? ` · ${formatCoins(row.remaining * row.price)} total` : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-primary">
                {yours ? "resting" : actionLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
