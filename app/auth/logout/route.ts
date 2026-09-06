import { destroySession } from "@/lib/game/auth";
import { redirect } from "next/navigation";

export async function POST() {
  await destroySession();
  redirect("/");
}
