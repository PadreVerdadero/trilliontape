export const MV_PRINTS = 100;

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
