import { CheckinCodes } from "@/components/game/checkin-codes";
import Link from "next/link";

export default function CodesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="font-heading text-2xl">Check-in codes</p>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Print these and tape them at each real-world stop. A traveler scans the code (signed in
          on their phone) and they arrive there instantly. On a computer, tap{" "}
          <span className="text-foreground">Open to test</span> or use{" "}
          <span className="text-foreground">I&apos;m here</span> on the map.
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
