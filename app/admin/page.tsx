import { AdminScreen } from "@/components/game/admin-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { canHoldOffice, enterAdmin, getGameState } from "@/lib/game/engine";
import { SELECTED_ITEM_COOKIE, selectedItemFromCookie } from "@/lib/game/selected-item";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  if (!(await canHoldOffice(userId))) {
    redirect("/play");
  }
  await enterAdmin(userId);
  const jar = await cookies();
  return (
    <AdminScreen
      initialState={await getGameState(userId)}
      initialItemId={selectedItemFromCookie(jar.get(SELECTED_ITEM_COOKIE)?.value)}
    />
  );
}
