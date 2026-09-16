"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { GAME_NAME, GAME_PITCH } from "@/lib/game/brand";
import { cn } from "@/lib/utils";
import type { GameState } from "@/lib/game/types";

function formatWhen(ms: number) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

function formatRemain(ms: number) {
  if (ms <= 0) return "starting now";
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export function LobbyScreen({
  state,
  error,
  onDismissError,
}: {
  state: GameState;
  error?: string | null;
  onDismissError?: () => void;
}) {
  const [mobile, setMobile] = useMobileLayout();
  const [now, setNow] = useState(() => Date.now());
  const startAt = state.scheduledStartAt;
  const remain = startAt != null ? startAt - now : null;
  const player = state.player;
  const humans = state.lobbyTravelers ?? [];
  const computers = state.computerCount ?? 0;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">{GAME_NAME}</p>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {GAME_PITCH}
              <span className="text-border"> · </span>
              {player.username}
            </span>
            <span className="truncate text-sm text-muted-foreground sm:hidden">{player.username}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <MobileToggle checked={mobile} onChange={setMobile} />
            {player.canOffice ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-2 sm:px-3")}
              >
                Admin
              </Link>
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
        {error ? (
          <div className="border-t border-destructive/30 bg-destructive/15 px-3 py-2 sm:px-4">
            <div className="flex w-full items-start justify-between gap-3 text-sm text-destructive">
              <p>{error}</p>
              {onDismissError ? (
                <button type="button" onClick={onDismissError}>
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">Lobby</p>
          <h1 className="font-heading text-3xl text-balance sm:text-4xl">Waiting for the book to open</h1>
          {startAt != null ? (
            <p className="text-base leading-7 text-muted-foreground">
              New game at <span className="text-foreground">{formatWhen(startAt)}</span>
              {remain != null ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-primary">{formatRemain(remain)}</span>
                </>
              ) : null}
              . Same reset as Jesse’s New game button: opening purse and an even pack for everyone listed here.
            </p>
          ) : (
            <p className="text-base leading-7 text-muted-foreground">
              Jesse has not set a start time yet. Sign in stays; the book stays closed until the clock is set.
            </p>
          )}
        </div>

        <section className="rounded-xl border border-border/80 bg-card/70 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg">Who will play</h2>
            <p className="text-sm tabular-nums text-muted-foreground">
              {humans.length} traveler{humans.length === 1 ? "" : "s"}
              {computers > 0 ? ` + ${computers} computer${computers === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          {humans.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No travelers at the table yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-border/60">
              {humans.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {row.username}
                    {row.username === player.username ? (
                      <span className="text-muted-foreground"> · you</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                    Traveler
                  </span>
                </li>
              ))}
            </ol>
          )}
          {computers > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {computers} computer{computers === 1 ? "" : "s"} will sit when the book opens. They do not appear as
              named travelers here.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No computers will sit this game.</p>
          )}
        </section>
      </main>
    </div>
  );
}
