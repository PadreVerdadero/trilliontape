"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterCard } from "@/components/game/character-card";
import { GuidePanel } from "@/components/game/guide-panel";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { MarketPanel } from "@/components/game/market-panel";
import { StallsPanel } from "@/components/game/stalls-panel";
import { WorkshopPanel } from "@/components/game/workshop-panel";
import { useGame } from "@/hooks/use-game";
import { locationById } from "@/lib/game/catalog";
import { formatCoins, formatDuration, formatNumber } from "@/lib/game/format";
import type { GameState } from "@/lib/game/types";

const views = [
  { id: "market", label: "Market", emoji: "📒" },
  { id: "stalls", label: "Stalls", emoji: "🏪" },
  { id: "plaza", label: "Plaza", emoji: "🏮" },
] as const;

export function PlayScreen({ initialState }: { initialState: GameState }) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const [plazaTab, setPlazaTab] = useState("workshop");
  const [itemId, setItemId] = useState("wheat");
  const [view, setView] = useState<(typeof views)[number]["id"]>("market");

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
  const busy = player.busy.type !== "idle";
  const here = locationById[player.locationId];

  const market = (
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
  );

  const pack = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <p className="font-heading text-lg">🎒 Pack</p>
        <span className="text-xs text-muted-foreground">
          {player.inventory.length} kind{player.inventory.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <InventoryPanel
          layout="rail"
          player={player}
          pending={pending}
          onSelect={(id) => {
            setItemId(id);
            setView("market");
          }}
          onUse={(id) => void run({ action: "use", itemId: id })}
        />
      </div>
    </div>
  );

  const biasPlace = locationById[player.locationId];
  const forageBias = biasPlace?.searchEnergy ? biasPlace : null;

  const stalls = (
    <>
      {player.hasWon ? (
        <Card className="mb-4 bg-primary/15">
          <CardHeader>
            <CardTitle>The great lantern is lit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6">
            You reached the festival score
            {player.titles.length ? ` · ${player.titles.join(" · ")}` : ""}. Keep trading, or help
            the next traveler with a fair ask.
          </CardContent>
        </Card>
      ) : null}
      <StallsPanel
        state={state}
        pending={pending}
        onForage={() => void run({ action: "search" })}
        onSell={(stallId, sellId, quantity) =>
          void run({ action: "stallSell", stallId, itemId: sellId, quantity })
        }
        onBuy={(stallId, buyId, quantity) =>
          void run({ action: "stallBuy", stallId, itemId: buyId, quantity })
        }
        onRumor={(stallId) => void run({ action: "rumor", stallId })}
        onCrate={(stallId) => void run({ action: "crate", stallId })}
        onContract={(contractId) => void run({ action: "contract", contractId })}
        onDonate={() => void run({ action: "donate" })}
      />
    </>
  );

  const plaza = (
    <Tabs value={plazaTab} onValueChange={setPlazaTab}>
      <TabsList className="mb-3 flex h-auto min-h-12 w-full flex-wrap">
        <TabsTrigger className="min-h-10 px-3" value="workshop">
          Craft
        </TabsTrigger>
        <TabsTrigger className="min-h-10 px-3" value="guide">
          Guide
        </TabsTrigger>
        <TabsTrigger className="min-h-10 px-3" value="you">
          You
        </TabsTrigger>
      </TabsList>
      <TabsContent value="workshop">
        <WorkshopPanel
          player={player}
          pending={pending}
          onCraft={(outputId) => void run({ action: "craft", outputId })}
        />
      </TabsContent>
      <TabsContent value="guide">
        <GuidePanel />
      </TabsContent>
      <TabsContent value="you">
        <Card>
          <CardContent className="pt-6">
            <CharacterCard player={player} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-lg">🏮 Lantern Bazaar</p>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/codes"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Codes
              </Link>
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
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary/15 px-3 py-1 font-medium text-primary">
              {formatCoins(player.availableGold)}
            </span>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1">
              {player.energy}/{player.energyMax} energy
            </span>
            <span className="rounded-full bg-amber-400/15 px-3 py-1">
              {formatNumber(player.vp ?? 0)}/{state.festival?.vpToWin ?? 20} VP
            </span>
            <span className="rounded-full bg-card px-3 py-1 ring-1 ring-foreground/10">
              {forageBias
                ? `${forageBias.emoji} ${forageBias.name} lean`
                : `${here?.emoji ?? "🏮"} Plaza grounds`}
            </span>
            <span className="hidden truncate text-muted-foreground md:inline">
              {player.username}
            </span>
          </div>
          {player.lastEvent ? (
            <p className="truncate rounded-lg bg-card px-3 py-1.5 text-sm ring-1 ring-foreground/10">
              {player.lastEvent}
            </p>
          ) : null}
        </div>
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
        {busy ? (
          <div className="border-t border-primary/20 bg-primary/10 px-4 py-2">
            <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {player.busy.label} · {formatDuration(player.busy.remainingMs)} left
              </p>
              <p className="text-xs text-muted-foreground">{player.busy.detail}</p>
            </div>
          </div>
        ) : null}
        <nav className="border-t border-border/70">
          <div className="mx-auto grid w-full max-w-[90rem] grid-cols-3 gap-1 px-2 py-2 sm:px-4">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium sm:h-11 sm:flex-row sm:gap-2 sm:text-sm ${
                  view === item.id ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-base sm:text-sm">{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 overflow-hidden">
        <aside className="flex w-[10.5rem] shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 sm:w-[16rem] lg:w-[18rem]">
          {pack}
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4">
          {view === "market" ? market : null}
          {view === "stalls" ? stalls : null}
          {view === "plaza" ? plaza : null}
        </main>
      </div>
    </div>
  );
}
