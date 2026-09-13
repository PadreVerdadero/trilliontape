"use client";

import { Button } from "@/components/ui/button";
import { ItemChip } from "@/components/game/item-chip";
import { items as defaultItems } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { playItems } from "@/lib/game/shares";
import { rarityMapFromPrices } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { Item, MarketPrice, OrderRow } from "@/lib/game/types";

type Stack = {
  itemId: string;
  side: OrderRow["side"];
  price: number;
  isGov: boolean;
  qty: number;
  ids: number[];
};

function groupOpenOrders(orders: OrderRow[], catalog: Item[]) {
  const itemIndex = new Map(catalog.map((item, index) => [item.id, index]));
  const byId = Object.fromEntries(catalog.map((item) => [item.id, item]));
  const stacks = new Map<string, Stack>();
  for (const order of orders) {
    const qty = Math.max(0, order.remaining);
    if (qty < 1) continue;
    const key = `${order.itemId}|${order.side}|${order.price}|${order.isGov ? 1 : 0}`;
    const existing = stacks.get(key);
    if (existing) {
      existing.qty += qty;
      existing.ids.push(order.id);
    } else {
      stacks.set(key, {
        itemId: order.itemId,
        side: order.side,
        price: order.price,
        isGov: order.isGov,
        qty,
        ids: [order.id],
      });
    }
  }

  const byItem = new Map<string, Stack[]>();
  for (const stack of stacks.values()) {
    const list = byItem.get(stack.itemId) ?? [];
    list.push(stack);
    byItem.set(stack.itemId, list);
  }

  return [...byItem.entries()]
    .sort(([a], [b]) => {
      const ia = itemIndex.get(a) ?? 999;
      const ib = itemIndex.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return (byId[a]?.name ?? a).localeCompare(byId[b]?.name ?? b);
    })
    .map(([itemId, lines]) => ({
      itemId,
      lines: lines.sort((a, b) => {
        if (a.side !== b.side) return a.side === "buy" ? -1 : 1;
        return a.side === "buy" ? b.price - a.price : a.price - b.price;
      }),
    }));
}

export function OpenOrdersPanel({
  orders,
  prices,
  selectedItemId,
  pending,
  catalog,
  onCancel,
}: {
  orders: OrderRow[];
  prices: MarketPrice[];
  selectedItemId: string;
  pending: boolean;
  catalog?: Item[];
  onCancel: (orderIds: number[]) => void;
}) {
  const goods = playItems(catalog ?? defaultItems);
  const rarityMap = rarityMapFromPrices(
    goods.map((item) => item.id),
    prices
  );
  const groups = groupOpenOrders(orders, goods);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-2 py-2 sm:px-3">
        <p className="font-heading text-base">Your open orders</p>
        <p className="text-[11px] text-muted-foreground">
          Same price stacks as ×qty. Cancel pulls the stack.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 sm:px-2">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
            Nothing resting. Post a bid or ask on the board.
          </p>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => {
              const active = group.itemId === selectedItemId;
              return (
                <li key={group.itemId}>
                  <div className="px-1.5 pb-1">
                    <ItemChip itemId={group.itemId} rarityMap={rarityMap} catalog={goods} />
                  </div>
                  <ul className="space-y-1">
                    {group.lines.map((stack) => {
                      const govAsk = stack.isGov && stack.side === "sell";
                      const govBid = stack.isGov && stack.side === "buy";
                      return (
                        <li
                          key={`${stack.side}-${stack.price}-${stack.isGov ? "g" : "p"}`}
                          className={cn(
                            "flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-xs",
                            govAsk && "bg-white text-zinc-950 ring-1 ring-zinc-300",
                            govBid && "bg-black text-white ring-1 ring-white/50",
                            !stack.isGov && active && "bg-primary/25 ring-1 ring-primary",
                            !stack.isGov && !active && "bg-background/50"
                          )}
                        >
                          <span className="min-w-0 truncate tabular-nums">
                            {stack.side === "buy" ? "Bid" : "Ask"} {formatCoins(stack.price)}
                            <span
                              className={cn(
                                stack.isGov ? "opacity-70" : "text-muted-foreground"
                              )}
                            >
                              {" "}
                              ×{formatNumber(stack.qty)}
                            </span>
                          </span>
                          <Button
                            size="sm"
                            className={cn(
                              "h-7 shrink-0 px-2 text-[11px]",
                              govAsk && "text-zinc-950 hover:bg-zinc-200",
                              govBid && "text-white hover:bg-white/15"
                            )}
                            variant="ghost"
                            disabled={pending}
                            title={`Cancel ${formatNumber(stack.qty)} at ${formatCoins(stack.price)}`}
                            onClick={() => onCancel(stack.ids)}
                          >
                            Cancel
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
