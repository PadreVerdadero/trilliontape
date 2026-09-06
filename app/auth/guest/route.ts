import { loginUser, registerUser } from "@/lib/game/auth";
import { nextFromForm } from "@/lib/game/auth-redirect";
import { redirect } from "next/navigation";

const GUEST = { username: "Guest", password: "play" };

export async function POST(request: Request) {
  const form = await request.formData();
  const next = nextFromForm(form);
  try {
    await loginUser(GUEST.username, GUEST.password);
  } catch {
    try {
      await registerUser(GUEST.username, GUEST.password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open the Guest stall.";
      redirect(`/?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
    }
  }
  redirect(next);
}
