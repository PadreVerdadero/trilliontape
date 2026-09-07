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

const RARITY_BY_ID: Record<string, Rarity> = {
  wood: "common",
  berries: "common",
  stone: "common",
  wheat: "common",
  fish: "common",
  flower: "common",
  herbs: "uncommon",
  flax: "uncommon",
  salt: "uncommon",
  shell: "uncommon",
  coal: "uncommon",
  mushrooms: "rare",
  iron: "rare",
  honey: "rare",
  coral: "legendary",
  gem: "legendary",
  bread: "common",
  planks: "common",
  basket: "uncommon",
  brick: "uncommon",
  charm: "uncommon",
  salve: "rare",
  stew: "rare",
  candle: "legendary",
  blade: "legendary",
  jewel: "legendary",
  "celestial-relic": "legendary",
};

export const rarityRank: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
};

export function rarityOf(itemId: string): Rarity {
  return RARITY_BY_ID[itemId] ?? "common";
}

export function compareByCommonness(
  a: { id: string; name?: string },
  b: { id: string; name?: string }
) {
  const rank = rarityRank[rarityOf(a.id)] - rarityRank[rarityOf(b.id)];
  if (rank !== 0) return rank;
  return (a.name ?? a.id).localeCompare(b.name ?? b.id);
}

export function rarityClass(itemId: string) {
  return rarityRing[rarityOf(itemId)];
}
