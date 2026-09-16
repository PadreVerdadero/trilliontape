"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameState, OrderBook } from "@/lib/game/types";

type ActionBody = Record<string, unknown> & { action: string };

function clientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useGame(initialState?: GameState | null) {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(initialState ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialState);
  const [pending, setPending] = useState(false);
  const lastEvent = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const busy = state?.player.busy.type !== "idle";
  const hurry = busy || state?.gamePhase === "lobby";
  pendingRef.current = pending;

  const refreshGen = useRef(0);

  const refresh = useCallback(async () => {
    const gen = (refreshGen.current += 1);
    const response = await fetch(`/api/state?tz=${encodeURIComponent(clientTimeZone())}`, {
      cache: "no-store",
    });
    if (gen !== refreshGen.current) return;
    if (response.status === 401) {
      router.replace("/");
      return;
    }
    const data = (await response.json()) as GameState & { error?: string };
    if (gen !== refreshGen.current) return;
    if (!response.ok) {
      setError(data.error ?? "Could not load the bazaar.");
      setLoading(false);
      return;
    }
    setState(data);
    setError(null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (initialState) return;
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh, initialState]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pendingRef.current) return;
      void refresh();
    }, hurry ? 1000 : 4000);
    return () => window.clearInterval(id);
  }, [refresh, hurry]);

  const run = useCallback(async (body: ActionBody) => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, timeZone: clientTimeZone() }),
      });
      const data = (await response.json()) as GameState & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That action failed.");
        return null;
      }
      setState(data);
      lastEvent.current = data.player.lastEvent;
      return data;
    } catch {
      setError("Network hiccup. Try again.");
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { state, error, loading, pending, refresh, run, setError };
}

export function useOrderBook(itemId: string | null) {
  const [book, setBook] = useState<OrderBook | null>(null);

  const load = useCallback(async () => {
    if (!itemId) {
      setBook(null);
      return;
    }
    const response = await fetch(`/api/book?item=${itemId}`, { cache: "no-store" });
    if (!response.ok) return;
    setBook((await response.json()) as OrderBook);
  }, [itemId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    const id = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(id);
    };
  }, [load]);

  return { book, reloadBook: load };
}
