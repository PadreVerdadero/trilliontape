"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { items as defaultItems } from "@/lib/game/catalog";
import { ItemIcon } from "@/components/game/item-icon";
import { playItems } from "@/lib/game/shares";
import type { Item } from "@/lib/game/types";
import { GOAL_TIME_PRESETS, describeGoal } from "@/lib/game/goal";
import type { GoalView } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function GoalEditor({
  goal,
  pending,
  catalog,
  onSave,
}: {
  goal: GoalView;
  catalog?: Item[];
  pending: boolean;
  onSave: (draft: {
    mode: GoalView["mode"];
    score: GoalView["score"];
    threshold: number;
    durationMs: number;
    needs: { itemId: string; quantity: number }[];
  }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GoalView["mode"]>(goal.mode);
  const [score, setScore] = useState<GoalView["score"]>(goal.score);
  const [threshold, setThreshold] = useState(String(goal.threshold));
  const [durationMs, setDurationMs] = useState(goal.durationMs);
  const [customMin, setCustomMin] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const goods = playItems(catalog ?? defaultItems);

  useEffect(() => {
    if (open) return;
    setMode(goal.mode);
    setScore(goal.score);
    setThreshold(String(goal.threshold));
    setDurationMs(goal.durationMs);
    const next: Record<string, string> = {};
    for (const need of goal.needs) next[need.itemId] = String(need.quantity);
    setQty(next);
  }, [goal, open]);

  const presetMatch = GOAL_TIME_PRESETS.some((row) => row.ms === durationMs);

  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        className="w-full border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
        onClick={() => setOpen(true)}
      >
        Edit goal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[min(90dvh,40rem)] max-w-lg overflow-y-auto border border-amber-400/30 bg-amber-950 text-amber-50"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="text-amber-100">When the game ends</DialogTitle>
            <DialogDescription className="text-amber-100/70">
              Now: {goal.label} Saving a new rule clears a finished game. Use the schedule at the top
              of Admin to choose when a timed game starts and ends.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-amber-100/80">End the game</Label>
              <select
                className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm"
                value={mode}
                onChange={(event) => setMode(event.target.value as GoalView["mode"])}
              >
                <option value="threshold">When someone hits the mark</option>
                <option value="timed">When the clock runs out</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-amber-100/80">What counts</Label>
              <select
                className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm"
                value={score}
                onChange={(event) => setScore(event.target.value as GoalView["score"])}
              >
                <option value="netWorth">Net worth</option>
                <option value="gold">Coins</option>
                <option value="items">Goods</option>
              </select>
            </div>
            {score !== "items" && mode === "threshold" ? (
              <div className="space-y-1">
                <Label htmlFor="goal-mark" className="text-amber-100/80">
                  Mark
                </Label>
                <Input
                  id="goal-mark"
                  inputMode="numeric"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
              </div>
            ) : null}
            {mode === "timed" ? (
              <div className="space-y-1">
                <Label className="text-amber-100/80">Clock duration (used when no top-page schedule is set)</Label>
                <select
                  className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm"
                  value={presetMatch ? String(durationMs) : "custom"}
                  onChange={(event) => {
                    if (event.target.value === "custom") {
                      setCustomMin(String(Math.max(1, Math.round(durationMs / 60_000))));
                      return;
                    }
                    setDurationMs(Number(event.target.value));
                  }}
                >
                  {GOAL_TIME_PRESETS.map((row) => (
                    <option key={row.ms} value={row.ms}>
                      {row.label}
                    </option>
                  ))}
                  <option value="custom">Custom minutes</option>
                </select>
                {!presetMatch ? (
                  <Input
                    inputMode="numeric"
                    value={customMin}
                    onChange={(event) => {
                      setCustomMin(event.target.value);
                      const minutes = Number(event.target.value);
                      if (Number.isFinite(minutes) && minutes >= 1) {
                        setDurationMs(Math.round(minutes) * 60_000);
                      }
                    }}
                    className="border-amber-400/30 bg-amber-950/60"
                  />
                ) : null}
              </div>
            ) : null}
            {score === "items" ? (
              <div className="space-y-2">
                <Label className="text-amber-100/80">
                  {mode === "threshold" ? "Need at least this many of each checked good" : "Rank by these goods"}
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {goods.map((item) => {
                    const on = qty[item.id] != null && qty[item.id] !== "";
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                          on ? "border-amber-300/50 bg-amber-900/40" : "border-amber-400/20"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(event) =>
                            setQty((prev) => {
                              const next = { ...prev };
                              if (event.target.checked) next[item.id] = prev[item.id] || "1";
                              else delete next[item.id];
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <ItemIcon item={item} /> {item.name}
                        </span>
                        {on ? (
                          <Input
                            inputMode="numeric"
                            value={qty[item.id] ?? "1"}
                            onChange={(event) =>
                              setQty((prev) => ({ ...prev, [item.id]: event.target.value }))
                            }
                            className="h-8 w-16 border-amber-400/30 bg-amber-950/60 px-2"
                          />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-amber-100/60">
              {describeGoal({
                mode,
                score,
                threshold: Number(threshold) || 1,
                durationMs,
                startsAt: null,
                endsAt: null,
                needs: Object.entries(qty)
                  .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }))
                  .filter((row) => Number.isInteger(row.quantity) && row.quantity >= 1),
              })}
            </p>
          </div>
          <DialogFooter className="border-amber-400/20 bg-amber-900/40">
            <Button
              variant="outline"
              className="border-amber-400/40 bg-transparent text-amber-50"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              className="bg-amber-300 text-amber-950 hover:bg-amber-200"
              onClick={() => {
                void onSave({
                  mode,
                  score,
                  threshold: Number(threshold),
                  durationMs,
                  needs: Object.entries(qty)
                    .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }))
                    .filter((row) => Number.isInteger(row.quantity) && row.quantity >= 1),
                }).then(() => setOpen(false));
              }}
            >
              Save goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
