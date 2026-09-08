export const MV_WINDOW_MS = 45 * 60 * 1000;
export const MV_MAX_PRINTS = 24;
export const MV_BASE_WEIGHT = 0.62;

export type Print = {
  price: number;
  quantity: number;
  at: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeFairValue(basePrice: number, prints: Print[], now = Date.now()) {
  const base = Math.max(1, Math.round(basePrice));
  const cutoff = now - MV_WINDOW_MS;
  const recent = prints
    .filter((print) => print.at >= cutoff && print.quantity > 0 && print.price > 0)
    .slice(-MV_MAX_PRINTS);
  const floor = Math.max(1, Math.round(base * 0.4));
  const ceiling = Math.max(floor + 1, Math.round(base * 2.6));
  const kept = recent.filter((print) => print.price >= floor && print.price <= ceiling);
  const volume = kept.reduce((sum, print) => sum + print.quantity, 0);
  const notional = kept.reduce((sum, print) => sum + print.price * print.quantity, 0);
  if (volume < 2 || notional <= 0) return base;
  const vwap = notional / volume;
  const blended = Math.round(base * MV_BASE_WEIGHT + vwap * (1 - MV_BASE_WEIGHT));
  return clamp(blended, Math.round(base * 0.65), Math.round(base * 1.75));
}

export function orderCollar(fair: number, basePrice: number) {
  const base = Math.max(1, Math.round(basePrice));
  const value = Math.max(1, Math.round(fair));
  return {
    min: Math.max(1, Math.round(Math.max(value * 0.5, base * 0.4))),
    max: Math.max(2, Math.round(Math.min(9999, Math.min(value * 2.4, base * 3)))),
  };
}
