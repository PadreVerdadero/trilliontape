"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { itemById, itemsByCommonness } from "@/lib/game/catalog";
import { bundleMarketValue } from "@/lib/game/deal-value";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { rarityClass, type RarityMap } from "@/lib/game/rarity";
import { cn } from "@/lib/utils";
import type { InventoryRow, MarketPrice, SwapOffer, TravelerRow } from "@/lib/game/types";

type LegDraft = { itemId: string; quantity: number };

function emptyLeg(): LegDraft {
  return { itemId: "", quantity: 1 };
}

function cleanLegs(rows: LegDraft[]) {
  return rows
    .filter((leg) => leg.itemId && leg.quantity > 0)
    .map((leg) => ({ itemId: leg.itemId, quantity: Math.floor(leg.quantity) }));
}

function pickLeg(rows: LegDraft[], itemId: string) {
  const existing = rows.findIndex((row) => row.itemId === itemId);
  if (existing >= 0) {
    return rows.map((row, index) =>
      index === existing ? { ...row, quantity: row.quantity + 1 } : row
    );
  }
  const empty = rows.findIndex((row) => !row.itemId);
  if (empty >= 0) {
    return rows.map((row, index) => (index === empty ? { ...row, itemId, quantity: 1 } : row));
  }
  return [...rows, { itemId, quantity: 1 }];
}

