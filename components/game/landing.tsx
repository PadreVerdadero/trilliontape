"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { items } from "@/lib/game/catalog";

const highlights = [
  {
    emoji: "🗺️",
    title: "The road takes time",
    body: "Walk between five places on the map. Start a trip, log out, and you will be there when you return.",
  },
  {
    emoji: "⛏️",
    title: "Gathering is a timer",
    body: "Mining, foraging, fishing, and harvesting all run on a clock. Rare gems and coral are slow on purpose.",
  },
  {
    emoji: "📒",
    title: "A real order book",
    body: "Post a bid or an ask at your price. Click an order to take it. If a bid sits above an ask, they match at the lower price.",
  },
  {
    emoji: "🏦",
    title: "The bank window",
    body: "Always dump stock at the market average — the volume-weighted price of every trade in that emoji.",
  },
];

export function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.push("/play");
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(232,176,80,0.18),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(255,120,70,0.12),_transparent_30%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:py-16">
        <header className="flex items-center justify-between gap-4">
          <p className="font-heading text-lg tracking-wide">🏮 Lantern Bazaar</p>
          <p className="hidden text-sm text-muted-foreground sm:block">
            A player market you can walk away from
          </p>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
              Harvest of Lanterns
            </p>
            <h1 className="font-heading max-w-xl text-4xl leading-tight text-balance sm:text-6xl">
              Gather the emojis. Set the prices. Light the relic.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              You are a traveling crafter in a night market that never sleeps. Materials live in
              the woods, ridge, shore, and fields. Crafted goods and the winning{" "}
              <span className="text-foreground">🌟 Celestial Relic</span> are made in town. Other
              players post buy and sell orders like a tiny stock exchange — or you sell straight
              to the bank at the going average.
            </p>
            <div className="flex flex-wrap gap-2">
              {items
                .filter((item) => item.kind === "material")
                .map((item) => (
                  <span
                    key={item.id}
                    title={item.name}
                    className="grid size-9 place-items-center rounded-full bg-card text-lg ring-1 ring-foreground/10"
                  >
                    {item.emoji}
                  </span>
                ))}
            </div>
          </div>

          <Card className="bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle>{mode === "register" ? "Take a stall" : "Return to the plaza"}</CardTitle>
              <CardDescription>
                Your pack, gold, open orders, and any running timer are saved. Come back mid-walk
                or mid-mine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="username">Traveler name</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="e.g. EmberWalker"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button className="w-full" disabled={pending} type="submit">
                  {pending
                    ? "Opening the gate…"
                    : mode === "register"
                      ? "Create traveler"
                      : "Enter the bazaar"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setMode(mode === "register" ? "login" : "register");
                    setError(null);
                  }}
                >
                  {mode === "register"
                    ? "Already have a stall? Sign in"
                    : "New here? Create a traveler"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {highlights.map((item) => (
            <Card key={item.title} className="bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  {item.title}
                </CardTitle>
                <CardDescription className="text-sm leading-6">{item.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
