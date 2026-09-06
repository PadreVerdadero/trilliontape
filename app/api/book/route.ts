import { asJson, handleError, requireUser } from "@/lib/game/api";
import { itemById } from "@/lib/game/catalog";
import { getOrderBook } from "@/lib/game/engine";

export async function GET(request: Request) {
  try {
    await requireUser();
    const itemId = new URL(request.url).searchParams.get("item") ?? "";
    if (!itemById[itemId]) throw new Error("Unknown item.");
    return asJson(getOrderBook(itemId));
  } catch (error) {
    return handleError(error);
  }
}
