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
  | { action: "adminGold"; gold: number }
  | { action: "adminItem"; itemId: string; quantity: number }
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
        placeOrder(userId, body.itemId, body.side, Number(body.price), Number(body.quantity));
        break;
      case "take":
        takeOrder(userId, Number(body.orderId), Number(body.quantity ?? 1));
        break;
      case "cancel": {
        const ids = Array.isArray(body.orderIds)
          ? body.orderIds.map(Number)
          : [Number(body.orderId)];
        cancelOrders(userId, ids);
        break;
      }
      case "use":
        consumeItem(userId, body.itemId);
        break;
      case "swapPropose":
        proposeSwap(userId, {
          toUsername: body.toUsername,
          giveGold: Number(body.giveGold ?? 0),
          wantGold: Number(body.wantGold ?? 0),
          give: body.give,
          want: body.want,
        });
        break;
      case "swapAccept":
        acceptSwap(userId, Number(body.offerId));
        break;
      case "swapCancel":
        cancelSwap(userId, Number(body.offerId));
        break;
      case "swapDecline":
        declineSwap(userId, Number(body.offerId));
        break;
      case "government":
        setGovernment(userId, Boolean(body.on));
        break;
      case "admin":
        setAdmin(userId, Boolean(body.on));
        break;
      case "adminGold":
        adminSetGold(userId, Number(body.gold));
        break;
      case "adminItem":
        adminSetItem(userId, String(body.itemId), Number(body.quantity));
        break;
      default:
        throw new Error("Unknown action.");
    }
    return asJson(getGameState(userId, tz, { tick: false }));
  } catch (error) {
    return handleError(error);
  }
}
