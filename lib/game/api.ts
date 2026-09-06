import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/game/auth";

export async function requireUser() {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Sign in to keep playing.");
  }
  return userId;
}

export function asJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went sideways.";
  const status = message === "Sign in to keep playing." ? 401 : 400;
  return asJson({ error: message }, status);
}
