import type { Rarity } from "@/lib/game/types";

export const rarityLabel: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  unique: "Unique",
  legendary: "Legendary",
};

export const rarityRing: Record<Rarity, string> = {
  common: "ring-white/80",
  uncommon: "ring-emerald-400",
  rare: "ring-sky-400",
  unique: "ring-violet-400",
  legendary: "ring-red-500",
};

export const rarityText: Record<Rarity, string> = {
  common: "text-white/80",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  unique: "text-violet-300",
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
  honey: "unique",
  coral: "unique",
  gem: "legendary",
  bread: "common",
  planks: "common",
  basket: "uncommon",
  brick: "uncommon",
  charm: "uncommon",
  salve: "rare",
  stew: "rare",
  candle: "unique",
  blade: "unique",
  jewel: "legendary",
  "celestial-relic": "legendary",
};

export function rarityOf(itemId: string): Rarity {
  return RARITY_BY_ID[itemId] ?? "common";
}

export function rarityClass(itemId: string) {
  return rarityRing[rarityOf(itemId)];
}
