import type {
  Card,
  Offer,
  Phase,
  RolePlan,
  Seat,
  SeatRole,
  StockDef,
  WolfTable,
} from "@/lib/wolf/types";

export const STARTING_CASH = 120;
export const NEGOTIATION_MS = 2 * 60 * 1000;
export const UPKEEP = 10;
export const SELL_PRICE = 5;
export const LOAN = 100;
export const SET_BONUS = 40;
export const INVESTOR_TOKENS = 10;
export const ROUNDS = 5;

const AUCTION_BY_MANAGERS: Record<number, number> = { 2: 3, 3: 5, 4: 7, 5: 8 };

export function defaultStocks(): StockDef[] {
  return [
    stock("red", "Red", "#e11d48", [-20, -10, 0, 30, 40, 50, 70, 80], [-7, -3, -2, 2, 3, 7], 6, 1),
    stock("yellow", "Yellow", "#eab308", [-10, 0, 10, 30, 40, 50, 60, 70], [-3, -2, -1, 1, 2, 3], 11, 2),
    stock("green", "Green", "#16a34a", [0, 10, 20, 30, 40, 40, 50, 60], [-2, -1, -1, 1, 1, 1], 11, 2),
    stock("blue", "Blue", "#0284c7", [10, 20, 20, 30, 30, 40, 40, 50], [-1, 0, 0, 0, 1, 1], 11, 2),
  ];
}

function stock(
  id: string,
  name: string,
  color: string,
  track: number[],
  die: number[],
  normalCards: number,
  doubleCards: number
): StockDef {
  return { id, name, color, track, die, startIndex: track.indexOf(30), normalCards, doubleCards };
}

export function emptyTable(): WolfTable {
  return {
    phase: "lobby",
    round: 0,
    combo: false,
    stocks: defaultStocks(),
    cards: [],
    deck: [],
    seats: [],
    offers: [],
    negotiationEndsAt: null,
    positions: {},
    lastRolls: {},
    draft: null,
    mustSell: {},
    broke: [],
    auction: null,
    log: [],
    scored: false,
    winners: null,
    seq: 1,
  };
}

export function rolePlan(count: number): RolePlan {
  if (count >= 3 && count <= 4) return "both";
  const table: Record<number, RolePlan> = {
    5: { managers: 2, investors: 3 },
    6: { managers: 3, investors: 3 },
    7: { managers: 3, investors: 4 },
    8: { managers: 4, investors: 4 },
    9: { managers: 4, investors: 5 },
    10: { managers: 5, investors: 5 },
    11: { managers: 5, investors: 6 },
  };
  const plan = table[count];
  if (!plan) throw new Error("Wolf Street seats 3 to 11 travelers.");
  return plan;
}

export function salesRequired(cash: number, companies: number) {
  if (companies <= 0) return 0;
  if (cash >= companies * UPKEEP) return 0;
  const need = companies * UPKEEP - cash;
  return Math.min(companies, Math.ceil(need / (UPKEEP + SELL_PRICE)));
}

export function managersOf(table: WolfTable) {
  return table.seats
    .filter((seat) => seat.role === "manager" || seat.role === "both")
    .sort((a, b) => a.username.localeCompare(b.username) || a.userId - b.userId);
}

export function investorsOf(table: WolfTable) {
  return table.seats.filter((seat) => seat.investing);
}

export function cardById(table: WolfTable, id: string) {
  const card = table.cards.find((row) => row.id === id);
  if (!card) throw new Error("That company is gone.");
  return card;
}

export function seatById(table: WolfTable, userId: number) {
  const seat = table.seats.find((row) => row.userId === userId);
  if (!seat) throw new Error("Sit down at Wolf Street first.");
  return seat;
}

function note(table: WolfTable, line: string) {
  table.log = [line, ...table.log].slice(0, 40);
}

function nextId(table: WolfTable, prefix: string) {
  const id = `${prefix}${table.seq}`;
  table.seq += 1;
  return id;
}

