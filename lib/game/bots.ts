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

export type BotSpread = {
  bid: number;
  ask: number;
  take: number;
  farBid: number;
  farAsk: number;
  farChance: number;
  hopeQuoteChance: number;
  lossChance: number;
  hope: number;
};

export function botSpread(style: BotProfile["style"]): BotSpread {
  if (style === "tight") {
    return {
      bid: 0.7,
      ask: 1.38,
      take: 0.16,
      farBid: 0.32,
      farAsk: 2.1,
      farChance: 0.07,
      hopeQuoteChance: 0.05,
      lossChance: 0.05,
      hope: 0.28,
    };
  }
  if (style === "wide") {
    return {
      bid: 0.48,
      ask: 1.75,
      take: 0.2,
      farBid: 0.18,
      farAsk: 2.7,
      farChance: 0.09,
      hopeQuoteChance: 0.06,
      lossChance: 0.07,
      hope: 0.38,
    };
  }
  if (style === "thin") {
    return {
      bid: 0.34,
      ask: 2.05,
      take: 0.24,
      farBid: 0.1,
      farAsk: 3.2,
      farChance: 0.1,
      hopeQuoteChance: 0.06,
      lossChance: 0.06,
      hope: 0.45,
    };
  }
  return {
    bid: 0.16,
    ask: 2.85,
    take: 0.3,
    farBid: 0.05,
    farAsk: 4.4,
    farChance: 0.12,
    hopeQuoteChance: 0.08,
    lossChance: 0.1,
    hope: 0.62,
  };
}

export function hopeCoins(spread: BotSpread, fair: number) {
  const value = Math.max(1, Math.round(fair));
  const fromPct = Math.max(1, Math.round(value * spread.hope));
  if (value > 12) return fromPct;
  const cheap = Math.round(2 + spread.hope * 4);
  return Math.max(fromPct, cheap);
}

export function botLossChance(spread: BotSpread, fair: number) {
  const value = Math.max(1, fair);
  if (value > 12) return spread.lossChance;
  return Math.min(0.48, spread.lossChance + (12 - value) * 0.03);
}

export function botQuoteMultipliers(spread: BotSpread, fair: number) {
  const roll = Math.random();
  if (roll < spread.farChance) {
    return {
      kind: "far" as const,
      bid: spread.farBid * (0.6 + Math.random() * 0.7),
      ask: spread.farAsk * (0.8 + Math.random() * 0.55),
    };
  }
  if (roll < spread.farChance + spread.hopeQuoteChance) {
    const slack = hopeCoins(spread, fair);
    const coins = 1 + Math.floor(Math.random() * slack);
    const mid = Math.max(1, fair);
    return {
      kind: "hope" as const,
      bid: (mid + coins) / mid,
      ask: Math.max(0.08, (mid - coins) / mid),
    };
  }
  const drift = 0.84 + Math.random() * 0.3;
  return {
    kind: "rest" as const,
    bid: spread.bid * drift,
    ask: spread.ask * drift,
  };
}

export function botWillTake(
  spread: BotSpread,
  fair: number,
  side: "liftAsk" | "hitBid",
  price: number,
  feelingLucky: boolean,
  slack = hopeCoins(spread, fair)
) {
  const fairPx = Math.max(1, Math.round(fair));
  const band = Math.max(1, Math.round(slack));
  if (side === "liftAsk") {
    const bargain = price <= Math.round(fairPx * (1 - spread.take));
    const overpay = feelingLucky && price <= fairPx + band;
    return bargain || overpay;
  }
  const rich = price >= Math.round(fairPx * (1 + spread.take));
  const dump = feelingLucky && price >= Math.max(1, fairPx - band);
  return rich || dump;
}

export function waitSteps(waitMs: number) {
  if (waitMs < 15_000) return 0;
  return Math.floor((waitMs - 15_000) / 12_000) + 1;
}

export function chaseSlack(spread: BotSpread, fair: number, waitMs: number) {
  const steps = waitSteps(waitMs);
  const base = hopeCoins(spread, fair);
  if (steps === 0) return base;
  const stepCoins = Math.max(1, Math.round(Math.max(1, fair) * (0.12 + spread.hope * 0.12)));
  return base + steps * stepCoins;
}

export function chaseBidPrice(oldPrice: number, fair: number, slack: number, steps: number) {
  const bump = Math.max(1, Math.ceil(steps / 3));
  const target = Math.round(fair + slack);
  return Math.max(1, Math.max(oldPrice + bump, target));
}

export function chaseAskPrice(oldPrice: number, fair: number, slack: number, steps: number) {
  const cut = Math.max(1, steps);
  const target = Math.max(1, Math.round(fair - slack * (0.35 + steps * 0.22)));
  return Math.max(1, Math.min(oldPrice - cut, target));
}
