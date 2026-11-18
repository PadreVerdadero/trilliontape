import assert from "node:assert/strict";
import {
  INVESTOR_TOKENS,
  LOAN,
  STARTING_CASH,
  bid,
  draftPick,
  emptyTable,
  enterUpkeep,
  incomeOf,
  rolePlan,
  salesRequired,
  sellForUpkeep,
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
console.log("wolf street rules ok");
