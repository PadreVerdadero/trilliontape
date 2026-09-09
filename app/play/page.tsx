import { PlayScreen } from "@/components/game/play-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { getGameState } from "@/lib/game/engine";
import { SELECTED_ITEM_COOKIE, selectedItemFromCookie } from "@/lib/game/selected-item";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function PlayPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  const jar = await cookies();
  return (
    <PlayScreen
      initialState={getGameState(userId)}
      initialItemId={selectedItemFromCookie(jar.get(SELECTED_ITEM_COOKIE)?.value)}
    />
  );
}
