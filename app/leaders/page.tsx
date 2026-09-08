import { LeaderboardScreen } from "@/components/game/leaderboard-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { getGameState } from "@/lib/game/engine";
import { redirect } from "next/navigation";

export default async function LeadersPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  return <LeaderboardScreen initialState={getGameState(userId)} />;
}