export function SwapPanel({
  inventory,
  gold,
  swaps,
  travelers,
  pending,
  rarityMap,
  prices,
  onPropose,
  onAccept,
  onCancel,
  onDecline,
}: {
  inventory: InventoryRow[];
  gold: number;
  swaps: SwapOffer[];
  travelers: TravelerRow[];
  pending: boolean;
  rarityMap?: RarityMap;
  prices: MarketPrice[];
  onPropose: (payload: {
    toUsername: string | null;
    giveGold: number;
    wantGold: number;
    give: { itemId: string; quantity: number }[];
    want: { itemId: string; quantity: number }[];
  }) => Promise<unknown>;
  onAccept: (id: number) => Promise<unknown>;
  onCancel: (id: number) => Promise<unknown>;
  onDecline: (id: number) => Promise<unknown>;
}) {
  const [toUsername, setToUsername] = useState("");
  const [giveGold, setGiveGold] = useState("");
  const [wantGold, setWantGold] = useState("");
  const [giveLegs, setGiveLegs] = useState<LegDraft[]>([emptyLeg()]);
  const [wantLegs, setWantLegs] = useState<LegDraft[]>([emptyLeg()]);

  const owned = useMemo(
    () =>
      inventory
        .filter((row) => row.quantity > 0)
        .map((row) => ({
          itemId: row.itemId,
          name: itemById[row.itemId]?.name ?? row.itemId,
          quantity: row.quantity,
        })),
    [inventory]
  );

  function updateLeg(side: "give" | "want", index: number, patch: Partial<LegDraft>) {
    const setter = side === "give" ? setGiveLegs : setWantLegs;
    setter((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function propose() {
    const result = await onPropose({
      toUsername: toUsername.trim() || null,
      giveGold: Math.max(0, Math.floor(Number(giveGold) || 0)),
      wantGold: Math.max(0, Math.floor(Number(wantGold) || 0)),
      give: cleanLegs(giveLegs),
      want: cleanLegs(wantLegs),
    });
    if (!result) return;
    setGiveGold("");
    setWantGold("");
    setGiveLegs([emptyLeg()]);
    setWantLegs([emptyLeg()]);
  }

  const inbox = swaps.filter((offer) => offer.role === "inbox");
  const mine = swaps.filter((offer) => offer.role === "mine");
  const open = swaps.filter((offer) => offer.role === "open");
  const draftGive = bundleMarketValue(
    prices,
    Math.max(0, Math.floor(Number(giveGold) || 0)),
    cleanLegs(giveLegs)
  );
  const draftWant = bundleMarketValue(
    prices,
    Math.max(0, Math.floor(Number(wantGold) || 0)),
    cleanLegs(wantLegs)
  );

  return (
    <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <p className="font-heading text-lg">Direct deals</p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Bundle several goods — even different ones — plus gold, and send the offer to one traveler
          or leave it open for anyone. These swaps do not print on the board, so they will not move
          market value.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="swap-to">Send to</Label>
          <Input
            id="swap-to"
            list="traveler-names"
            value={toUsername}
            onChange={(event) => setToUsername(event.target.value)}
            placeholder="Anyone (open offer)"
          />
          <datalist id="traveler-names">
            {travelers.map((row) => (
              <option key={row.username} value={row.username} />
            ))}
          </datalist>
        </div>
        <p className="self-end text-xs text-muted-foreground">
          Leave blank for a public offer. Named deals only the recipient can accept.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LegEditor
          title="You give"
          gold={giveGold}
          onGold={setGiveGold}
          goldHint={`You have ${formatCoins(gold)} free.`}
          legs={giveLegs}
          itemChoices={owned}
          rarityMap={rarityMap}
          total={draftGive}
          onPick={(itemId) =>
            setGiveLegs((rows) => pickLeg(rows, itemId))
          }
          onChange={(index, patch) => updateLeg("give", index, patch)}
          onRemove={(index) =>
            setGiveLegs((rows) => (rows.length <= 1 ? [emptyLeg()] : rows.filter((_, i) => i !== index)))
          }
        />
        <LegEditor
          title="You want"
          gold={wantGold}
          onGold={setWantGold}
          goldHint="Gold they must send you."
          legs={wantLegs}
          itemChoices={itemsByCommonness.map((item) => ({ itemId: item.id, name: item.name }))}
          rarityMap={rarityMap}
          total={draftWant}
          onPick={(itemId) => setWantLegs((rows) => pickLeg(rows, itemId))}
          onChange={(index, patch) => updateLeg("want", index, patch)}
          onRemove={(index) =>
            setWantLegs((rows) => (rows.length <= 1 ? [emptyLeg()] : rows.filter((_, i) => i !== index)))
          }
        />
      </div>

      <DealScore pay={draftGive} get={draftWant} />

      <Button className="h-11 w-full sm:w-auto" disabled={pending} onClick={() => void propose()}>
        Post deal
      </Button>

      <OfferList
        title="Inbox"
        empty="No named deals waiting on you."
        offers={inbox}
        pending={pending}
        prices={prices}
        onAccept={onAccept}
        onDecline={onDecline}
      />
      <OfferList
        title="Your posted deals"
        empty="You have no open offers."
        offers={mine}
        pending={pending}
        prices={prices}
        onCancel={onCancel}
      />
      <OfferList
        title="Open to anyone"
        empty="No public bundles on the board."
        offers={open}
        pending={pending}
        prices={prices}
        onAccept={onAccept}
      />
    </div>
  );
}

function DealScore({ pay, get }: { pay: number; get: number }) {
  const delta = get - pay;
  if (pay <= 0 && get <= 0) return null;
  if (delta === 0) {
    return (
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
        Even on MV · {formatCoins(get)} each way.
      </p>
    );
  }
  const gain = delta > 0;
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        gain ? "bg-emerald-950/40 text-emerald-100" : "bg-rose-950/40 text-rose-100"
      )}
    >
      {gain ? "You would gain " : "You would lose "}
      {formatCoins(Math.abs(delta))} on MV
      <span className="text-muted-foreground">
        {" "}
        · give {formatCoins(pay)} · get {formatCoins(get)}
      </span>
    </p>
  );
}

