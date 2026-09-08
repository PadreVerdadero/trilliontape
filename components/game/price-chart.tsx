"use client";

import { useMemo, useState } from "react";
import { formatCoins } from "@/lib/game/format";
import { MV_PRINTS } from "@/lib/game/market";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/lib/game/types";

export function PriceChart({
  trades,
  basePrice,
  mv,
  bestBid,
  bestAsk,
}: {
  trades: TradeRow[];
  basePrice: number;
  mv?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
}) {
  const prints = useMemo(
    () =>
      [...trades]
        .slice(0, MV_PRINTS)
        .sort((a, b) => a.id - b.id || a.createdAt - b.createdAt),
    [trades]
  );
  const [hover, setHover] = useState<number | null>(null);
  const traded = prints.length > 0;
  const prices = traded ? prints.map((print) => print.price) : [basePrice];
  const extras = [bestBid, bestAsk, mv].filter((value): value is number => value != null);
  const min = Math.min(...prices, ...extras);
  const max = Math.max(...prices, ...extras);
  const span = Math.max(1, max - min);
  const pad = { top: 14, right: 78, bottom: 22, left: 36 };
  const width = 640;
  const height = 180;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const yFor = (price: number) => pad.top + (1 - (price - min) / span) * innerH;
  const count = Math.max(1, prints.length);
  const xFor = (index: number) =>
    pad.left + (count === 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const coords = (traded ? prints : [{ price: basePrice }]).map((print, index) => ({
    x: xFor(index),
    y: yFor(print.price),
    print: traded ? prints[index] : null,
  }));
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`;
  const lastPrice = prints[prints.length - 1]?.price ?? basePrice;
  const firstPrice = prints[0]?.price ?? basePrice;
  const delta = traded ? lastPrice - firstPrice : 0;
  const up = delta > 0;
  const down = delta < 0;
  const endX = pad.left + innerW;
  const startX = pad.left + innerW * 0.62;
  let bidLabelY = bestBid != null ? yFor(bestBid) : 0;
  let askLabelY = bestAsk != null ? yFor(bestAsk) : 0;
  let mvLabelY = mv != null ? yFor(mv) : 0;
  const nudge = (a: number, b: number) => {
    if (Math.abs(a - b) >= 14) return [a, b] as const;
    return a >= b ? ([a + 8, b - 8] as const) : ([a - 8, b + 8] as const);
  };
  if (bestBid != null && bestAsk != null) {
    [bidLabelY, askLabelY] = nudge(bidLabelY, askLabelY);
  }
  if (mv != null && bestBid != null) {
    [mvLabelY, bidLabelY] = nudge(mvLabelY, bidLabelY);
  }
  if (mv != null && bestAsk != null) {
    [mvLabelY, askLabelY] = nudge(mvLabelY, askLabelY);
  }
  const active = hover != null ? coords[hover] : null;

  return (
    <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-lg">Price</p>
          <p className="text-xs text-muted-foreground">
            {traded
              ? `Each dot is one of the last ${MV_PRINTS} prints, oldest to newest. Hover a dot for price and who traded.`
              : "No trades yet. The line sits at the starting price."}{" "}
            Dashed marks on the right are MV, best bid, and best ask.
          </p>
        </div>
        <p
          className={cn(
            "text-sm tabular-nums",
            up && "text-emerald-200",
            down && "text-rose-200",
            traded && !up && !down && "text-muted-foreground"
          )}
          title={
            traded
              ? `Last print vs the leftmost dot — the oldest of these ${prints.length} prints.`
              : "Starting price — no prints yet."
          }
        >
          {formatCoins(lastPrice)}
          {traded ? ` ${up ? "▲" : down ? "▼" : "–"} vs ${formatCoins(firstPrice)}` : ""}
        </p>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          role="img"
          aria-label="Last 25 print prices"
        >
          <path d={area} className={up ? "fill-emerald-400/15" : down ? "fill-rose-400/15" : "fill-zinc-400/15"} />
          <path
            d={line}
            fill="none"
            strokeWidth="2.5"
            className={up ? "stroke-emerald-300" : down ? "stroke-rose-300" : "stroke-zinc-400"}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {traded
            ? coords.map((point, index) => (
                <circle
                  key={point.print?.id ?? index}
                  cx={point.x}
                  cy={point.y}
                  r={hover === index || index === 0 || index === coords.length - 1 ? 4 : 2.75}
                  className={
                    index === 0
                      ? "fill-zinc-200"
                      : index === coords.length - 1
                        ? up
                          ? "fill-emerald-200"
                          : down
                            ? "fill-rose-200"
                            : "fill-zinc-200"
                        : up
                          ? "fill-emerald-200/80"
                          : down
                            ? "fill-rose-200/80"
                            : "fill-zinc-300"
                  }
                />
              ))
            : null}
          {traded
            ? coords.map((point, index) => (
                <circle
                  key={`hit-${point.print?.id ?? index}`}
                  cx={point.x}
                  cy={point.y}
                  r={10}
                  className="fill-transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(index)}
                />
              ))
            : null}
          {mv != null ? (
            <>
              <line
                x1={startX}
                x2={endX}
                y1={yFor(mv)}
                y2={yFor(mv)}
                strokeWidth="2"
                strokeDasharray="5 4"
                className="stroke-sky-300"
              />
              <text
                x={width - 4}
                y={mvLabelY + 3}
                textAnchor="end"
                fill="currentColor"
                className="fill-sky-200 text-[11px]"
              >
                MV {formatCoins(mv)}
              </text>
            </>
          ) : null}
          {bestBid != null ? (
            <>
              <line
                x1={startX}
                x2={endX}
                y1={yFor(bestBid)}
                y2={yFor(bestBid)}
                strokeWidth="2"
                strokeDasharray="5 4"
                className="stroke-emerald-300"
              />
              <text
                x={width - 4}
                y={bidLabelY + 3}
                textAnchor="end"
                fill="currentColor"
                className="fill-emerald-200 text-[11px]"
              >
                bid {formatCoins(bestBid)}
              </text>
            </>
          ) : null}
          {bestAsk != null ? (
            <>
              <line
                x1={startX}
                x2={endX}
                y1={yFor(bestAsk)}
                y2={yFor(bestAsk)}
                strokeWidth="2"
                strokeDasharray="5 4"
                className="stroke-rose-300"
              />
              <text
                x={width - 4}
                y={askLabelY + 3}
                textAnchor="end"
                fill="currentColor"
                className="fill-rose-200 text-[11px]"
              >
                ask {formatCoins(bestAsk)}
              </text>
            </>
          ) : null}
          <text x="4" y={pad.top + 4} fill="currentColor" className="text-[11px] text-muted-foreground">
            {formatCoins(max)}
          </text>
          <text x="4" y={pad.top + innerH} fill="currentColor" className="text-[11px] text-muted-foreground">
            {formatCoins(min)}
          </text>
        </svg>
        {active?.print ? (
          <div
            className={cn(
              "pointer-events-none absolute z-10 -translate-y-full rounded-md bg-zinc-950/95 px-2 py-1 text-xs shadow-lg ring-1 ring-white/15",
              active.x > width * 0.62 ? "-translate-x-full" : "translate-x-1"
            )}
            style={{
              left: `${(active.x / width) * 100}%`,
              top: `${(active.y / height) * 100}%`,
            }}
          >
            <p className="tabular-nums font-medium">{formatCoins(active.print.price)}</p>
            <p className="truncate">
              <span className="text-emerald-200">{active.print.buyUsername}</span>
              <span className="text-muted-foreground"> – </span>
              <span className="text-rose-200">{active.print.sellUsername}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
