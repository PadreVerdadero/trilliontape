"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpenOrdersPanel } from "@/components/game/open-orders-panel";
import { ItemIcon } from "@/components/game/item-icon";
import { playItemMap, playItems } from "@/lib/game/shares";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { SoundToggle } from "@/components/game/sound-toggle";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { useGame } from "@/hooks/use-game";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { useSelectedItem } from "@/hooks/use-selected-item";
import { cn } from "@/lib/utils";
import { GAME_NAME } from "@/lib/game/brand";
import type { GameState } from "@/lib/game/types";

export function GovernmentScreen({
  initialState,
  initialItemId,
}: {
  initialState: GameState;
  initialItemId?: string;
}) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const catalog = playItems(state?.items);
  const catalogById = playItemMap(catalog);
  const [itemId, setItemId] = useSelectedItem(
    initialItemId,
    catalog.map((item) => item.id)
  );
  const [qtyInput, setQtyInput] = useState("1");
  const [mobile, setMobile] = useMobileLayout();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-emerald-950 px-4 text-emerald-100">
        <p>Opening the treasury…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center bg-emerald-950 px-4 text-emerald-50">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-heading text-2xl">The treasury is closed</p>
          <p className="text-sm text-emerald-100/70">{error ?? "Could not load the desk."}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { player } = state;
  const selected = catalogById[itemId];
  const price = state.prices.find((row) => row.itemId === itemId);
  const mv = Math.max(1, Math.round(price?.vwap ?? selected?.basePrice ?? 1));
  const qty = Number(qtyInput);

  async function quote(side: "buy" | "sell") {
    if (!selected) return;
    await run({ action: "order", itemId: selected.id, side, price: mv, quantity: qty });
  }

  return (
    <div className="min-h-dvh bg-emerald-950 text-emerald-50">
      <header className="sticky top-0 z-20 border-b border-emerald-300/30 bg-emerald-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-200/80 uppercase">
              {GAME_NAME}
            </p>
            <h1 className="font-heading text-2xl text-emerald-100 sm:text-3xl">Treasury</h1>
            <p className="truncate text-sm text-emerald-100/70">
              {player.username} · you hold the government desk
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SoundToggle className="text-emerald-100/80 hover:bg-emerald-900 hover:text-emerald-50" />
            <MobileToggle
              checked={mobile}
              onChange={setMobile}
              className="text-emerald-100/80 hover:bg-emerald-900 hover:text-emerald-50"
            />
            <Link
              href="/play"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 shrink-0 border-emerald-200/40 bg-transparent text-emerald-50 hover:bg-emerald-900"
              )}
            >
              Back to the desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
          Quotes always sit at MV. Asks mint until Outstanding meets Authorized. Bids pay sellers
          with new coin and burn the goods. Your personal purse is not spent.
        </p>
        {player.lastEvent ? (
          <p className="text-sm text-emerald-100/80">{player.lastEvent}</p>
        ) : null}
        {error ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">
            <p>{error}</p>
            <button type="button" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="overflow-x-auto rounded-xl border border-emerald-300/20 bg-emerald-900/30">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-emerald-100/70">
              <tr className="border-b border-emerald-300/20">
                <th className="px-3 py-2 font-medium">Good</th>
                <th className="px-3 py-2 font-medium">MV</th>
                <th className="px-3 py-2 font-medium">Issued</th>
                <th className="px-3 py-2 font-medium">Outstanding</th>
                <th className="px-3 py-2 font-medium">Treasury</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((item) => {
                const row = state.prices.find((priceRow) => priceRow.itemId === item.id);
                const active = item.id === itemId;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "cursor-pointer border-b border-emerald-300/10",
                      active ? "bg-emerald-300/20 text-emerald-50" : "hover:bg-emerald-900/60"
                    )}
                    onClick={() => setItemId(item.id)}
                  >
                    <td className="px-3 py-2">
                      <ItemIcon item={item} /> {item.name}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row?.vwap ?? item.basePrice)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row?.issued ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row?.held ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row?.treasury ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="space-y-3 rounded-xl border border-emerald-300/20 bg-emerald-900/30 p-4">
          <h2 className="font-heading text-lg">
            {selected ? (
              <>
                <ItemIcon item={selected} /> {selected.name}
              </>
            ) : (
              "Pick a good"
            )}{" "}
            at {formatCoins(mv)}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="gov-qty" className="text-emerald-100/80">
                Quantity
              </Label>
              <Input
                id="gov-qty"
                inputMode="numeric"
                value={qtyInput}
                onChange={(event) => setQtyInput(event.target.value)}
                className="border-emerald-300/30 bg-emerald-950/60"
              />
            </div>
            <Button
              disabled={pending || !selected}
              className="bg-emerald-200 text-emerald-950 hover:bg-emerald-100"
              onClick={() => void quote("buy")}
            >
              Bid at MV
            </Button>
            <Button
              disabled={pending || !selected}
              variant="outline"
              className="border-emerald-200/50 bg-transparent text-emerald-50 hover:bg-emerald-900"
              onClick={() => void quote("sell")}
            >
              Ask at MV
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-300/20 bg-emerald-900/20 p-2">
          <OpenOrdersPanel
            orders={state.myOrders.filter((row) => row.isGov)}
            prices={state.prices}
            catalog={catalog}
            selectedItemId={itemId}
            pending={pending}
            onCancel={(orderIds) => void run({ action: "cancel", orderIds })}
          />
        </section>
      </main>
    </div>
  );
}
