import type { Cosmetic, Item, Location } from "@/lib/game/types";

export const STARTING_GOLD = 1_000;
export const TABLE_GOLD = 2_000;
export const NET_WORTH_GOAL = 1_000_000_000_000;

export function seatGold(computers: boolean) {
  return computers ? STARTING_GOLD : TABLE_GOLD;
}

const DAILY_DEPOSITS = [
  1_000, 2_000, 3_000, 5_000, 8_000, 15_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
  2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000,
  1_000_000_000, 2_500_000_000, 5_000_000_000, 10_000_000_000, 25_000_000_000, 50_000_000_000,
  100_000_000_000, 250_000_000_000, 500_000_000_000,
];

export function dailyDeposit(paymentNumber: number) {
  if (paymentNumber <= 0) return 0;
  if (paymentNumber >= DAILY_DEPOSITS.length) return DAILY_DEPOSITS[DAILY_DEPOSITS.length - 1];
  return DAILY_DEPOSITS[paymentNumber - 1];
}

export const STIPEND_SLOT_MS = 5 * 60 * 1000;

export const STIPEND_PRESETS = [
  { ms: 30_000, label: "30 seconds" },
  { ms: 60_000, label: "1 minute" },
  { ms: 2 * 60_000, label: "2 minutes" },
  { ms: 5 * 60_000, label: "5 minutes" },
  { ms: 15 * 60_000, label: "15 minutes" },
  { ms: 60 * 60_000, label: "1 hour" },
  { ms: 24 * 60 * 60_000, label: "1 day" },
] as const;

export function stipendLabel(ms: number) {
  return STIPEND_PRESETS.find((row) => row.ms === ms)?.label ?? `${Math.round(ms / 1000)} seconds`;
}

export function stipendSlotKey(now = Date.now(), slotMs = STIPEND_SLOT_MS) {
  const ms = slotMs > 0 ? slotMs : STIPEND_SLOT_MS;
  const slot = Math.floor(now / ms) * ms;
  return `slot:${ms}:${slot}`;
}

export const locations: Location[] = [
  {
    id: "town",
    emoji: "🏮",
    name: "Lantern Plaza",
    region: "The Bazaar",
    blurb:
      "The public board. Trade happens here.",
  },
  {
    id: "woods",
    emoji: "🌲",
    name: "Whispering Woods",
    region: "West Path",
    blurb: "Damp shade and old timber. Mushrooms hide under the roots.",
    searchEnergy: 4,
  },
  {
    id: "ridge",
    emoji: "⛰️",
    name: "Ironridge",
    region: "North Climb",
    blurb: "Pickaxe country. Stone is easy; gems make you wait.",
    searchEnergy: 5,
  },
  {
    id: "shore",
    emoji: "🏖️",
    name: "Sunshore",
    region: "South Tide",
    blurb: "Salt air and tide pools. Fish and shells turn up first.",
    searchEnergy: 4,
  },
  {
    id: "fields",
    emoji: "🌾",
    name: "Golden Fields",
    region: "East Road",
    blurb: "Wheat and wildflowers along the east road.",
    searchEnergy: 4,
  },
];

