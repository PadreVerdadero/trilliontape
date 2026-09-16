import { registerUser } from "@/lib/game/auth";
import { publicAuthError } from "@/lib/game/auth-error";
import { nextFromForm } from "@/lib/game/auth-redirect";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const next = nextFromForm(form);
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const invite = String(form.get("invite") ?? "");
  try {
    await registerUser(username, password, invite);
  } catch (error) {
    const message = publicAuthError(error, "Could not create a traveler.");
    redirect(`/?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}
