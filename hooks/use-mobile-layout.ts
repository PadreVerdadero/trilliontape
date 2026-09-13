"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export const MOBILE_LAYOUT_KEY = "bazaar_mobile";

function readSaved(): boolean | null {
  try {
    const saved = window.localStorage.getItem(MOBILE_LAYOUT_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    // Private mode can block storage.
  }
  return null;
}

function persist(on: boolean) {
  try {
    window.localStorage.setItem(MOBILE_LAYOUT_KEY, on ? "1" : "0");
  } catch {
    // Private mode can block storage.
  }
}

export function useMobileLayout() {
  const [mobile, setMobileState] = useState(false);

  useLayoutEffect(() => {
    const saved = readSaved();
    const next =
      saved ??
      (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
    setMobileState(next);
    document.documentElement.classList.toggle("mobile-desk", next);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-desk", mobile);
    persist(mobile);
  }, [mobile]);

  const setMobile = (on: boolean) => {
    setMobileState(on);
    persist(on);
    document.documentElement.classList.toggle("mobile-desk", on);
  };

  return [mobile, setMobile] as const;
}
