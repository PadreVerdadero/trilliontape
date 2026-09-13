"use client";

import { useMemo, useState } from "react";
import { items as defaultItems } from "@/lib/game/catalog";
import {
  cycleMarketSort,
  rankCatalogItems,
  type MarketSort,
  type SortColumn,
  type SortDir,
} from "@/lib/game/market-sort";
import { rarityMapFromPrices } from "@/lib/game/rarity";
import type { Item, MarketPrice } from "@/lib/game/types";

export function useMarketSort(prices: MarketPrice[], catalog: Item[] = defaultItems) {
  const [sort, setSort] = useState<MarketSort>("item");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const rarityMap = useMemo(
    () => rarityMapFromPrices(
      catalog.map((item) => item.id),
      prices
    ),
    [catalog, prices]
  );
  const rankedItems = useMemo(
    () => rankCatalogItems(prices, sort, sortDir, rarityMap, catalog),
    [catalog, prices, rarityMap, sort, sortDir]
  );

  function cycleSort(column: SortColumn) {
    const next = cycleMarketSort(sort, sortDir, column);
    setSort(next.sort);
    setSortDir(next.dir);
  }

  return { sort, sortDir, rankedItems, rarityMap, cycleSort };
}
