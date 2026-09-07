import { itemById } from "@/lib/game/catalog";

export type BuffKind =
  | "travel_haste"
  | "search_haste"
  | "search_yield"
  | "search_luck"
  | "search_calm"
  | "search_double";

export type Consumable = {
  itemId: string;
  kind: BuffKind;
  charges: number;
  power: number;
  verb: string;
  blurb: string;
};

export type Food = {
  itemId: string;
  energy: number;
  verb: string;
  blurb: string;
};

export const foods: Food[] = [
  {
    itemId: "berries",
    energy: 4,
    verb: "Eat",
    blurb: "A handful. Enough energy for one quiet search.",
  },
  {
    itemId: "bread",
    energy: 10,
    verb: "Eat",
    blurb: "A plaza loaf. Two or three searches, depending on the crowd.",
  },
  {
    itemId: "fish",
    energy: 6,
    verb: "Eat",
    blurb: "Raw shore snack. Better in stew, but it fills you.",
  },
  {
    itemId: "honey",
    energy: 8,
    verb: "Eat",
    blurb: "A spoon of gold. Fast energy, or save it for a candle.",
  },
];

export const consumables: Consumable[] = [
  {
    itemId: "planks",
    kind: "search_calm",
    charges: 2,
    power: 1,
    verb: "Lay",
    blurb: "Boardwalk through two crowded searches. You still add strain for everyone else.",
  },
  {
    itemId: "mushrooms",
    kind: "search_double",
    charges: 1,
    power: 1,
    verb: "Eat",
    blurb: "Next search pulls two finds instead of one.",
  },
  {
    itemId: "flower",
    kind: "search_luck",
    charges: 1,
    power: 2,
    verb: "Tuck",
    blurb: "Next search: Rare and higher show up more often.",
  },
  {
    itemId: "shell",
    kind: "search_luck",
    charges: 1,
    power: 2,
    verb: "Listen",
    blurb: "Next search: Rare and higher show up more often.",
  },
  {
    itemId: "charm",
    kind: "search_luck",
    charges: 1,
    power: 3,
    verb: "Wear",
    blurb: "Strong luck. Unique and Legendary weights jump. Better than a raw flower or shell.",
  },
  {
    itemId: "salve",
    kind: "search_calm",
    charges: 1,
    power: 1,
    verb: "Rub",
    blurb: "Next search ignores crowd strain. You still add strain for everyone else.",
  },
  {
    itemId: "brick",
    kind: "search_calm",
    charges: 1,
    power: 1,
    verb: "Brace",
    blurb: "Same as salve: one calm search. Stone's reason to exist.",
  },
  {
    itemId: "basket",
    kind: "search_yield",
    charges: 1,
    power: 1,
    verb: "Carry",
    blurb: "Next find comes with +1 extra. Wood plus flax, then flip to gem hunters.",
  },
];

export const foodById = Object.fromEntries(foods.map((entry) => [entry.itemId, entry]));
export const consumableById = Object.fromEntries(
  consumables.map((entry) => [entry.itemId, entry])
);

export const buffLabel: Record<BuffKind, string> = {
  travel_haste: "Fast road",
  search_haste: "Quick hands",
  search_yield: "Deep pockets",
  search_luck: "Lucky pull",
  search_calm: "Steady ground",
  search_double: "Second find",
};

export function describeBuff(kind: BuffKind, charges: number, power: number) {
  const name = buffLabel[kind];
  const extra =
    kind === "travel_haste"
      ? `${power}% walk time ×${charges}`
      : kind === "search_haste"
        ? `${power}% search time ×${charges}`
        : kind === "search_luck"
          ? `luck ×${power} · ${charges} search${charges === 1 ? "" : "es"}`
          : `×${charges}`;
  return `${name} · ${extra}`;
}

export function usableById(itemId: string) {
  const food = foodById[itemId];
  if (food) return { verb: food.verb, blurb: food.blurb };
  const consumable = consumableById[itemId];
  if (consumable) return { verb: consumable.verb, blurb: consumable.blurb };
  return null;
}

export function isConsumable(itemId: string) {
  return Boolean(usableById(itemId) && itemById[itemId]);
}
