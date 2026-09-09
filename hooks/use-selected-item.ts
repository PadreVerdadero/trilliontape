"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  SELECTED_ITEM_COOKIE,
  SELECTED_ITEM_DEFAULT,
  catalogItemId,
  selectedItemFromCookie,
} from "@/lib/game/selected-item";

const MAX_AGE = 60 * 60 * 24 * 365;

function persist(id: string) {
  try {
    document.cookie = `${SELECTED_ITEM_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
    window.localStorage.setItem(SELECTED_ITEM_COOKIE, id);
  } catch {
    // Private mode can block storage.
  }
}

export function useSelectedItem(initialId?: string) {
  const [itemId, setItemIdState] = useState(
    selectedItemFromCookie(initialId ?? SELECTED_ITEM_DEFAULT)
  );

  useLayoutEffect(() => {
    try {
      const saved = catalogItemId(window.localStorage.getItem(SELECTED_ITEM_COOKIE));
      if (saved && saved !== itemId) {
        setItemIdState(saved);
        persist(saved);
      } else {
        persist(itemId);
      }
    } catch {
      persist(itemId);
    }
    // Restore once on mount from this browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setItemId = useCallback((id: string) => {
    const next = catalogItemId(id);
    if (!next) return;
    setItemIdState(next);
    persist(next);
  }, []);

  return [itemId, setItemId] as const;
}
