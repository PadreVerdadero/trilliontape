import { asJson, handleError, requireUser } from "@/lib/game/api";
import { getGameState } from "@/lib/game/engine";

export async function GET(request: Request) {
  try {
    const userId = await requireUser();
    const timeZone = new URL(request.url).searchParams.get("tz") ?? undefined;
    return asJson(getGameState(userId, timeZone));
  } catch (error) {
    return handleError(error);
  }
}
