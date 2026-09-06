import { loginUser } from "@/lib/game/auth";
import { nextFromForm } from "@/lib/game/auth-redirect";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const next = nextFromForm(form);
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  try {
    await loginUser(username, password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign in.";
    redirect(`/?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}
