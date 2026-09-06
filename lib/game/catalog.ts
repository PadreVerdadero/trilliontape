import type { Cosmetic, Item, Location, Recipe } from "@/lib/game/types";

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
    searchSeconds: 14,
  },
  {
    id: "ridge",
    emoji: "⛰️",
    name: "Ironridge",
    region: "North Climb",
    blurb: "Pickaxe country. Stone is easy; gems make you wait.",
    searchSeconds: 16,
  },
  {
    id: "shore",
    emoji: "🏖️",
    name: "Sunshore",
    region: "South Tide",
    blurb: "Salt air and tide pools. Coral is slow, fish are not.",
    searchSeconds: 15,
  },
  {
    id: "fields",
    emoji: "🌾",
    name: "Golden Fields",
    region: "East Road",
    blurb: "Wheat, flax, and stubborn bees. Bring patience for honey.",
    searchSeconds: 14,
  },
];

export const items: Item[] = [
  {
    id: "wood",
    emoji: "🪵",
    name: "Wood",
    kind: "material",
    description: "Fallen timber from the woods. Planks, baskets, and camp smoke start here.",
    basePrice: 5,
    mine: { locationId: "woods", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "berries",
    emoji: "🍓",
    name: "Berries",
    kind: "material",
    description: "Sweet trail food. Not in the relic recipe, but traders snack and speculate.",
    basePrice: 4,
    mine: { locationId: "woods", seconds: 10, yieldMin: 2, yieldMax: 4 },
  },
  {
    id: "herbs",
    emoji: "🌿",
    name: "Herbs",
    kind: "material",
    description: "Bitter greens used in salves and stew. Everyone needs a handful eventually.",
    basePrice: 7,
    mine: { locationId: "woods", seconds: 18, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "mushrooms",
    emoji: "🍄",
    name: "Mushrooms",
    kind: "material",
    description: "Spongy caps for the healer's bench. Pair with herbs.",
    basePrice: 8,
    mine: { locationId: "woods", seconds: 22, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "stone",
    emoji: "🪨",
    name: "Stone",
    kind: "material",
    description: "Rough blocks from the ridge. Bricks want two of these and a kiss of coal.",
    basePrice: 5,
    mine: { locationId: "ridge", seconds: 12, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "iron",
    emoji: "⛓️",
    name: "Iron",
    kind: "material",
    description: "Heavy ore. Two bars and coal become a blade.",
    basePrice: 12,
    mine: { locationId: "ridge", seconds: 28, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "coal",
    emoji: "🔥",
    name: "Coal",
    kind: "material",
    description: "The ridge's other currency. Smelts iron and fires brick kilns.",
    basePrice: 9,
    mine: { locationId: "ridge", seconds: 24, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "gem",
    emoji: "💎",
    name: "Gem",
    kind: "material",
    description: "A long chisel job. One gem plus coral becomes a jewel.",
    basePrice: 28,
    mine: { locationId: "ridge", seconds: 48, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "fish",
    emoji: "🐟",
    name: "Fish",
    kind: "material",
    description: "Silver from the tide. The stew pot is waiting.",
    basePrice: 6,
    mine: { locationId: "shore", seconds: 14, yieldMin: 1, yieldMax: 3 },
  },
  {
    id: "shell",
    emoji: "🐚",
    name: "Shell",
    kind: "material",
    description: "Polished by the surf. Charms want a shell and a flower.",
    basePrice: 7,
    mine: { locationId: "shore", seconds: 16, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "salt",
    emoji: "🧂",
    name: "Salt",
    kind: "material",
    description: "Raked from the flats. Stew without salt is a dare.",
    basePrice: 6,
    mine: { locationId: "shore", seconds: 18, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "coral",
    emoji: "🪸",
    name: "Coral",
    kind: "material",
    description: "Slow diving. Jewelers pay, or you keep it for the relic path.",
    basePrice: 22,
    mine: { locationId: "shore", seconds: 40, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "wheat",
    emoji: "🌾",
    name: "Wheat",
    kind: "material",
    description: "The fields' staple. Two sheaves bake into bread.",
    basePrice: 4,
    mine: { locationId: "fields", seconds: 11, yieldMin: 2, yieldMax: 3 },
  },
  {
    id: "flax",
    emoji: "🧵",
    name: "Flax",
    kind: "material",
    description: "Spun for baskets and candle wicks. Quietly essential.",
    basePrice: 7,
    mine: { locationId: "fields", seconds: 16, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "honey",
    emoji: "🍯",
    name: "Honey",
    kind: "material",
    description: "The bees do not hurry. Wax and sweetness for festival candles.",
    basePrice: 16,
    mine: { locationId: "fields", seconds: 36, yieldMin: 1, yieldMax: 1 },
  },
  {
    id: "flower",
    emoji: "🌸",
    name: "Flower",
    kind: "material",
    description: "Festival color. Thread one through a shell and you have a charm.",
    basePrice: 6,
    mine: { locationId: "fields", seconds: 15, yieldMin: 1, yieldMax: 2 },
  },
  {
    id: "bread",
    emoji: "🍞",
    name: "Bread",
    kind: "good",
    description: "Baked in the plaza ovens. Easy craft, easy coin if the board is hungry.",
    basePrice: 10,
  },
  {
    id: "planks",
    emoji: "🪜",
    name: "Planks",
    kind: "good",
    description: "Milled wood. Not on the relic list, but builders bid when timber is tight.",
    basePrice: 12,
  },
  {
    id: "salve",
    emoji: "🩹",
    name: "Salve",
    kind: "good",
    description: "Woods medicine. Traders who hate mushroom timers will pay up.",
    basePrice: 18,
  },
  {
    id: "basket",
    emoji: "🧺",
    name: "Basket",
    kind: "good",
    description: "Flax and wood, useful and pretty. A side hustle while hunting honey.",
    basePrice: 16,
  },
  {
    id: "candle",
    emoji: "🕯️",
    name: "Candle",
    kind: "good",
    description: "Festival light. One of the four pieces of the Celestial Relic.",
    basePrice: 28,
  },
  {
    id: "stew",
    emoji: "🍲",
    name: "Stew",
    kind: "good",
    description: "Fish, herbs, and salt. The relic feast needs a pot of this.",
    basePrice: 24,
  },
  {
    id: "brick",
    emoji: "🧱",
    name: "Brick",
    kind: "good",
    description: "Kiln-fired stone. A market staple when ridge runners over-mine.",
    basePrice: 16,
  },
  {
    id: "blade",
    emoji: "🗡️",
    name: "Blade",
    kind: "good",
    description: "Forged iron. Required for the relic, and a favorite of speculators.",
    basePrice: 40,
  },
  {
    id: "charm",
    emoji: "📿",
    name: "Charm",
    kind: "good",
    description: "Shore souvenir. Pretty, cheap to make, and a good flip.",
    basePrice: 16,
  },
  {
    id: "jewel",
    emoji: "💍",
    name: "Jewel",
    kind: "good",
    description: "Gem set in coral. The slowest good on the relic path.",
    basePrice: 58,
  },
  {
    id: WIN_ITEM_ID,
    emoji: "🌟",
    name: "Celestial Relic",
    kind: "relic",
    description:
      "Blade, jewel, candle, and stew bound at the plaza altar. Craft this and the festival is yours.",
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
    description: "Sparkles. Does not skip mining timers. Sorry.",
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

export function searchDurationSeconds(locationId: string, strain: number): number {
  const base = locationById[locationId]?.searchSeconds ?? 0;
  if (!base) return 0;
  const multiplier = Math.min(SEARCH_STRAIN_CAP, 1 + SEARCH_STRAIN_STEP * Math.max(0, strain));
  return Math.round(base * multiplier);
}

export function defaultBodyEmoji(): string {
  return "🙂";
}
