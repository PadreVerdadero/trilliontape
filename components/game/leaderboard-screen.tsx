"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useGame } from "@/hooks/use-game";
import { items } from "@/lib/game/catalog";
import { formatCoins, formatNetWorth, formatNumber } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";

function qtyCell(amount: number, title: string, className?: string) {
  const empty = amount <= 0;
  return (
    <td
      className={cn(
        "whitespace-nowrap px-1.5 py-2 text-center tabular-nums text-xs sm:px-2 sm:text-sm",
        empty ? "text-muted-foreground/50" : "text-foreground",
        className
      )}
      title={title}
    >
      {formatNumber(amount)}
    </td>
  );
}

export function LeaderboardScreen({ initialState }: { initialState: GameState }) {
  const { state, error, loading } = useGame(initialState);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <p className="text-muted-foreground">Opening the board…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-heading text-2xl">The gate is stuck</p>
          <p className="text-sm text-muted-foreground">
            {error ?? "Could not load the leaderboard."}
          </p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { player, leaders } = state;
  const you = leaders.find((row) => row.username === player.username);
  const goods = items;
  const totals = {
    gold: 0,
    netWorth: 0,
    items: Object.fromEntries(goods.map((item) => [item.id, 0])) as Record<string, number>,
  };
  for (const row of leaders) {
    totals.gold += row.gold ?? 0;
    totals.netWorth += row.netWorth;
    for (const item of goods) {
      totals.items[item.id] += row.holdings?.[item.id] ?? 0;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">🏮 Lantern Bazaar</p>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {player.username}
            </span>
          </div>
          <Link
            href="/play"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 px-3")}
          >
            Back to the desk
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-5 px-3 py-6 sm:px-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Place by net worth. Full counts under each mark — coin, every good, then the bag. Totals
            sit on the last row.
          </p>
        </div>

        {you ? (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
            You are <span className="font-medium text-primary">#{you.place}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="tabular-nums" title={formatNetWorth(you.netWorth)}>
              {formatNetWorth(you.netWorth)}
            </span>
          </p>
        ) : null}

        {leaders.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/50 px-4 py-10 text-center">
            <p className="font-heading text-xl">No purses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sit at the desk and the tape will have someone to rank.
            </p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border/70 bg-card/50">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="sticky left-0 z-20 w-8 min-w-8 bg-card px-2 py-2 text-left text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:px-3">
                    #
                  </th>
                  <th className="sticky left-8 z-20 min-w-[6.5rem] bg-card px-2 py-2 text-left text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:left-10 sm:px-3">
                    Traveler
                  </th>
                  <th className="px-1.5 py-2 text-center text-lg sm:px-2" title="Coins">
                    🪙
                  </th>
                  {goods.map((item) => (
                    <th
                      key={item.id}
                      className="px-1.5 py-2 text-center text-lg sm:px-2"
                      title={item.name}
                    >
                      {item.emoji}
                    </th>
                  ))}
                  <th className="px-1.5 py-2 text-center text-lg sm:px-2" title="Net worth">
                    💰
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => {
                  const mine = row.username === player.username;
                  const pack = row.holdings ?? {};
                  return (
                    <tr
                      key={`${row.place}-${row.username}`}
                      className={cn(
                        "border-b border-border/40",
                        mine && "bg-primary/10"
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-10 px-2 py-2 tabular-nums sm:px-3",
                          mine ? "bg-primary/10" : "bg-card",
                          row.place <= 3 ? "font-medium text-primary" : "text-muted-foreground"
                        )}
                      >
                        {row.place}
                      </td>
                      <td
                        className={cn(
                          "sticky left-8 z-10 max-w-[7.5rem] truncate px-2 py-2 sm:left-10 sm:max-w-[10rem] sm:px-3",
                          mine ? "bg-primary/10 font-medium text-primary" : "bg-card"
                        )}
                      >
                        {row.username}
                      </td>
                      {qtyCell(row.gold ?? 0, formatCoins(row.gold ?? 0))}
                      {goods.map((item) => {
                        const qty = pack[item.id] ?? 0;
                        return (
                          <td
                            key={item.id}
                            className={cn(
                              "whitespace-nowrap px-1.5 py-2 text-center tabular-nums text-xs sm:px-2 sm:text-sm",
                              qty <= 0 ? "text-muted-foreground/50" : "text-foreground"
                            )}
                            title={`${item.name} · ${formatNumber(qty)}`}
                          >
                            {formatNumber(qty)}
                          </td>
                        );
                      })}
                      <td
                        className="whitespace-nowrap px-1.5 py-2 text-center tabular-nums text-xs font-medium text-primary sm:px-2 sm:text-sm"
                        title={formatNetWorth(row.netWorth)}
                      >
                        {formatNumber(row.netWorth)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/80">
                  <td className="sticky bottom-0 left-0 z-20 bg-card px-2 py-2.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:px-3">
                    Σ
                  </td>
                  <td className="sticky bottom-0 left-8 z-20 bg-card px-2 py-2.5 text-xs font-medium sm:left-10 sm:px-3">
                    Total
                  </td>
                  <td
                    className="sticky bottom-0 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium sm:px-2 sm:text-sm"
                    title={formatCoins(totals.gold)}
                  >
                    {formatNumber(totals.gold)}
                  </td>
                  {goods.map((item) => (
                    <td
                      key={item.id}
                      className={cn(
                        "sticky bottom-0 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium sm:px-2 sm:text-sm",
                        totals.items[item.id] <= 0 ? "text-muted-foreground/50" : "text-foreground"
                      )}
                      title={`${item.name} · ${formatNumber(totals.items[item.id])} in every pack`}
                    >
                      {formatNumber(totals.items[item.id])}
                    </td>
                  ))}
                  <td
                    className="sticky bottom-0 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium text-primary sm:px-2 sm:text-sm"
                    title={formatNetWorth(totals.netWorth)}
                  >
                    {formatNumber(totals.netWorth)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
