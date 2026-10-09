"use client";

import { useMemo, useState } from "react";
import { formatCompact, formatNumber } from "@/lib/game/format";
import type { OrderRow } from "@/lib/game/types";

type Level = { price: number; total: number };

function cumulative(rows: OrderRow[], side: "bid" | "ask"): Level[] {
  const byPrice = new Map<number, number>();
  for (const row of rows) {
    if (row.remaining > 0) byPrice.set(row.price, (byPrice.get(row.price) ?? 0) + row.remaining);
  }
  const sorted = [...byPrice.entries()].sort((a, b) => (side === "bid" ? b[0] - a[0] : a[0] - b[0]));
  let total = 0;
  return sorted.map(([price, qty]) => {
    total += qty;
    return { price, total };
  });
}

function stepPath(levels: Level[], x: (p: number) => number, y: (q: number) => number, baseY: number) {
  if (levels.length === 0) return "";
  let d = `M ${x(levels[0].price)} ${baseY} L ${x(levels[0].price)} ${y(levels[0].total)}`;
  for (let i = 1; i < levels.length; i += 1) {
    d += ` L ${x(levels[i].price)} ${y(levels[i - 1].total)} L ${x(levels[i].price)} ${y(levels[i].total)}`;
  }
  const last = levels[levels.length - 1];
  return `${d} L ${x(last.price)} ${baseY} Z`;
}

export function DepthChart({
  bids,
  asks,
  mv,
  compact = false,
}: {
  bids: OrderRow[];
  asks: OrderRow[];
  mv: number;
  compact?: boolean;
}) {
  const data = useMemo(() => {
    const bidLevels = cumulative(bids, "bid");
    const askLevels = cumulative(asks, "ask");
    const prices = [...bidLevels, ...askLevels].map((level) => level.price);
    const maxQty = Math.max(1, bidLevels.at(-1)?.total ?? 0, askLevels.at(-1)?.total ?? 0);
    return { bidLevels, askLevels, prices, maxQty };
  }, [bids, asks]);

  const width = 600;
  const height = compact ? 140 : 170;
  const pad = { l: 8, r: 8, t: 8, b: 18 };
  const baseY = height - pad.b;

  if (data.prices.length === 0) {
    return (
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <p className="font-heading text-sm">Order depth</p>
        <p className="text-xs text-muted-foreground">No resting bids or asks yet.</p>
      </div>
    );
  }

  const lo = Math.min(...data.prices, mv);
  const hi = Math.max(...data.prices, mv);
  const span = Math.max(1, hi - lo);
  const x = (price: number) => pad.l + ((price - lo) / span) * (width - pad.l - pad.r);
  const y = (qty: number) => baseY - (qty / data.maxQty) * (baseY - pad.t);

  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <div className="mb-1 flex items-center justify-between text-xs">
        <p className="font-heading text-sm">Order depth</p>
        <p className="text-muted-foreground">
          <span className="text-emerald-300">Bids {formatNumber(data.bidLevels.at(-1)?.total ?? 0)}</span>
          {" · "}
          <span className="text-rose-300">Asks {formatNumber(data.askLevels.at(-1)?.total ?? 0)}</span>
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={compact ? "h-32 w-full" : "h-40 w-full"}
        role="img"
        aria-label="Cumulative order book depth"
        preserveAspectRatio="none"
      >
        <path
          d={stepPath(data.bidLevels, x, y, baseY)}
          className="fill-emerald-400/25 stroke-emerald-400"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={stepPath(data.askLevels, x, y, baseY)}
          className="fill-rose-400/25 stroke-rose-400"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(mv)}
          x2={x(mv)}
          y1={pad.t}
          y2={baseY}
          className="stroke-sky-300"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <line x1={pad.l} x2={width - pad.r} y1={baseY} y2={baseY} className="stroke-border" />
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{formatCompact(lo)}</span>
        <span className="text-sky-300">MV {formatCompact(mv)}</span>
        <span>{formatCompact(hi)}</span>
      </div>
    </div>
  );
}
