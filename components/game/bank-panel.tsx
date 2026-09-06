"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemById } from "@/lib/game/catalog";
import { formatCoins } from "@/lib/game/format";
import type { GameState } from "@/lib/game/types";

export function BankPanel({
  state,
  pending,
  onSell,
}: {
  state: GameState;
  pending: boolean;
  onSell: (itemId: string, quantity: number) => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const inTown = state.player.locationId === "town" && state.player.busy.type === "idle";

  if (state.player.inventory.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        The teller shrugs. Bring something to sell — the window always pays the average trade
        price for that emoji.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Instant sale at the market average (every completed trade, including other players and
        this window). If nobody has traded it yet, the bank uses the catalog base price.
      </p>
      {!inTown ? (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm">
          The bank window is in 🏮 Lantern Plaza.
        </p>
      ) : null}
      {state.player.inventory.map((row) => {
        const item = itemById[row.itemId];
        const reserved = state.player.reservedItems[row.itemId] ?? 0;
        const free = row.quantity - reserved;
        const quote = state.prices.find((price) => price.itemId === row.itemId);
        const price = quote?.vwap ?? item.basePrice;
        return (
          <div
            key={row.itemId}
            className="flex flex-col gap-2 rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {item.emoji} {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {free} free · bank pays {formatCoins(price)} each
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="w-20"
                inputMode="numeric"
                value={qty[row.itemId] ?? String(Math.min(free, 1))}
                onChange={(event) =>
                  setQty((current) => ({ ...current, [row.itemId]: event.target.value }))
                }
              />
              <Button
                size="sm"
                disabled={!inTown || pending || free < 1}
                onClick={() =>
                  onSell(row.itemId, Number(qty[row.itemId] ?? Math.min(free, 1)))
                }
              >
                Sell
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