export const items: Item[] = [
  {
    id: "wheat",
    emoji: "🌿",
    name: "Wheat",
    kind: "material",
    purpose: "The fields' staple. Trade it on the board.",
    description: "The fields' staple.",
    basePrice: 10,
    authorized: 150,
    mine: { locationId: "fields", seconds: 11, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "berries",
    emoji: "🍓",
    name: "Berries",
    kind: "material",
    purpose: "Eat: +4 energy (one quiet search).",
    description: "Sweet trail food. The cheapest refill.",
    basePrice: 20,
    authorized: 135,
    mine: { locationId: "woods", seconds: 10, yieldMin: 2, yieldMax: 4 },
  },
  {
    id: "wood",
    emoji: "🪵",
    name: "Wood",
    kind: "material",
    purpose: "Fallen timber. Trade it on the board.",
    description: "Fallen timber from the woods.",
    basePrice: 30,
    authorized: 120,
    mine: { locationId: "woods", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "fish",
    emoji: "🐟",
    name: "Fish",
    kind: "material",
    purpose: "Eat: +6 energy.",
    description: "Silver from the tide.",
    basePrice: 40,
    authorized: 105,
    mine: { locationId: "shore", seconds: 14, yieldMin: 1, yieldMax: 3 },
  },
  {
    id: "flower",
    emoji: "🌸",
    name: "Flower",
    kind: "material",
    purpose: "Tuck: next search leans Rare+.",
    description: "Festival color from the east road.",
    basePrice: 50,
    authorized: 90,
    mine: { locationId: "fields", seconds: 15, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "stone",
    emoji: "🪨",
    name: "Stone",
    kind: "material",
    purpose: "Rough blocks. Trade them on the board.",
    description: "Rough blocks from the ridge.",
    basePrice: 60,
    authorized: 75,
    mine: { locationId: "ridge", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "mushrooms",
    emoji: "🍄",
    name: "Mushrooms",
    kind: "material",
    purpose: "Eat: next search finds two things.",
    description: "Spongy caps. Snack for a double pull.",
    basePrice: 70,
    authorized: 60,
    mine: { locationId: "woods", seconds: 22, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "coal",
    emoji: "🔥",
    name: "Coal",
    kind: "material",
    purpose: "Ridge fuel. Trade it on the board.",
    description: "The ridge's other currency.",
    basePrice: 80,
    authorized: 45,
    mine: { locationId: "ridge", seconds: 24, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "shell",
    emoji: "🐚",
    name: "Shell",
    kind: "material",
    purpose: "Listen: next search skips Commons.",
    description: "Polished by the surf.",
    basePrice: 90,
    authorized: 30,
    mine: { locationId: "shore", seconds: 16, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "gem",
    emoji: "💎",
    name: "Gem",
    kind: "material",
    purpose: "A long chisel job. Trade it on the board.",
    description: "A long chisel job. Legendary pull.",
    basePrice: 100,
    authorized: 15,
    mine: { locationId: "ridge", seconds: 48, yieldMin: 1, yieldMax: 1 },
  },
];

export const cosmetics: Cosmetic[] = [
  {
    id: "cap",
    emoji: "🧢",
    name: "Traveler Cap",
    slot: "hat",
    price: 35,
    description: "Keeps the sun off on the east road.",
  },
  {
    id: "sunhat",
    emoji: "👒",
    name: "Sunshore Hat",
    slot: "hat",
    price: 55,
    description: "Woven brim. Says you have stood in the tide.",
  },
  {
    id: "ribbon",
    emoji: "🎀",
    name: "Festival Ribbon",
    slot: "hat",
    price: 48,
    description: "Tied for luck before a long gem chisel.",
  },
  {
    id: "tophat",
    emoji: "🎩",
    name: "Boardwalk Hat",
    slot: "hat",
    price: 90,
    description: "What the serious order-book people wear.",
  },
  {
    id: "crown",
    emoji: "👑",
    name: "Gilded Circlet",
    slot: "hat",
    price: 220,
    description: "Enough gold to look like you already won.",
  },
  {
    id: "vest",
    emoji: "🦺",
    name: "Ridge Vest",
    slot: "outfit",
    price: 50,
    description: "Pockets for ore samples and snack berries.",
  },
  {
    id: "coat",
    emoji: "🧥",
    name: "Wandercoat",
    slot: "outfit",
    price: 85,
    description: "Road dust optional, recommended.",
  },
  {
    id: "robe",
    emoji: "👘",
    name: "Lantern Robe",
    slot: "outfit",
    price: 140,
    description: "Plaza silk. You will be noticed at the wardrobe stall.",
  },
  {
    id: "scarf",
    emoji: "🧣",
    name: "Trail Scarf",
    slot: "accessory",
    price: 40,
    description: "Warm on the north climb.",
  },
  {
    id: "satchel",
    emoji: "🎒",
    name: "Forager Satchel",
    slot: "accessory",
    price: 60,
    description: "Looks heavier than your actual inventory.",
  },
  {
    id: "spectacles",
    emoji: "👓",
    name: "Ledger Specs",
    slot: "accessory",
    price: 70,
    description: "For reading the bid-ask spread in lantern light.",
  },
  {
    id: "wand",
    emoji: "🪄",
    name: "Fair Wand",
    slot: "accessory",
    price: 175,
    description: "Sparkles. Does not refill energy. Sorry.",
  },
];

const TRAVEL: Record<string, Record<string, number>> = {
  town: { woods: 12, ridge: 14, shore: 14, fields: 12 },
  woods: { town: 12, ridge: 18, shore: 20, fields: 22 },
  ridge: { town: 14, woods: 18, shore: 22, fields: 20 },
  shore: { town: 14, woods: 20, ridge: 22, fields: 24 },
  fields: { town: 12, woods: 22, ridge: 20, shore: 24 },
};

export function itemAuthorized(item: Item | undefined) {
  return item?.authorized ?? 0;
}

export const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
export const itemsByCommonness = [...items].sort((a, b) => a.name.localeCompare(b.name));
export const locationById = Object.fromEntries(
  locations.map((location) => [location.id, location])
);
export const cosmeticById = Object.fromEntries(
  cosmetics.map((cosmetic) => [cosmetic.id, cosmetic])
);

export function travelSeconds(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  return TRAVEL[fromId]?.[toId] ?? 20;
}

export const SEARCH_COOLDOWN_MS = 45_000;
export const SEARCH_STRAIN_STEP = 0.5;
export const SEARCH_STRAIN_CAP = 3;

export function materialsAt(locationId: string): Item[] {
  return items.filter((item) => item.mine?.locationId === locationId);
}

export function searchWeight(item: Item): number {
  const seconds = item.mine?.seconds ?? 20;
  return Math.max(1, Math.round(4000 / (seconds * seconds)));
}

export const ENERGY_MAX = 20;
export const STARTING_ENERGY = 20;
export const FORAGE_ENERGY = 4;
export const FORAGE_STRAIN_ID = "grounds";
export const VP_TO_WIN = 20;
export const FOOD_ITEM_IDS = ["berries", "fish"] as const;
export const LEGENDARY_ITEM_IDS = ["gem"] as const;
export const RETIRED_ITEM_IDS = [
  "flax",
  "stew",
  "basket",
  "charm",
  "salve",
  "celestial-relic",
  "iron",
  "coral",
  "planks",
  "honey",
  "salt",
  "bread",
  "blade",
  "candle",
  "jewel",
  "herbs",
  "brick",
] as const;

export function isFoodItem(itemId: string) {
  return (FOOD_ITEM_IDS as readonly string[]).includes(itemId);
}

export function isLegendaryItem(itemId: string) {
  return (LEGENDARY_ITEM_IDS as readonly string[]).includes(itemId);
}

export function searchEnergyCost(locationId: string, strain: number): number {
  const base =
    locationId === FORAGE_STRAIN_ID ? FORAGE_ENERGY : (locationById[locationId]?.searchEnergy ?? FORAGE_ENERGY);
  const multiplier = Math.min(SEARCH_STRAIN_CAP, 1 + SEARCH_STRAIN_STEP * Math.max(0, strain));
  return Math.max(1, Math.round(base * multiplier));
}

export function defaultBodyEmoji(): string {
  return "🙂";
}
