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
import { formatCompact } from "@/lib/game/format";
import {
  defaultStipendLadder,
  MAX_STIPEND_RUNGS,
  parseCoinAmount,
} from "@/lib/game/stipend-ladder";

export function StipendEditor({
  ladder,
  pending,
  onSave,
}: {
  ladder: number[];
  pending: boolean;
  onSave: (amounts: number[]) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(ladder.map(String));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setDraft(ladder.map(String));
    setError(null);
  }, [ladder, open]);

  const preview = ladder.slice(0, 6).map((amount) => formatCompact(amount)).join(" → ");
  const extra = ladder.length > 6 ? ` → … (${ladder.length} levels)` : "";

  return (
    <>
      <div className="space-y-2">
        <Label className="text-amber-100/80">Coin drop amounts</Label>
        <p className="text-xs text-amber-100/70">
          {preview}
          {extra}. After the last level, that purse repeats.
        </p>
        <Button
          variant="outline"
          disabled={pending}
          className="w-full border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
          onClick={() => setOpen(true)}
        >
          Edit coin drops
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[min(90dvh,40rem)] max-w-lg overflow-y-auto border border-amber-400/30 bg-amber-950 text-amber-50"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="text-amber-100">Coin drop ladder</DialogTitle>
            <DialogDescription className="text-amber-100/70">
              Drop 1 is the first purse after someone sits down. Type 1000, 1,000, or 1k. After the
              last level, travelers keep getting that amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              {draft.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Label className="w-14 shrink-0 text-amber-100/70">#{index + 1}</Label>
                  <Input
                    inputMode="text"
                    value={value}
                    onChange={(event) => {
                      const next = [...draft];
                      next[index] = event.target.value;
                      setDraft(next);
                    }}
                    className="border-amber-400/30 bg-amber-950/60"
                  />
                  {draft.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 border-amber-400/40 bg-transparent text-amber-50 hover:bg-amber-900"
                      onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {draft.length < MAX_STIPEND_RUNGS ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-400/40 bg-transparent text-amber-50 hover:bg-amber-900"
                onClick={() => {
                  const last = parseCoinAmount(draft[draft.length - 1] ?? "") ?? 1000;
                  setDraft([...draft, String(last)]);
                }}
              >
                Add a level
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-400/40 bg-transparent text-amber-50 hover:bg-amber-900"
              onClick={() => {
                setDraft(defaultStipendLadder().map(String));
                setError(null);
              }}
            >
              Reset to default ladder
            </Button>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
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
                const amounts: number[] = [];
                for (const [index, value] of draft.entries()) {
                  const amount = parseCoinAmount(value);
                  if (amount == null) {
                    setError(`Drop ${index + 1} must be a whole number such as 1000 or 1k.`);
                    return;
                  }
                  amounts.push(amount);
                }
                if (amounts.length === 0) {
                  setError("Add at least one coin-drop amount.");
                  return;
                }
                setError(null);
                void onSave(amounts).then((result) => {
                  if (result) setOpen(false);
                });
              }}
            >
              Save ladder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
