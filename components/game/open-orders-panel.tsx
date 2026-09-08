"use client";

import { Button } from "@/components/ui/button";
import { ItemChip } from "@/components/game/item-chip";
import { items } from "@/lib/game/catalog";
import { formatCoins } from "@/lib/game/format";
import { rarityMapFromPrices } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { MarketPrice, OrderRow } from "@/lib/game/types";

function unitRows(rows: OrderRow[]) {
  return rows.flatMap((row) =>
    Array.from({ length: Math.max(0, row.remaining) }, (_, unit) => ({
      ...row,
      remaining: 1,
      unit,
    }))
  );
}

export function OpenOrdersPanel({
  orders,
  prices,
  selectedItemId,
  pending,
  onCancel,
}: {
  orders: OrderRow[];
  prices: MarketPrice[];
  selectedItemId: string;
  pending: boolean;
  onCancel: (orderId: number) => void;
}) {
  const rarityMap = rarityMapFromPrices(
    items.map((item) => item.id),
    prices
  );
  const units = unitRows(orders);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-2 py-2 sm:px-3">
        <p className="font-heading text-base">Your open orders</p>
        <p className="text-[11px] text-muted-foreground">Tap cancel on each unit.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 sm:px-2">
        {units.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
            Nothing resting. Post a bid or ask on the board.
          </p>
        ) : (
          <ul className="space-y-1">
            {units.map((order) => {
              const govAsk = order.isGov && order.side === "sell";
              const govBid = order.isGov && order.side === "buy";
              const active = order.itemId === selectedItemId;
              return (
                <li
                  key={`${order.id}-${order.unit}`}
                  className={cn(
                    "flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-xs",
                    govAsk && "bg-white text-zinc-950 ring-1 ring-zinc-300",
                    govBid && "bg-black text-white ring-1 ring-white/50",
                    !order.isGov && active && "bg-primary/25 ring-1 ring-primary",
                    !order.isGov && !active && "bg-background/50"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {order.side === "buy" ? "Bid" : "Ask"} {formatCoins(order.price)}
                    </span>
                    <ItemChip itemId={order.itemId} qty={1} rarityMap={rarityMap} className="mt-0.5" />
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
                    onClick={() => onCancel(order.id)}
                  >
                    Cancel
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