function LegEditor({
  title,
  gold,
  onGold,
  goldHint,
  legs,
  itemChoices,
  rarityMap,
  total,
  onPick,
  onChange,
  onRemove,
}: {
  title: string;
  gold: string;
  onGold: (value: string) => void;
  goldHint: string;
  legs: LegDraft[];
  itemChoices: { itemId: string; name: string; quantity?: number }[];
  rarityMap?: RarityMap;
  total: number;
  onPick: (itemId: string) => void;
  onChange: (index: number, patch: Partial<LegDraft>) => void;
  onRemove: (index: number) => void;
}) {
  const selected = new Set(legs.map((leg) => leg.itemId).filter(Boolean));
  return (
    <div className="space-y-2 rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1">
        <Label className="text-xs">Gold</Label>
        <Input inputMode="numeric" min={0} value={gold} onChange={(event) => onGold(event.target.value)} />
        <p className="text-[11px] text-muted-foreground">{goldHint}</p>
      </div>
      {itemChoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing free in your pack.</p>
      ) : (
        <div className="-mx-1 flex flex-wrap gap-1 px-1">
          {itemChoices.map((item) => {
            const catalog = itemById[item.itemId];
            const active = selected.has(item.itemId);
            return (
              <button
                key={item.itemId}
                type="button"
                title={`${item.name}${item.quantity != null ? ` ×${item.quantity}` : ""}`}
                onClick={() => onPick(item.itemId)}
                className={cn(
                  "grid size-11 place-items-center rounded-xl text-lg ring-1 hover:bg-card md:size-10",
                  active ? "bg-primary/25 ring-primary" : "bg-background/70",
                  rarityClass(item.itemId, rarityMap)
                )}
              >
                {catalog?.emoji ?? "?"}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Tap an item to add it. Tap again to add another.</p>
      <div className="space-y-2">
        {legs
          .map((leg, index) => ({ leg, index }))
          .filter(({ leg }) => leg.itemId)
          .map(({ leg, index }) => {
            const catalog = itemById[leg.itemId];
            return (
              <div key={`${title}-${leg.itemId}-${index}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {catalog?.emoji} {catalog?.name ?? leg.itemId}
                </span>
                <Input
                  className="w-20"
                  inputMode="numeric"
                  min={1}
                  value={leg.quantity}
                  onChange={(event) => onChange(index, { quantity: Number(event.target.value) || 0 })}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="h-11 w-11 md:h-8 md:w-8"
                  onClick={() => onRemove(index)}
                >
                  ×
                </Button>
              </div>
            );
          })}
      </div>
      <p className="border-t border-border/50 pt-2 text-sm font-medium tabular-nums">
        Worth {formatCoins(total)} <span className="font-normal text-muted-foreground">on MV</span>
      </p>
    </div>
  );
}

function OfferList({
  title,
  empty,
  offers,
  pending,
  prices,
  onAccept,
  onCancel,
  onDecline,
}: {
  title: string;
  empty: string;
  offers: SwapOffer[];
  pending: boolean;
  prices: MarketPrice[];
  onAccept?: (id: number) => void;
  onCancel?: (id: number) => void;
  onDecline?: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {offers.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      {offers.map((offer) => {
        const giveValue = bundleMarketValue(prices, offer.giveGold, offer.give);
        const wantValue = bundleMarketValue(prices, offer.wantGold, offer.want);
        const youPay = offer.role === "mine" ? giveValue : wantValue;
        const youGet = offer.role === "mine" ? wantValue : giveValue;
        return (
        <div key={offer.id} className="rounded-xl bg-background/50 p-3 text-sm ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {offer.fromName}
                {offer.toName ? ` → ${offer.toName}` : " → anyone"}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(offer.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {onAccept ? (
                <Button size="sm" className="h-10 md:h-8" disabled={pending} onClick={() => onAccept(offer.id)}>
                  Accept
                </Button>
              ) : null}
              {onDecline ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 md:h-8"
                  disabled={pending}
                  onClick={() => onDecline(offer.id)}
                >
                  Decline
                </Button>
              ) : null}
              {onCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 md:h-8"
                  disabled={pending}
                  onClick={() => onCancel(offer.id)}
                >
                  Withdraw
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <SwapSide
              label={offer.role === "mine" ? "You give" : "They give"}
              gold={offer.giveGold}
              legs={offer.give}
              total={giveValue}
            />
            <SwapSide
              label={offer.role === "mine" ? "You want" : "They want"}
              gold={offer.wantGold}
              legs={offer.want}
              total={wantValue}
            />
          </div>
          <div className="mt-2">
            <DealScore pay={youPay} get={youGet} />
          </div>
        </div>
        );
      })}
    </div>
  );
}

function SwapSide({
  label,
  gold,
  legs,
  total,
}: {
  label: string;
  gold: number;
  legs: SwapOffer["give"];
  total: number;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      {gold > 0 ? <p>{formatCoins(gold)}</p> : null}
      {legs.map((leg) => (
        <p key={`${leg.itemId}-${leg.quantity}`}>
          {leg.emoji} {leg.name} ×{formatNumber(leg.quantity)}
        </p>
      ))}
      {gold === 0 && legs.length === 0 ? <p className="text-muted-foreground">Nothing</p> : null}
      <p className="mt-2 border-t border-border/40 pt-1.5 text-xs font-medium tabular-nums">
        {formatCoins(total)} <span className="font-normal text-muted-foreground">on MV</span>
      </p>
    </div>
  );
}
