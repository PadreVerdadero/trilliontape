import { locationById } from "@/lib/game/catalog";

export function herePath(locationId: string) {
  return `/here/${locationId}`;
}

export function safeReturnPath(raw: unknown) {
  const value = String(raw ?? "");
  if (value === "/wolf" || value === "/play") return value;
  const match = /^\/here\/([a-z]+)$/.exec(value);
  if (match && locationById[match[1]]) return value;
  return "/play";
}
