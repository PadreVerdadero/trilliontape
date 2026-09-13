"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { LeaderTicker } from "@/components/game/leader-ticker";
import { MarketPanel } from "@/components/game/market-panel";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { OpenOrdersPanel } from "@/components/game/open-orders-panel";
import { useGame } from "@/hooks/use-game";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { useSelectedItem } from "@/hooks/use-selected-item";
import { useMarketSort } from "@/hooks/use-market-sort";
import { DepositDialog } from "@/components/game/deposit-dialog";
import { GAME_NAME, GAME_PITCH } from "@/lib/game/brand";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";

type PhoneTab = "pack" | "book" | "orders";

export function PlayScreen({
  initialState,
  initialItemId,
}: {
  initialState: GameState;
  initialItemId?: string;
}) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const [itemId, setItemId] = useSelectedItem(initialItemId);
  const marketSort = useMarketSort(state?.prices ?? []);
  const [mobile, setMobile] = useMobileLayout();
  const [tab, setTab] = useState<PhoneTab>("book");

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
            <p className="text-muted-foreground">Opening the book…</p>
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

  const market = (
    <MarketPanel
      state={state}
      pending={pending}
      compact={mobile}
      selectedItemId={itemId}
      onSelectItem={setItemId}
      rankedItems={marketSort.rankedItems}
      rarityMap={marketSort.rarityMap}
      sort={marketSort.sort}
      sortDir={marketSort.sortDir}
      cycleSort={marketSort.cycleSort}
      onOrder={(input) => run({ action: "order", ...input })}
      onTake={(orderId) => run({ action: "take", orderId })}
      onCancel={(orderId) => run({ action: "cancel", orderId })}
      onProposeSwap={(input) => run({ action: "swapPropose", ...input })}
      onAcceptSwap={(offerId) => run({ action: "swapAccept", offerId })}
      onCancelSwap={(offerId) => run({ action: "swapCancel", offerId })}
      onDeclineSwap={(offerId) => run({ action: "swapDecline", offerId })}
    />
  );

  const pack = (
    <InventoryPanel
      player={player}
      prices={state.prices}
      onSelect={(id) => {
        setItemId(id);
        if (mobile) setTab("book");
      }}
      selectedItemId={itemId}
      rankedItemIds={marketSort.rankedItems.map((item) => item.id)}
      coinVolume={state.coinVolume}
    />
  );

  const orders = (
    <OpenOrdersPanel
      orders={state.myOrders}
      prices={state.prices}
      selectedItemId={itemId}
      pending={pending}
      onCancel={(orderIds) => void run({ action: "cancel", orderIds })}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <DepositDialog deposit={state.deposit} stipendMs={state.stipendMs} />
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <LeaderTicker leaders={state.leaders ?? []} you={player.username} />
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">{GAME_NAME}</p>
            {mobile ? (
              <span className="truncate text-sm text-muted-foreground">{player.username}</span>
            ) : (
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                {GAME_PITCH}
                <span className="text-border"> · </span>
                {player.username}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <MobileToggle checked={mobile} onChange={setMobile} />
            {player.canOffice ? (
              <>
                <Link
                  href="/government"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-2 sm:px-3")}
                >
                  {mobile ? "Gov" : "Government"}
                </Link>
                <Link
                  href="/admin"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-2 sm:px-3")}
                >
                  Admin
                </Link>
              </>
            ) : null}
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
              >
                {mobile ? "Out" : "Sign out"}
              </button>
            </form>
          </div>
        </div>
        {player.hasWon ? (
          <p className="w-full truncate px-3 pb-2 text-sm text-primary sm:px-4">
            You are worth a trillion.
          </p>
        ) : null}
        {player.lastEvent ? (
          <p className="w-full truncate px-3 pb-2 text-sm text-muted-foreground sm:px-4">
            {player.lastEvent}
          </p>
        ) : null}
        {error ? (
          <div className="border-t border-destructive/30 bg-destructive/15 px-3 py-2 sm:px-4">
            <div className="flex w-full items-start justify-between gap-3 text-sm text-destructive">
              <p>{error}</p>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {mobile ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3" data-keep-scroll>
            {tab === "pack" ? pack : null}
            {tab === "book" ? market : null}
            {tab === "orders" ? orders : null}
          </div>
          <nav className="grid shrink-0 grid-cols-3 gap-1 border-t border-border/80 bg-background/95 px-2 py-2">
            {(
              [
                ["pack", "Pack"],
                ["book", "Book"],
                ["orders", "Orders"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-11 rounded-lg text-sm font-medium",
                  tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          <aside className="flex w-[13.5rem] shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 sm:w-[17.5rem] lg:w-[20.5rem]">
            <div className="min-h-0 flex-1 overflow-y-auto pb-1" data-keep-scroll>
              {pack}
            </div>
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-3" data-keep-scroll>
            {market}
            <div className="mt-4 md:hidden">{orders}</div>
          </main>
          <aside className="hidden w-[15rem] shrink-0 flex-col overflow-hidden border-l border-border/70 bg-card/40 md:flex lg:w-[17rem]">
            {orders}
          </aside>
        </div>
      )}
    </div>
  );
}
