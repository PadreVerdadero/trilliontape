import type { Cosmetic, Item, Location, Recipe } from "@/lib/game/types";
import { compareByCommonness } from "@/lib/game/rarity";

export const WIN_ITEM_ID = "celestial-relic";
export const STARTING_GOLD = 140;

export const locations: Location[] = [
  {
    id: "town",
    emoji: "🏮",
    name: "Lantern Plaza",
    region: "The Bazaar",
    blurb:
      "Workshops, the public board, the bank window, and a wardrobe stall. Craft and trade happen here.",
  },
  {
    id: "woods",
    emoji: "🌲",
    name: "Whispering Woods",
    region: "West Path",
    blurb: "Damp shade and old timber. Herbs and mushrooms hide under the roots.",
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
    blurb: "Salt air and tide pools. Coral is slow, fish are not.",
    searchEnergy: 4,
  },
  {
    id: "fields",
    emoji: "🌾",
    name: "Golden Fields",
    region: "East Road",
    blurb: "Wheat, flax, and stubborn bees. Bring patience for honey.",
    searchEnergy: 4,
  },
];

export const items: Item[] = [
  {
    id: "wood",
    emoji: "🪵",
    name: "Wood",
    kind: "material",
    purpose: "Craft planks (2 wood) or a basket (with flax).",
    description: "Fallen timber from the woods.",
    basePrice: 5,
    mine: { locationId: "woods", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "berries",
    emoji: "🍓",
    name: "Berries",
    kind: "material",
    purpose: "Eat: +4 energy (one quiet search).",
    description: "Sweet trail food. The cheapest refill.",
    basePrice: 4,
    mine: { locationId: "woods", seconds: 10, yieldMin: 2, yieldMax: 4 },
  },
  {
    id: "herbs",
    emoji: "🌿",
    name: "Herbs",
    kind: "material",
    purpose: "Craft salve (with mushrooms) or stew (with fish and salt).",
    description: "Bitter greens from under the roots.",
    basePrice: 7,
    mine: { locationId: "woods", seconds: 18, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "mushrooms",
    emoji: "🍄",
    name: "Mushrooms",
    kind: "material",
    purpose: "Eat: next search finds two things. Also crafts salve.",
    description: "Spongy caps. Snack for a double pull, or grind with herbs.",
    basePrice: 8,
    mine: { locationId: "woods", seconds: 22, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "stone",
    emoji: "🪨",
    name: "Stone",
    kind: "material",
    purpose: "Craft a brick (2 stone + coal).",
    description: "Rough blocks from the ridge.",
    basePrice: 5,
    mine: { locationId: "ridge", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "iron",
    emoji: "⛓️",
    name: "Iron",
    kind: "material",
    purpose: "Craft a blade (2 iron + coal).",
    description: "Heavy ore for the relic sword.",
    basePrice: 12,
    mine: { locationId: "ridge", seconds: 28, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "coal",
    emoji: "🔥",
    name: "Coal",
    kind: "material",
    purpose: "Fires a blade or a brick at the kiln.",
    description: "The ridge's other currency.",
    basePrice: 9,
    mine: { locationId: "ridge", seconds: 24, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "gem",
    emoji: "💎",
    name: "Gem",
    kind: "material",
    purpose: "Craft a jewel (with coral).",
    description: "A long chisel job. Legendary pull.",
    basePrice: 28,
    mine: { locationId: "ridge", seconds: 48, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "fish",
    emoji: "🐟",
    name: "Fish",
    kind: "material",
    purpose: "Eat: +6 energy, or craft stew.",
    description: "Silver from the tide.",
    basePrice: 6,
    mine: { locationId: "shore", seconds: 14, yieldMin: 1, yieldMax: 3 },
  },
  {
    id: "shell",
    emoji: "🐚",
    name: "Shell",
    kind: "material",
    purpose: "Listen: next search skips Commons. Also crafts a charm.",
    description: "Polished by the surf.",
    basePrice: 7,
    mine: { locationId: "shore", seconds: 16, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "salt",
    emoji: "🧂",
    name: "Salt",
    kind: "material",
    purpose: "Craft stew (with fish and herbs).",
    description: "Raked from the flats. Stew without salt is a dare.",
    basePrice: 6,
    mine: { locationId: "shore", seconds: 18, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "coral",
    emoji: "🪸",
    name: "Coral",
    kind: "material",
    purpose: "Craft a jewel (with a gem).",
    description: "Slow diving. Legendary pull.",
    basePrice: 22,
    mine: { locationId: "shore", seconds: 40, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "wheat",
    emoji: "🌾",
    name: "Wheat",
    kind: "material",
    purpose: "Craft bread (2 wheat).",
    description: "The fields' staple.",
    basePrice: 4,
    mine: { locationId: "fields", seconds: 11, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "flax",
    emoji: "🧵",
    name: "Flax",
    kind: "material",
    purpose: "Craft a basket (with wood) or a candle (with honey).",
    description: "Spun for wicks and weaves.",
    basePrice: 7,
    mine: { locationId: "fields", seconds: 16, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "honey",
    emoji: "🍯",
    name: "Honey",
    kind: "material",
    purpose: "Eat: +8 energy, or craft a candle.",
    description: "The bees do not hurry.",
    basePrice: 16,
    mine: { locationId: "fields", seconds: 36, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "flower",
    emoji: "🌸",
    name: "Flower",
    kind: "material",
    purpose: "Tuck: next search leans Rare+. Also crafts a charm.",
    description: "Festival color from the east road.",
    basePrice: 6,
    mine: { locationId: "fields", seconds: 15, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "bread",
    emoji: "🍞",
    name: "Bread",
    kind: "good",
    purpose: "Eat: +10 energy.",
    description: "A plaza loaf. Two or three searches.",
    basePrice: 10,
  },
  {
    id: "planks",
    emoji: "🪜",
    name: "Planks",
    kind: "good",
    purpose: "Lay: next 2 searches ignore crowd cost.",
    description: "A boardwalk through busy ground.",
    basePrice: 12,
  },
  {
    id: "salve",
    emoji: "🩹",
    name: "Salve",
    kind: "good",
    purpose: "Rub: +8 energy and next search ignores crowd cost.",
    description: "Woods medicine. Heal and keep pulling.",
    basePrice: 18,
  },
  {
    id: "basket",
    emoji: "🧺",
    name: "Basket",
    kind: "good",
    purpose: "Carry: next find comes with +1 extra.",
    description: "Flax and wood. Foragers flip these to gem hunters.",
    basePrice: 16,
  },
  {
    id: "candle",
    emoji: "🕯️",
    name: "Candle",
    kind: "good",
    purpose: "Craft the Celestial Relic (with blade, jewel, stew).",
    description: "Festival light.",
    basePrice: 28,
  },
  {
    id: "stew",
    emoji: "🍲",
    name: "Stew",
    kind: "good",
    purpose: "Eat: refill all 20 energy, or craft the relic.",
    description: "A feast. Eating it means it cannot go on the altar.",
    basePrice: 24,
  },
  {
    id: "brick",
    emoji: "🧱",
    name: "Brick",
    kind: "good",
    purpose: "Brace: next search costs only 1 energy.",
    description: "Kiln-fired stone. Cheap pulls on a crowded ridge.",
    basePrice: 16,
  },
  {
    id: "blade",
    emoji: "🗡️",
    name: "Blade",
    kind: "good",
    purpose: "Craft the Celestial Relic (with jewel, candle, stew).",
    description: "Forged iron.",
    basePrice: 40,
  },
  {
    id: "charm",
    emoji: "📿",
    name: "Charm",
    kind: "good",
    purpose: "Wear: strong luck. Rare and Legendary show up more.",
    description: "Shell plus flower. Better than a raw bloom.",
    basePrice: 16,
  },
  {
    id: "jewel",
    emoji: "💍",
    name: "Jewel",
    kind: "good",
    purpose: "Craft the Celestial Relic (with blade, candle, stew).",
    description: "Gem set in coral. The slow relic piece.",
    basePrice: 58,
  },
  {
    id: WIN_ITEM_ID,
    emoji: "🌟",
    name: "Celestial Relic",
    kind: "relic",
    purpose: "Craft this in the plaza to win the festival.",
    description: "Blade, jewel, candle, and stew bound at the altar.",
    basePrice: 200,
  },
];

export const recipes: Recipe[] = [
  { id: "bread", outputId: "bread", outputQty: 1, inputs: [{ itemId: "wheat", qty: 2 }] },
  { id: "planks", outputId: "planks", outputQty: 1, inputs: [{ itemId: "wood", qty: 2 }] },
  {
    id: "salve",
    outputId: "salve",
    outputQty: 1,
    inputs: [
      { itemId: "herbs", qty: 1 },
      { itemId: "mushrooms", qty: 1 },
    ],
  },
  {
    id: "basket",
    outputId: "basket",
    outputQty: 1,
    inputs: [
      { itemId: "flax", qty: 1 },
      { itemId: "wood", qty: 1 },
    ],
  },
  {
    id: "candle",
    outputId: "candle",
    outputQty: 1,
    inputs: [
      { itemId: "honey", qty: 1 },
      { itemId: "flax", qty: 1 },
    ],
  },
  {
    id: "stew",
    outputId: "stew",
    outputQty: 1,
    inputs: [
      { itemId: "fish", qty: 1 },
      { itemId: "herbs", qty: 1 },
      { itemId: "salt", qty: 1 },
    ],
  },
  {
    id: "brick",
    outputId: "brick",
    outputQty: 1,
    inputs: [
      { itemId: "stone", qty: 2 },
      { itemId: "coal", qty: 1 },
    ],
  },
  {
    id: "blade",
    outputId: "blade",
    outputQty: 1,
    inputs: [
      { itemId: "iron", qty: 2 },
      { itemId: "coal", qty: 1 },
    ],
  },
  {
    id: "charm",
    outputId: "charm",
    outputQty: 1,
    inputs: [
      { itemId: "shell", qty: 1 },
      { itemId: "flower", qty: 1 },
    ],
  },
  {
    id: "jewel",
    outputId: "jewel",
    outputQty: 1,
    inputs: [
      { itemId: "gem", qty: 1 },
      { itemId: "coral", qty: 1 },
    ],
  },
  {
    id: WIN_ITEM_ID,
    outputId: WIN_ITEM_ID,
    outputQty: 1,
    inputs: [
      { itemId: "blade", qty: 1 },
      { itemId: "jewel", qty: 1 },
      { itemId: "candle", qty: 1 },
      { itemId: "stew", qty: 1 },
    ],
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
    description: "Not the relic. Just enough gold to look like you won already.",
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

export const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
export const itemsByCommonness = [...items].sort(compareByCommonness);
export const locationById = Object.fromEntries(
  locations.map((location) => [location.id, location])
);
export const recipeByOutput = Object.fromEntries(
  recipes.map((recipe) => [recipe.outputId, recipe])
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

export const BANK_BASE_RATE = 0.5;
export const BANK_DROP_PER_UNIT = 0.05;
export const BANK_FLOOR_RATE = 0.1;
export const BANK_COOLDOWN_MS = 60_000;

export function bankRate(glut: number) {
  return Math.max(BANK_FLOOR_RATE, BANK_BASE_RATE - BANK_DROP_PER_UNIT * Math.max(0, glut));
}

export function bankPayout(marketValue: number, glut: number, quantity: number) {
  let total = 0;
  let nextGlut = Math.max(0, glut);
  for (let i = 0; i < quantity; i += 1) {
    const rate = bankRate(nextGlut);
    total += Math.max(1, Math.round(marketValue * rate));
    nextGlut += 1;
  }
  return {
    total,
    startRate: bankRate(glut),
    endRate: bankRate(nextGlut),
    nextGlut,
  };
}

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
export const FOOD_ITEM_IDS = ["berries", "fish", "honey", "bread", "stew"] as const;
export const LEGENDARY_ITEM_IDS = [
  "coral",
  "gem",
  "candle",
  "blade",
  "jewel",
  WIN_ITEM_ID,
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
