import { itemById } from "@/lib/game/catalog";

export const SELECTED_ITEM_COOKIE = "bazaar_item";
export const SELECTED_ITEM_DEFAULT = "wheat";

export function catalogItemId(raw: unknown) {
  const id = String(raw ?? "").trim();
  return itemById[id] ? id : null;
}

export function selectedItemFromCookie(raw: unknown) {
  return catalogItemId(raw) ?? SELECTED_ITEM_DEFAULT;
}
