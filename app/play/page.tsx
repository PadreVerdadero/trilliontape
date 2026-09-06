import { PlayScreen } from "@/components/game/play-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { getGameState } from "@/lib/game/engine";
import { redirect } from "next/navigation";

export default async function PlayPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  return <PlayScreen initialState={getGameState(userId)} />;
}
