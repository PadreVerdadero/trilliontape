"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { GameOverScreen } from "@/components/game/game-over-screen";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { useGame } from "@/hooks/use-game";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { ItemIcon } from "@/components/game/item-icon";
import { playItems } from "@/lib/game/shares";
import { formatCoins, formatNetWorth, formatNumber } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import { GAME_NAME } from "@/lib/game/brand";
import type { GameState } from "@/lib/game/types";

const PLACE =
  "sticky left-0 w-[2.75rem] min-w-[2.75rem] max-w-[2.75rem] px-2 py-2 sm:px-2.5";
const NAME =
  "sticky left-[2.75rem] w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] truncate px-2 py-2 sm:px-2.5";
const HEAD_Z = "z-40 bg-card";
const ROW_Z = "z-20 bg-card";
const FOOT_Z = "z-30 bg-card";

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

  const [mobile, setMobile] = useMobileLayout();
  const { player, leaders } = state;
  const you = leaders.find((row) => row.username === player.username);
  const goods = playItems(state.items);
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
      {state.goal && state.gameOver ? (
        <GameOverScreen
          goal={state.goal}
          gameOver={state.gameOver}
          leaders={leaders}
          you={player.username}
          canOffice={Boolean(player.canOffice)}
        />
      ) : null}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">{GAME_NAME}</p>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {player.username}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MobileToggle checked={mobile} onChange={setMobile} />
            <Link
              href="/play"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 px-3")}
            >
              Back to the desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-5 px-3 py-6 sm:px-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Place by net worth. {state.goal?.label ?? "The table has a mark to hit."}
            Place and name stay on the left, the emoji header stays on top, and
            totals stay at the bottom while you scroll.
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
          <div className="max-h-[min(70dvh,calc(100dvh-13rem))] overflow-auto rounded-xl border border-border/70 bg-card">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th
                    className={cn(
                      PLACE,
                      HEAD_Z,
                      "top-0 text-left text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                    )}
                  >
                    #
                  </th>
                  <th
                    className={cn(
                      NAME,
                      HEAD_Z,
                      "top-0 shadow-[2px_0_0_0_var(--border)] text-left text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                    )}
                  >
                    Traveler
                  </th>
                  <th
                    className="sticky top-0 z-30 bg-card px-1.5 py-2 text-center text-lg sm:px-2"
                    title="Coins"
                  >
                    🪙
                  </th>
                  {goods.map((item) => (
                    <th
                      key={item.id}
                      className="sticky top-0 z-30 bg-card px-1.5 py-2 text-center text-lg sm:px-2"
                      title={item.name}
                    >
                      <ItemIcon item={item} />
                    </th>
                  ))}
                  <th
                    className="sticky top-0 z-30 bg-card px-1.5 py-2 text-center text-lg sm:px-2"
                    title="Net worth"
                  >
                    💰
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => {
                  const mine = row.username === player.username;
                  const pack = row.holdings ?? {};
                  const freezeBg = mine ? "bg-accent" : "bg-card";
                  return (
                    <tr
                      key={`${row.place}-${row.username}`}
                      className={cn("border-b border-border/40", mine && "bg-primary/10")}
                    >
                      <td
                        className={cn(
                          PLACE,
                          ROW_Z,
                          freezeBg,
                          "tabular-nums",
                          row.place <= 3 ? "font-medium text-primary" : "text-muted-foreground"
                        )}
                      >
                        {row.place}
                      </td>
                      <td
                        className={cn(
                          NAME,
                          ROW_Z,
                          freezeBg,
                          "shadow-[2px_0_0_0_var(--border)]",
                          mine && "font-medium text-primary"
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
                  <td
                    className={cn(
                      PLACE,
                      FOOT_Z,
                      "bottom-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                    )}
                  >
                    Σ
                  </td>
                  <td
                    className={cn(
                      NAME,
                      FOOT_Z,
                      "bottom-0 shadow-[2px_0_0_0_var(--border)] text-xs font-medium"
                    )}
                  >
                    Total
                  </td>
                  <td
                    className="sticky bottom-0 z-30 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium sm:px-2 sm:text-sm"
                    title={formatCoins(totals.gold)}
                  >
                    {formatNumber(totals.gold)}
                  </td>
                  {goods.map((item) => (
                    <td
                      key={item.id}
                      className={cn(
                        "sticky bottom-0 z-30 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium sm:px-2 sm:text-sm",
                        totals.items[item.id] <= 0 ? "text-muted-foreground/50" : "text-foreground"
                      )}
                      title={`${item.name} · ${formatNumber(totals.items[item.id])} in every pack`}
                    >
                      {formatNumber(totals.items[item.id])}
                    </td>
                  ))}
                  <td
                    className="sticky bottom-0 z-30 whitespace-nowrap bg-card px-1.5 py-2.5 text-center tabular-nums text-xs font-medium text-primary sm:px-2 sm:text-sm"
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
