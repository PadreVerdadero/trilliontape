"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { items, itemById, STIPEND_PRESETS, stipendLabel } from "@/lib/game/catalog";
import { MAX_COMPUTERS } from "@/lib/game/bots";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { useGame } from "@/hooks/use-game";
import { useSelectedItem } from "@/hooks/use-selected-item";
import { cn } from "@/lib/utils";
import { GAME_NAME } from "@/lib/game/brand";
import type { GameState } from "@/lib/game/types";

export function AdminScreen({
  initialState,
  initialItemId,
}: {
  initialState: GameState;
  initialItemId?: string;
}) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const [itemId, setItemId] = useSelectedItem(initialItemId);
  const [seatId, setSeatId] = useState<number | null>(null);
  const [goldInput, setGoldInput] = useState("");
  const [qtyInput, setQtyInput] = useState("0");
  const [issuedDraft, setIssuedDraft] = useState<Record<string, string>>({});
  const [computerDraft, setComputerDraft] = useState(String(initialState.computerCount ?? 0));

  const player = state?.player;
  const roster = state?.adminRoster ?? [];
  const selectedSeat =
    roster.find((row) => row.id === seatId) ?? roster.find((row) => row.id === player?.id) ?? roster[0];
  const held = selectedSeat?.holdings[itemId] ?? 0;
  const selected = itemById[itemId];

  useEffect(() => {
    if (player && seatId == null) setSeatId(player.id);
  }, [player?.id, seatId]);

  useEffect(() => {
    if (selectedSeat) setGoldInput(String(selectedSeat.gold));
  }, [selectedSeat?.id, selectedSeat?.gold]);

  useEffect(() => {
    setQtyInput(String(held));
  }, [held, itemId, selectedSeat?.id]);

  useEffect(() => {
    setComputerDraft(String(state?.computerCount ?? 0));
  }, [state?.computerCount]);

  const capKey = (state?.prices ?? []).map((row) => `${row.itemId}:${row.authorized}`).join("|");
  useEffect(() => {
    if (!state) return;
    const next: Record<string, string> = {};
    for (const item of items) {
      const row = state.prices.find((price) => price.itemId === item.id);
      next[item.id] = String(row?.authorized ?? item.authorized ?? 0);
    }
    setIssuedDraft(next);
  }, [capKey]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-amber-950 px-4 text-amber-100">
        <p>Opening the admin office…</p>
      </div>
    );
  }

  if (!state || !player) {
    return (
      <div className="grid min-h-dvh place-items-center bg-amber-950 px-4 text-amber-50">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-heading text-2xl">The office is locked</p>
          <p className="text-sm text-amber-100/70">{error ?? "Could not load admin."}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-amber-950 text-amber-50">
      <header className="sticky top-0 z-20 border-b border-amber-400/40 bg-amber-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-200/80 uppercase">
              {GAME_NAME}
            </p>
            <h1 className="font-heading text-2xl text-amber-100 sm:text-3xl">Admin office</h1>
            <p className="truncate text-sm text-amber-100/70">
              {player.username} · you are the admin
              {selectedSeat && selectedSeat.id !== player.id
                ? ` · editing ${selectedSeat.username}`
                : ""}
            </p>
          </div>
          <Link
            href="/play"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 border-amber-200/40 bg-transparent text-amber-50 hover:bg-amber-900")}
          >
            Back to the desk
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4">
        {player.lastEvent ? (
          <p className="rounded-lg border border-amber-400/20 bg-amber-900/40 px-3 py-2 text-sm text-amber-100">
            {player.lastEvent}
          </p>
        ) : null}
        {error ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">
            <p>{error}</p>
            <button type="button" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <h2 className="font-heading text-lg">Traveler</h2>
          <Label htmlFor="admin-seat" className="text-amber-100/80">
            Edit this pack
          </Label>
          <select
            id="admin-seat"
            className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm text-amber-50"
            value={selectedSeat?.id ?? player.id}
            onChange={(event) => setSeatId(Number(event.target.value))}
          >
            {roster.map((row) => (
              <option key={row.id} value={row.id}>
                {row.username}
                {row.id === player.id ? " (you)" : ""}
                {row.bot ? (row.seated ? " · computer" : " · sitting out") : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-amber-100/60">
            Coins and pack qty below apply to {selectedSeat?.username ?? player.username}. Issued is a table rule
            and changes every traveler.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
            <h2 className="font-heading text-lg">
              {selectedSeat && selectedSeat.id !== player.id
                ? `${selectedSeat.username}'s purse`
                : "Your purse"}
            </h2>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="admin-gold" className="text-amber-100/80">
                  Coins
                </Label>
                <Input
                  id="admin-gold"
                  inputMode="numeric"
                  value={goldInput}
                  onChange={(event) => setGoldInput(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
              </div>
              <Button
                disabled={pending || !selectedSeat}
                className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                onClick={() =>
                  void run({
                    action: "adminGold",
                    gold: Number(goldInput),
                    targetUserId: selectedSeat?.id,
                  })
                }
              >
                Set
              </Button>
            </div>
            <p className="text-sm text-amber-100/70">
              Now {formatCoins(selectedSeat?.gold ?? player.gold)}.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
            <h2 className="font-heading text-lg">Pack quantity</h2>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setItemId(item.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-sm",
                    item.id === itemId
                      ? "bg-amber-300 text-amber-950"
                      : "bg-amber-950/50 text-amber-100 ring-1 ring-amber-400/20"
                  )}
                >
                  {item.emoji} {item.name}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="admin-qty" className="text-amber-100/80">
                  {selected ? `${selected.emoji} ${selected.name}` : "Item"} qty
                </Label>
                <Input
                  id="admin-qty"
                  inputMode="numeric"
                  value={qtyInput}
                  onChange={(event) => setQtyInput(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
              </div>
              <Button
                disabled={pending || !selected}
                className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                onClick={() =>
                  void run({
                    action: "adminItem",
                    itemId,
                    quantity: Number(qtyInput),
                    targetUserId: selectedSeat?.id,
                  })
                }
              >
                Set
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <h2 className="font-heading text-lg">Table rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-stipend" className="text-amber-100/80">
                Coin drop every
              </Label>
              <select
                id="admin-stipend"
                className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm text-amber-50"
                value={state.stipendMs}
                disabled={pending}
                onChange={(event) => void run({ action: "adminStipend", ms: Number(event.target.value) })}
              >
                {STIPEND_PRESETS.map((row) => (
                  <option key={row.ms} value={row.ms}>
                    {row.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-amber-100/60">
                Travelers who sit at the desk get the next ladder purse every {stipendLabel(state.stipendMs)}.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-computers" className="text-amber-100/80">
                Computers at the table
              </Label>
              <div className="flex items-end gap-2">
                <Input
                  id="admin-computers"
                  inputMode="numeric"
                  min={0}
                  max={MAX_COMPUTERS}
                  value={computerDraft}
                  onChange={(event) => setComputerDraft(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
                <Button
                  disabled={pending}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => {
                    const next = Number(computerDraft);
                    const current = state.computerCount ?? 0;
                    if (next < current) {
                      const ok = window.confirm(
                        "Sit some computers out? They leave the book, and their packs go back to the treasury."
                      );
                      if (!ok) return;
                    }
                    void run({ action: "adminComputers", count: next });
                  }}
                >
                  Set
                </Button>
              </div>
              <p className="text-xs text-amber-100/60">
                {state.computerCount ?? 0} of {MAX_COMPUTERS} seated. Set applies it now. New game
                uses the number in this box, splits Issued across travelers plus that many
                computers, and leaves the remainder in the treasury.
              </p>
              <Button
                variant="outline"
                disabled={pending}
                className="w-full border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
                onClick={() => {
                  const bots = Number(computerDraft);
                  if (!Number.isInteger(bots) || bots < 0 || bots > MAX_COMPUTERS) {
                    setError(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
                    return;
                  }
                  const ok = window.confirm(
                    `Start a new game? This clears packs, the book, and the tape. Every traveler and ${bots} seated computer${
                      bots === 1 ? "" : "s"
                    } start with 1,000 coins and floor(Issued ÷ seats) of each good. Remainder stays in the treasury for the government to sell at MV.`
                  );
                  if (ok) void run({ action: "adminNewGame", count: bots });
                }}
              >
                New game
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <h2 className="font-heading text-lg">Share structure</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-amber-100/70">
                <tr className="border-b border-amber-400/20">
                  <th className="py-2 pr-3 font-medium">Good</th>
                  <th className="py-2 pr-3 font-medium">MV</th>
                  <th className="py-2 pr-3 font-medium">Issued</th>
                  <th className="py-2 pr-3 font-medium">Outstanding</th>
                  <th className="py-2 font-medium">Treasury</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const row = state.prices.find((price) => price.itemId === item.id);
                  return (
                    <tr key={item.id} className="border-b border-amber-400/10">
                      <td className="py-2 pr-3">
                        {item.emoji} {item.name}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(row?.vwap ?? item.basePrice)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Input
                            inputMode="numeric"
                            value={issuedDraft[item.id] ?? String(row?.authorized ?? 0)}
                            onChange={(event) =>
                              setIssuedDraft((prev) => ({ ...prev, [item.id]: event.target.value }))
                            }
                            className="h-8 w-20 border-amber-400/30 bg-amber-950/60 px-2"
                          />
                          <Button
                            size="sm"
                            disabled={pending}
                            className="h-8 bg-amber-300 px-2 text-amber-950 hover:bg-amber-200"
                            onClick={() =>
                              void run({
                                action: "adminIssued",
                                itemId: item.id,
                                authorized: Number(issuedDraft[item.id] ?? row?.authorized ?? 0),
                              })
                            }
                          >
                            Set
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(row?.held ?? 0)}</td>
                      <td className="py-2 tabular-nums">{formatNumber(row?.treasury ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-100/60">
            Issued is the cap. Changing it lists leftover on the treasury or buys surplus at MV.
            Outstanding is every unit sitting in traveler packs. Treasury is Issued minus Outstanding.
          </p>
        </section>
      </main>
    </div>
  );
}
