export type ItemKind = "material" | "good" | "relic";
export type CosmeticSlot = "hat" | "outfit" | "accessory";
export type BusyType = "idle" | "travel" | "search";
export type OrderSide = "buy" | "sell";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type Item = {
  id: string;
  emoji: string;
  name: string;
  kind: ItemKind;
  description: string;
  purpose: string;
  basePrice: number;
  mine?: {
    locationId: string;
    seconds: number;
    yieldMin: number;
    yieldMax: number;
  };
};

export type Location = {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  region: string;
  searchEnergy?: number;
};

export type Recipe = {
  id: string;
  outputId: string;
  outputQty: number;
  inputs: { itemId: string; qty: number }[];
};

export type Cosmetic = {
  id: string;
  emoji: string;
  name: string;
  slot: CosmeticSlot;
  price: number;
  description: string;
};

export type InventoryRow = {
  itemId: string;
  quantity: number;
};

export type OrderRow = {
  id: number;
  playerId: number;
  username: string;
  itemId: string;
  side: OrderSide;
  price: number;
  remaining: number;
  createdAt: number;
};

export type TradeRow = {
  id: number;
  itemId: string;
  price: number;
  quantity: number;
  createdAt: number;
  buyUsername: string;
  sellUsername: string;
};

export type BusyState = {
  type: BusyType;
  endsAt: number | null;
  remainingMs: number;
  label: string;
  detail: string;
};

export type Equipped = {
  hat: string | null;
  outfit: string | null;
  accessory: string | null;
};

export type PlayerState = {
  id: number;
  username: string;
  gold: number;
  availableGold: number;
  locationId: string;
  inventory: InventoryRow[];
  reservedItems: Record<string, number>;
  cosmetics: string[];
  equipped: Equipped;
  hasWon: boolean;
  wonAt: number | null;
  busy: BusyState;
  lastEvent: string | null;
  energy: number;
  energyMax: number;
  buffs: { kind: string; charges: number; power: number; label: string }[];
  vp: number;
  goldFromStalls: number;
  foodDelivered: number;
  legendaryTurnins: number;
  boardFills: number;
  goldDonated: number;
  titles: string[];
};

export type MarketPrice = {
  itemId: string;
  vwap: number;
  last: number | null;
  volume: number;
  bestBid: number | null;
  bestAsk: number | null;
};

export type AreaCrowd = {
  locationId: string;
  searchers: number;
  strain: number;
  cooldownMs: number;
  nextSearchCost: number;
};

export type BankQuote = {
  itemId: string;
  rate: number;
  payEach: number;
  glut: number;
  cooldownMs: number;
};

export type StallQuote = {
  itemId: string;
  rate: number;
  payEach: number;
  special: boolean;
};

export type StallOffer = {
  itemId: string;
  price: number;
};

export type StallView = {
  id: string;
  emoji: string;
  name: string;
  role: string;
  blurb: string;
  hoursLabel: string;
  open: boolean;
  sundayMarket: boolean;
  nextChangeMs: number;
  nextOpens: boolean;
  chalkboardItemId: string;
  tomorrowItemId: string | null;
  buys: StallQuote[];
  sells: StallOffer[];
  crateReservedBy: string | null;
  crateYours: boolean;
  crateUsed: boolean;
  windowKey: string;
};

export type ContractView = {
  id: string;
  stallId: string;
  stallName: string;
  stallEmoji: string;
  title: string;
  detail: string;
  itemId: string;
  quantity: number;
  vp: number;
  gold: number;
  expiresAt: number;
  remainingMs: number;
  done: boolean;
};

export type FestivalTitle = {
  id: string;
  label: string;
  username: string | null;
};

export type FestivalState = {
  timeZone: string;
  clockLabel: string;
  sundayMarket: boolean;
  vpToWin: number;
  rumorCost: number;
  crateCost: number;
  donationNextCost: number;
  forage: AreaCrowd & { biasLocationId: string | null };
  stalls: StallView[];
  contracts: ContractView[];
  titles: FestivalTitle[];
  leaders: { username: string; vp: number }[];
};

export type GameState = {
  now: number;
  player: PlayerState;
  prices: MarketPrice[];
  myOrders: OrderRow[];
  recentTrades: TradeRow[];
  winners: { username: string; wonAt: number }[];
  areas: AreaCrowd[];
  bank: BankQuote[];
  festival: FestivalState;
};

export type PricePoint = {
  at: number;
  price: number;
};

export type OrderBook = {
  itemId: string;
  bids: OrderRow[];
  asks: OrderRow[];
  history: PricePoint[];
};
