"use client";

import { useMemo, useState } from "react";
import { formatCoins, formatCompact, formatMilitaryTime, formatNumber } from "@/lib/game/format";
import { CHART_MINUTES, MINUTE_MS } from "@/lib/game/market";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/lib/game/types";

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  last: TradeRow | null;
  count: number;
  at: number;
};

function minuteKey(at: number) {
  return Math.floor(at / MINUTE_MS) * MINUTE_MS;
}

function toMinuteCandles(prints: TradeRow[], now: number, basePrice: number): Candle[] {
  if (prints.length === 0) return [];
  const sorted = [...prints].sort((a, b) => a.id - b.id || a.createdAt - b.createdAt);
  const windowEnd = minuteKey(now);
  const windowStart = windowEnd - (CHART_MINUTES - 1) * MINUTE_MS;
  let prevClose = basePrice;
  const prior = sorted.filter((print) => print.createdAt < windowStart);
  if (prior.length > 0) prevClose = prior[prior.length - 1].price;
  else prevClose = sorted[0].price;

  const byMinute = new Map<number, TradeRow[]>();
  for (const print of sorted) {
    if (print.createdAt < windowStart) continue;
    const key = minuteKey(print.createdAt);
    const list = byMinute.get(key);
    if (list) list.push(print);
    else byMinute.set(key, [print]);
  }

  const firstTrade = sorted.find((print) => print.createdAt >= windowStart) ?? sorted[0];
  const firstMinute = Math.max(windowStart, minuteKey(firstTrade.createdAt));
  const candles: Candle[] = [];
  for (let at = firstMinute; at <= windowEnd; at += MINUTE_MS) {
    const bucket = byMinute.get(at) ?? [];
    if (bucket.length === 0) {
      candles.push({
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
        last: null,
        count: 0,
        at,
      });
      continue;
    }
    const prices = bucket.map((print) => print.price);
    const open = prevClose;
    const close = prices[prices.length - 1];
    candles.push({
      open,
      close,
      high: Math.max(open, ...prices),
      low: Math.min(open, ...prices),
      volume: bucket.reduce((sum, print) => sum + print.quantity, 0),
      last: bucket[bucket.length - 1],
      count: bucket.length,
      at,
    });
    prevClose = close;
  }
  return candles;
}

function candleTone(candle: Candle) {
  if (candle.close > candle.open) return "up" as const;
  if (candle.close < candle.open) return "down" as const;
  return "flat" as const;
}

