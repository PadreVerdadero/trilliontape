import { asJson } from "@/lib/game/api";
import { destroySession } from "@/lib/game/auth";

export async function POST() {
  await destroySession();
  return asJson({ ok: true });
}
