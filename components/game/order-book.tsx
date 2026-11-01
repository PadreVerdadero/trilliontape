"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/game/format";
import type { OrderRow } from "@/lib/game/types";

type Level = {
  key: string;
  price: number;
  qty: number;
  orders: number;
  kind: "others" | "mine" | "stop";
  side: "buy" | "sell";
  gov: boolean;
  name: string;
  ids: number[];
  takeRow: OrderRow | null;
};

function buildLevels(rows: OrderRow[], stops: OrderRow[], selfId: number, side: "buy" | "sell") {
  const map = new Map<string, Level>();
  const bump = (row: OrderRow, kind: Level["kind"]) => {
    const gov = Boolean(row.isGov);
    const key = `${kind}-${row.price}-${kind === "others" && gov ? "g" : "p"}`;
    const level =
      map.get(key) ??
      ({
        key,
        price: row.price,
        qty: 0,
        orders: 0,
        kind,
        side,
        gov: kind === "others" && gov,
        name: row.username,
        ids: [],
        takeRow: null,
      } satisfies Level);
    level.qty += row.remaining;
    level.orders += 1;
    level.ids.push(row.id);
    if (level.name !== row.username) level.name = "";
    if (kind === "others" && !level.takeRow) level.takeRow = row;
    map.set(key, level);
  };
  for (const row of rows) {
    if (row.remaining <= 0) continue;
    bump(row, row.playerId === selfId && !row.isGov ? "mine" : "others");
  }
  for (const row of stops) if (row.remaining > 0) bump(row, "stop");
  const order = { others: 0, mine: 1, stop: 2 } as const;
  return [...map.values()].sort((a, b) =>
    side === "sell"
      ? a.price - b.price || order[a.kind] - order[b.kind]
      : b.price - a.price || order[a.kind] - order[b.kind]
  );
}

function LevelRow({
  level,
  max,
  pending,
  onTake,
  onCancel,
}: {
  level: Level;
  max: number;
  pending: boolean;
  onTake: (row: OrderRow) => void;
  onCancel: (id: number) => void;
}) {
  const ask = level.side === "sell";
  const stop = level.kind === "stop";
  const mine = level.kind === "mine";
  const label = stop
    ? `you · ${ask ? "Sell STP" : "Buy STP"}`
    : mine
      ? "you"
      : level.gov
        ? "Gov"
        : level.name || `${level.orders} orders`;
  const clickable = stop || mine || level.takeRow != null;
  return (
    <button
      type="button"
      disabled={pending || !clickable}
      title={
        stop || mine
          ? `Cancel 1 of your ${stop ? (ask ? "Sell STP" : "Buy STP") : ask ? "ask" : "bid"} at ${formatNumber(level.price)}`
          : `${ask ? "Buy" : "Sell"} 1 at ${formatNumber(level.price)} (market order)`
      }
      onClick={() => {
        if (stop || mine) onCancel(level.ids[level.ids.length - 1]);
        else if (level.takeRow) onTake(level.takeRow);
      }}
      className={cn(
        "relative grid h-6 w-full shrink-0 grid-cols-[3.5rem_2.75rem_minmax(0,1fr)] items-center gap-1 overflow-hidden rounded px-1.5 text-left text-xs tabular-nums disabled:opacity-100",
        stop && "bg-purple-400/20 ring-1 ring-purple-400/50 hover:bg-purple-400/35",
        mine && "bg-amber-400/20 ring-1 ring-amber-400/50 hover:bg-amber-400/35",
        !stop && !mine && level.gov && ask && "bg-white text-zinc-950 hover:bg-zinc-200",
        !stop && !mine && level.gov && !ask && "bg-black text-white ring-1 ring-white/40 hover:bg-zinc-900",
        !stop && !mine && !level.gov && "hover:bg-background/70"
      )}
    >
      {!stop && !mine && !level.gov ? (
        <span
          aria-hidden
          className={cn("absolute inset-y-0 right-0", ask ? "bg-rose-400/15" : "bg-emerald-400/15")}
          style={{ width: `${Math.max(4, (level.qty / Math.max(1, max)) * 100)}%` }}
        />
      ) : null}
      <span
        className={cn(
          "relative font-medium",
          !level.gov && !stop && !mine && (ask ? "text-rose-200" : "text-emerald-200"),
          stop && "text-purple-200",
          mine && "text-amber-200"
        )}
      >
        {formatNumber(level.price)}
      </span>
      <span className="relative text-right">×{formatNumber(level.qty)}</span>
      <span className={cn("relative min-w-0 truncate text-[11px]", level.gov && ask ? "text-zinc-600" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}

export function OrderBookPanel({
  asks,
  bids,
  myStops,
  selfId,
  pending,
  mv,
  onTake,
  onCancel,
}: {
  asks: OrderRow[];
  bids: OrderRow[];
  myStops: OrderRow[];
  selfId: number;
  pending: boolean;
  mv: number;
  onTake: (row: OrderRow) => void;
  onCancel: (id: number) => void;
}) {
  const askLevels = buildLevels(
    asks,
    myStops.filter((row) => row.side === "sell"),
    selfId,
    "sell"
  );
  const bidLevels = buildLevels(
    bids,
    myStops.filter((row) => row.side === "buy"),
    selfId,
    "buy"
  );
  const max = Math.max(1, ...askLevels.map((l) => l.qty), ...bidLevels.map((l) => l.qty));
  const bestAsk = askLevels.find((l) => l.kind !== "stop")?.price ?? null;
  const bestBid = bidLevels.find((l) => l.kind !== "stop")?.price ?? null;
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-2 py-1.5">
        <p className="font-heading text-base">Order book</p>
        <p className="text-[10px] leading-4 text-muted-foreground">
          Tap a quote for a market order of 1. Tap yours (amber) or a stop (purple) to cancel 1.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-px overflow-y-auto px-1 py-1" aria-label="Asks">
        {askLevels.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No asks.</p>
        ) : (
          askLevels.map((level) => (
            <LevelRow key={level.key} level={level} max={max} pending={pending} onTake={onTake} onCancel={onCancel} />
          ))
        )}
      </div>
      <div className="shrink-0 border-y border-border/60 bg-muted/40 px-2 py-1 text-center text-xs tabular-nums">
        <span className="font-medium">
          Spread {spread != null ? formatNumber(spread) : "—"}
        </span>
        <span className="text-muted-foreground">
          {bestBid != null && bestAsk != null
            ? ` · bid ${formatNumber(bestBid)} · ask ${formatNumber(bestAsk)}`
            : ""}
          {` · MV ${formatNumber(mv)}`}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 py-1" aria-label="Bids">
        {bidLevels.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No bids.</p>
        ) : (
          bidLevels.map((level) => (
            <LevelRow key={level.key} level={level} max={max} pending={pending} onTake={onTake} onCancel={onCancel} />
          ))
        )}
      </div>
    </div>
  );
}
