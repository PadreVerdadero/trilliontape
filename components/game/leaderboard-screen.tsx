"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useGame } from "@/hooks/use-game";
import { formatCompactNetWorth, formatNetWorth } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-3 py-6 sm:px-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Place by net worth — coin plus goods at market value. The old Banker is not listed.
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
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/50">
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-2 border-b border-border/60 px-3 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:px-4">
              <span>Place</span>
              <span>Traveler</span>
              <span className="text-right">Net worth</span>
            </div>
            <ol>
              {leaders.map((row) => {
                const mine = row.username === player.username;
                return (
                  <li
                    key={`${row.place}-${row.username}`}
                    className={cn(
                      "grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-border/40 px-3 py-2.5 last:border-b-0 sm:px-4",
                      mine && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "tabular-nums text-sm",
                        row.place <= 3 ? "font-medium text-primary" : "text-muted-foreground"
                      )}
                    >
                      #{row.place}
                    </span>
                    <span className={cn("truncate text-sm", mine && "font-medium text-primary")}>
                      {row.username}
                      {mine ? <span className="text-muted-foreground"> · you</span> : null}
                    </span>
                    <span
                      className="tabular-nums text-sm text-primary"
                      title={formatNetWorth(row.netWorth)}
                    >
                      <span className="sm:hidden">{formatCompactNetWorth(row.netWorth)}</span>
                      <span className="hidden sm:inline">{formatNetWorth(row.netWorth)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
