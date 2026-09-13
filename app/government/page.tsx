import { GovernmentScreen } from "@/components/game/government-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { canHoldOffice, enterGovernment, getGameState } from "@/lib/game/engine";
import { SELECTED_ITEM_COOKIE, selectedItemFromCookie } from "@/lib/game/selected-item";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function GovernmentPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  if (!canHoldOffice(userId)) {
    redirect("/play");
  }
  enterGovernment(userId);
  const jar = await cookies();
  return (
    <GovernmentScreen
      initialState={getGameState(userId)}
      initialItemId={selectedItemFromCookie(jar.get(SELECTED_ITEM_COOKIE)?.value)}
    />
  );
}
