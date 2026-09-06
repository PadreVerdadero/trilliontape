import { getSessionUserId } from "@/lib/game/auth";
import { locationById } from "@/lib/game/catalog";
import { arriveAt } from "@/lib/game/engine";
import { herePath } from "@/lib/game/places";
import { redirect } from "next/navigation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ locationId: string }> }
) {
  const { locationId } = await context.params;
  if (!locationById[locationId]) {
    redirect("/play");
  }
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(`/?next=${encodeURIComponent(herePath(locationId))}`);
  }
  try {
    arriveAt(userId, locationId);
  } catch {
    redirect("/play");
  }
  redirect("/play");
}
