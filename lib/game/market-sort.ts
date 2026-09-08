import { items } from "@/lib/game/catalog";
import { compareByCommonness, type RarityMap } from "@/lib/game/rarity";
import type { Item, MarketPrice } from "@/lib/game/types";

export type MarketSort = "item" | "bid" | "ask" | "mv" | "bookBid" | "bookAsk" | "volume";
export type SortColumn = Exclude<MarketSort, "bookBid" | "bookAsk"> | "book";
export type SortDir = "asc" | "desc";

function quoteOf(prices: MarketPrice[], itemId: string) {
  return prices.find((row) => row.itemId === itemId);
}

function cmpMissingLast(a: number | null | undefined, b: number | null | undefined, dir: 1 | -1) {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return (a - b) * dir;
}

export function cycleMarketSort(
  sort: MarketSort,
  dir: SortDir,
  column: SortColumn
): { sort: MarketSort; dir: SortDir } {
  if (column === "book") {
    if (sort === "bookBid" && dir === "desc") return { sort: "bookBid", dir: "asc" };
    if (sort === "bookBid" && dir === "asc") return { sort: "bookAsk", dir: "desc" };
    if (sort === "bookAsk" && dir === "desc") return { sort: "bookAsk", dir: "asc" };
    return { sort: "bookBid", dir: "desc" };
  }
  if (sort === column) {
    return { sort, dir: dir === "desc" ? "asc" : "desc" };
  }
  return { sort: column, dir: column === "item" || column === "ask" ? "asc" : "desc" };
}

export function rankCatalogItems(
  prices: MarketPrice[],
  sort: MarketSort,
  sortDir: SortDir,
  rarityMap: RarityMap,
  catalog = items
): Item[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...catalog].sort((a, b) => {
    const qa = quoteOf(prices, a.id);
    const qb = quoteOf(prices, b.id);
    let cmp = 0;
    if (sort === "bid") cmp = cmpMissingLast(qa?.bestBid, qb?.bestBid, dir);
    else if (sort === "ask") cmp = cmpMissingLast(qa?.bestAsk, qb?.bestAsk, dir);
    else if (sort === "mv") {
      const ma = qa?.vwap ?? a.basePrice;
      const mb = qb?.vwap ?? b.basePrice;
      cmp = (ma - mb) * dir;
    } else if (sort === "bookBid") {
      const da = (qa?.wanted ?? 0) > 0 ? qa?.wanted : null;
      const db = (qb?.wanted ?? 0) > 0 ? qb?.wanted : null;
      cmp = cmpMissingLast(da, db, dir);
    } else if (sort === "bookAsk") {
      const da = (qa?.listed ?? 0) > 0 ? qa?.listed : null;
      const db = (qb?.listed ?? 0) > 0 ? qb?.listed : null;
      cmp = cmpMissingLast(da, db, dir);
    } else if (sort === "volume") cmp = ((qa?.held ?? 0) - (qb?.held ?? 0)) * dir;
    else cmp = compareByCommonness(a, b, rarityMap) * dir;
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name);
  });
}

export function orderIndex(rankedIds: string[]) {
  return new Map(rankedIds.map((id, index) => [id, index]));
}