function shuffle<T>(list: T[], random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function heldBy(table: WolfTable, managerId: number) {
  return table.cards.filter((card) => card.zone === "held" && card.managerId === managerId);
}

function clearDeal(card: Card) {
  card.investorId = null;
  card.price = null;
  card.locked = false;
}

export function sit(table: WolfTable, userId: number, username: string, role: SeatRole) {
  if (table.phase !== "lobby") throw new Error("The table is already in a game.");
  if (role !== "manager" && role !== "investor") throw new Error("Pick manager or investor.");
  const existing = table.seats.find((seat) => seat.userId === userId);
  if (existing) {
    existing.role = role;
    existing.username = username;
    return;
  }
  if (table.seats.length >= 11) throw new Error("Wolf Street seats 11 travelers.");
  table.seats.push({
    userId,
    username,
    role,
    cash: 0,
    tokens: 0,
    lostTokens: 0,
    investing: role !== "manager",
  });
  table.seats.sort((a, b) => a.username.localeCompare(b.username) || a.userId - b.userId);
}

export function leave(table: WolfTable, userId: number) {
  if (table.phase !== "lobby") throw new Error("You can leave from the lobby.");
  table.seats = table.seats.filter((seat) => seat.userId !== userId);
}

export function assignRole(table: WolfTable, userId: number, role: SeatRole) {
  if (table.phase !== "lobby") throw new Error("Roles lock when the game starts.");
  const seat = seatById(table, userId);
  seat.role = role;
  seat.investing = role !== "manager";
}

function slug(name: string) {
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return id.slice(0, 24);
}

function cleanTrack(values: number[]) {
  if (values.length !== 8 || values.some((value) => !Number.isInteger(value) || value < -999 || value > 999)) {
    throw new Error("A track needs 8 whole numbers.");
  }
  return values;
}

function cleanDie(values: number[]) {
  if (values.length !== 6 || values.some((value) => !Number.isInteger(value) || value < -20 || value > 20)) {
    throw new Error("A die needs 6 whole faces.");
  }
  return values;
}

export function saveStock(
  table: WolfTable,
  stockId: string,
  draft: {
    name: string;
    color: string;
    track: number[];
    die: number[];
    startIndex: number;
    normalCards: number;
    doubleCards: number;
  }
) {
  if (table.phase !== "lobby") throw new Error("Stocks can change in the lobby.");
  const stockDef = table.stocks.find((row) => row.id === stockId);
  if (!stockDef) throw new Error("Unknown stock.");
  const track = cleanTrack(draft.track);
  const die = cleanDie(draft.die);
  const startIndex = Math.floor(draft.startIndex);
  if (startIndex < 0 || startIndex > 7) throw new Error("The start space is 1 through 8.");
  const normalCards = Math.floor(draft.normalCards);
  const doubleCards = Math.floor(draft.doubleCards);
  if (normalCards < 0 || normalCards > 30 || doubleCards < 0 || doubleCards > 10) {
    throw new Error("Card counts are 0–30 ordinary and 0–10 doubles.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(draft.color)) throw new Error("Use a color like #e11d48.");
  const name = draft.name.trim();
  if (name.length < 1 || name.length > 24) throw new Error("Name the stock in 1–24 letters.");
  stockDef.name = name;
  stockDef.color = draft.color;
  stockDef.track = track;
  stockDef.die = die;
  stockDef.startIndex = startIndex;
  stockDef.normalCards = normalCards;
  stockDef.doubleCards = doubleCards;
}

export function addStock(table: WolfTable, name: string, color: string) {
  if (table.phase !== "lobby") throw new Error("Stocks can change in the lobby.");
  if (table.stocks.length >= 8) throw new Error("Eight stocks is the table limit.");
  const id = slug(name);
  if (!id || table.stocks.some((row) => row.id === id)) throw new Error("That stock name is already on the board.");
  table.stocks.push({
    id,
    name: name.trim(),
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#a8a29e",
    track: [0, 10, 20, 30, 40, 50, 60, 70],
    die: [-1, -1, 0, 0, 1, 1],
    startIndex: 3,
    normalCards: 8,
    doubleCards: 1,
  });
}

export function removeStock(table: WolfTable, stockId: string) {
  if (table.phase !== "lobby") throw new Error("Stocks can change in the lobby.");
  if (table.stocks.length <= 1) throw new Error("Keep at least one stock.");
  table.stocks = table.stocks.filter((row) => row.id !== stockId);
}

function buildDeck(table: WolfTable, random: () => number) {
  const cards: Card[] = [];
  for (const stockDef of table.stocks) {
    for (let n = 0; n < stockDef.normalCards; n += 1) {
      cards.push({
        id: nextId(table, "c"),
        stockId: stockDef.id,
        double: false,
        managerId: null,
        zone: "deck",
        investorId: null,
        price: null,
        locked: false,
      });
    }
    for (let n = 0; n < stockDef.doubleCards; n += 1) {
      cards.push({
        id: nextId(table, "c"),
        stockId: stockDef.id,
        double: true,
        managerId: null,
        zone: "deck",
        investorId: null,
        price: null,
        locked: false,
      });
    }
  }
  table.cards = cards;
  table.deck = shuffle(cards.map((card) => card.id), random);
}

function drawOpening(table: WolfTable, random: () => number) {
  const side: string[] = [];
  const take = () => {
    while (table.deck.length > 0) {
      const id = table.deck.shift() as string;
      const card = cardById(table, id);
      if (!card.double) return card;
      side.push(id);
    }
    throw new Error("Not enough ordinary companies for the opening deal.");
  };
  const hands: Record<string, string[]> = {};
  const kept: Record<string, string[]> = {};
  for (const manager of managersOf(table)) {
    const hand: string[] = [];
    for (let n = 0; n < 3; n += 1) hand.push(take().id);
    hands[String(manager.userId)] = hand;
    kept[String(manager.userId)] = [];
  }
  table.deck = shuffle([...table.deck, ...side], random);
  table.draft = { hands, kept };
}

export function startGame(table: WolfTable, now: number, random = Math.random) {
  if (table.phase !== "lobby") throw new Error("A game is already going.");
  if (table.seats.length < 3) throw new Error("Wolf Street needs at least 3 travelers.");
  const plan = rolePlan(table.seats.length);
  table.combo = plan === "both";
  if (plan === "both") {
    for (const seat of table.seats) {
      seat.role = "both";
      seat.investing = true;
    }
  } else {
    const managers = table.seats.filter((seat) => seat.role === "manager").length;
    const investors = table.seats.filter((seat) => seat.role === "investor").length;
    if (managers !== plan.managers || investors !== plan.investors) {
      throw new Error(`This table needs ${plan.managers} managers and ${plan.investors} investors.`);
    }
  }
  const normals = table.stocks.reduce((sum, row) => sum + row.normalCards, 0);
  if (normals < managersOf(table).length * 3) {
    throw new Error("Deal needs 3 ordinary companies for each manager.");
  }
  for (const seat of table.seats) {
    seat.cash = STARTING_CASH;
    seat.tokens = seat.investing ? INVESTOR_TOKENS : 0;
    seat.lostTokens = 0;
  }
  table.cards = [];
  table.deck = [];
  table.offers = [];
  table.broke = [];
  table.mustSell = {};
  table.auction = null;
  table.scored = false;
  table.winners = null;
  table.log = [];
  table.round = 1;
  table.positions = {};
  table.lastRolls = {};
  for (const stockDef of table.stocks) table.positions[stockDef.id] = stockDef.startIndex;
  buildDeck(table, random);
  drawOpening(table, random);
  table.phase = "draft";
  note(table, "The opening deal is out. Each manager keeps one company and passes the rest left.");
  void now;
}

export function draftPick(table: WolfTable, userId: number, cardId: string, now: number) {
  if (table.phase !== "draft" || !table.draft) throw new Error("The draft is over.");
  const key = String(userId);
  const hand = table.draft.hands[key];
  if (!hand || !hand.includes(cardId)) throw new Error("That company is not in your hand.");
  if (table.draft.kept[key].length > minKept(table)) {
    throw new Error("Wait for the other managers to keep one.");
  }
  table.draft.hands[key] = hand.filter((id) => id !== cardId);
  table.draft.kept[key].push(cardId);
  const keptNow = table.draft.kept[key].length;
  if (managersOf(table).every((seat) => table.draft?.kept[String(seat.userId)].length === keptNow)) {
    passOrFinish(table, now);
  }
}

function minKept(table: WolfTable) {
  const lengths = managersOf(table).map((seat) => table.draft?.kept[String(seat.userId)].length ?? 0);
  return Math.min(...lengths);
}

function passOrFinish(table: WolfTable, now: number) {
  const draft = table.draft;
  if (!draft) return;
  const managers = managersOf(table);
  if (managers.every((seat) => draft.kept[String(seat.userId)].length >= 3)) {
    for (const manager of managers) {
      for (const id of draft.kept[String(manager.userId)]) {
        const card = cardById(table, id);
        card.zone = "held";
        card.managerId = manager.userId;
      }
    }
    table.draft = null;
    openNegotiation(table, now);
    return;
  }
  const hands = managers.map((seat) => draft.hands[String(seat.userId)]);
  for (let i = 0; i < managers.length; i += 1) {
    const receiver = managers[(i + 1) % managers.length];
    draft.hands[String(receiver.userId)] = hands[i];
  }
  note(table, "Companies pass to the left.");
}

function openNegotiation(table: WolfTable, now: number) {
  table.phase = "negotiation";
  table.offers = [];
  table.negotiationEndsAt = now + NEGOTIATION_MS;
  note(table, `Round ${table.round}. Two minutes to deal.`);
}

export function makeOffer(
  table: WolfTable,
  userId: number,
  input: { cardId: string; price: number; kind?: "bid" | "ask" | "close"; toId?: number | null; lock?: boolean }
) {
  if (table.phase !== "negotiation") throw new Error("Deals wait for the negotiation.");
  const from = seatById(table, userId);
  const card = cardById(table, input.cardId);
  if (card.zone !== "held" || card.managerId == null) throw new Error("That company is not for sale.");
  if (card.locked) throw new Error("That deal is locked.");
  const price = Math.floor(Number(input.price));
  if (!Number.isInteger(price) || price < 0 || price > 999) throw new Error("The price is a whole number from 0 to 999.");
  const managerId = card.managerId;
  const isManager = from.userId === managerId;
  const isInvestor = from.investing && !isManager;
  if (!isManager && !isInvestor) throw new Error("Only the manager and an investor can deal on that company.");
  let kind = input.kind;
  if (kind !== "bid" && kind !== "ask" && kind !== "close") kind = input.lock ? "close" : isManager ? "ask" : "bid";
  if (kind === "ask" && !isManager) throw new Error("Only the manager can ask.");
  if (kind === "bid" && !isInvestor) throw new Error("Only an investor can bid.");
  if (isInvestor && from.tokens < 1 && card.investorId !== from.userId) throw new Error("You have no token free.");
  table.offers = table.offers.filter((offer) => !(offer.fromId === from.userId && offer.cardId === card.id));
  table.offers.push({
    id: nextId(table, "o"),
    cardId: card.id,
    fromId: from.userId,
    toId: isManager ? null : managerId,
    price,
    lock: kind === "close",
    kind,
  });
}

export function cancelOffer(table: WolfTable, userId: number, offerId: string) {
  const offer = table.offers.find((row) => row.id === offerId);
  if (!offer || offer.fromId !== userId) throw new Error("That offer is not yours.");
  table.offers = table.offers.filter((row) => row.id !== offerId);
}

export function acceptOffer(table: WolfTable, userId: number, offerId: string, now: number) {
  if (table.phase !== "negotiation") throw new Error("The floor is closed.");
  const offer = table.offers.find((row) => row.id === offerId);
  if (!offer) throw new Error("That offer is gone.");
  const card = cardById(table, offer.cardId);
  if (card.locked) throw new Error("That deal is locked.");
  if (card.zone !== "held" || card.managerId == null) throw new Error("That company is not for sale.");
  if (!mayTake(table, userId, offer, card)) throw new Error("That quote is not yours to take.");
  const investorId = card.managerId === offer.fromId ? userId : offer.fromId;
  const investor = seatById(table, investorId);
  if (!investor.investing) throw new Error("That traveler is not investing.");
  if (card.investorId !== investor.userId) {
    if (investor.tokens < 1) throw new Error(`${investor.username} has no token free.`);
    releaseDeal(table, card);
    investor.tokens -= 1;
    card.investorId = investor.userId;
  }
  card.price = offer.price;
  card.locked = offer.lock;
  table.offers = table.offers.filter((row) => row.cardId !== card.id);
  note(
    table,
    `${investor.username} ${card.locked ? "locks" : "marks"} ${labelOf(table, card)} at ${offer.price}.`
  );
  maybeCloseFloor(table, now);
}

function mayTake(table: WolfTable, userId: number, offer: Offer, card: Card) {
  if (card.managerId == null || userId === offer.fromId) return false;
  if (offer.toId != null) return offer.toId === userId;
  if (offer.fromId === card.managerId) {
    const seat = seatById(table, userId);
    return seat.investing && userId !== card.managerId;
  }
  return userId === card.managerId;
}

function releaseDeal(table: WolfTable, card: Card) {
  if (card.investorId == null) return;
  const previous = table.seats.find((seat) => seat.userId === card.investorId);
  if (previous) previous.tokens += 1;
  clearDeal(card);
}

export function pullDeal(table: WolfTable, userId: number, cardId: string) {
  if (table.phase !== "negotiation") throw new Error("The floor is closed.");
  const card = cardById(table, cardId);
  if (card.investorId == null) throw new Error("No one is on that company.");
  if (card.locked) throw new Error("That deal is locked.");
  if (userId !== card.investorId && userId !== card.managerId) throw new Error("Only the two sides can pull this deal.");
  const investor = seatById(table, card.investorId);
  note(table, `${investor.username} is off ${labelOf(table, card)}.`);
  releaseDeal(table, card);
}

export function lockDeal(table: WolfTable, userId: number, cardId: string, now: number) {
  if (table.phase !== "negotiation") throw new Error("The floor is closed.");
  const card = cardById(table, cardId);
  if (card.investorId == null || card.price == null) throw new Error("There is no deal to lock.");
  if (userId !== card.investorId && userId !== card.managerId) throw new Error("Only the two sides can lock this deal.");
  card.locked = true;
  note(table, `${labelOf(table, card)} is locked at ${card.price}.`);
  maybeCloseFloor(table, now);
}

function labelOf(table: WolfTable, card: Card) {
  const stockDef = table.stocks.find((row) => row.id === card.stockId);
  return `${card.double ? "2× " : ""}${stockDef?.name ?? card.stockId}`;
}

function maybeCloseFloor(table: WolfTable, now: number, random = Math.random) {
  const held = table.cards.filter((card) => card.zone === "held");
  if (held.length > 0 && held.every((card) => card.locked && card.investorId != null && card.price != null)) {
    closeNegotiation(table, now, "Every company is locked.", random);
  }
}

export function tick(table: WolfTable, now: number, random = Math.random) {
  if (table.phase === "negotiation" && table.negotiationEndsAt != null && now >= table.negotiationEndsAt) {
    closeNegotiation(table, now, "Time.", random);
    return true;
  }
  return false;
}

function closeNegotiation(table: WolfTable, now: number, why: string, random = Math.random) {
  table.offers = [];
  table.negotiationEndsAt = null;
  for (const card of table.cards) {
    if (card.investorId == null || card.price == null) releaseDeal(table, card);
  }
  rollMarket(table, random);
  note(table, why);
  table.phase = "market";
}

function rollMarket(table: WolfTable, random = Math.random) {
  const parts: string[] = [];
  for (const stockDef of table.stocks) {
    const face = stockDef.die[Math.floor(random() * stockDef.die.length)] ?? 0;
    const from = table.positions[stockDef.id] ?? stockDef.startIndex;
    const next = Math.max(0, Math.min(stockDef.track.length - 1, from + face));
    table.positions[stockDef.id] = next;
    table.lastRolls[stockDef.id] = face;
    parts.push(`${stockDef.name} ${face > 0 ? "+" : ""}${face} → ${stockDef.track[next]}`);
  }
  note(table, parts.join(". ") + ".");
  for (const seat of investorsOf(table)) {
    const net = incomeOf(table, seat.userId);
    if (seat.cash + net < 0) {
      bust(table, seat, "cannot cover the market.", true);
    } else {
      seat.cash += net;
      if (net !== 0) note(table, `${seat.username} ${net > 0 ? "collects" : "pays"} ${Math.abs(net)} on the market.`);
    }
  }
}

function trackValue(table: WolfTable, stockId: string) {
  const stockDef = table.stocks.find((row) => row.id === stockId);
  if (!stockDef) return 0;
  const index = table.positions[stockId] ?? stockDef.startIndex;
  return stockDef.track[index] ?? 0;
}

export function incomeOf(table: WolfTable, userId: number) {
  return table.cards
    .filter((card) => card.investorId === userId && card.price != null)
    .reduce((sum, card) => sum + trackValue(table, card.stockId) * (card.double ? 2 : 1), 0);
}

function bust(table: WolfTable, seat: Seat, why: string, takeTokenNow: boolean) {
  if (table.combo) {
    note(table, `${seat.username} ${why} Their cash and investor tokens are gone. They stay a manager.`);
    for (const card of table.cards) {
      if (card.investorId === seat.userId) clearDeal(card);
    }
    seat.cash = 0;
    seat.tokens = 0;
    seat.investing = false;
    seat.role = "manager";
    return;
  }
  note(table, `${seat.username} ${why} Cash is wiped, managers are unpaid, and the bank lends ${LOAN}.`);
  seat.cash = LOAN;
  seat.lostTokens += 1;
  if (takeTokenNow) {
    if (seat.tokens > 0) seat.tokens -= 1;
    else {
      const deal = table.cards.find((card) => card.investorId === seat.userId);
      if (deal) clearDeal(deal);
    }
    return;
  }
  table.broke.push(seat.userId);
}

export function takeFees(table: WolfTable) {
  if (table.phase !== "market") throw new Error("Fees are not due.");
  for (const seat of investorsOf(table)) {
    const deals = table.cards.filter((card) => card.investorId === seat.userId && card.price != null);
    const owed = deals.reduce((sum, card) => sum + (card.price ?? 0), 0);
    if (seat.cash < owed) {
      bust(table, seat, "cannot pay the managers.", false);
      continue;
    }
    for (const card of deals) {
      const manager = table.seats.find((row) => row.userId === card.managerId);
      if (manager) manager.cash += card.price ?? 0;
      seat.cash -= card.price ?? 0;
      if ((card.price ?? 0) > 0 && manager) {
        note(table, `${seat.username} pays ${manager.username} ${card.price}.`);
      }
    }
  }
  for (const card of table.cards) {
    if (card.investorId != null) {
      const seat = table.seats.find((row) => row.userId === card.investorId);
      if (seat) seat.tokens += 1;
      clearDeal(card);
    }
  }
  for (const userId of table.broke) {
    const seat = table.seats.find((row) => row.userId === userId);
    if (!seat || table.combo) continue;
    if (seat.tokens > 0) {
      seat.tokens -= 1;
    }
  }
  table.broke = [];
  table.phase = "fees";
}

export function enterUpkeep(table: WolfTable, now = Date.now()) {
  if (table.phase !== "fees") throw new Error("Upkeep is not due.");
  table.mustSell = {};
  for (const manager of managersOf(table)) {
    const owned = heldBy(table, manager.userId);
    const need = salesRequired(manager.cash, owned.length);
    if (need > 0) table.mustSell[String(manager.userId)] = need;
    else if (owned.length > 0) {
      manager.cash -= owned.length * UPKEEP;
      note(table, `${manager.username} pays ${owned.length * UPKEEP} upkeep.`);
    }
  }
  if (Object.keys(table.mustSell).length === 0) finishUpkeep(table, now);
  else table.phase = "upkeep";
}

export function sellForUpkeep(table: WolfTable, userId: number, cardIds: string[], now = Date.now()) {
  if (table.phase !== "upkeep") throw new Error("No one is selling to the bank.");
  const need = table.mustSell[String(userId)] ?? 0;
  if (need < 1) throw new Error("You can cover your upkeep.");
  const unique = [...new Set(cardIds)];
  if (unique.length !== need) throw new Error(`Sell exactly ${need} ${need === 1 ? "company" : "companies"} to the bank.`);
  const manager = seatById(table, userId);
  for (const id of unique) {
    const card = cardById(table, id);
    if (card.managerId !== userId || card.zone !== "held") throw new Error("You can only sell your own companies.");
    card.zone = "deck";
    card.managerId = null;
    clearDeal(card);
    table.deck.push(card.id);
    manager.cash += SELL_PRICE;
    note(table, `${manager.username} sells ${labelOf(table, card)} to the bank for ${SELL_PRICE}.`);
  }
  const left = heldBy(table, userId).length;
  const due = left * UPKEEP;
  if (manager.cash < due) throw new Error("That sale still leaves the upkeep unpaid.");
  manager.cash -= due;
  if (due > 0) note(table, `${manager.username} pays ${due} upkeep.`);
  delete table.mustSell[String(userId)];
  if (Object.keys(table.mustSell).length === 0) finishUpkeep(table, now);
}

function finishUpkeep(table: WolfTable, now: number) {
  table.phase = "upkeep";
  if (table.round >= ROUNDS) {
    score(table);
    return;
  }
  const count = AUCTION_BY_MANAGERS[managersOf(table).length] ?? managersOf(table).length * 2 - 1;
  const queue: string[] = [];
  while (queue.length < count && table.deck.length > 0) queue.push(table.deck.shift() as string);
  if (queue.length === 0) {
    note(table, "The deck is empty. No auction.");
    nextRound(table, now);
    return;
  }
  table.auction = { queue, bids: {}, rebidders: null, tieFloor: 0 };
  table.phase = "auction";
  const first = cardById(table, queue[0]);
  note(table, `Auction: ${labelOf(table, first)}.`);
}

export function bid(table: WolfTable, userId: number, amount: number, now: number) {
  if (table.phase !== "auction" || !table.auction) throw new Error("There is no auction.");
  const manager = seatById(table, userId);
  if (manager.role === "investor") throw new Error("Investors do not bid at the auction.");
  const price = Math.floor(Number(amount));
  if (!Number.isInteger(price) || price < 0) throw new Error("Bid a whole number, or 0 to pass.");
  if (price > manager.cash) throw new Error("That bid is more cash than you have.");
  const auction = table.auction;
  if (auction.rebidders && !auction.rebidders.includes(userId)) throw new Error("You are not in the tie.");
  if (auction.rebidders && price !== 0 && price <= auction.tieFloor) {
    throw new Error(`Bid more than ${auction.tieFloor}, or 0 to drop out.`);
  }
  auction.bids[String(userId)] = price;
  const needed = auction.rebidders ?? managersOf(table).map((seat) => seat.userId);
  if (needed.every((id) => auction.bids[String(id)] != null)) resolveBid(table, now);
}

function resolveBid(table: WolfTable, now: number) {
  const auction = table.auction;
  if (!auction) return;
  const needed = auction.rebidders ?? managersOf(table).map((seat) => seat.userId);
  let best = -1;
  let leaders: number[] = [];
  for (const id of needed) {
    const price = auction.bids[String(id)] ?? 0;
    if (price > best) {
      best = price;
      leaders = [id];
    } else if (price === best) leaders.push(id);
  }
  const card = cardById(table, auction.queue[0]);
  if (best <= 0) {
    card.zone = "removed";
    note(table, `No bid. ${labelOf(table, card)} leaves the game.`);
    advanceAuction(table, now);
    return;
  }
  if (leaders.length > 1) {
    auction.rebidders = leaders;
    auction.tieFloor = best;
    auction.bids = {};
    const names = leaders.map((id) => seatById(table, id).username).join(", ");
    note(table, `Tie at ${best}. ${names} bid again.`);
    return;
  }
  const winner = seatById(table, leaders[0]);
  winner.cash -= best;
  card.zone = "held";
  card.managerId = winner.userId;
  note(table, `${winner.username} pays ${best} and takes ${labelOf(table, card)}.`);
  advanceAuction(table, now);
}

function advanceAuction(table: WolfTable, now: number) {
  const auction = table.auction;
  if (!auction) return;
  auction.queue.shift();
  auction.bids = {};
  auction.rebidders = null;
  auction.tieFloor = 0;
  if (auction.queue.length === 0) {
    table.auction = null;
    nextRound(table, now);
    return;
  }
  const card = cardById(table, auction.queue[0]);
  note(table, `Auction: ${labelOf(table, card)}.`);
}

function nextRound(table: WolfTable, now: number) {
  table.round += 1;
  openNegotiation(table, now);
}

function rainbowSets(table: WolfTable, userId: number) {
  const ids = table.stocks.map((row) => row.id);
  if (ids.length === 0) return 0;
  const owned = heldBy(table, userId);
  return Math.min(...ids.map((id) => owned.filter((card) => card.stockId === id).length));
}

function score(table: WolfTable) {
  if (table.scored) return;
  for (const manager of managersOf(table)) {
    const sets = rainbowSets(table, manager.userId);
    if (sets > 0) {
      manager.cash += sets * SET_BONUS;
      note(table, `${manager.username} earns ${sets * SET_BONUS} for ${sets} full set${sets === 1 ? "" : "s"}.`);
    }
  }
  if (!table.combo) {
    for (const seat of table.seats) {
      if (seat.lostTokens > 0) {
        seat.cash -= seat.lostTokens * LOAN;
        note(table, `${seat.username} repays ${seat.lostTokens * LOAN} to the bank.`);
      }
    }
  }
  table.scored = true;
  table.phase = "score";
  if (table.combo) {
    const best = Math.max(...table.seats.map((seat) => seat.cash));
    const names = table.seats.filter((seat) => seat.cash === best).map((seat) => seat.username);
    table.winners = { managers: names, investors: [] };
    note(table, `${names.join(", ")} wins the table.`);
    return;
  }
  const managerSeats = table.seats.filter((seat) => seat.role === "manager");
  const investorSeats = table.seats.filter((seat) => seat.role === "investor" || seat.role === "both");
  const top = (seats: Seat[]) => {
    const best = Math.max(...seats.map((seat) => seat.cash));
    return seats.filter((seat) => seat.cash === best).map((seat) => seat.username);
  };
  const managerNames = top(managerSeats);
  const investorNames = top(investorSeats);
  table.winners = { managers: managerNames, investors: investorNames };
  note(table, `${managerNames.join(", ")} wins among managers. ${investorNames.join(", ")} wins among investors.`);
}

export function resetLobby(table: WolfTable) {
  const stocks = table.stocks;
  const seats = table.seats.map((seat) => {
    const role = seat.role === "both" ? "investor" : seat.role;
    return {
      ...seat,
      role,
      cash: 0,
      tokens: 0,
      lostTokens: 0,
      investing: role !== "manager",
    };
  });
  const next = emptyTable();
  next.stocks = stocks;
  next.seats = seats;
  return next;
}

export function publicStocks(table: WolfTable) {
  return table.stocks.map((stockDef) => {
    const index = table.positions[stockDef.id] ?? stockDef.startIndex;
    return {
      ...stockDef,
      index,
      value: stockDef.track[index] ?? 0,
      roll: table.lastRolls[stockDef.id] ?? null,
    };
  });
}
