import { Landing } from "@/components/game/landing";
import { getSessionUserId } from "@/lib/game/auth";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSessionUserId()) {
    redirect("/play");
  }
  const params = await searchParams;
  return <Landing error={params.error} />;
}
