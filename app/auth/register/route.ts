import { registerUser } from "@/lib/game/auth";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  try {
    await registerUser(username, password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create a traveler.";
    redirect(`/?error=${encodeURIComponent(message)}&mode=register`);
  }
  redirect("/play");
}
