"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeGameOver, formatGoalScore, goalScore, sortByGoal } from "@/lib/game/goal";
import { cn } from "@/lib/utils";
import type { GameOverView, GoalView, LeaderRow } from "@/lib/game/types";

export function GameOverScreen({
  goal,
  gameOver,
  leaders,
  you,
  canOffice,
}: {
  goal: GoalView;
  gameOver: GameOverView;
  leaders: LeaderRow[];
  you: string;
  canOffice: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!gameOver.over) return null;
  const ranked = sortByGoal(leaders, goal);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[min(90dvh,36rem)] max-w-lg overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Game over</DialogTitle>
          <DialogDescription>
            {gameOver.winner ? (
              <>
                <span className="font-medium text-foreground">{gameOver.winner}</span> wins.{" "}
              </>
            ) : null}
            {describeGameOver(gameOver, goal)}
          </DialogDescription>
        </DialogHeader>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one was at the table.</p>
        ) : (
          <ol className="space-y-1">
            {ranked.slice(0, 12).map((row, index) => (
              <li
                key={row.username}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                  row.username === gameOver.winner && "bg-primary/15 text-primary",
                  row.username === you && row.username !== gameOver.winner && "bg-muted/60"
                )}
              >
                <span className="min-w-0 truncate">
                  <span className="tabular-nums text-muted-foreground">{index + 1}.</span>{" "}
                  {row.username}
                  {row.username === you ? " · you" : ""}
                </span>
                <span className="shrink-0 tabular-nums">{formatGoalScore(goalScore(row, goal), goal)}</span>
              </li>
            ))}
          </ol>
        )}
        <DialogFooter>
          <Link href="/leaders" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
            Full leaderboard
          </Link>
          {canOffice ? (
            <Link href="/admin" className={cn(buttonVariants(), "h-10")}>
              New game in Admin
            </Link>
          ) : (
            <Button onClick={() => setOpen(false)}>Look at the desk</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GameOverBanner({
  gameOver,
  goal,
}: {
  gameOver: GameOverView;
  goal: GoalView;
}) {
  if (!gameOver.over) return null;
  return (
    <p className="w-full truncate px-3 pb-2 text-sm text-primary sm:px-4">
      Game over{gameOver.winner ? ` · ${gameOver.winner} wins` : ""}. {goal.label}
    </p>
  );
}

export function GoalClock({ goal, now }: { goal: GoalView; now: number }) {
  const [tick, setTick] = useState(now);
  useEffect(() => {
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [goal.endsAt, now]);
  if (goal.mode !== "timed" || !goal.endsAt) return null;
  const left = Math.max(0, goal.endsAt - tick);
  const totalSec = Math.floor(left / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const clock =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return (
    <p className="w-full truncate px-3 pb-2 text-sm text-muted-foreground sm:px-4">
      Clock {clock} · {goal.label}
    </p>
  );
}
