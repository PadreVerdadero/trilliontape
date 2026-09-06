import { asJson, handleError, requireUser } from "@/lib/game/api";
import {
  bankSell,
  buyCosmetic,
  cancelOrder,
  craftItem,
  equipCosmetic,
  getGameState,
  placeOrder,
  startMine,
  startTravel,
  takeOrder,
} from "@/lib/game/engine";

type ActionBody =
  | { action: "travel"; locationId: string }
  | { action: "mine"; itemId: string }
  | { action: "craft"; outputId: string }
  | { action: "order"; itemId: string; side: "buy" | "sell"; price: number; quantity: number }
  | { action: "take"; orderId: number }
  | { action: "cancel"; orderId: number }
  | { action: "bank"; itemId: string; quantity: number }
  | { action: "buyCosmetic"; cosmeticId: string }
  | { action: "equip"; cosmeticId: string | null; slot: string };

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as ActionBody;
    switch (body.action) {
      case "travel":
        startTravel(userId, body.locationId);
        break;
      case "mine":
        startMine(userId, body.itemId);
        break;
      case "craft":
        craftItem(userId, body.outputId);
        break;
      case "order":
        placeOrder(userId, body.itemId, body.side, Number(body.price), Number(body.quantity));
        break;
      case "take":
        takeOrder(userId, Number(body.orderId));
        break;
      case "cancel":
        cancelOrder(userId, Number(body.orderId));
        break;
      case "bank":
        bankSell(userId, body.itemId, Number(body.quantity));
        break;
      case "buyCosmetic":
        buyCosmetic(userId, body.cosmeticId);
        break;
      case "equip":
        equipCosmetic(userId, body.cosmeticId, body.slot);
        break;
      default:
        throw new Error("Unknown action.");
    }
    return asJson(getGameState(userId));
  } catch (error) {
    return handleError(error);
  }
}
