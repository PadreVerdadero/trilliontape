"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById } from "@/lib/game/catalog";
import { formatNumber } from "@/lib/game/format";
import type { PlayerState } from "@/lib/game/types";

export function AdminPanel({
  player,
  selectedItemId,
  pending,
  onSetGold,
  onSetItem,
  onNewGame,
  onSetComputers,
  computers,
  authorized,
  issued,
}: {
  player: PlayerState;
  selectedItemId: string;
  pending: boolean;
  onSetGold: (gold: number) => Promise<unknown>;
  onSetItem: (itemId: string, quantity: number) => Promise<unknown>;
  onNewGame: () => Promise<unknown>;
  onSetComputers: (on: boolean) => Promise<unknown>;
  computers: boolean;
  authorized: number;
  issued: number;
}) {
  const [goldInput, setGoldInput] = useState(String(player.gold));
  const selected = itemById[selectedItemId];
  const held = player.inventory.find((row) => row.itemId === selectedItemId)?.quantity ?? 0;
  const [qtyInput, setQtyInput] = useState(String(held));

  useEffect(() => {
    setGoldInput(String(player.gold));
  }, [player.gold]);

  useEffect(() => {
    setQtyInput(String(held));
  }, [held, selectedItemId]);

  return (
    <div className="border-b border-amber-400/30 bg-amber-950/25 px-3 py-2 sm:px-4">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <p className="font-heading text-sm text-amber-100">Admin</p>
        <p
          className="text-[11px] tabular-nums tracking-wide text-amber-100/80 uppercase"
          title="Max that can be issued / already issued"
        >
          Authorized/Issued {formatNumber(authorized)}/{formatNumber(issued)}
        </p>
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="admin-gold">Coins</Label>
              <Input
                id="admin-gold"
                inputMode="numeric"
                value={goldInput}
                onChange={(event) => setGoldInput(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="h-11 md:h-8"
              disabled={pending}
              onClick={() => void onSetGold(Number(goldInput))}
            >
              Set
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="admin-qty">
                {selected ? `${selected.emoji} ${selected.name}` : "Item"} qty
              </Label>
              <Input
                id="admin-qty"
                inputMode="numeric"
                value={qtyInput}
                onChange={(event) => setQtyInput(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="h-11 md:h-8"
              disabled={pending || !selected}
              onClick={() => void onSetItem(selectedItemId, Number(qtyInput))}
            >
              Set
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant={computers ? "secondary" : "outline"}
          className="h-11 shrink-0 border-amber-400/50 text-amber-100 md:h-8"
          disabled={pending}
          onClick={() => {
            if (computers) {
              const ok = window.confirm(
                "Sit the computers out? They leave the book, and their packs go back to the treasury."
              );
              if (ok) void onSetComputers(false);
            } else {
              void onSetComputers(true);
            }
          }}
        >
          {computers ? "Computers on" : "Computers off"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-11 shrink-0 border-amber-400/50 text-amber-100 md:h-8"
          disabled={pending}
          onClick={() => {
            const ok = window.confirm(
              "Start a new game? This clears packs, the book, and the tape. Computers sit out. Travelers start with 2,000 coins and the same opening pack: Issued split evenly, leftover listed on the treasury at opening MV."
            );
            if (ok) void onNewGame();
          }}
        >
          New game
        </Button>
      </div>
    </div>
  );
}
