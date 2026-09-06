import { loginUser, registerUser } from "@/lib/game/auth";
import { redirect } from "next/navigation";

const GUEST = { username: "Guest", password: "play" };

export async function POST() {
  try {
    await loginUser(GUEST.username, GUEST.password);
  } catch {
    try {
      await registerUser(GUEST.username, GUEST.password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open the Guest stall.";
      redirect(`/?error=${encodeURIComponent(message)}`);
    }
  }
  redirect("/play");
}
