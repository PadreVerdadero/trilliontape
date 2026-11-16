export type SeatRole = "manager" | "investor" | "both";

export type Phase =
  | "lobby"
  | "draft"
  | "negotiation"
  | "market"
  | "fees"
  | "upkeep"
  | "auction"
  | "score";

export type StockDef = {
  id: string;
  name: string;
  color: string;
  track: number[];
  die: number[];
  startIndex: number;
  normalCards: number;
  doubleCards: number;
};

export type Card = {
  id: string;
  stockId: string;
  double: boolean;
  managerId: number | null;
  zone: "deck" | "held" | "removed";
  investorId: number | null;
  price: number | null;
  locked: boolean;
};

export type Offer = {
  id: string;
  cardId: string;
  fromId: number;
  toId: number;
  price: number;
  lock: boolean;
};

export type Seat = {
  userId: number;
  username: string;
  role: SeatRole;
  cash: number;
  tokens: number;
  lostTokens: number;
  investing: boolean;
};

export type WolfTable = {
  phase: Phase;
  round: number;
  combo: boolean;
  stocks: StockDef[];
  cards: Card[];
  deck: string[];
  seats: Seat[];
  offers: Offer[];
  negotiationEndsAt: number | null;
  positions: Record<string, number>;
  lastRolls: Record<string, number>;
  draft: { hands: Record<string, string[]>; kept: Record<string, string[]> } | null;
  mustSell: Record<string, number>;
  broke: number[];
  auction: {
    queue: string[];
    bids: Record<string, number>;
    rebidders: number[] | null;
    tieFloor: number;
  } | null;
  log: string[];
  scored: boolean;
  winners: { managers: string[]; investors: string[] } | null;
  seq: number;
};

export type RolePlan = { managers: number; investors: number } | "both";

export type WolfView = {
  you: {
    id: number;
    username: string;
    role: SeatRole | null;
    cash: number;
    tokens: number;
    lostTokens: number;
    investing: boolean;
    seated: boolean;
    office: boolean;
  };
  phase: Phase;
  round: number;
  combo: boolean;
  now: number;
  negotiationEndsAt: number | null;
  plan: RolePlan | null;
  seats: {
    userId: number;
    username: string;
    role: SeatRole;
    cash: number;
    tokens: number;
    lostTokens: number;
    investing: boolean;
  }[];
  stocks: (StockDef & { index: number; value: number; roll: number | null })[];
  companies: {
    id: string;
    stockId: string;
    double: boolean;
    managerId: number | null;
    managerName: string;
    investorId: number | null;
    investorName: string | null;
    price: number | null;
    locked: boolean;
  }[];
  offers: (Offer & { fromName: string; toName: string })[];
  draft: {
    hand: { id: string; stockId: string; double: boolean }[];
    kept: number;
    waiting: string[];
  } | null;
  mustSell: number;
  auction: {
    stockId: string;
    double: boolean;
    yourBid: number | null;
    youBid: boolean;
    tieFloor: number;
    waiting: string[];
    left: number;
  } | null;
  log: string[];
  winners: { managers: string[]; investors: string[] } | null;
  catalog: StockDef[] | null;
};
