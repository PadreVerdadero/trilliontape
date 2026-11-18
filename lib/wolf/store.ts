import { getDb } from "@/lib/game/db";
import { isOfficeUsername } from "@/lib/game/office";
import {
  acceptOffer,
  addStock,
  assignRole,
  bid,
  emptyTable,
  cancelOffer,
  draftPick,
  enterUpkeep,
  leave,
  lockDeal,
  makeOffer,
  publicStocks,
  pullDeal,
  removeStock,
  resetLobby,
  rolePlan,
  saveStock,
  sellForUpkeep,
  sit,
  startGame,
  takeFees,
  tick,
} from "@/lib/wolf/rules";
import type { SeatRole, WolfTable, WolfView } from "@/lib/wolf/types";

const KEY = "wolf_street";

async function readTable(): Promise<WolfTable> {
  const row = (await getDb().prepare("SELECT value FROM game_meta WHERE key = ?").get(KEY)) as
    | { value: string }
    | undefined;
  if (!row) return emptyTable();
  try {
    return { ...emptyTable(), ...(JSON.parse(row.value) as WolfTable) };
  } catch {
    return emptyTable();
  }
}

async function writeTable(table: WolfTable) {
  await getDb()
    .prepare(
      `INSERT INTO game_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(KEY, JSON.stringify(table));
}

async function usernameOf(userId: number) {
  const row = (await getDb().prepare("SELECT username FROM users WHERE id = ?").get(userId)) as
    | { username: string }
    | undefined;
  if (!row) throw new Error("Sign in to keep playing.");
  return row.username;
}

export async function wolfView(userId: number) {
  return getDb().transaction(async () => {
    const table = await readTable();
    const name = await usernameOf(userId);
    if (tick(table, Date.now())) await writeTable(table);
    return present(table, userId, name);
  });
}

type WolfAction =
  | { action: "sit"; role: SeatRole }
  | { action: "leave" }
  | { action: "assign"; userId: number; role: SeatRole }
  | { action: "saveStock"; stockId: string; name: string; color: string; track: number[]; die: number[]; startIndex: number; normalCards: number; doubleCards: number }
  | { action: "addStock"; name: string; color: string }
  | { action: "removeStock"; stockId: string }
  | { action: "start" }
  | { action: "draft"; cardId: string }
  | { action: "offer"; cardId: string; toId: number; price: number; lock: boolean }
  | { action: "cancelOffer"; offerId: string }
  | { action: "accept"; offerId: string }
  | { action: "pull"; cardId: string }
  | { action: "lock"; cardId: string }
  | { action: "fees" }
  | { action: "upkeep" }
  | { action: "sell"; cardIds: string[] }
  | { action: "bid"; amount: number }
  | { action: "reset" };

export async function wolfAct(userId: number, body: WolfAction) {
  return getDb().transaction(async () => {
    const table = await readTable();
    const name = await usernameOf(userId);
    const office = isOfficeUsername(name);
    const now = Date.now();
    tick(table, now);
    if ((body.action === "assign" || body.action === "saveStock" || body.action === "addStock" || body.action === "removeStock" || body.action === "reset") && !office) {
      throw new Error("Only Jesse can change the table.");
    }
    switch (body.action) {
      case "sit":
        sit(table, userId, name, body.role);
        break;
      case "leave":
        leave(table, userId);
        break;
      case "assign":
        assignRole(table, body.userId, body.role);
        break;
      case "saveStock":
        saveStock(table, body.stockId, body);
        break;
      case "addStock":
        addStock(table, body.name, body.color);
        break;
      case "removeStock":
        removeStock(table, body.stockId);
        break;
      case "start":
        startGame(table, now);
        break;
      case "draft":
        draftPick(table, userId, body.cardId, now);
        break;
      case "offer":
        makeOffer(table, userId, body);
        break;
      case "cancelOffer":
        cancelOffer(table, userId, body.offerId);
        break;
      case "accept":
        acceptOffer(table, userId, body.offerId, now);
        break;
      case "pull":
        pullDeal(table, userId, body.cardId);
        break;
      case "lock":
        lockDeal(table, userId, body.cardId, now);
        break;
      case "fees":
        takeFees(table);
        break;
      case "upkeep":
        enterUpkeep(table, now);
        break;
      case "sell":
        sellForUpkeep(table, userId, body.cardIds, now);
        break;
      case "bid":
        bid(table, userId, body.amount, now);
        break;
      case "reset": {
        const next = resetLobby(table);
        await writeTable(next);
        return present(next, userId, name);
      }
      default:
        throw new Error("Unknown action.");
    }
    await writeTable(table);
    return present(table, userId, name);
  });
}

function present(table: WolfTable, userId: number, username: string): WolfView {
  const you = table.seats.find((seat) => seat.userId === userId) ?? null;
  const plan = table.seats.length >= 3 && table.seats.length <= 11 ? safePlan(table.seats.length) : null;
  const hand = table.draft?.hands[String(userId)] ?? [];
  const auctionCard = table.auction ? table.cards.find((card) => card.id === table.auction?.queue[0]) : null;
  const rebidders = table.auction?.rebidders ?? null;
  const waitingIds = table.auction
    ? (rebidders ?? table.seats.filter((seat) => seat.role !== "investor").map((seat) => seat.userId)).filter(
        (id) => table.auction?.bids[String(id)] == null
      )
    : [];
  return {
    you: {
      id: userId,
      username,
      role: you?.role ?? null,
      cash: you?.cash ?? 0,
      tokens: you?.tokens ?? 0,
      lostTokens: you?.lostTokens ?? 0,
      investing: you?.investing ?? false,
      seated: Boolean(you),
      office: isOfficeUsername(username),
    },
    phase: table.phase,
    round: table.round,
    combo: table.combo,
    now: Date.now(),
    negotiationEndsAt: table.negotiationEndsAt,
    plan,
    seats: table.seats.map((seat) => ({
      userId: seat.userId,
      username: seat.username,
      role: seat.role,
      cash: seat.cash,
      tokens: seat.tokens,
      lostTokens: seat.lostTokens,
      investing: seat.investing,
    })),
    stocks: publicStocks(table),
    companies: table.cards
      .filter((card) => card.zone === "held")
      .map((card) => ({
        id: card.id,
        stockId: card.stockId,
        double: card.double,
        managerId: card.managerId,
        managerName: table.seats.find((seat) => seat.userId === card.managerId)?.username ?? "",
        investorId: card.investorId,
        investorName: table.seats.find((seat) => seat.userId === card.investorId)?.username ?? null,
        price: card.price,
        locked: card.locked,
      })),
    offers: table.offers.map((offer) => ({
      ...offer,
      fromName: table.seats.find((seat) => seat.userId === offer.fromId)?.username ?? "",
      toName: table.seats.find((seat) => seat.userId === offer.toId)?.username ?? "",
    })),
    draft: table.draft
      ? {
          hand: hand.map((id) => {
            const card = table.cards.find((row) => row.id === id);
            return { id, stockId: card?.stockId ?? "", double: Boolean(card?.double) };
          }),
          kept: table.draft.kept[String(userId)]?.length ?? 0,
          waiting: table.seats
            .filter((seat) => seat.role !== "investor")
            .filter((seat) => {
              const kept = table.draft?.kept[String(seat.userId)].length ?? 0;
              const min = Math.min(
                ...table.seats
                  .filter((row) => row.role !== "investor")
                  .map((row) => table.draft?.kept[String(row.userId)].length ?? 0)
              );
              return kept === min;
            })
            .map((seat) => seat.username),
        }
      : null,
    mustSell: table.mustSell[String(userId)] ?? 0,
    auction: table.auction
      ? {
          stockId: auctionCard?.stockId ?? "",
          double: Boolean(auctionCard?.double),
          yourBid: table.auction.bids[String(userId)] ?? null,
          youBid: waitingIds.includes(userId),
          tieFloor: table.auction.tieFloor,
          waiting: waitingIds.map((id) => table.seats.find((seat) => seat.userId === id)?.username ?? ""),
          left: table.auction.queue.length,
        }
      : null,
    log: table.log.slice(0, 12),
    winners: table.winners,
    catalog: table.phase === "lobby" ? table.stocks : null,
  };
}

function safePlan(count: number) {
  try {
    return rolePlan(count);
  } catch {
    return null;
  }
}
