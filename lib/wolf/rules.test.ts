import assert from "node:assert/strict";
import {
  INVESTOR_TOKENS,
  LOAN,
  STARTING_CASH,
  acceptOffer,
  bid,
  lockDeal,
  draftPick,
  makeOffer,
  emptyTable,
  enterUpkeep,
  incomeOf,
  rolePlan,
  salesRequired,
  sellForUpkeep,
  saveStock,
  sit,
  startGame,
  takeFees,
  tick,
} from "./rules";
import type { WolfTable } from "./types";

const names = ["Ada", "Ben", "Cam", "Dee", "Eve"];

function tableOf(count: number, roles?: ("manager" | "investor")[]) {
  const table = emptyTable();
  for (let i = 0; i < count; i += 1) sit(table, i + 1, names[i], roles?.[i] ?? "investor");
  return table;
}

function zero() {
  return 0;
}

salesRequired(120, 3);
assert.equal(salesRequired(120, 3), 0);
assert.equal(salesRequired(0, 1), 1);
assert.equal(salesRequired(25, 3), 1);
assert.equal(salesRequired(0, 3), 2);
assert.equal(rolePlan(3), "both");
assert.deepEqual(rolePlan(5), { managers: 2, investors: 3 });
assert.deepEqual(rolePlan(11), { managers: 5, investors: 6 });

{
  const table = tableOf(3);
  startGame(table, 1_000, zero);
  assert.equal(table.combo, true);
  assert.equal(table.phase, "draft");
  assert.equal(table.seats[0].cash, STARTING_CASH);
  assert.equal(table.seats[0].tokens, INVESTOR_TOKENS);
  const hands = Object.values(table.draft?.hands ?? {});
  assert.equal(hands.length, 3);
  assert.ok(hands.every((hand) => hand.length === 3));
  for (let round = 0; round < 3; round += 1) {
    for (const seat of table.seats) {
      const hand = table.draft?.hands[String(seat.userId)] ?? [];
      if (hand[0]) draftPick(table, seat.userId, hand[0], 1_000);
    }
  }
  assert.equal(table.phase, "negotiation");
  assert.equal(table.cards.filter((card) => card.zone === "held").length, 9);
  table.negotiationEndsAt = 1;
  tick(table, 2, zero);
  assert.equal(table.phase, "market");
  assert.equal(table.lastRolls.red, -7);
  assert.equal(table.positions.red, 0);
  assert.equal(table.stocks.find((stock) => stock.id === "red")?.track[0], -20);
  assert.equal(table.lastRolls.yellow, -3);
  assert.equal(table.positions.yellow, 0);
  assert.equal(table.lastRolls.blue, -1);
  assert.equal(table.positions.blue, 2);
  assert.equal(table.stocks.find((stock) => stock.id === "blue")?.track[2], 20);
}

{
  const table = tableOf(5, ["manager", "manager", "investor", "investor", "investor"]);
  startGame(table, 5_000, zero);
  assert.equal(table.combo, false);
  for (let round = 0; round < 3; round += 1) {
    const pending = table.seats.filter((seat) => seat.role === "manager");
    for (const seat of pending) {
      const hand = table.draft?.hands[String(seat.userId)];
      if (!hand?.[0]) continue;
      draftPick(table, seat.userId, hand[0], 5_000);
    }
  }
  const held = table.cards.filter((card) => card.zone === "held");
  const investor = table.seats.find((seat) => seat.role === "investor");
  const card = held[0];
  assert.ok(investor && card.managerId);
  card.investorId = investor.userId;
  card.price = 50;
  investor.tokens -= 1;
  table.negotiationEndsAt = 1;
  tick(table, 2, zero);
  assert.equal(table.phase, "market");
  const value = incomeOf(table, investor.userId);
  assert.equal(investor.cash, STARTING_CASH + value);
  investor.cash = 10;
  card.investorId = investor.userId;
  card.price = 50;
  table.phase = "market";
  const manager = table.seats.find((seat) => seat.userId === card.managerId);
  const before = manager?.cash ?? 0;
  takeFees(table);
  assert.equal(manager?.cash, before);
  assert.equal(investor.cash, LOAN);
  assert.equal(investor.lostTokens, 1);
  assert.equal(investor.tokens, INVESTOR_TOKENS - 1);
}

{
  const table = emptyTable();
  sit(table, 1, "Ada", "manager");
  table.phase = "upkeep";
  table.mustSell = { "1": 1 };
  table.cards = [
    {
      id: "c1",
      stockId: "red",
      double: false,
      managerId: 1,
      zone: "held",
      investorId: null,
      price: null,
      locked: false,
    },
  ];
  table.seats[0].cash = 0;
  sellForUpkeep(table, 1, ["c1"], 9);
  assert.equal(table.seats[0].cash, 5);
  assert.equal(table.cards[0].zone, "deck");
}

{
  const table = auctionTable();
  bid(table, 1, 12, 1);
  bid(table, 2, 12, 1);
  assert.equal(table.auction?.tieFloor, 12);
  bid(table, 1, 0, 1);
  bid(table, 2, 15, 1);
  assert.equal(table.seats[1].cash, STARTING_CASH - 15);
  assert.equal(table.cards[0].managerId, 2);
}

