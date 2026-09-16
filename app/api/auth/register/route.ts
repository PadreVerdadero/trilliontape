import { handleError, asJson } from "@/lib/game/api";
import { registerUser } from "@/lib/game/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      invite?: string;
    };
    await registerUser(body.username ?? "", body.password ?? "", body.invite ?? "");
    return asJson({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
