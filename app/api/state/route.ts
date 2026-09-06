import { asJson, handleError, requireUser } from "@/lib/game/api";
import { getGameState } from "@/lib/game/engine";

export async function GET() {
  try {
    const userId = await requireUser();
    return asJson(getGameState(userId));
  } catch (error) {
    return handleError(error);
  }
}
