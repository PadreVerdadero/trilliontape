import type { Rarity } from "@/lib/game/types";

export const rarityLabel: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

export const rarityRing: Record<Rarity, string> = {
  common: "ring-white/80",
  uncommon: "ring-emerald-400",
  rare: "ring-sky-400",
  legendary: "ring-red-500",
};

export const rarityText: Record<Rarity, string> = {
  common: "text-white/80",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  legendary: "text-red-400",
};

export const rarityRank: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
};

const RARITY_BY_QUARTILE: Rarity[] = ["common", "uncommon", "rare", "legendary"];

export type RarityMap = Record<string, Rarity>;

export function rarityFromHeld(itemIds: string[], heldByItem: Record<string, number>): RarityMap {
  const ranked = [...itemIds].sort((a, b) => {
    const diff = (heldByItem[b] ?? 0) - (heldByItem[a] ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  const n = Math.max(1, ranked.length);
  const map: RarityMap = {};
  let i = 0;
  while (i < ranked.length) {
    const volume = heldByItem[ranked[i]] ?? 0;
    let end = i + 1;
    while (end < ranked.length && (heldByItem[ranked[end]] ?? 0) === volume) end += 1;
    const quartile = Math.min(3, Math.floor((i * 4) / n));
    const rarity = RARITY_BY_QUARTILE[quartile];
    for (let k = i; k < end; k += 1) map[ranked[k]] = rarity;
    i = end;
  }
  return map;
}

export function rarityMapFromPrices(
  itemIds: string[],
  prices: { itemId: string; held: number }[]
): RarityMap {
  const held: Record<string, number> = {};
  for (const id of itemIds) held[id] = 0;
  for (const row of prices) held[row.itemId] = row.held;
  return rarityFromHeld(itemIds, held);
}

export function rarityOf(itemId: string, map?: RarityMap): Rarity {
  return map?.[itemId] ?? "common";
}

export function compareByCommonness(
  a: { id: string; name?: string },
  b: { id: string; name?: string },
  map?: RarityMap
) {
  const rank = rarityRank[rarityOf(a.id, map)] - rarityRank[rarityOf(b.id, map)];
  if (rank !== 0) return rank;
  return (a.name ?? a.id).localeCompare(b.name ?? b.id);
}

export function rarityClass(itemId: string, map?: RarityMap) {
  return rarityRing[rarityOf(itemId, map)];
}
