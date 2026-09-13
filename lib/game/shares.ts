import { items as fallbackItems } from "@/lib/game/catalog";
import type { Item } from "@/lib/game/types";

export const MAX_SHARE_TYPES = 24;
export const MIN_SHARE_TYPES = 1;
export const MAX_SHARE_IMAGE_CHARS = 180_000;

const RESERVED_IDS = new Set([
  "gold",
  "coin",
  "coins",
  "banker",
  "government",
  "guest",
  "item",
  "share",
  "pack",
]);

export function playItems(list?: Item[] | null): Item[] {
  return list && list.length > 0 ? list : fallbackItems;
}

export function playItemMap(list?: Item[] | null): Record<string, Item> {
  return Object.fromEntries(playItems(list).map((item) => [item.id, item]));
}

export function shareIdFromName(name: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "share";
  let id = RESERVED_IDS.has(base) ? `${base}-share` : base;
  let n = 2;
  let candidate = id;
  while (used.has(candidate)) {
    candidate = `${id}-${n}`;
    n += 1;
  }
  return candidate;
}

export function normalizeShareName(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 24) {
    throw new Error("Name the share in 1–24 characters.");
  }
  if (!/[a-zA-Z]/.test(name)) {
    throw new Error("The share name needs at least one letter.");
  }
  return name;
}

export function normalizeShareEmoji(raw: string) {
  return [...raw.trim()].slice(0, 4).join("");
}

export function normalizeShareImage(raw: string | null | undefined) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.length > MAX_SHARE_IMAGE_CHARS) {
    throw new Error("That image is too large. Use a small png, jpg, webp, or gif.");
  }
  if (/^https:\/\/\S+$/i.test(text) && text.length <= 500) return text;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(text)) return text;
  throw new Error("Use an emoji, a small image file, or an https image link.");
}

export function validateShareDraft(input: { name: string; emoji?: string; image?: string | null }) {
  const name = normalizeShareName(input.name);
  const image = normalizeShareImage(input.image);
  const emoji = normalizeShareEmoji(input.emoji ?? "");
  if (!emoji && !image) {
    throw new Error("Add an emoji or an image for this share.");
  }
  return { name, emoji: emoji || "📦", image };
}
