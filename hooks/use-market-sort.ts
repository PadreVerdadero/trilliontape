"use client";

import { useMemo, useState } from "react";
import { items } from "@/lib/game/catalog";
import {
  cycleMarketSort,
  rankCatalogItems,
  type MarketSort,
  type SortColumn,
  type SortDir,
} from "@/lib/game/market-sort";
import { rarityMapFromPrices } from "@/lib/game/rarity";
import type { MarketPrice } from "@/lib/game/types";

export function useMarketSort(prices: MarketPrice[]) {
  const [sort, setSort] = useState<MarketSort>("item");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const rarityMap = useMemo(
    () => rarityMapFromPrices(
      items.map((item) => item.id),
      prices
    ),
    [prices]
  );
  const rankedItems = useMemo(
    () => rankCatalogItems(prices, sort, sortDir, rarityMap),
    [prices, rarityMap, sort, sortDir]
  );

  function cycleSort(column: SortColumn) {
    const next = cycleMarketSort(sort, sortDir, column);
    setSort(next.sort);
    setSortDir(next.dir);
  }

  return { sort, sortDir, rankedItems, rarityMap, cycleSort };
}
