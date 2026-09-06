import { PlayScreen } from "@/components/game/play-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { redirect } from "next/navigation";

export default async function PlayPage() {
  if (!(await getSessionUserId())) {
    redirect("/");
  }
  return <PlayScreen />;
}
