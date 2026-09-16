export function coalesceTrades<
  T extends {
    itemId: string;
    price: number;
    quantity: number;
    buyUsername: string;
    sellUsername: string;
  },
>(trades: T[]): T[] {
  const out: T[] = [];
  for (const trade of trades) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.itemId === trade.itemId &&
      prev.price === trade.price &&
      prev.buyUsername === trade.buyUsername &&
      prev.sellUsername === trade.sellUsername
    ) {
      prev.quantity += trade.quantity;
      continue;
    }
    out.push({ ...trade });
  }
  return out;
}

export function lastTapeQty(
  prints: { price: number; quantity: number; buyUserId: number; sellUserId: number }[]
) {
  const head = prints[0];
  if (!head) return 0;
  let qty = 0;
  for (const row of prints) {
    if (
      row.price !== head.price ||
      row.buyUserId !== head.buyUserId ||
      row.sellUserId !== head.sellUserId
    ) {
      break;
    }
    qty += row.quantity;
  }
  return qty;
}
