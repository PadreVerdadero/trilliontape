export type BotProfile = {
  username: string;
  gold: number;
  specialty: string[];
  style: "tight" | "wide" | "thin";
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
];

export const BOT_USERNAMES = new Set(BOT_PROFILES.map((bot) => bot.username));

export function isBotUsername(name: string) {
  return BOT_USERNAMES.has(name);
}

export function botSpread(style: BotProfile["style"]) {
  if (style === "tight") return { bid: 0.94, ask: 1.06, take: 0.08 };
  if (style === "wide") return { bid: 0.88, ask: 1.12, take: 0.1 };
  return { bid: 0.82, ask: 1.18, take: 0.14 };
}
