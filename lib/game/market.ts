export const MV_PRINTS = 25;
export const CHART_MINUTES = 20;
export const CHART_CANDLES = 20;
export const MINUTE_MS = 60_000;

export const CANDLE_PRESETS = [
  { ms: 60_000, label: "1 minute" },
  { ms: 5 * 60_000, label: "5 minutes" },
  { ms: 15 * 60_000, label: "15 minutes" },
  { ms: 30 * 60_000, label: "30 minutes" },
  { ms: 60 * 60_000, label: "1 hour" },
  { ms: 4 * 60 * 60_000, label: "4 hours" },
  { ms: 24 * 60 * 60_000, label: "1 day" },
] as const;

export function normalizeCandleMs(raw: unknown) {
  const ms = Math.floor(Number(raw));
  return CANDLE_PRESETS.some((row) => row.ms === ms) ? ms : MINUTE_MS;
}

export function candleSizeLabel(ms: number) {
  return CANDLE_PRESETS.find((row) => row.ms === ms)?.label ?? "1 minute";
}

export type Print = {
  price: number;
  quantity: number;
  at?: number;
};

export function computeFairValue(basePrice: number, prints: Print[]) {
  const base = Math.max(1, Math.round(basePrice));
  const recent = prints.filter((print) => print.price > 0).slice(-MV_PRINTS);
  if (recent.length === 0) return base;
  const sum = recent.reduce((total, print) => total + print.price, 0);
  return Math.max(1, Math.round(sum / recent.length));
}
