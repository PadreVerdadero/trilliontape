export const SELECTED_ITEM_COOKIE = "bazaar_item";
export const SELECTED_ITEM_DEFAULT = "wheat";

export function catalogItemId(raw: unknown) {
  const id = String(raw ?? "").trim();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(id) ? id : null;
}

export function selectedItemFromCookie(raw: unknown) {
  return catalogItemId(raw) ?? SELECTED_ITEM_DEFAULT;
}
