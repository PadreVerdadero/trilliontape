import { CheckinCodes } from "@/components/game/checkin-codes";
import Link from "next/link";

export default function CodesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="font-heading text-2xl">Check-in codes</p>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Optional. Print these and tape them at real-world edges of the festival. A signed-in
          traveler scans a code and their next forage leans toward that biome. Plaza clears the
          lean. On a computer, tap <span className="text-foreground">Open to test</span>.
        </p>
        <Link
          href="/play"
          className="text-sm text-primary underline-offset-4 hover:underline print:hidden"
        >
          Back to the plaza
        </Link>
      </header>
      <CheckinCodes />
    </div>
  );
}
