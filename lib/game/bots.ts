export type BotProfile = {
  username: string;
  gold: number;
  specialty: string[];
  style: "tight" | "wide" | "thin" | "wild";
};

export const BOT_PROFILES: BotProfile[] = [
  {
    username: "Piper",
    gold: 2400,
    specialty: ["wood", "berries", "wheat", "stone", "bread", "planks"],
    style: "tight",
  },
  {
    username: "Reed",
    gold: 2200,
    specialty: ["berries", "fish", "honey", "bread", "stew", "wheat"],
    style: "tight",
  },
  {
    username: "Gossamer",
    gold: 2600,
    specialty: ["herbs", "flax", "flower", "shell", "salt", "basket"],
    style: "wide",
  },
  {
    username: "Anvil",
    gold: 3200,
    specialty: ["stone", "iron", "coal", "brick", "blade"],
    style: "tight",
  },
  {
    username: "Brine",
    gold: 2800,
    specialty: ["fish", "shell", "salt", "coral", "stew"],
    style: "wide",
  },
  {
    username: "Cinder",
    gold: 3000,
    specialty: ["planks", "brick", "salve", "charm", "candle", "coal"],
    style: "tight",
  },
  {
    username: "Nettle",
    gold: 2400,
    specialty: ["herbs", "mushrooms", "salve", "berries"],
    style: "wide",
  },
  {
    username: "Cobble",
    gold: 2600,
    specialty: ["stone", "wood", "planks", "brick", "wheat"],
    style: "tight",
  },
  {
    username: "Drift",
    gold: 2700,
    specialty: ["fish", "flax", "flower", "honey", "basket"],
    style: "wide",
  },
  {
    username: "Hearth",
    gold: 2500,
    specialty: ["bread", "stew", "honey", "wheat", "salt"],
    style: "tight",
  },
  {
    username: "Magpie",
    gold: 4200,
    specialty: ["gem", "iron", "honey", "mushrooms", "jewel"],
    style: "thin",
  },
  {
    username: "Wisp",
    gold: 4800,
    specialty: ["coral", "gem", "candle", "blade", "jewel"],
    style: "thin",
  },
  {
    username: "Finch",
    gold: 2100,
    specialty: ["wheat", "berries", "flower", "honey", "bread"],
    style: "wild",
  },
  {
    username: "Soot",
    gold: 3100,
    specialty: ["coal", "iron", "stone", "brick", "blade"],
    style: "wild",
  },
  {
    username: "Vetch",
    gold: 2300,
    specialty: ["herbs", "flax", "mushrooms", "salve", "basket"],
    style: "wild",
  },
  {
    username: "Gale",
    gold: 2900,
    specialty: ["fish", "salt", "shell", "coral", "stew"],
    style: "wild",
  },
  {
    username: "Bramble",
    gold: 2500,
    specialty: ["wood", "planks", "berries", "mushrooms", "charm"],
    style: "wide",
  },
  {
    username: "Yarrow",
    gold: 2700,
    specialty: ["flower", "honey", "herbs", "candle", "salve"],
    style: "wild",
  },
  {
    username: "Knurl",
    gold: 3400,
    specialty: ["stone", "coal", "iron", "gem", "jewel"],
    style: "thin",
  },
  {
    username: "Dusk",
    gold: 4000,
    specialty: ["coral", "gem", "candle", "blade", "charm"],
    style: "wild",
  },
  {
    username: "Rill",
    gold: 2200,
    specialty: ["fish", "wheat", "salt", "bread", "stew"],
    style: "wide",
  },
  {
    username: "Quill",
    gold: 2600,
    specialty: ["flax", "wood", "basket", "planks", "flower"],
    style: "wild",
  },
];

export const BOT_USERNAMES = new Set(BOT_PROFILES.map((bot) => bot.username));

export function isBotUsername(name: string) {
  return BOT_USERNAMES.has(name);
}

export function botSpread(style: BotProfile["style"]) {
  if (style === "tight") return { bid: 0.82, ask: 1.18, take: 0.05 };
  if (style === "wide") return { bid: 0.68, ask: 1.38, take: 0.08 };
  if (style === "thin") return { bid: 0.58, ask: 1.52, take: 0.12 };
  return { bid: 0.42, ask: 1.85, take: 0.18 };
}
