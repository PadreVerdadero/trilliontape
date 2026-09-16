import { asJson, handleError, requireUser } from "@/lib/game/api";
import {
  acceptSwap,
  cancelOrders,
  cancelSwap,
  declineSwap,
  getGameState,
  placeOrder,
  proposeSwap,
  takeOrder,
  consumeItem,
  setGovernment,
  setAdmin,
  adminSetGold,
  adminSetItem,
  adminStartGame,
  adminScheduleStart,
  adminClearSchedule,
  adminSetInviteCode,
  adminSetComputers,
  adminSetComputerCount,
  adminSitOtherTravelers,
  adminSetStipend,
  adminSetStartingGold,
  adminSetStipendLadder,
  adminSetIssued,
  adminSetGoal,
  adminAddShare,
  adminRemoveShare,
} from "@/lib/game/engine";

type ActionBody = {
  timeZone?: string;
} & (
  | { action: "travel"; locationId: string }
  | { action: "arrive"; locationId: string }
  | { action: "search" }
  | { action: "mine"; itemId?: string }
  | { action: "craft"; outputId: string }
  | { action: "order"; itemId: string; side: "buy" | "sell"; price: number; quantity: number }
  | { action: "take"; orderId: number; quantity?: number }
  | { action: "cancel"; orderId?: number; orderIds?: number[] }
  | { action: "use"; itemId: string }
  | { action: "stallSell"; stallId: string; itemId: string; quantity: number }
  | { action: "stallBuy"; stallId: string; itemId: string; quantity: number }
  | { action: "rumor"; stallId: string }
  | { action: "crate"; stallId: string }
  | { action: "contract"; contractId: string }
  | { action: "donate" }
  | {
      action: "swapPropose";
      toUsername?: string | null;
      giveGold?: number;
      wantGold?: number;
      give?: { itemId: string; quantity: number }[];
      want?: { itemId: string; quantity: number }[];
    }
  | { action: "swapAccept"; offerId: number }
  | { action: "swapCancel"; offerId: number }
  | { action: "swapDecline"; offerId: number }
  | { action: "government"; on: boolean }
  | { action: "admin"; on: boolean }
  | { action: "adminGold"; gold: number; targetUserId?: number }
  | { action: "adminItem"; itemId: string; quantity: number; targetUserId?: number }
  | { action: "adminIssued"; itemId: string; authorized: number }
  | { action: "adminShareAdd"; name: string; emoji?: string; image?: string | null }
  | { action: "adminShareRemove"; itemId: string }
  | { action: "adminNewGame"; count?: number }
  | { action: "adminScheduleStart"; at: number; count?: number }
  | { action: "adminClearSchedule" }
  | { action: "adminInviteCode"; code: string }
  | { action: "adminComputers"; count?: number; on?: boolean }
  | { action: "adminSitOthers" }
  | { action: "adminStipend"; ms: number }
  | { action: "adminStartingGold"; gold: number }
  | { action: "adminStipendLadder"; amounts: number[] }
  | {
      action: "adminGoal";
      mode: "threshold" | "timed";
      score: "netWorth" | "gold" | "items";
      threshold?: number;
      durationMs?: number;
      needs?: { itemId: string; quantity: number }[];
    }
);

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as ActionBody;
    const tz = body.timeZone;
    switch (body.action) {
      case "travel":
      case "arrive":
      case "search":
      case "mine":
      case "stallSell":
      case "stallBuy":
      case "rumor":
      case "crate":
      case "contract":
      case "donate":
        throw new Error("The stalls are gone. Trade on the board.");
      case "craft":
        throw new Error("Items are not combined. Trade them on the board.");
      case "order":
        await placeOrder(userId, body.itemId, body.side, Number(body.price), Number(body.quantity));
        break;
      case "take":
        await takeOrder(userId, Number(body.orderId), Number(body.quantity ?? 1));
        break;
      case "cancel": {
        const ids = Array.isArray(body.orderIds)
          ? body.orderIds.map(Number)
          : [Number(body.orderId)];
        await cancelOrders(userId, ids);
        break;
      }
      case "use":
        await consumeItem(userId, body.itemId);
        break;
      case "swapPropose":
        await proposeSwap(userId, {
          toUsername: body.toUsername,
          giveGold: Number(body.giveGold ?? 0),
          wantGold: Number(body.wantGold ?? 0),
          give: body.give,
          want: body.want,
        });
        break;
      case "swapAccept":
        await acceptSwap(userId, Number(body.offerId));
        break;
      case "swapCancel":
        await cancelSwap(userId, Number(body.offerId));
        break;
      case "swapDecline":
        await declineSwap(userId, Number(body.offerId));
        break;
      case "government":
        await setGovernment(userId, Boolean(body.on));
        break;
      case "admin":
        await setAdmin(userId, Boolean(body.on));
        break;
      case "adminGold":
        await adminSetGold(userId, Number(body.gold), Number(body.targetUserId ?? userId));
        break;
      case "adminItem":
        await adminSetItem(userId, String(body.itemId), Number(body.quantity), Number(body.targetUserId ?? userId));
        break;
      case "adminIssued":
        await adminSetIssued(userId, String(body.itemId), Number(body.authorized));
        break;
      case "adminShareAdd":
        await adminAddShare(userId, { name: body.name, emoji: body.emoji, image: body.image });
        break;
      case "adminShareRemove":
        await adminRemoveShare(userId, String(body.itemId));
        break;
      case "adminNewGame":
        await adminStartGame(userId, tz, body.count != null ? Number(body.count) : undefined);
        break;
      case "adminScheduleStart":
        await adminScheduleStart(
          userId,
          Number(body.at),
          tz,
          body.count != null ? Number(body.count) : undefined
        );
        break;
      case "adminClearSchedule":
        await adminClearSchedule(userId);
        break;
      case "adminInviteCode":
        await adminSetInviteCode(userId, String(body.code ?? ""));
        break;
      case "adminComputers":
        if (body.count != null) await adminSetComputerCount(userId, Number(body.count));
        else await adminSetComputers(userId, Boolean(body.on));
        break;
      case "adminSitOthers":
        await adminSitOtherTravelers(userId);
        break;
      case "adminStipend":
        await adminSetStipend(userId, Number(body.ms));
        break;
      case "adminStartingGold":
        await adminSetStartingGold(userId, Number(body.gold));
        break;
      case "adminStipendLadder":
        await adminSetStipendLadder(userId, body.amounts);
        break;
      case "adminGoal":
        await adminSetGoal(userId, {
          mode: body.mode,
          score: body.score,
          threshold: body.threshold,
          durationMs: body.durationMs,
          needs: body.needs,
        });
        break;
      default:
        throw new Error("Unknown action.");
    }
    return asJson(await getGameState(userId, tz, { tick: false }));
  } catch (error) {
    return handleError(error);
  }
}
