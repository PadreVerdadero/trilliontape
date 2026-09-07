"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ItemChip } from "@/components/game/item-chip";
import { itemById, locationById } from "@/lib/game/catalog";
import { formatCoins, formatEta, formatNumber } from "@/lib/game/format";
import { cn } from "@/lib/utils";
import type { ContractView, GameState, StallView } from "@/lib/game/types";

export function StallsPanel({
  state,
  pending,
  onForage,
  onSell,
  onBuy,
  onRumor,
  onCrate,
  onContract,
  onDonate,
}: {
  state: GameState;
  pending: boolean;
  onForage: () => void;
  onSell: (stallId: string, itemId: string, quantity: number) => void;
  onBuy: (stallId: string, itemId: string, quantity: number) => void;
  onRumor: (stallId: string) => void;
  onCrate: (stallId: string) => void;
  onContract: (contractId: string) => void;
  onDonate: () => void;
}) {
  const festival = state.festival;
  const player = state.player;
  const forage = festival.forage;
  const bias = forage.biasLocationId ? locationById[forage.biasLocationId] : null;
  const canForage = player.busy.type === "idle" && !pending && player.energy >= forage.nextSearchCost;
  const openCount = festival.stalls.filter((stall) => stall.open).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-2xl sm:text-3xl">Stall board</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Shop owners keep real hours on your clock. Hold stock for the open window, or flip it
            on the player board while they sleep. First to {festival.vpToWin} victory points lights
            the festival.
          </p>
        </div>
        <p className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
          {festival.clockLabel}
        </p>
      </div>

      {festival.sundayMarket ? (
        <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm">
          Sunday market is on. Every stall is open until 14:00.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Search the grounds</CardTitle>
          <CardDescription>
            One energy pull, mixed loot from the festival edges. Crowds on the grounds raise the
            next cost until it sits quiet for 45s.
            {bias
              ? ` Your last check-in (${bias.emoji} ${bias.name}) leans the next find that way.`
              : " Scan a QR at a real stop if you want the next pull to lean woods, ridge, shore, or fields."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {player.energy < forage.nextSearchCost
              ? `Tired · need ${forage.nextSearchCost} energy.`
              : forage.strain > 0
                ? `Busy grounds · ${forage.nextSearchCost} energy · quiet in ${formatEta(forage.cooldownMs)}`
                : `Quiet · ${forage.nextSearchCost} energy · ${player.energy}/${player.energyMax} left`}
          </p>
          <Button
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={!canForage}
            onClick={onForage}
          >
            Forage · {forage.nextSearchCost} energy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Festival score</span>
            <span className="text-base font-medium text-primary">
              {formatNumber(player.vp)} / {festival.vpToWin} VP
            </span>
          </CardTitle>
          <CardDescription>
            Contracts, chalkboard hours, looks, and lantern donations all print points. The relic
            is worth 8. Gold converts at the desk, and each lantern costs more than the last.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {festival.titles.map((title) => (
              <span
                key={title.id}
                className={cn(
                  "rounded-full px-3 py-1 text-xs ring-1 ring-foreground/10",
                  title.username === player.username
                    ? "bg-primary/20 text-foreground"
                    : "bg-background/50 text-muted-foreground"
                )}
              >
                {title.label}
                {title.username ? ` · ${title.username}` : " · open"}
              </span>
            ))}
          </div>
          {festival.leaders.length > 0 ? (
            <ol className="space-y-1 text-sm">
              {festival.leaders.map((row, index) => (
                <li key={row.username} className="flex justify-between gap-3">
                  <span>
                    {index + 1}. {row.username}
                    {row.username === player.username ? " (you)" : ""}
                  </span>
                  <span className="text-muted-foreground">{formatNumber(row.vp)} VP</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No points on the board yet.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Next lantern donation: {formatCoins(festival.donationNextCost)} for 1 VP.
            </p>
            <Button
              variant="secondary"
              className="h-11 sm:h-8"
              disabled={pending || player.availableGold < festival.donationNextCost}
              onClick={onDonate}
            >
              Sponsor a lantern
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-xl">Contracts</h2>
          <p className="text-sm text-muted-foreground">
            Turn in at the named stall while that door is open. The relic scores itself when you
            craft it.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {festival.contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              stall={festival.stalls.find((row) => row.id === contract.stallId)}
              pending={pending}
              onTurnIn={() => onContract(contract.id)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-xl">Owners on the clock</h2>
          <p className="text-sm text-muted-foreground">
            {openCount === 0
              ? "Nobody is buying right now. Forage, craft, or flip on the player market."
              : `${openCount} stall${openCount === 1 ? "" : "s"} open. Chalkboard items pay more, and the first chalkboard sale of the day is +1 VP.`}{" "}
            The bank in Plaza still buys anything at 50% of MV, any hour.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {festival.stalls.map((stall) => (
            <StallCard
              key={stall.id}
              stall={stall}
              state={state}
              pending={pending}
              rumorCost={festival.rumorCost}
              crateCost={festival.crateCost}
              onSell={onSell}
              onBuy={onBuy}
              onRumor={() => onRumor(stall.id)}
              onCrate={() => onCrate(stall.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ContractCard({
  contract,
  stall,
  pending,
  onTurnIn,
}: {
  contract: ContractView;
  stall?: StallView;
  pending: boolean;
  onTurnIn: () => void;
}) {
  const relic = contract.itemId === "celestial-relic";
  const food = contract.itemId === "*food";
  return (
    <Card className={contract.done ? "opacity-70" : ""}>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-lg">
          <span>
            {contract.stallEmoji} {contract.title}
          </span>
          <span className="shrink-0 text-sm font-medium text-primary">+{contract.vp} VP</span>
        </CardTitle>
        <CardDescription>{contract.detail}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          {food ? (
            <p>Any food ×{formatNumber(contract.quantity)}</p>
          ) : (
            <ItemChip itemId={contract.itemId} qty={contract.quantity} />
          )}
          <p className="text-xs text-muted-foreground">
            {contract.gold > 0 ? `${formatCoins(contract.gold)} · ` : ""}
            {contract.done
              ? "Stamped"
              : relic
                ? "Craft at the workshop"
                : stall?.open
                  ? `${contract.stallName} is open · ${formatEta(contract.remainingMs)} left`
                  : `${contract.stallName} is closed · ${formatEta(contract.remainingMs)} left`}
          </p>
        </div>
        {relic || contract.done ? null : (
          <Button
            className="h-11 sm:h-8"
            disabled={pending || !stall?.open}
            onClick={onTurnIn}
          >
            Turn in
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StallCard({
  stall,
  state,
  pending,
  rumorCost,
  crateCost,
  onSell,
  onBuy,
  onRumor,
  onCrate,
}: {
  stall: StallView;
  state: GameState;
  pending: boolean;
  rumorCost: number;
  crateCost: number;
  onSell: (stallId: string, itemId: string, quantity: number) => void;
  onBuy: (stallId: string, itemId: string, quantity: number) => void;
  onRumor: () => void;
  onCrate: () => void;
}) {
  const chalk = itemById[stall.chalkboardItemId];
  const tomorrow = stall.tomorrowItemId ? itemById[stall.tomorrowItemId] : null;
  const freeOf = (itemId: string) => {
    const have = state.player.inventory.find((row) => row.itemId === itemId)?.quantity ?? 0;
    return have - (state.player.reservedItems[itemId] ?? 0);
  };

  return (
    <Card className={stall.open ? "ring-1 ring-primary/40" : ""}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {stall.emoji} {stall.name}{" "}
            <span className="text-sm font-normal text-muted-foreground">{stall.role}</span>
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              stall.open ? "bg-emerald-400/20 text-emerald-100" : "bg-muted text-muted-foreground"
            )}
          >
            {stall.open
              ? `Open · closes in ${formatEta(stall.nextChangeMs)}`
              : `Closed · opens in ${formatEta(stall.nextChangeMs)}`}
          </span>
        </CardTitle>
        <CardDescription>
          {stall.blurb} {stall.hoursLabel}
          {stall.sundayMarket ? " Sunday market is covering this window." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Chalkboard:{" "}
          <span className="text-foreground">
            {chalk?.emoji} {chalk?.name}
          </span>{" "}
          <span className="text-muted-foreground">pays the fat cut.</span>
          {tomorrow ? (
            <span className="mt-1 block text-xs text-primary">
              Tomorrow’s rumor: {tomorrow.emoji} {tomorrow.name}
            </span>
          ) : null}
        </p>

        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Selling to {stall.name}
          </p>
          {stall.buys.map((quote) => (
            <TradeRow
              key={`buy-${quote.itemId}`}
              itemId={quote.itemId}
              detail={`${Math.round(quote.rate * 100)}% MV · ${formatCoins(quote.payEach)} each${
                quote.special ? " · special" : ""
              }`}
              max={Math.max(0, freeOf(quote.itemId))}
              disabled={pending || !stall.open || freeOf(quote.itemId) < 1}
              actionLabel="Sell"
              onSubmit={(qty) => onSell(stall.id, quote.itemId, qty)}
            />
          ))}
        </div>

        {stall.sells.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Buying from {stall.name}
            </p>
            {stall.sells.map((offer) => (
              <TradeRow
                key={`sell-${offer.itemId}`}
                itemId={offer.itemId}
                detail={`${formatCoins(offer.price)} each`}
                max={20}
                disabled={pending || !stall.open || state.player.availableGold < offer.price}
                actionLabel="Buy"
                onSubmit={(qty) => onBuy(stall.id, offer.itemId, qty)}
              />
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-11 flex-1 sm:h-8"
            disabled={pending || Boolean(stall.tomorrowItemId) || state.player.availableGold < rumorCost}
            onClick={onRumor}
          >
            {stall.tomorrowItemId ? "Rumor paid" : `Rumor · ${formatCoins(rumorCost)}`}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 sm:h-8"
            disabled={pending || stall.crateYours || Boolean(stall.crateReservedBy) || state.player.availableGold < crateCost}
            onClick={onCrate}
          >
            {stall.crateYours
              ? stall.crateUsed
                ? "Crate used"
                : "Your crate is ready"
              : stall.crateReservedBy
                ? `Crate: ${stall.crateReservedBy}`
                : `Rent crate · ${formatCoins(crateCost)}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TradeRow({
  itemId,
  detail,
  max,
  disabled,
  actionLabel,
  onSubmit,
}: {
  itemId: string;
  detail: string;
  max: number;
  disabled: boolean;
  actionLabel: string;
  onSubmit: (quantity: number) => void;
}) {
  const [qty, setQty] = useState("1");
  const item = itemById[itemId];
  const chosen = Number(qty);
  const valid = Number.isInteger(chosen) && chosen >= 1 && chosen <= Math.max(1, max);
  const preview = useMemo(() => item, [item]);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {preview?.emoji} {preview?.name}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="h-11 w-16 sm:h-8"
          inputMode="numeric"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
        />
        <Button
          size="sm"
          className="h-11 sm:h-8"
          disabled={disabled || !valid}
          onClick={() => onSubmit(chosen)}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
