import { AdminScreen } from "@/components/game/admin-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { enterAdmin, getGameState } from "@/lib/game/engine";
import { SELECTED_ITEM_COOKIE, selectedItemFromCookie } from "@/lib/game/selected-item";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  enterAdmin(userId);
  const jar = await cookies();
  return (
    <AdminScreen
      initialState={getGameState(userId)}
      initialItemId={selectedItemFromCookie(jar.get(SELECTED_ITEM_COOKIE)?.value)}
    />
  );
}
