"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankPanel } from "@/components/game/bank-panel";
import { CharacterCard } from "@/components/game/character-card";
import { GuidePanel } from "@/components/game/guide-panel";
import { InventoryPanel } from "@/components/game/inventory-panel";
import { MapPanel } from "@/components/game/map-panel";
import { MarketPanel } from "@/components/game/market-panel";
import { WardrobePanel } from "@/components/game/wardrobe-panel";
import { WorkshopPanel } from "@/components/game/workshop-panel";
import { useGame } from "@/hooks/use-game";
import { locationById } from "@/lib/game/catalog";
import { formatCoins, formatDuration } from "@/lib/game/format";
import type { GameState } from "@/lib/game/types";

const views = [
  { id: "market", label: "Market", emoji: "📒" },
  { id: "map", label: "Map", emoji: "🗺️" },
  { id: "pack", label: "Pack", emoji: "🎒" },
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
    />
  );

  const pack = (
    <Card>
      <CardHeader>
        <CardTitle>Your pack</CardTitle>
      </CardHeader>
      <CardContent>
        <InventoryPanel
          player={player}
          pending={pending}
          onSelect={(id) => {
            setItemId(id);
            setView("market");
          }}
          onUse={(id) => void run({ action: "use", itemId: id })}
        />
      </CardContent>
    </Card>
  );

  const map = (
    <>
      {player.hasWon ? (
        <Card className="mb-4 bg-primary/15">
          <CardHeader>
            <CardTitle>The great lantern is lit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6">
            You crafted the 🌟 Celestial Relic. Keep trading, dress the part, or help the next
            traveler with a fair ask.
          </CardContent>
        </Card>
      ) : null}
      <MapPanel
        player={player}
        pending={pending}
        areas={state.areas ?? []}
        onArrive={(locationId) => void run({ action: "arrive", locationId })}
        onSearch={() => void run({ action: "search" })}
      />
    </>
  );

  const plaza = (
    <Tabs value={plazaTab} onValueChange={setPlazaTab}>
      <TabsList className="mb-3 flex h-auto min-h-12 w-full flex-wrap">
        <TabsTrigger className="min-h-10 px-3" value="workshop">
          Craft
        </TabsTrigger>
        <TabsTrigger className="min-h-10 px-3" value="bank">
          Bank
        </TabsTrigger>
        <TabsTrigger className="min-h-10 px-3" value="wardrobe">
          Looks
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
      <TabsContent value="bank">
        <BankPanel
          state={state}
          pending={pending}
          onSell={(sellId, quantity) => void run({ action: "bank", itemId: sellId, quantity })}
        />
      </TabsContent>
      <TabsContent value="wardrobe">
        <WardrobePanel
          player={player}
          pending={pending}
          onBuy={(cosmeticId) => void run({ action: "buyCosmetic", cosmeticId })}
          onEquip={(cosmeticId, slot) => void run({ action: "equip", cosmeticId, slot })}
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
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
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
            <span className="rounded-full bg-card px-3 py-1 ring-1 ring-foreground/10">
              {here?.emoji} {here?.name}
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
        <nav className="hidden border-t border-border/70 lg:block">
          <div className="mx-auto grid w-full max-w-[90rem] grid-cols-4 gap-1 px-4 py-2">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium ${
                  view === item.id ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-4 pb-24 lg:pb-6">
        {view === "market" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div>{market}</div>
            <div className="hidden xl:block">{pack}</div>
          </div>
        ) : null}
        {view === "map" ? map : null}
        {view === "pack" ? pack : null}
        {view === "plaza" ? plaza : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pt-2">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex h-12 flex-col items-center justify-center rounded-xl text-xs ${
                view === item.id ? "bg-primary/15 text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
