"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { itemById } from "@/lib/game/catalog";
import { formatDuration } from "@/lib/game/format";
import type { GameState } from "@/lib/game/types";

export function PlayScreen({ initialState }: { initialState: GameState }) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const [tab, setTab] = useState("market");
  const [itemId, setItemId] = useState("wheat");

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center px-4">
        <p className="text-muted-foreground">Lighting the plaza lanterns…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-full place-items-center px-4">
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-heading text-lg">🏮 Lantern Bazaar</p>
            <p className="text-xs text-muted-foreground">
              {busy ? player.busy.label : "Ready to walk or gather"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {busy ? (
          <div className="border-t border-primary/20 bg-primary/10 px-4 py-2">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {player.busy.label} · {formatDuration(player.busy.remainingMs)} left
              </p>
              <p className="text-xs text-muted-foreground">{player.busy.detail}</p>
            </div>
            <div className="mx-auto mt-2 h-1.5 w-full max-w-7xl overflow-hidden rounded-full bg-background/50">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.max(4, 100 - (player.busy.remainingMs / getBusyTotal(player.busy.remainingMs, player.busy.endsAt)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-[280px_1fr_400px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <CharacterCard player={player} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pack</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryPanel
                player={player}
                onSelect={(id) => {
                  setItemId(id);
                  setTab("market");
                }}
              />
            </CardContent>
          </Card>
          {player.lastEvent ? (
            <p className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
              {player.lastEvent}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="flex items-start justify-between gap-3 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">
              <p>{error}</p>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          ) : null}
          {player.hasWon ? (
            <Card className="bg-primary/15">
              <CardHeader>
                <CardTitle>The great lantern is lit</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6">
                You crafted the 🌟 Celestial Relic. Keep trading, dress the part, or help the
                next traveler with a fair ask.
              </CardContent>
            </Card>
          ) : null}
          <MapPanel
            player={player}
            pending={pending}
            onTravel={(locationId) => void run({ action: "travel", locationId })}
            onMine={(mineId) => void run({ action: "mine", itemId: mineId })}
          />
          <Card>
            <CardHeader>
              <CardTitle>Tape</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.recentTrades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No trades yet. Take a Banker listing or post the first cross.
                </p>
              ) : (
                state.recentTrades.map((trade) => {
                  const item = itemById[trade.itemId];
                  return (
                    <p key={trade.id} className="text-sm">
                      {item?.emoji} {trade.quantity} @ {trade.price}🪙 · {trade.buyUsername} bought
                      from {trade.sellUsername}
                    </p>
                  );
                })
              )}
              {state.winners.length > 0 ? (
                <p className="pt-2 text-xs text-muted-foreground">
                  Champions: {state.winners.map((row) => row.username).join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[28rem]">
          <CardHeader className="pb-2">
            <CardTitle>Plaza desk</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-3 flex h-auto w-full flex-wrap">
                <TabsTrigger value="market">Board</TabsTrigger>
                <TabsTrigger value="workshop">Craft</TabsTrigger>
                <TabsTrigger value="bank">Bank</TabsTrigger>
                <TabsTrigger value="wardrobe">Wardrobe</TabsTrigger>
                <TabsTrigger value="guide">Guide</TabsTrigger>
              </TabsList>
              <ScrollArea className="h-[min(70vh,36rem)] pr-3">
                <TabsContent value="market">
                  <MarketPanel
                    state={state}
                    pending={pending}
                    selectedItemId={itemId}
                    onSelectItem={setItemId}
                    onOrder={(input) => run({ action: "order", ...input })}
                    onTake={(orderId) => run({ action: "take", orderId })}
                    onCancel={(orderId) => run({ action: "cancel", orderId })}
                  />
                </TabsContent>
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
                    onSell={(sellId, quantity) =>
                      void run({ action: "bank", itemId: sellId, quantity })
                    }
                  />
                </TabsContent>
                <TabsContent value="wardrobe">
                  <WardrobePanel
                    player={player}
                    pending={pending}
                    onBuy={(cosmeticId) => void run({ action: "buyCosmetic", cosmeticId })}
                    onEquip={(cosmeticId, slot) =>
                      void run({ action: "equip", cosmeticId, slot })
                    }
                  />
                </TabsContent>
                <TabsContent value="guide">
                  <GuidePanel />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function getBusyTotal(remaining: number, endsAt: number | null) {
  if (!endsAt) return remaining || 1;
  const startedAgo = Date.now() - (endsAt - remaining);
  const total = remaining + Math.max(0, startedAgo);
  return total || 1;
}
