"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bankPayout, itemById } from "@/lib/game/catalog";
import { formatCoins, formatDuration, formatNumber } from "@/lib/game/format";
import { rarityClass, rarityLabel, rarityOf, rarityText } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
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
        The teller only buys. Bring stock and they will pay a cut of MV — never a listing on the
        public board.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        The bank never posts bids or asks. It buys at <span className="text-foreground">50% of MV</span>
        . Each unit they take of that emoji drops the cut by 5 points (floor 10%). After 60s with
        no dumps of that item, the rate climbs back to 50%.
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
        const mv = quote?.vwap ?? item.basePrice;
        const bank = state.bank?.find((entry) => entry.itemId === row.itemId);
        const glut = bank?.glut ?? 0;
        const chosen = Number(qty[row.itemId] ?? Math.min(free, 1));
        const saleQty = Number.isFinite(chosen) && chosen > 0 ? chosen : 1;
        const payout = bankPayout(mv, glut, saleQty);
        const rarity = rarityOf(row.itemId);
        return (
          <div
            key={row.itemId}
            className={cn(
              "flex flex-col gap-2 rounded-xl bg-background/40 p-3 ring-1 sm:flex-row sm:items-center sm:justify-between",
              rarityClass(row.itemId)
            )}
          >
            <div>
              <p className="font-medium">
                {item.emoji} {item.name}{" "}
                <span className={cn("text-[10px] uppercase tracking-wide", rarityText[rarity])}>
                  {rarityLabel[rarity]}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(free)} free · MV {formatCoins(mv)} · bank{" "}
                {Math.round(payout.startRate * 100)}% → {formatCoins(payout.total)}
                {saleQty > 1 ? ` for ${formatNumber(saleQty)}` : " each"}
              </p>
              {glut > 0 ? (
                <p className="text-[11px] text-amber-100/80">
                  Window is heavy ({formatNumber(glut)} taken) · back to 50% in{" "}
                  {formatDuration(bank?.cooldownMs ?? 0)}
                </p>
              ) : null}
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
                className="h-11 md:h-7"
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