function auctionTable(): WolfTable {
  const table = emptyTable();
  sit(table, 1, "Ada", "manager");
  sit(table, 2, "Ben", "manager");
  table.seats.forEach((seat) => {
    seat.cash = STARTING_CASH;
  });
  table.phase = "auction";
  table.cards = [
    {
      id: "c1",
      stockId: "blue",
      double: true,
      managerId: null,
      zone: "deck",
      investorId: null,
      price: null,
      locked: false,
    },
  ];
  table.auction = { queue: ["c1"], bids: {}, rebidders: null, tieFloor: 0 };
  return table;
}

enterUpkeep;

{
  const table = tableOf(3);
  startGame(table, 1_000, zero);
  for (let round = 0; round < 3; round += 1) {
    for (const seat of table.seats) {
      const hand = table.draft?.hands[String(seat.userId)] ?? [];
      if (hand[0]) draftPick(table, seat.userId, hand[0], 1_000);
    }
  }
  assert.equal(table.phase, "negotiation");
  const ada = table.seats.find((seat) => seat.username === "Ada");
  const ben = table.seats.find((seat) => seat.username === "Ben");
  const cam = table.seats.find((seat) => seat.username === "Cam");
  assert.ok(ada && ben && cam);
  const adaCard = table.cards.find((card) => card.zone === "held" && card.managerId === ada.userId);
  const benCard = table.cards.find((card) => card.zone === "held" && card.managerId === ben.userId);
  const camCard = table.cards.find((card) => card.zone === "held" && card.managerId === cam.userId);
  assert.ok(adaCard && benCard && camCard);

  makeOffer(table, ben.userId, { cardId: adaCard.id, price: 25, kind: "bid" });
  assert.equal(table.offers[0]?.kind, "bid");
  assert.equal(table.offers[0]?.toId, ada.userId);
  assert.throws(() => makeOffer(table, ada.userId, { cardId: adaCard.id, price: 10, kind: "bid" }), /investor/);
  acceptOffer(table, ada.userId, table.offers[0].id, 1_000);
  assert.equal(adaCard.investorId, ben.userId);
  assert.equal(adaCard.price, 25);
  assert.equal(adaCard.locked, false);
  assert.equal(ben.tokens, INVESTOR_TOKENS - 1);

  makeOffer(table, ben.userId, { cardId: benCard.id, price: 40, kind: "ask" });
  const ask = table.offers.find((offer) => offer.cardId === benCard.id);
  assert.equal(ask?.kind, "ask");
  assert.equal(ask?.toId, null);
  assert.throws(() => acceptOffer(table, ben.userId, ask!.id, 1_000), /not yours to take/);
  acceptOffer(table, ada.userId, ask!.id, 1_000);
  assert.equal(benCard.investorId, ada.userId);
  assert.equal(benCard.price, 40);
  assert.equal(benCard.locked, false);
  assert.equal(ada.tokens, INVESTOR_TOKENS - 1);

  assert.throws(
    () => makeOffer(table, ben.userId, { cardId: camCard.id, price: 12, kind: "close" }),
    /manager/
  );
  makeOffer(table, cam.userId, { cardId: camCard.id, price: 12, kind: "close" });
  const close = table.offers.find((offer) => offer.cardId === camCard.id);
  assert.equal(close?.kind, "close");
  assert.equal(close?.lock, true);
  acceptOffer(table, ben.userId, close!.id, 1_000);
  assert.equal(camCard.investorId, ben.userId);
  assert.equal(camCard.price, 12);
  assert.equal(camCard.locked, true);
  assert.equal(ben.tokens, INVESTOR_TOKENS - 2);
  assert.throws(() => makeOffer(table, ada.userId, { cardId: camCard.id, price: 30, kind: "bid" }), /locked/);
  assert.throws(() => lockDeal(table, ben.userId, adaCard.id, 1_000), /manager/);
  lockDeal(table, ada.userId, adaCard.id, 1_000);
  assert.equal(adaCard.locked, true);
}

{
  const table = emptyTable();
  const red = table.stocks[0];
  table.positions[red.id] = 7;
  saveStock(table, red.id, {
    name: "Red",
    color: "#e11d48",
    track: [0, 20, 40, 60],
    die: [-2, -2, 1, 1, 1],
    startIndex: 1,
    normalCards: red.normalCards,
    doubleCards: red.doubleCards,
  });
  assert.deepEqual(table.stocks[0].track, [0, 20, 40, 60]);
  assert.equal(table.stocks[0].die.filter((face) => face === 1).length, 3);
  assert.equal(table.positions[red.id], 3);
  assert.throws(
    () =>
      saveStock(table, red.id, {
        name: "Red",
        color: "#e11d48",
        track: [1],
        die: [0],
        startIndex: 0,
        normalCards: 1,
        doubleCards: 0,
      }),
    /track/
  );
}

console.log("wolf street rules ok");
