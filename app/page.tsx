import { Landing } from "@/components/game/landing";
import { getSessionUserId } from "@/lib/game/auth";
import { inviteRequired } from "@/lib/game/db";
import { safeReturnPath } from "@/lib/game/places";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeReturnPath(params.next) : "/play";
  if (await getSessionUserId()) {
    redirect(next);
  }
  return (
    <Landing
      error={params.error}
      next={params.next ? next : undefined}
      needsInvite={await inviteRequired()}
    />
  );
}