export function PriceChart({
  trades,
  basePrice,
  mv,
  bestBid,
  bestAsk,
  compact = false,
  now,
}: {
  trades: TradeRow[];
  basePrice: number;
  mv?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  compact?: boolean;
  now?: number;
}) {
  const clock = now ?? Date.now();
  const prints = useMemo(
    () => [...trades].sort((a, b) => a.id - b.id || a.createdAt - b.createdAt),
    [trades]
  );
  const candles = useMemo(() => toMinuteCandles(prints, clock, basePrice), [prints, clock, basePrice]);
  const [hover, setHover] = useState<number | null>(null);
  const traded = prints.length > 0;
  const shown = traded
    ? candles
    : [
        {
          open: basePrice,
          high: basePrice,
          low: basePrice,
          close: basePrice,
          volume: 0,
          last: null,
          count: 0,
          at: minuteKey(clock),
        },
      ];
  const extras = [bestBid, bestAsk, mv].filter((value): value is number => value != null);
  const min = Math.min(...shown.flatMap((candle) => [candle.low, candle.high]), ...extras);
  const max = Math.max(...shown.flatMap((candle) => [candle.low, candle.high]), ...extras);
  const span = Math.max(1, max - min);
  const pad = { top: 14, right: 78, bottom: 6, left: 36 };
  const width = 640;
  const height = compact ? 168 : 200;
  const volH = 32;
  const gap = 8;
  const innerW = width - pad.left - pad.right;
  const candleH = height - pad.top - pad.bottom - volH - gap;
  const volTop = pad.top + candleH + gap;
  const yFor = (price: number) => pad.top + (1 - (price - min) / span) * candleH;
  const count = Math.max(1, shown.length);
  const slot = innerW / count;
  const bodyW = Math.max(4, Math.min(22, slot * 0.62));
  const xMid = (index: number) => pad.left + (index + 0.5) * slot;
  const lastClose = shown[shown.length - 1]?.close ?? basePrice;
  const firstOpen = shown[0]?.open ?? basePrice;
  const delta = traded ? lastClose - firstOpen : 0;
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
  const maxVol = Math.max(1, ...shown.map((candle) => candle.volume));
  const active = hover != null ? shown[hover] : null;
  const activeX = hover != null ? xMid(hover) : 0;
  const activeY = active ? yFor((active.high + active.low) / 2) : 0;

  return (
    <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-lg">Price</p>
          <p className="text-xs text-muted-foreground">
            {traded
              ? `Each candle is one minute. Open is the previous close. Last ${CHART_MINUTES} minutes, oldest to newest. Hover for open, high, low, close.`
              : "No trades yet. The candle sits at the starting price."}{" "}
            Dashed marks on the right are MV, best bid, and best ask. Bars under the candles are volume.
          </p>
        </div>
        <p
          className={cn(
            "text-sm tabular-nums",
            up && "text-emerald-200",
            down && "text-rose-200",
            traded && !up && !down && "text-sky-200"
          )}
          title={
            traded
              ? `Change from the first candle’s open to the last close in this ${CHART_MINUTES}-minute window.`
              : "Starting price — no prints yet."
          }
        >
          {traded ? `${up ? "▲" : down ? "▼" : "▬"} ${formatCoins(Math.abs(delta))}` : null}
        </p>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={compact ? "h-36 w-full" : "h-48 w-full"}
          role="img"
          aria-label="One-minute candlestick chart"
        >
          {shown.map((candle, index) => {
            const tone = candleTone(candle);
            const mid = xMid(index);
            const yHigh = yFor(candle.high);
            const yLow = yFor(candle.low);
            const yOpen = yFor(candle.open);
            const yClose = yFor(candle.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(tone === "flat" ? 2 : 1.5, Math.abs(yClose - yOpen));
            const vol = (candle.volume / maxVol) * volH;
            const fill =
              tone === "up"
                ? "fill-emerald-400"
                : tone === "down"
                  ? "fill-rose-400"
                  : "fill-sky-400";
            const stroke =
              tone === "up"
                ? "stroke-emerald-300"
                : tone === "down"
                  ? "stroke-rose-300"
                  : "stroke-sky-300";
            return (
              <g key={`${candle.at}-${index}`}>
                <line
                  x1={mid}
                  x2={mid}
                  y1={yHigh}
                  y2={yLow}
                  strokeWidth="1.5"
                  className={stroke}
                />
                <rect
                  x={mid - bodyW / 2}
                  y={bodyTop}
                  width={bodyW}
                  height={bodyH}
                  className={cn(fill, hover === index && "opacity-100", hover != null && hover !== index && "opacity-70")}
                />
                {traded ? (
                  <rect
                    x={mid - bodyW / 2}
                    y={volTop + (volH - vol)}
                    width={bodyW}
                    height={Math.max(candle.volume > 0 ? 2 : 0, vol)}
                    className={cn(fill, "opacity-55")}
                  />
                ) : null}
                <rect
                  x={pad.left + index * slot}
                  y={pad.top}
                  width={slot}
                  height={candleH + gap + volH}
                  className="fill-transparent"
                  style={{ cursor: traded ? "pointer" : "default" }}
                  onMouseEnter={() => setHover(index)}
                />
              </g>
            );
          })}
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
          <text x="4" y={pad.top + candleH} fill="currentColor" className="text-[11px] text-muted-foreground">
            {formatCoins(min)}
          </text>
        </svg>
        {active ? (
          <div
            className={cn(
              "pointer-events-none absolute z-10 -translate-y-full rounded-md bg-zinc-950/95 px-2 py-1 text-xs shadow-lg ring-1 ring-white/15",
              activeX > width * 0.62 ? "-translate-x-full" : "translate-x-1"
            )}
            style={{
              left: `${(activeX / width) * 100}%`,
              top: `${(activeY / height) * 100}%`,
            }}
          >
            <p className="tabular-nums text-muted-foreground">{formatMilitaryTime(active.at)}</p>
            <p className="tabular-nums font-medium">
              O {formatCompact(active.open)} · H {formatCompact(active.high)} · L {formatCompact(active.low)} · C{" "}
              {formatCompact(active.close)}
            </p>
            <p className="tabular-nums text-muted-foreground">
              vol {formatNumber(active.volume)}
              {active.count > 0 ? ` · ${active.count} print${active.count === 1 ? "" : "s"}` : " · no prints"}
            </p>
            {active.last ? (
              <p className="truncate">
                <span className="text-emerald-200">{active.last.buyUsername}</span>
                <span className="text-muted-foreground"> – </span>
                <span className="text-rose-200">{active.last.sellUsername}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
