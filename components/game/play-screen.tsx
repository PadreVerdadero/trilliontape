"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { MarketPanel } from "@/components/game/market-panel";
import { useGame } from "@/hooks/use-game";
import { itemById } from "@/lib/game/catalog";
import { formatCoins, formatNumber } from "@/lib/game/format";
import type { GameState, MarketPrice } from "@/lib/game/types";

function itemValue(prices: MarketPrice[], itemId: string) {
  return prices.find((row) => row.itemId === itemId)?.vwap ?? itemById[itemId]?.basePrice ?? 0;
}

function holdingsValue(state: GameState) {
  return state.player.inventory.reduce((sum, row) => {
    return sum + row.quantity * itemValue(state.prices, row.itemId);
  }, 0);
}

export function PlayScreen({ initialState }: { initialState: GameState }) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const [itemId, setItemId] = useState("wheat");

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <p className="text-muted-foreground">Lighting the plaza lanterns…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-heading text-2xl">The gate is stuck</p>
          <p className="text-sm text-muted-foreground">
            {error ?? "Could not load your traveler."}
          </p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { player } = state;
  const goods = holdingsValue(state);
  const net = player.gold + goods;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">🏮 Lantern Bazaar</p>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {player.username}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
              {formatCoins(player.gold)}
              {player.availableGold !== player.gold ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  · {formatCoins(player.availableGold)} free
                </span>
              ) : null}
            </span>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {player.lastEvent ? (
          <p className="mx-auto w-full max-w-[90rem] truncate px-3 pb-2 text-sm text-muted-foreground sm:px-4">
            {player.lastEvent}
          </p>
        ) : null}
        {error ? (
          <div className="border-t border-destructive/30 bg-destructive/15 px-4 py-2">
            <div className="mx-auto flex w-full max-w-[90rem] items-start justify-between gap-3 text-sm text-destructive">
              <p>{error}</p>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 overflow-hidden">
        <aside className="flex w-[11.5rem] shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 sm:w-[16rem] lg:w-[17.5rem]">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1 border-b border-border/60 px-2 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:px-3">
            <span>Pack</span>
            <span>Qty</span>
            <span>MV</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 sm:px-2">
            <InventoryPanel
              player={player}
              prices={state.prices}
              onSelect={setItemId}
              selectedItemId={itemId}
            />
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4">
          <MarketPanel
            state={state}
            pending={pending}
            selectedItemId={itemId}
            onSelectItem={setItemId}
            onOrder={(input) => run({ action: "order", ...input })}
            onTake={(orderId) => run({ action: "take", orderId })}
            onCancel={(orderId) => run({ action: "cancel", orderId })}
            onProposeSwap={(input) => run({ action: "swapPropose", ...input })}
            onAcceptSwap={(offerId) => run({ action: "swapAccept", offerId })}
            onCancelSwap={(offerId) => run({ action: "swapCancel", offerId })}
            onDeclineSwap={(offerId) => run({ action: "swapDecline", offerId })}
          />
        </main>
      </div>

      <footer className="shrink-0 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm sm:px-4">
          <p className="font-heading text-base">
            Net worth {formatCoins(net)}
          </p>
          <p className="text-muted-foreground">
            {formatCoins(player.gold)} coin · {formatCoins(goods)} goods
            {player.inventory.length ? (
              <span className="hidden sm:inline">
                {" "}
                · {formatNumber(player.inventory.reduce((n, row) => n + row.quantity, 0))} items
              </span>
            ) : null}
          </p>
        </div>
      </footer>
    </div>
  );
}
