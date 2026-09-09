import { itemById } from "@/lib/game/catalog";

export type BuffKind =
  | "travel_haste"
  | "search_haste"
  | "search_yield"
  | "search_luck"
  | "search_calm"
  | "search_double"
  | "search_skip_common"
  | "search_cheap";

export type Consumable = {
  itemId: string;
  kind: BuffKind;
  charges: number;
  power: number;
  verb: string;
  blurb: string;
  energy?: number;
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
    blurb: "A handful. +4 energy — one quiet search.",
  },
  {
    itemId: "fish",
    energy: 6,
    verb: "Eat",
    blurb: "Raw shore snack. +6 energy.",
  },
];

export const consumables: Consumable[] = [
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
    kind: "search_skip_common",
    charges: 1,
    power: 1,
    verb: "Listen",
    blurb: "Next search skips Commons — only Uncommon and rarer.",
  },
  {
    itemId: "stone",
    kind: "search_cheap",
    charges: 1,
    power: 1,
    verb: "Brace",
    blurb: "Next search costs only 1 energy, even on a crowded node.",
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
  search_skip_common: "No commons",
  search_cheap: "Easy pull",
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
          : kind === "search_skip_common"
            ? `skip Commons ×${charges}`
            : kind === "search_cheap"
              ? `1 energy ×${charges}`
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
