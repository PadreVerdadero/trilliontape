"use client";

import { useMemo, useRef, useState } from "react";
import { formatCoins, formatCompact, formatMilitaryTime, formatNumber } from "@/lib/game/format";
import { CHART_CANDLES, MINUTE_MS } from "@/lib/game/market";
import { cn } from "@/lib/utils";
import type { OrderRow, TradeRow } from "@/lib/game/types";

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

function minuteKey(at: number, interval = MINUTE_MS) {
  return Math.floor(at / interval) * interval;
}

function toMinuteCandles(prints: TradeRow[], now: number, basePrice: number, candleMs: number): Candle[] {
  if (prints.length === 0) return [];
  const interval = Math.max(MINUTE_MS, candleMs);
  const sorted = [...prints].sort((a, b) => a.id - b.id || a.createdAt - b.createdAt);
  const windowEnd = minuteKey(now, interval);
  const windowStart = windowEnd - (CHART_CANDLES - 1) * interval;
  let prevClose = basePrice;
  const prior = sorted.filter((print) => print.createdAt < windowStart);
  if (prior.length > 0) prevClose = prior[prior.length - 1].price;
  else prevClose = sorted[0].price;

  const byMinute = new Map<number, TradeRow[]>();
  for (const print of sorted) {
    if (print.createdAt < windowStart) continue;
    const key = minuteKey(print.createdAt, interval);
    const list = byMinute.get(key);
    if (list) list.push(print);
    else byMinute.set(key, [print]);
  }

  const firstTrade = sorted.find((print) => print.createdAt >= windowStart) ?? sorted[0];
  const firstMinute = Math.max(windowStart, minuteKey(firstTrade.createdAt, interval));
  const candles: Candle[] = [];
  for (let at = firstMinute; at <= windowEnd; at += interval) {
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

export type ChartOrderGroup = {
  key: string;
  price: number;
  side: "buy" | "sell";
  orderType: "limit" | "stop";
  ids: number[];
  qty: number;
};

export function PriceChart({
  trades,
  basePrice,
  mv,
  bestBid,
  bestAsk,
  bids = [],
  asks = [],
  myOrders = [],
  onCancel,
  quantity = 1,
  confirm = false,
  onPlaceAt,
  describeAt,
  onMoveOrder,
  compact = false,
  now,
  candleMs = MINUTE_MS,
}: {
  trades: TradeRow[];
  basePrice: number;
  mv?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  bids?: OrderRow[];
  asks?: OrderRow[];
  myOrders?: OrderRow[];
  onCancel?: (id: number) => void;
  quantity?: number;
  confirm?: boolean;
  onPlaceAt?: (side: "buy" | "sell", price: number) => void;
  describeAt?: (side: "buy" | "sell", price: number) => string;
  onMoveOrder?: (group: ChartOrderGroup, toPrice: number) => void;
  compact?: boolean;
  now?: number;
  candleMs?: number;
}) {
  const clock = now ?? Date.now();
  const prints = useMemo(
    () => [...trades].sort((a, b) => a.id - b.id || a.createdAt - b.createdAt),
    [trades]
  );
  const candles = useMemo(
    () => toMinuteCandles(prints, clock, basePrice, candleMs),
    [prints, clock, basePrice, candleMs]
  );
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<{ side: "buy" | "sell"; price: number } | null>(null);
  const [armed, setArmed] = useState<
    | { kind: "place"; side: "buy" | "sell"; price: number }
    | { kind: "move"; group: ChartOrderGroup; toPrice: number }
    | null
  >(null);
  const [drag, setDrag] = useState<{ group: ChartOrderGroup; price: number } | null>(null);
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
          at: minuteKey(clock, candleMs),
        },
      ];
  const extras = [bestBid, bestAsk, mv].filter((value): value is number => value != null);
  const rawMin = Math.min(...shown.flatMap((candle) => [candle.low, candle.high]), ...extras);
  const rawMax = Math.max(...shown.flatMap((candle) => [candle.low, candle.high]), ...extras);
  // Headroom so stop orders and far bids/asks can be placed just beyond the book.
  const headroom = Math.max(1, Math.ceil(Math.max(1, rawMax - rawMin) * 0.2));
  const min = Math.max(1, Math.floor(rawMin - headroom));
  const max = Math.ceil(rawMax + headroom);
  const span = Math.max(1, max - min);
  const depthW = 64;
  const pad = { top: 14, right: 78 + depthW, bottom: 6, left: 36 };
  const width = 640 + depthW;
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
  const depth = useMemo(() => {
    const build = (rows: OrderRow[], side: "bid" | "ask") => {
      const byPrice = new Map<number, number>();
      for (const row of rows) {
        if (row.remaining > 0) byPrice.set(row.price, (byPrice.get(row.price) ?? 0) + row.remaining);
      }
      const sorted = [...byPrice.entries()].sort((a, b) => (side === "bid" ? b[0] - a[0] : a[0] - b[0]));
      let total = 0;
      return sorted.map(([price, qty]) => {
        total += qty;
        return { price, qty, total };
      });
    };
    const bidLevels = build(bids, "bid");
    const askLevels = build(asks, "ask");
    const maxTotal = Math.max(1, bidLevels.at(-1)?.total ?? 0, askLevels.at(-1)?.total ?? 0);
    return { bidLevels, askLevels, maxTotal };
  }, [bids, asks]);
  const depthBars = (levels: typeof depth.bidLevels, side: "bid" | "ask") =>
    levels.flatMap((level, index) => {
      if (level.price < min || level.price > max) return [];
      const next = levels[index + 1];
      const y0 = yFor(level.price);
      const y1 = next ? yFor(Math.min(max, Math.max(min, next.price))) : y0 + (side === "bid" ? 3 : -3);
      return [
        {
          key: `${side}-${level.price}`,
          y: Math.min(y0, y1),
          h: Math.max(2, Math.abs(y1 - y0)),
          w: Math.max(2, (level.total / depth.maxTotal) * (depthW - 6)),
          level,
        },
      ];
    });
  const mine = useMemo(() => {
    const groups = new Map<string, ChartOrderGroup>();
    for (const row of myOrders) {
      if (row.price < min || row.price > max) continue;
      const orderType = row.orderType === "stop" ? "stop" : "limit";
      const side = row.side === "buy" ? "buy" : "sell";
      const key = `${orderType}-${side}-${row.price}`;
      const group = groups.get(key) ?? { key, price: row.price, side, orderType, ids: [], qty: 0 };
      group.ids.push(row.id);
      group.qty += row.remaining;
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [myOrders, min, max]);
  const offScale = [...depth.bidLevels, ...depth.askLevels].filter(
    (level) => level.price < min || level.price > max
  ).length;
  const maxVol = Math.max(1, ...shown.map((candle) => candle.volume));
  const active = hover != null ? shown[hover] : null;
  const activeX = hover != null ? xMid(hover) : 0;
  const activeY = active ? yFor((active.high + active.low) / 2) : 0;

  const interactive = Boolean(onPlaceAt);
  const svgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const mapped = point.matrixTransform(ctm.inverse());
    return { x: mapped.x, y: mapped.y };
  };
  const priceAtY = (y: number) =>
    Math.min(max, Math.max(1, Math.round(min + (1 - (y - pad.top) / candleH) * span)));
  const targetAt = (clientX: number, clientY: number) => {
    const point = svgPoint(clientX, clientY);
    if (!point) return null;
    if (point.x < pad.left || point.x > endX || point.y < pad.top || point.y > pad.top + candleH) return null;
    return {
      side: (point.x < pad.left + innerW / 2 ? "buy" : "sell") as "buy" | "sell",
      price: priceAtY(point.y),
    };
  };
  const runAction = (action: NonNullable<typeof armed>) => {
    setArmed(null);
    setGhost(null);
    if (action.kind === "place") onPlaceAt?.(action.side, action.price);
    else onMoveOrder?.(action.group, action.toPrice);
  };
  const request = (action: NonNullable<typeof armed>) => {
    if (confirm) setArmed(action);
    else runAction(action);
  };
  const orderLabel = (group: ChartOrderGroup) =>
    `${group.orderType === "stop" ? (group.side === "buy" ? "Buy STP" : "Sell STP") : group.side === "buy" ? "Bid" : "Ask"}${group.ids.length > 1 ? ` ×${group.ids.length}` : ""}`;
  const previewTarget = armed
    ? armed.kind === "place"
      ? { side: armed.side, price: armed.price, text: `${describeAt?.(armed.side, armed.price) ?? armed.side} ${formatNumber(armed.price)}` }
      : {
          side: armed.group.side,
          price: armed.toPrice,
          text: `Move ${orderLabel(armed.group)} ${formatNumber(armed.group.price)} → ${formatNumber(armed.toPrice)}`,
        }
    : ghost && !drag
      ? { ...ghost, text: `${describeAt?.(ghost.side, ghost.price) ?? ghost.side} ${formatNumber(ghost.price)}` }
      : null;

  return (
    <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-lg">Price</p>
          <p className="text-xs text-muted-foreground">
            {traded
              ? `Each candle is ${Math.round(candleMs / MINUTE_MS)} minutes. Open is the previous close. Last ${CHART_CANDLES} candles, oldest to newest. Hover for open, high, low, close.`
              : "No trades yet. The candle sits at the starting price."}{" "}
            Dashed marks on the right are MV, best bid, and best ask. Bars under the candles are volume. Shaded bars beside the price scale are cumulative bid (green) and ask (red) depth, growing leftward. Your own orders are amber lines (limit) and dashed purple lines (stop); drag one up or down to move it, or tap its ✕ to cancel. Click the left half of the chart to buy and the right half to sell at that price: above the best ask is a Buy STP, at it a market buy, below it a Bid (mirrored for sells).{offScale > 0 ? ` ${offScale} price level${offScale === 1 ? "" : "s"} sit outside this price range.` : ""}
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
              ? `Change from the first candle’s open to the last close in this ${CHART_CANDLES}-candle window.`
              : "Starting price — no prints yet."
          }
        >
          {traded ? `${up ? "▲" : down ? "▼" : "▬"} ${formatCoins(Math.abs(delta))}` : null}
        </p>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={cn(compact ? "h-36 w-full" : "h-48 w-full", interactive && "cursor-crosshair")}
          role="img"
          aria-label="One-minute candlestick chart"
          onPointerMove={(event) => {
            if (!interactive || drag || armed || event.pointerType !== "mouse") return;
            setGhost(targetAt(event.clientX, event.clientY));
          }}
          onPointerLeave={() => setGhost(null)}
          onClick={(event) => {
            if (!interactive || drag) return;
            const target = targetAt(event.clientX, event.clientY);
            if (target) request({ kind: "place", ...target });
          }}
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
          {([["bid", depth.bidLevels], ["ask", depth.askLevels]] as const).flatMap(([side, levels]) =>
            depthBars(levels, side).map((bar) => (
              <rect
                key={bar.key}
                x={endX + depthW - 2 - bar.w}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                className={side === "bid" ? "fill-emerald-400/35" : "fill-rose-400/35"}
              >
                <title>{`${side === "bid" ? "Bid" : "Ask"} ${formatNumber(bar.level.price)}: ${formatNumber(bar.level.qty)} units (cumulative ${formatNumber(bar.level.total)})`}</title>
              </rect>
            ))
          )}
          <line
            x1={endX + depthW - 2}
            x2={endX + depthW - 2}
            y1={pad.top}
            y2={pad.top + candleH}
            className="stroke-border"
          />
          {mine.map((group) => {
            const dragging = drag?.group.key === group.key;
            const shownPrice = dragging ? drag.price : group.price;
            const y = yFor(shownPrice);
            const stop = group.orderType === "stop";
            const tone = stop ? "stroke-purple-400" : "stroke-amber-300";
            const fill = stop ? "fill-purple-300" : "fill-amber-200";
            const label = `${orderLabel(group)} ${formatNumber(shownPrice)}`;
            return (
              <g key={group.key}>
                <line
                  x1={pad.left}
                  x2={endX}
                  y1={y}
                  y2={y}
                  strokeWidth={dragging ? 2.5 : 1.5}
                  strokeDasharray={stop ? "2 3" : undefined}
                  className={tone}
                />
                <text x={pad.left + 4} y={y - 3} fill="currentColor" className={cn(fill, "text-[10px]")}>
                  {label}
                </text>
                {onMoveOrder ? (
                  <line
                    x1={pad.left}
                    x2={endX - 22}
                    y1={y}
                    y2={y}
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ cursor: "ns-resize", touchAction: "none" }}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setGhost(null);
                      setArmed(null);
                      setDrag({ group, price: group.price });
                    }}
                    onPointerMove={(event) => {
                      if (!dragging) return;
                      const point = svgPoint(event.clientX, event.clientY);
                      if (point) setDrag({ group, price: priceAtY(point.y) });
                    }}
                    onPointerUp={() => {
                      if (!dragging) return;
                      const toPrice = drag.price;
                      setDrag(null);
                      if (toPrice !== group.price) request({ kind: "move", group, toPrice });
                    }}
                    onPointerCancel={() => setDrag(null)}
                  >
                    <title>Drag to move your {orderLabel(group)}</title>
                  </line>
                ) : null}
                {onCancel ? (
                  <g
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancel(group.ids[group.ids.length - 1]);
                    }}
                  >
                    <title>Cancel your {label}</title>
                    <circle cx={endX - 10} cy={y} r={8} className={cn(stop ? "fill-purple-950" : "fill-amber-950", tone)} />
                    <text x={endX - 10} y={y + 3.5} textAnchor="middle" fill="currentColor" className={cn(fill, "text-[11px]")}>
                      ✕
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
          {previewTarget ? (
            <g className="pointer-events-none">
              <line
                x1={pad.left}
                x2={endX}
                y1={yFor(previewTarget.price)}
                y2={yFor(previewTarget.price)}
                strokeWidth="1.5"
                strokeDasharray="6 4"
                className={previewTarget.side === "buy" ? "stroke-emerald-300" : "stroke-rose-300"}
              />
              <text
                x={previewTarget.side === "buy" ? pad.left + 4 : endX - 4}
                y={Math.max(pad.top + 10, yFor(previewTarget.price) - 4)}
                textAnchor={previewTarget.side === "buy" ? "start" : "end"}
                fill="currentColor"
                className={cn(
                  "text-[11px] font-medium",
                  previewTarget.side === "buy" ? "fill-emerald-200" : "fill-rose-200"
                )}
              >
                {previewTarget.text}
              </text>
            </g>
          ) : null}          {mv != null ? (
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
        {armed ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
            <span className="font-medium">
              {armed.kind === "place"
                ? `${describeAt?.(armed.side, armed.price) ?? armed.side} ${formatNumber(armed.price)} × ${formatNumber(quantity)}`
                : `Move ${orderLabel(armed.group)} ${formatNumber(armed.group.price)} → ${formatNumber(armed.toPrice)} (×${formatNumber(armed.group.qty)})`}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground"
                onClick={() => runAction(armed)}
              >
                Confirm
              </button>
              <button
                type="button"
                className="rounded-md bg-background px-3 py-1 ring-1 ring-foreground/20"
                onClick={() => setArmed(null)}
              >
                Cancel
              </button>
            </span>
          </div>
        ) : null}
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
