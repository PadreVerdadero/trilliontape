"use client";

import { useEffect, useState } from "react";

export const CONFIRM_CLICK_KEY = "bazaar_confirm_click";

// Two-step order confirmation: stored choice wins; otherwise phone layout defaults on, desktop off.
export function useConfirmClick(phoneLayout: boolean) {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(CONFIRM_CLICK_KEY);
      setSaved(value === "1" ? true : value === "0" ? false : null);
    } catch {
      // Private mode can block storage.
    }
  }, []);

  const confirm = saved ?? phoneLayout;
  const setConfirm = (on: boolean) => {
    setSaved(on);
    try {
      window.localStorage.setItem(CONFIRM_CLICK_KEY, on ? "1" : "0");
    } catch {
      // Private mode can block storage.
    }
  };

  return [confirm, setConfirm] as const;
}
