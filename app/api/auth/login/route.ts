import { handleError, asJson } from "@/lib/game/api";
import { loginUser } from "@/lib/game/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    await loginUser(body.username ?? "", body.password ?? "");
    return asJson({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
