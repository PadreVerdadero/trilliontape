import { NextResponse } from "next/server";
import { databaseTarget } from "@/lib/game/sql";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "TrillionTape",
    book: databaseTarget(),
  });
}
