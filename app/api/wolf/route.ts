import { asJson, handleError, requireUser } from "@/lib/game/api";
import { wolfAct, wolfView } from "@/lib/wolf/store";
import type { SeatRole } from "@/lib/wolf/types";

export async function GET() {
  try {
    const userId = await requireUser();
    return asJson(await wolfView(userId));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as { action: string; role?: SeatRole; [key: string]: unknown };
    return asJson(await wolfAct(userId, body as never));
  } catch (error) {
    return handleError(error);
  }
}
