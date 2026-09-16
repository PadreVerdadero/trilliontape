export type ItemKind = "material" | "good" | "relic";
export type CosmeticSlot = "hat" | "outfit" | "accessory";
export type BusyType = "idle" | "travel" | "search";
export type OrderSide = "buy" | "sell";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type Item = {
  id: string;
  emoji: string;
  image?: string | null;
  name: string;
  kind: ItemKind;
  description: string;
  purpose: string;
  basePrice: number;
  authorized?: number;
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
  avgCost?: number | null;
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
  isGov: boolean;
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
  isGov: boolean;
  isAdmin: boolean;
  canOffice: boolean;
};

export type MarketPrice = {
  itemId: string;
  vwap: number;
  last: number | null;
  lastQty: number;
  windowOpen: number | null;
  volume: number;
  tradesToday: number;
  prints: number;
  listed: number;
  wanted: number;
  held: number;
  authorized: number;
  issued: number;
  treasury: number;
  bestBid: number | null;
  bestAsk: number | null;
};

export type SwapLeg = {
  itemId: string;
  name: string;
  emoji: string;
  quantity: number;
};

export type SwapRole = "inbox" | "mine" | "open";

export type SwapOffer = {
  id: number;
  fromId: number;
  fromName: string;
  toId: number | null;
  toName: string | null;
  giveGold: number;
  wantGold: number;
  give: SwapLeg[];
  want: SwapLeg[];
  createdAt: number;
  yours: boolean;
  incoming: boolean;
  role: SwapRole;
};

export type TravelerRow = {
  id: number;
  username: string;
  bot: boolean;
};

export type AdminSeat = {
  id: number;
  username: string;
  gold: number;
  bot: boolean;
  seated: boolean;
  holdings: Record<string, number>;
};

export type AreaCrowd = {
  locationId: string;
  searchers: number;
  strain: number;
  cooldownMs: number;
  nextSearchCost: number;
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

export type LeaderRow = {
  place: number;
  username: string;
  gold: number;
  goods: number;
  holdings: Record<string, number>;
  netWorth: number;
};

export type GoalNeed = {
  itemId: string;
  quantity: number;
};

export type GoalView = {
  mode: "threshold" | "timed";
  score: "netWorth" | "gold" | "items";
  threshold: number;
  durationMs: number;
  endsAt: number | null;
  needs: GoalNeed[];
  label: string;
};

export type GameOverView = {
  over: boolean;
  winner: string | null;
  endedAt: number | null;
  reason: "threshold" | "time" | null;
};

export type CoinDropState = {
  ladder: number[];
  loginDays: number;
  lastSlotKey: string | null;
  paidThisSlot: boolean;
};

export type GameState = {
  now: number;
  player: PlayerState;
  prices: MarketPrice[];
  myOrders: OrderRow[];
  recentTrades: TradeRow[];
  winners: { username: string; wonAt: number }[];
  areas: AreaCrowd[];
  festival: FestivalState;
  swaps: SwapOffer[];
  travelers: TravelerRow[];
  coinVolume: number;
  computers: boolean;
  computerCount: number;
  travelerCount: number;
  stipendMs: number;
  startingGold: number;
  coinDrop: CoinDropState;
  adminRoster: AdminSeat[];
  gamePhase: "lobby" | "live";
  scheduledStartAt: number | null;
  lobbyTravelers: TravelerRow[];
  inviteCode: string | null;
  netWorthGoal: number;
  goal: GoalView;
  gameOver: GameOverView;
  leaders: LeaderRow[];
  items: Item[];
  deposit: { amount: number; day: number; gold: number } | null;
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
  trades: TradeRow[];
  chartTrades: TradeRow[];
};
