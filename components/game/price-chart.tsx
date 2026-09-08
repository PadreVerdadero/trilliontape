import { formatCoins } from "@/lib/game/format";
import type { PricePoint } from "@/lib/game/types";

export function PriceChart({
  history,
  basePrice,
  mv,
  bestBid,
  bestAsk,
}: {
  history: PricePoint[];
  basePrice: number;
  mv?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
}) {
  const points =
    history.length >= 2
      ? history
      : [
          { at: 0, price: basePrice },
          { at: 1, price: basePrice },
        ];
  const prices = points.map((point) => point.price);
  const extras = [bestBid, bestAsk, mv].filter((value): value is number => value != null);
  const min = Math.min(...prices, ...extras);
  const max = Math.max(...prices, ...extras);
  const span = Math.max(1, max - min);
  const pad = { top: 14, right: 78, bottom: 22, left: 36 };
  const width = 640;
  const height = 180;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const first = points[0].at;
  const last = points[points.length - 1].at;
  const timeSpan = Math.max(1, last - first);
  const yFor = (price: number) => pad.top + (1 - (price - min) / span) * innerH;
  const coords = points.map((point) => {
    const x = pad.left + ((point.at - first) / timeSpan) * innerW;
    const y = yFor(point.price);
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`;
  const lastPrice = points[points.length - 1].price;
  const firstPrice = points[0].price;
  const up = lastPrice >= firstPrice;
  const traded = history.length > 2 || (history.length === 2 && history[0].price !== history[1].price);
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

  return (
    <div className="rounded-xl bg-background/40 p-3 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-lg">Price</p>
          <p className="text-xs text-muted-foreground">
            {traded
              ? "Each trade is a point, oldest to newest."
              : "No trades yet. The line sits at the starting price."}{" "}
            Dashed marks on the right are MV, best bid, and best ask.
          </p>
        </div>
        <p className={up ? "text-sm text-emerald-200" : "text-sm text-rose-200"}>
          {formatCoins(lastPrice)} {traded ? (up ? "▲" : "▼") : ""}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Price over time">
        <path d={area} className={up ? "fill-emerald-400/15" : "fill-rose-400/15"} />
        <path
          d={line}
          fill="none"
          strokeWidth="2.5"
          className={up ? "stroke-emerald-300" : "stroke-rose-300"}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === coords.length - 1 ? 4 : 2.5}
            className={up ? "fill-emerald-200" : "fill-rose-200"}
          />
        ))}
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
    </div>
  );
}
