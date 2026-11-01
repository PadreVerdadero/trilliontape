"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { LeaderTicker } from "@/components/game/leader-ticker";
import { MarketPanel } from "@/components/game/market-panel";
import { SoundToggle } from "@/components/game/sound-toggle";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { OpenOrdersPanel } from "@/components/game/open-orders-panel";
import { useGame } from "@/hooks/use-game";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { useSelectedItem } from "@/hooks/use-selected-item";
import { useMarketSort } from "@/hooks/use-market-sort";
import { CompaniesScreen } from "@/components/game/companies-screen";
import { GameOverBanner, GameOverScreen, GoalClock } from "@/components/game/game-over-screen";
import { LobbyScreen } from "@/components/game/lobby-screen";
import { GAME_NAME, GAME_PITCH } from "@/lib/game/brand";
import { playItems } from "@/lib/game/shares";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";

type PhoneTab = "pack" | "chart" | "trade" | "ladder" | "orders" | "stocks" | "deals" | "firms";
const PHONE_MARKET_TABS = ["chart", "trade", "ladder", "orders", "stocks", "deals"] as const;

export function PlayScreen({
  initialState,
  initialItemId,
}: {
  initialState: GameState;
  initialItemId?: string;
}) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const catalog = playItems(state?.items);
  const [itemId, setItemId] = useSelectedItem(
    initialItemId,
    catalog.map((item) => item.id)
  );
  const marketSort = useMarketSort(state?.prices ?? [], catalog);
  const [mobile, setMobile] = useMobileLayout();
  const [tab, setTab] = useState<PhoneTab>("chart");
  const [deskTab, setDeskTab] = useState<"market" | "companies" | "stocks" | "deals">("market");

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

  if (state.gamePhase === "lobby") {
    return (
      <LobbyScreen
        state={state}
        error={error}
        onDismissError={() => setError(null)}
      />
    );
  }

  const renderMarket = (view: "market" | "stocks" | "deals" | "chart" | "trade" | "ladder" | "orders") => (
    <MarketPanel
      state={state}
      pending={pending}
      compact={mobile}
      view={view}
      pack={pack}
      orders={orders}
      onOpenMarket={() => (mobile ? setTab("chart") : setDeskTab("market"))}
      selectedItemId={itemId}
      onSelectItem={setItemId}
      rankedItems={marketSort.rankedItems}
      rarityMap={marketSort.rarityMap}
      sort={marketSort.sort}
      sortDir={marketSort.sortDir}
      cycleSort={marketSort.cycleSort}
      onSetCandle={(ms) => run({ action: "setCandle", ms })}
      onOrder={(input) => run({ action: "order", ...input })}
      onTake={(input) =>
        run({
          action: "take",
          orderId: input.orderId,
          itemId: input.itemId,
          side: input.side,
          price: input.price,
          treasury: input.treasury,
        })
      }
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
        if (mobile) setTab("chart");
      }}
      selectedItemId={itemId}
      rankedItemIds={marketSort.rankedItems.map((item) => item.id)}
      coinVolume={state.coinVolume}
      goalLabel={state.goal?.label}
      catalog={catalog}
    />
  );

  const renderFirms = (desk: boolean) => (
    <CompaniesScreen
      desk={desk}
      state={state}
      pending={pending}
      run={run}
      selectedItemId={itemId}
      onSelectItem={setItemId}
    />
  );

  const orders = (
    <OpenOrdersPanel
      orders={state.myOrders}
      prices={state.prices}
      catalog={catalog}
      selectedItemId={itemId}
      pending={pending}
      onCancel={(orderIds) => void run({ action: "cancel", orderIds })}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {state.goal && state.gameOver ? (
        <GameOverScreen
          goal={state.goal}
          gameOver={state.gameOver}
          leaders={state.leaders ?? []}
          you={player.username}
          canOffice={Boolean(player.canOffice)}
        />
      ) : null}
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <LeaderTicker
          leaders={state.leaders ?? []}
          you={player.username}
          items={catalog}
          prices={state.prices}
          onSelectItem={setItemId}
        />
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
            {!mobile ? (
              <div className="flex overflow-hidden rounded-lg border border-border/80 text-sm">
                {(
                  [
                    ["market", "Market"],
                    ["stocks", "Stocks"],
                    ["deals", "Deals"],
                    ["companies", "Companies"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDeskTab(id)}
                    className={cn(
                      "h-9 px-3",
                      deskTab === id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <SoundToggle />
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
        {state.gameOver?.over ? (
          <GameOverBanner gameOver={state.gameOver} goal={state.goal} />
        ) : state.goal?.mode === "timed" ? (
          <GoalClock goal={state.goal} now={state.now} />
        ) : player.hasWon ? (
          <p className="w-full truncate px-3 pb-2 text-sm text-primary sm:px-4">
            You hit the mark.
          </p>
        ) : state.goal ? (
          <p className="w-full truncate px-3 pb-2 text-sm text-muted-foreground sm:px-4">
            {state.goal.label}
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
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className={cn("h-full", tab !== "pack" && "hidden")}>
              <div className="h-full overflow-y-auto px-2 py-2" data-keep-scroll>
                {pack}
              </div>
            </div>
            <div className={cn("h-full", !(PHONE_MARKET_TABS as readonly string[]).includes(tab) && "hidden")}>
              {renderMarket(
                (PHONE_MARKET_TABS as readonly string[]).includes(tab)
                  ? (tab as (typeof PHONE_MARKET_TABS)[number])
                  : "chart"
              )}
            </div>
            <div className={cn("h-full", tab !== "firms" && "hidden")}>
              <div className="h-full overflow-y-auto px-2 py-2" data-keep-scroll>
                {renderFirms(false)}
              </div>
            </div>
          </div>
          <nav className="grid shrink-0 grid-cols-4 gap-1 border-t border-border/80 bg-background/95 px-2 py-1.5">
            {(
              [
                ["pack", "Pack"],
                ["chart", "Chart"],
                ["trade", "Trade"],
                ["ladder", "Ladder"],
                ["orders", "Orders"],
                ["stocks", "Stocks"],
                ["deals", "Deals"],
                ["firms", "Firms"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium",
                  tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <div className="min-h-0 w-full flex-1 overflow-hidden">
          {deskTab === "companies" ? renderFirms(true) : renderMarket(deskTab)}
        </div>
      )}
    </div>
  );
}
