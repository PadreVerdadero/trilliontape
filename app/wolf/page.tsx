import { WolfScreen } from "@/components/wolf/wolf-screen";
import { getSessionUserId } from "@/lib/game/auth";
import { wolfView } from "@/lib/wolf/store";
import { redirect } from "next/navigation";

export default async function WolfPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/?next=/wolf");
  return <WolfScreen initial={await wolfView(userId)} />;
}
