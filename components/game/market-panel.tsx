"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById, items } from "@/lib/game/catalog";
import { formatCoins } from "@/lib/game/format";
import { useOrderBook } from "@/hooks/use-game";
import { ItemChip } from "@/components/game/item-chip";
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
    Number.isFinite(draftQty) && draftQty > 1 && Number.isFinite(draftPrice) && draftPrice > 0
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

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Post a limit order at your price. Click a listing to take one unit. If your bid is
        higher than someone&apos;s ask, the trade clears at the ask — the lower price.
      </p>
      <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3">
        {items.map((item) => {
          const quote = state.prices.find((row) => row.itemId === item.id);
          const active = item.id === selectedItemId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectItem(item.id);
                setPriceInput("");
              }}
              className={`rounded-xl p-2 text-left ring-1 transition ${
                active
                  ? "bg-primary/15 ring-primary"
                  : "bg-background/40 ring-foreground/10 hover:bg-background/70"
              }`}
            >
              <div className="text-xl">{item.emoji}</div>
              <div className="truncate text-xs font-medium">{item.name}</div>
              <div className="text-[11px] text-muted-foreground">
                MV {quote?.vwap ?? item.basePrice}🪙
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="space-y-3 rounded-xl bg-background/30 p-3 ring-1 ring-foreground/10">
          <div>
            <p className="font-heading text-lg">
              {selected.emoji} {selected.name}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{selected.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              MV {formatCoins(price?.vwap ?? selected.basePrice)}
              {price?.bestBid != null ? ` · bid ${price.bestBid}` : " · no bid"}
              {price?.bestAsk != null ? ` · ask ${price.bestAsk}` : " · no ask"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-200/80">
                Bids
              </p>
              <OrderList
                empty="No bids. Someone wants this cheap — or nobody wants it yet."
                rows={book?.bids ?? []}
                selfId={state.player.id}
                pending={pending}
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-rose-200/80">
                Asks
              </p>
              <OrderList
                empty="No asks. Gather it, craft it, or wait for a seller."
                rows={book?.asks ?? []}
                selfId={state.player.id}
                pending={pending}
                onTake={async (id) => {
                  await onTake(id);
                  await reloadBook();
                }}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label>Side</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={side === "buy" ? "default" : "outline"}
                  onClick={() => setSide("buy")}
                >
                  Bid
                </Button>
                <Button
                  size="sm"
                  variant={side === "sell" ? "default" : "outline"}
                  onClick={() => setSide("sell")}
                >
                  Ask
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="px">Price</Label>
              <Input
                id="px"
                inputMode="numeric"
                value={priceInput}
                placeholder={suggested}
                onChange={(event) => setPriceInput(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qty">Qty</Label>
              <Input
                id="qty"
                inputMode="numeric"
                value={qtyInput}
                onChange={(event) => setQtyInput(event.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <Button className="w-full" disabled={pending} onClick={() => void place()}>
                Post {side === "buy" ? "bid" : "ask"}
              </Button>
              {draftTotal != null ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  {draftQty} × {draftPrice}🪙 = {draftTotal}🪙 total
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Your open orders</p>
        {state.myOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing resting on the board. Post a bid or ask above.
          </p>
        ) : (
          <ul className="space-y-2">
            {state.myOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2 py-1.5 text-sm"
              >
                <span>
                  {order.side === "buy" ? "Bid" : "Ask"}{" "}
                  <ItemChip itemId={order.itemId} qty={order.remaining} /> @ {order.price}🪙
                  {order.remaining > 1 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {order.remaining * order.price}🪙 total
                    </span>
                  ) : null}
                </span>
                <Button
                  size="xs"
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
    </div>
  );
}

function OrderList({
  rows,
  empty,
  selfId,
  pending,
  onTake,
}: {
  rows: { id: number; username: string; price: number; remaining: number; playerId: number }[];
  empty: string;
  selfId: number;
  pending: boolean;
  onTake: (id: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-xs leading-5 text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            disabled={pending || row.playerId === selfId}
            onClick={() => onTake(row.id)}
            className="flex w-full items-center justify-between rounded-lg bg-background/50 px-2 py-1.5 text-left text-xs ring-1 ring-foreground/10 hover:bg-background disabled:opacity-60"
          >
            <span>
              {row.remaining} @ {row.price}🪙
              {row.remaining > 1 ? (
                <span className="text-muted-foreground"> · {row.remaining * row.price}🪙 total</span>
              ) : null}
            </span>
            <span className="text-muted-foreground">
              {row.playerId === selfId ? "you" : row.username}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
