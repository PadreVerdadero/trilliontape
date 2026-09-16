import { nextFromForm } from "@/lib/game/auth-redirect";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const next = nextFromForm(form);
  redirect(
    `/?error=${encodeURIComponent("Sign in with your traveler name. Guest play is closed.")}&next=${encodeURIComponent(next)}`
  );
}

export async function GET() {
  redirect("/?error=" + encodeURIComponent("Sign in with your traveler name. Guest play is closed."));
}
