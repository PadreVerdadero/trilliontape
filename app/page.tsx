import { Landing } from "@/components/game/landing";
import { getSessionUserId } from "@/lib/game/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  if (await getSessionUserId()) {
    redirect("/play");
  }
  return <Landing />;
}
