import { itemById } from "@/lib/game/catalog";
import type { MarketPrice } from "@/lib/game/types";

export function itemMarketValue(prices: MarketPrice[], itemId: string) {
  return prices.find((row) => row.itemId === itemId)?.vwap ?? itemById[itemId]?.basePrice ?? 0;
}

export function bundleMarketValue(
  prices: MarketPrice[],
  gold: number,
  legs: { itemId: string; quantity: number }[]
) {
  const coin = Math.max(0, Number.isFinite(gold) ? gold : 0);
  const goods = legs.reduce((sum, leg) => {
    if (!leg.itemId || !(leg.quantity > 0)) return sum;
    return sum + itemMarketValue(prices, leg.itemId) * leg.quantity;
  }, 0);
  return Math.round(coin + goods);
}
