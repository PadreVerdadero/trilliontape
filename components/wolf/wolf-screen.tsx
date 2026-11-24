"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_NAME } from "@/lib/game/brand";
import { cn } from "@/lib/utils";
import type { SeatRole, WolfView } from "@/lib/wolf/types";
import { play, toggleSound, unlockSound } from "@/components/wolf/sounds";

type Action = Record<string, unknown> & { action: string };

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

export function WolfScreen({ initial }: { initial: WolfView }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(initial.now);
  const [sound, setSound] = useState(true);
  const [tab, setTab] = useState<"now" | "admin">("now");
  const previous = useRef(initial);
  const flights = useCashFlights(state, previous);
  const ticked = useRef<number | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    const poll = window.setInterval(() => {
      void fetch("/api/wolf", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: WolfView & { error?: string }) => {
          if (!data.error) setState(data);
        })
        .catch(() => undefined);
    }, state.phase === "negotiation" ? 1000 : 2000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(poll);
    };
  }, [state.phase]);

  async function act(body: Action) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/wolf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as WolfView & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That did not go through.");
        return false;
      }
      setState(data);
      if (body.action === "offer") play(body.kind === "close" ? "close" : body.kind === "ask" ? "ask" : "bid");
      if (body.action === "accept" || body.action === "lock") play("close");
      if (body.action === "pull" || body.action === "cancelOffer") play("pull");
      if (body.action === "draft") play("deal");
      if (body.action === "bid") play("auction");
      if (body.action === "fees") play("fee");
      if (body.action === "take") play("take");
      return true;
    } catch {
      setError("Network hiccup. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  const left =
    state.negotiationEndsAt == null ? null : Math.max(0, state.negotiationEndsAt - now);
  const clock =
    left == null
      ? null
      : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const role =
    state.phase === "lobby" && state.plan === "both"
      ? "Manager and investor"
      : roleLabel(state.you.role);
  const urgent = left != null && left <= 10_000;
  const warning = left != null && left <= 30_000;

  useEffect(() => {
    const onPointer = () => unlockSound();
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    if (left == null || left > 10_000) {
      ticked.current = null;
      return;
    }
    const second = Math.ceil(left / 1000);
    if (ticked.current === second) return;
    ticked.current = second;
    play("tick");
  }, [left]);

  const phaseHeard = useRef(state.phase);
  useEffect(() => {
    if (phaseHeard.current === state.phase) return;
    const next = state.phase;
    phaseHeard.current = next;
    if (next === "market") play("payout");
    else if (next === "fees") play("fee");
    else if (next === "auction") play("auction");
    else if (next === "draft") play("deal");
    else if (next === "score") play("win");
    else if (next === "negotiation") play("deal");
  }, [state.phase]);

  return (
    <div className="flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-lg">{GAME_NAME}</p>
            <span className="truncate text-sm text-muted-foreground">
              Wolf Street
              <span className="text-border"> · </span>
              {state.you.username}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-2 sm:px-3")}
              onClick={() => setSound(toggleSound())}
            >
              {sound ? "♪ On" : "♪ Off"}
            </button>
            <Link
              href="/play"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-2 sm:px-3")}
            >
              Desk
            </Link>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 px-3 pb-2 sm:px-4">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {state.phase === "lobby" ? "Lobby" : `Round ${state.round} · ${phaseLabel(state.phase)}`}
            {state.you.seated ? ` · ${role}` : ""}
          </p>
          {clock ? (
            <p
              className={cn(
                "font-heading text-3xl leading-none tabular-nums",
                urgent ? "text-destructive" : warning ? "text-amber-700" : "text-foreground"
              )}
              aria-live="polite"
              aria-label={`${clock} left`}
            >
              {clock}
            </p>
          ) : null}
        </div>
      </header>
      <CashFlights flights={flights} />
      <main className="mx-auto grid w-full max-w-7xl gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[22rem_minmax(0,1fr)_22rem] lg:items-start">
        {error ? (
          <p className="col-span-full rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
            {error}
            <button type="button" className="ml-3 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </p>
        ) : null}
        <aside className="order-2 flex flex-col gap-3 lg:order-1">
          <h2 className="font-heading text-lg">Tracks</h2>
          <Tracks stocks={state.stocks} stack />
          <div className="flex gap-1">
            <button
              type="button"
              className={cn(buttonVariants({ variant: tab === "now" ? "default" : "outline", size: "sm" }))}
              onClick={() => setTab("now")}
            >
              Now
            </button>
            {state.you.office ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: tab === "admin" ? "default" : "outline", size: "sm" }))}
                onClick={() => setTab("admin")}
              >
                Admin
              </button>
            ) : null}
          </div>
          {tab === "admin" && state.you.office ? (
            <AdminPanel stocks={state.stocks} phase={state.phase} pending={pending} act={act} />
          ) : (
            <GameNow state={state} pending={pending} act={act} clock={clock} urgent={urgent} warning={warning} />
          )}
        </aside>
        <section className="order-3 flex min-w-0 flex-col gap-3 lg:order-2">
          {state.phase !== "lobby" ? <SeatPurses state={state} /> : null}
          <Companies state={state} pending={pending} act={act} side="others" />
        </section>
        <aside className="order-1 lg:sticky lg:top-24 lg:order-3">
          <YouColumn state={state} pending={pending} act={act} />
        </aside>
      </main>
    </div>
  );
}

function phaseLabel(phase: WolfView["phase"]) {
  switch (phase) {
    case "draft":
      return "Opening deal";
    case "negotiation":
      return "Negotiation";
    case "market":
      return "Investor income";
    case "fees":
      return "Manager income";
    case "upkeep":
      return "Upkeep";
    case "auction":
      return "Auction";
    case "score":
      return "Final";
    default:
      return "Lobby";
  }
}

function roleLabel(role: SeatRole | null) {
  if (role === "manager") return "Manager";
  if (role === "investor") return "Investor";
  if (role === "both") return "Manager and investor";
  return "Not seated";
}

function ink(color: string) {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#1c120c";
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  const lin = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * lin(channel(0)) + 0.7152 * lin(channel(2)) + 0.0722 * lin(channel(4));
  return luminance > 0.45 ? "#1c120c" : "#fffaf3";
}

function stockColor(state: WolfView, stockId: string) {
  return state.stocks.find((stock) => stock.id === stockId)?.color ?? "#a8a29e";
}

function faceLabel(face: number | null | undefined) {
  if (face == null) return "Start";
  return face > 0 ? `+${face}` : String(face);
}

function Tracks({ stocks, stack }: { stocks: WolfView["stocks"]; stack?: boolean }) {
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;
  const settledRef = useRef(stocks);
  const signature = stocks.map((stock) => `${stock.id}:${stock.index}:${stock.roll ?? ""}`).join("|");
  const [shownIndex, setShownIndex] = useState<Record<string, number>>(() =>
    Object.fromEntries(stocks.map((stock) => [stock.id, stock.index]))
  );
  const [spinning, setSpinning] = useState(false);
  const [liveFace, setLiveFace] = useState<Record<string, number>>({});

  useEffect(() => {
    const next = stocksRef.current;
    const previous = settledRef.current;
    const moved = next.some((stock) => {
      const before = previous.find((row) => row.id === stock.id);
      return !before || before.index !== stock.index || before.roll !== stock.roll;
    });
    if (!moved) {
      settledRef.current = next;
      return;
    }
    const from = Object.fromEntries(previous.map((stock) => [stock.id, stock.index]));
    const finals = Object.fromEntries(next.map((stock) => [stock.id, stock.index]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      settledRef.current = next;
      setSpinning(false);
      setShownIndex(finals);
      return;
    }
    let stopped = false;
    const timers: number[] = [];
    const firstFaces: Record<string, number> = {};
    for (const stock of next) {
      const die = stock.die.length > 0 ? stock.die : [0];
      firstFaces[stock.id] = die[Math.floor(Math.random() * die.length)] ?? 0;
    }
    setSpinning(true);
    setShownIndex(from);
    setLiveFace(firstFaces);
    play("dice");
    const spinTimer = window.setInterval(() => {
      if (stopped) return;
      const faces: Record<string, number> = {};
      for (const stock of next) {
        const die = stock.die.length > 0 ? stock.die : [0];
        faces[stock.id] = die[Math.floor(Math.random() * die.length)] ?? 0;
      }
      setLiveFace(faces);
    }, 90);
    timers.push(spinTimer);
    const land = window.setTimeout(() => {
      window.clearInterval(spinTimer);
      if (stopped) return;
      setSpinning(false);
      setLiveFace(Object.fromEntries(next.map((stock) => [stock.id, stock.roll ?? 0])));
      const maxSteps = Math.max(
        0,
        ...next.map((stock) => Math.abs(stock.index - (from[stock.id] ?? stock.index)))
      );
      if (maxSteps === 0) {
        settledRef.current = next;
        setShownIndex(finals);
        return;
      }
      let step = 0;
      const walk = window.setInterval(() => {
        step += 1;
        const positions: Record<string, number> = {};
        for (const stock of next) {
          const start = from[stock.id] ?? stock.index;
          const delta = stock.index - start;
          const walked = Math.min(step, Math.abs(delta));
          positions[stock.id] = start + Math.sign(delta) * walked;
        }
        if (!stopped) setShownIndex(positions);
        if (step >= maxSteps) {
          window.clearInterval(walk);
          settledRef.current = next;
        }
      }, 280);
      timers.push(walk);
    }, 1600);
    timers.push(land);
    return () => {
      stopped = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      }
    };
  }, [signature]);

  return (
    <div className={stack ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
      <style>{`
        @keyframes wolf-die {
          0% { transform: rotate(-14deg) translateY(0); }
          25% { transform: rotate(16deg) translateY(-5px); }
          50% { transform: rotate(-18deg) translateY(2px); }
          75% { transform: rotate(12deg) translateY(-3px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        .wolf-die { animation: wolf-die 0.16s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .wolf-die { animation: none; }
        }
      `}</style>
      {stocks.map((stock) => {
        const fg = ink(stock.color);
        const index = shownIndex[stock.id] ?? stock.index;
        const face = spinning ? liveFace[stock.id] : stock.roll;
        return (
          <section
            key={stock.id}
            className="rounded-xl p-3 ring-1 ring-black/10"
            style={{ background: stock.color, color: fg }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg">{stock.name}</h2>
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-lg text-base font-semibold tabular-nums shadow-sm",
                  spinning && "wolf-die"
                )}
                style={{ background: fg, color: stock.color }}
                aria-label={spinning ? `${stock.name} die rolling` : `${stock.name} rolled ${faceLabel(stock.roll)}`}
              >
                {faceLabel(face)}
              </span>
            </div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${Math.max(stock.track.length, 1)}, minmax(0, 1fr))` }}
            >
              {stock.track.map((value, cell) => (
                <div
                  key={`${stock.id}-${cell}`}
                  className="rounded px-0.5 py-1 text-center text-[11px] tabular-nums transition-transform"
                  style={{
                    background: cell === index ? fg : "transparent",
                    color: cell === index ? stock.color : fg,
                    outline: cell === stock.startIndex ? `1px solid ${fg}` : undefined,
                    transform: cell === index ? "scale(1.08)" : undefined,
                  }}
                >
                  {value}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  body,
  children,
  className,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        {body ? <CardDescription>{body}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent className="flex w-full flex-col items-start gap-3">{children}</CardContent> : null}
    </Card>
  );
}

function Lobby({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const plan = state.plan;
  const planText =
    plan === "both"
      ? "With 3 or 4 travelers, each person is both manager and investor."
      : plan
        ? `This table needs ${plan.managers} managers and ${plan.investors} investors.`
        : "Seat 3 to 11 travelers.";
  return (
    <Panel title="Who is at the table" body={`${planText} Everyone starts with 💵 120. Investors hold 🪙 10.`}>
      <ul className="w-full space-y-2">
        {state.seats.map((seat) => (
          <li key={seat.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {seat.username}
              {seat.userId === state.you.id ? " · you" : ""}
            </span>
            {state.you.office && plan !== "both" ? (
              <select
                className={cn(fieldClass, "w-auto")}
                value={seat.role}
                onChange={(event) =>
                  void act({ action: "assign", userId: seat.userId, role: event.target.value })
                }
              >
                <option value="investor">Investor</option>
                <option value="manager">Manager</option>
              </select>
            ) : (
              <span className="text-muted-foreground">
                {plan === "both" ? "Manager and investor" : roleLabel(seat.role)}
              </span>
            )}
          </li>
        ))}
        {state.seats.length === 0 ? <li className="text-sm text-muted-foreground">No one is seated.</li> : null}
      </ul>
      {plan !== "both" ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void act({ action: "sit", role: "investor" })}>
            Sit as investor
          </Button>
          <Button disabled={pending} variant="outline" onClick={() => void act({ action: "sit", role: "manager" })}>
            Sit as manager
          </Button>
          {state.you.seated ? (
            <Button disabled={pending} variant="outline" onClick={() => void act({ action: "leave" })}>
              Leave
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void act({ action: "sit", role: "investor" })}>
            {state.you.seated ? "You are seated" : "Sit down"}
          </Button>
          {state.you.seated ? (
            <Button disabled={pending} variant="outline" onClick={() => void act({ action: "leave" })}>
              Leave
            </Button>
          ) : null}
        </div>
      )}
      <Button disabled={pending || state.seats.length < 3} onClick={() => void act({ action: "start" })}>
        Start the street
      </Button>
    </Panel>
  );
}

function GameNow({
  state,
  pending,
  act,
  clock,
  urgent,
  warning,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
  clock: string | null;
  urgent: boolean;
  warning: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {clock ? (
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ring-border",
            urgent ? "bg-destructive/15" : warning ? "bg-amber-500/15" : "bg-card"
          )}
        >
          <span className="text-sm text-muted-foreground">Time left</span>
          <span className="font-heading text-4xl tabular-nums">{clock}</span>
        </div>
      ) : null}
      {state.phase === "lobby" ? <Lobby state={state} pending={pending} act={act} /> : null}
      {state.phase === "draft" && state.draft ? <Draft state={state} pending={pending} act={act} /> : null}
      {state.phase === "negotiation" ? (
        <p className="text-sm text-muted-foreground">
          Investors bid. The manager asks, and only the manager can close. A closed deal turns gold, and nobody can bid on it.
        </p>
      ) : null}
      {state.phase === "market" ? (
        <PhaseNote
          title="The market moved"
          body="💵 is moving from the companies to the investors who held them."
          action="Take the fees"
          pending={pending}
          onClick={() => void act({ action: "fees" })}
        />
      ) : null}
      {state.phase === "fees" ? (
        <PhaseNote
          title="Managers have been paid"
          body={
            state.combo
              ? "💵 moved from the investors to the managers. A traveler who cannot cover every fee pays nothing. Their 💵 and 🪙 are wiped, and they stay in as a manager."
              : "💵 moved from the investors to the managers. A traveler who cannot cover every fee pays nothing. Their 💵 is wiped, the bank lends 100, and one 🪙 is repaid at the end."
          }
          action="Pay upkeep"
          pending={pending}
          onClick={() => void act({ action: "upkeep" })}
        />
      ) : null}
      {state.phase === "upkeep" ? <Upkeep state={state} pending={pending} act={act} /> : null}
      {state.phase === "auction" && state.auction ? <Auction state={state} pending={pending} act={act} /> : null}
      {state.phase === "score" ? <Score state={state} pending={pending} act={act} /> : null}
      <Log lines={state.log} />
    </div>
  );
}

function groupDie(die: number[]) {
  const rows: { face: number; weight: number }[] = [];
  for (const face of die) {
    const found = rows.find((row) => row.face === face);
    if (found) found.weight += 1;
    else rows.push({ face, weight: 1 });
  }
  return rows.length > 0 ? rows : [{ face: 0, weight: 1 }];
}

function AdminPanel({
  stocks,
  phase,
  pending,
  act,
}: {
  stocks: WolfView["stocks"];
  phase: WolfView["phase"];
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a8a29e");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Set how many numbers are on a track, which rolls it has, and how often each roll comes up. A higher weight is
        drawn more often.
      </p>
      {stocks.map((stock) => (
        <AdminStock key={stock.id} stock={stock} phase={phase} pending={pending} act={act} />
      ))}
      {phase === "lobby" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="new-stock">New stock</Label>
            <Input id="new-stock" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28" aria-label="Color" />
          <Button
            disabled={pending}
            variant="outline"
            onClick={() => {
              void act({ action: "addStock", name, color });
              setName("");
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">New stocks wait for the lobby. Track and roll changes apply now.</p>
      )}
    </div>
  );
}

function AdminStock({
  stock,
  phase,
  pending,
  act,
}: {
  stock: WolfView["stocks"][number];
  phase: WolfView["phase"];
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const [values, setValues] = useState(stock.track);
  const [rolls, setRolls] = useState(() => groupDie(stock.die));
  const [start, setStart] = useState(stock.startIndex);
  const [name, setName] = useState(stock.name);
  const [color, setColor] = useState(stock.color);
  const total = rolls.reduce((sum, row) => sum + Math.max(1, row.weight), 0);
  function setCount(count: number) {
    if (!Number.isFinite(count)) return;
    const next = Math.max(2, Math.min(16, Math.trunc(count)));
    setValues((prev) => {
      const copy = prev.slice(0, next);
      while (copy.length < next) copy.push((copy[copy.length - 1] ?? 0) + 10);
      return copy;
    });
    setStart((current) => Math.min(current, next - 1));
  }
  return (
    <div className="overflow-hidden rounded-xl bg-background/40 ring-1 ring-foreground/10">
      <div className="h-2" style={{ background: color }} />
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-32" aria-label="Stock name" />
          <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-24" aria-label="Color" />
          {phase === "lobby" ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => void act({ action: "removeStock", stockId: stock.id })}>
              Remove
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${stock.id}-spaces`}>Spaces</Label>
          <Input
            id={`${stock.id}-spaces`}
            inputMode="numeric"
            value={String(values.length)}
            onChange={(event) => setCount(Number(event.target.value))}
            className="w-16"
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {values.map((value, index) => (
            <Input
              key={`${stock.id}-space-${index}`}
              aria-label={`Space ${index + 1}`}
              inputMode="numeric"
              value={String(value)}
              onChange={(event) =>
                setValues((prev) => prev.map((cell, cellIndex) => (cellIndex === index ? Number(event.target.value) : cell)))
              }
              className="h-8 px-1 text-center"
            />
          ))}
        </div>
        <Label htmlFor={`${stock.id}-start`}>Start space</Label>
        <Input
          id={`${stock.id}-start`}
          inputMode="numeric"
          value={String(start + 1)}
          onChange={(event) => setStart(Math.max(0, Math.min(values.length - 1, Number(event.target.value) - 1)))}
          className="w-16"
        />
        <p className="text-xs font-medium">Rolls</p>
        {rolls.map((row, index) => (
          <div key={`${stock.id}-roll-${index}`} className="flex items-center gap-1">
            <Input
              aria-label={`Roll ${index + 1}`}
              inputMode="numeric"
              value={String(row.face)}
              onChange={(event) =>
                setRolls((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, face: Number(event.target.value) } : item)))
              }
              className="h-8 w-16"
            />
            <Input
              aria-label={`Weight ${index + 1}`}
              inputMode="numeric"
              value={String(row.weight)}
              onChange={(event) =>
                setRolls((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, weight: Math.max(1, Math.min(20, Number(event.target.value) || 1)) } : item
                  )
                )
              }
              className="h-8 w-14"
            />
            <span className="w-10 text-xs tabular-nums text-muted-foreground">
              {Math.round((Math.max(1, row.weight) / total) * 100)}%
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={rolls.length < 2}
              onClick={() => setRolls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
            >
              Drop
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setRolls((prev) => [...prev, { face: 0, weight: 1 }])}>
          Add roll
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            void act({
              action: "saveStock",
              stockId: stock.id,
              name,
              color,
              track: values.map((value) => Math.trunc(Number(value))),
              die: rolls.flatMap((row) => Array.from({ length: Math.max(1, Math.min(20, Math.trunc(row.weight))) }, () => Math.trunc(row.face))),
              startIndex: start,
              normalCards: stock.normalCards,
              doubleCards: stock.doubleCards,
            })
          }
        >
          Save {name}
        </Button>
      </div>
    </div>
  );
}

function Draft({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const draft = state.draft;
  if (!draft) return null;
  return (
    <Panel
      title="Keep one company"
      body={`You have kept ${draft.kept}. Still choosing: ${draft.waiting.join(", ") || "no one"}.`}
    >
      <div className="flex w-full flex-wrap gap-2">
        <style>{`
          @keyframes wolf-deal {
            0% { transform: translateY(-2.5rem) rotate(-8deg); opacity: 0; }
            100% { transform: none; opacity: 1; }
          }
          .wolf-deal { animation: wolf-deal 0.55s ease-out both; }
          @media (prefers-reduced-motion: reduce) { .wolf-deal { animation: none; } }
        `}</style>
        {draft.hand.map((card, index) => (
          <CompanyBox
            key={card.id}
            color={stockColor(state, card.stockId)}
            title={`${card.double ? "2× " : ""}${stockName(state, card.stockId)}`}
            detail="Keep"
            disabled={pending}
            className="wolf-deal"
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={() => void act({ action: "draft", cardId: card.id })}
          />
        ))}
        {draft.hand.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting on the other managers.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function useFreshKeys(keys: string[]) {
  const signature = keys.join("\n");
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useLayoutEffect(() => {
    const current = new Set(signature ? signature.split("\n") : []);
    if (seen.current == null) {
      seen.current = current;
      return;
    }
    const arrived = [...current].filter((key) => key && !seen.current?.has(key));
    seen.current = current;
    if (arrived.length === 0) return;
    setFresh(new Set(arrived));
    const timer = window.setTimeout(() => setFresh(new Set()), 1500);
    return () => window.clearTimeout(timer);
  }, [signature]);
  return fresh;
}

function Companies({
  state,
  pending,
  act,
  side,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
  side: "you" | "others";
}) {
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const offerKeys = state.offers.map((offer) => offer.id);
  const dealKeys = state.companies
    .filter((card) => card.investorId != null && card.price != null)
    .map((card) => `${card.id}:${card.investorId}:${card.price}`);
  const fresh = useFreshKeys([...offerKeys, ...dealKeys]);
  if (state.companies.length === 0 || state.phase === "lobby") return null;
  const stockOrder = new Map(state.stocks.map((stock, index) => [stock.id, index]));
  const tables = state.seats
    .map((seat) => ({
      seat,
      cards: state.companies
        .filter((card) => card.managerId === seat.userId)
        .sort(
          (a, b) =>
            (stockOrder.get(a.stockId) ?? 0) - (stockOrder.get(b.stockId) ?? 0) ||
            Number(a.double) - Number(b.double)
        ),
    }))
    .filter((table) => table.cards.length > 0)
    .filter(({ seat }) => (side === "you" ? seat.userId === state.you.id : seat.userId !== state.you.id));
  if (tables.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {tables.map(({ seat, cards }) => (
        <Card key={seat.userId} className="min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {side === "you" ? "Your 🏢" : seat.username}
            </CardTitle>
            {side === "you" ? null : (
              <CardDescription className="flex flex-wrap gap-2">
                <span aria-label={`${seat.cash} cash`}>💵 {seat.cash}</span>
                {seat.investing ? <span aria-label={`${seat.tokens} tokens`}>🪙 {seat.tokens}</span> : null}
                <span aria-label={`${cards.length} companies`}>🏢 {cards.length}</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {cards.map((card) => {
              const color = stockColor(state, card.stockId);
              const offers = state.offers
                .filter((offer) => offer.cardId === card.id)
                .map((offer) => ({ offer, kind: quoteKind(offer, card.managerId) }))
                .sort((a, b) => quoteRank(a.kind) - quoteRank(b.kind) || a.offer.price - b.offer.price);
              const canBid =
                state.phase === "negotiation" &&
                state.you.investing &&
                card.managerId !== state.you.id &&
                !card.locked;
              const canAsk = state.phase === "negotiation" && card.managerId === state.you.id && !card.locked;
              const canQuote = canBid || canAsk;
              const dealKey =
                card.investorId != null && card.price != null ? `${card.id}:${card.investorId}:${card.price}` : null;
              return (
                <div
                  key={card.id}
                  data-wolf={`card:${card.id}`}
                  className={card.locked ? "rounded-2xl ring-2 ring-amber-400" : undefined}
                  onClick={() => {
                    if (!canQuote) return;
                    setQuotingId(card.id);
                  }}
                >
                  <CompanyBox
                    fill
                    color={color}
                    title={`${card.double ? "2× " : ""}${stockName(state, card.stockId)}`}
                    detail={
                      canQuote && quotingId !== card.id
                        ? canAsk
                          ? "Ask or close"
                          : "Bid"
                        : card.locked
                          ? "Closed"
                          : undefined
                    }
                    className={canQuote ? "cursor-pointer" : undefined}
                    tokens={
                      card.investorName != null || offers.length > 0 ? (
                        <span className="mb-1 flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {card.investorName != null && card.price != null ? (
                          <InvestorToken
                            name={card.investorName}
                            amount={card.price}
                            locked={card.locked}
                            note={card.locked ? "close" : undefined}
                            drop={dealKey != null && fresh.has(dealKey)}
                          />
                        ) : null}
                        {offers.map(({ offer, kind }) => (
                            <InvestorToken
                              key={offer.id}
                              name={offer.fromName}
                              amount={offer.price}
                              drop={fresh.has(offer.id)}
                              note={kind}
                            >
                              {canTakeQuote(state, offer, card.managerId) ? (
                                <Button
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px]"
                                  disabled={pending}
                                  onClick={() => void act({ action: "accept", offerId: offer.id })}
                                >
                                  Take
                                </Button>
                              ) : null}
                              {offer.fromId === state.you.id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 bg-white/90 px-1.5 text-[10px] text-[#1c120c]"
                                  disabled={pending}
                                  onClick={() => void act({ action: "cancelOffer", offerId: offer.id })}
                                >
                                  Pull
                                </Button>
                              ) : null}
                            </InvestorToken>
                          ))}
                      </span>
                      ) : undefined
                    }
                  >
                    {quotingId === card.id && canQuote ? (
                      <QuoteForm
                        mode={canAsk ? "ask" : "bid"}
                        pending={pending}
                        onSubmit={async (price, kind) => {
                          const ok = await act({
                            action: "offer",
                            cardId: card.id,
                            price,
                            kind,
                          });
                          if (ok) setQuotingId(null);
                        }}
                      />
                    ) : null}
                    {state.phase === "negotiation" &&
                    (card.managerId === state.you.id || card.investorId === state.you.id) &&
                    card.investorId != null &&
                    !card.locked ? (
                      <span className="mt-2 flex gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => void act({ action: "pull", cardId: card.id })}
                        >
                          Pull deal
                        </Button>
                        {card.managerId === state.you.id ? (
                          <Button size="sm" disabled={pending} onClick={() => void act({ action: "lock", cardId: card.id })}>
                            Close deal
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </CompanyBox>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function quoteKind(
  offer: WolfView["offers"][number],
  managerId: number | null
): "bid" | "ask" | "close" {
  if (offer.kind === "bid" || offer.kind === "ask" || offer.kind === "close") return offer.kind;
  if (offer.lock) return "close";
  return offer.fromId === managerId ? "ask" : "bid";
}

function quoteRank(kind: "bid" | "ask" | "close") {
  if (kind === "bid") return 0;
  if (kind === "ask") return 1;
  return 2;
}

function canTakeQuote(state: WolfView, offer: WolfView["offers"][number], managerId: number | null) {
  if (state.phase !== "negotiation" || offer.fromId === state.you.id || managerId == null) return false;
  if (offer.toId != null) return offer.toId === state.you.id;
  if (offer.fromId === managerId) return state.you.investing && state.you.id !== managerId;
  return state.you.id === managerId;
}

function QuoteForm({
  mode,
  pending,
  onSubmit,
}: {
  mode: "bid" | "ask";
  pending: boolean;
  onSubmit: (price: number, kind: "bid" | "ask" | "close") => Promise<void>;
}) {
  const [amount, setAmount] = useState("10");
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(Number(amount), mode);
      }}
    >
      <Input
        autoFocus
        inputMode="numeric"
        aria-label="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="h-8 w-20 bg-background text-foreground"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {mode === "bid" ? "Bid" : "Ask"}
      </Button>
      {mode === "ask" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => void onSubmit(Number(amount), "close")}
        >
          Close
        </Button>
      ) : null}
    </form>
  );
}

function InvestorToken({
  name,
  amount,
  locked,
  drop,
  note,
  children,
}: {
  name: string;
  amount: number;
  locked?: boolean;
  drop?: boolean;
  note?: string;
  children?: ReactNode;
}) {
  const tone = note === "bid" || note === "ask" || note === "close" ? note : locked ? "locked" : "deal";
  return (
    <span className={cn("wolf-chip", `wolf-chip-${tone}`, drop && "wolf-token-drop")}>
      <style>{tokenCss}</style>
      <span className="wolf-chip-face" aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="wolf-chip-copy">
        <span className="wolf-chip-name">{name}</span>
        <span className="wolf-chip-amount">{amount}</span>
      </span>
      <span className="wolf-chip-kind">{locked ? "closed" : (note ?? "deal")}</span>
      {children}
    </span>
  );
}

const tokenCss = `
@keyframes wolf-token-drop {
  0% { transform: translateY(-5rem) scale(0.84) rotate(-8deg); }
  42% { transform: translateY(-2.5rem) scale(0.94) rotate(3deg); }
  70% { transform: translateY(0.42rem) scale(1.08) rotate(-1deg); }
  84% { transform: translateY(-0.38rem) scale(0.98); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}
.wolf-token-drop { position: relative; z-index: 3; animation: wolf-token-drop 1.4s linear both; }
@media (prefers-reduced-motion: reduce) {
  .wolf-token-drop { animation: none; }
}
.wolf-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  padding: 0.15rem 0.5rem 0.15rem 0.15rem;
  color: #fffaf3;
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1;
  box-shadow: 0 6px 12px rgba(28, 18, 12, 0.22);
}
.wolf-chip-bid {
  border-radius: 999px;
  background:
    repeating-conic-gradient(from 0deg, rgba(255,255,255,0.28) 0 6deg, transparent 6deg 14deg),
    radial-gradient(circle at 30% 25%, #86efac, #16a34a 46%, #14532d);
  box-shadow: 0 0 0 2px #dcfce7, 0 0 0 4px #166534, 0 6px 12px rgba(20, 83, 45, 0.35);
}
.wolf-chip-ask {
  border-radius: 0.35rem 999px 999px 0.35rem;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.18), transparent 28%),
    radial-gradient(circle at 20% 20%, #fda4af, #e11d48 48%, #881337);
  box-shadow: 0 0 0 2px #ffe4e6, 0 0 0 4px #9f1239, 0 6px 12px rgba(136, 19, 55, 0.35);
}
.wolf-chip-close {
  border-radius: 999px;
  color: #1c120c;
  background:
    repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0 2px, transparent 2px 5px),
    radial-gradient(circle at 32% 28%, #fde68a, #d97706 52%, #92400e);
  box-shadow: 0 0 0 2px #fff7d6, 0 0 0 4px #b45309, 0 6px 12px rgba(146, 64, 14, 0.3);
}
.wolf-chip-locked {
  border-radius: 999px;
  color: #1c120c;
  background:
    repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0 2px, transparent 2px 5px),
    radial-gradient(circle at 32% 28%, #fde68a, #d97706 52%, #92400e);
  box-shadow: 0 0 0 2px #fff7d6, 0 0 0 4px #b45309, 0 6px 12px rgba(146, 64, 14, 0.3);
}
.wolf-chip-deal {
  border-radius: 0.7rem;
  color: #1c120c;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.55), transparent 40%),
    radial-gradient(circle at 30% 20%, #fff7ed, #e7d3b0 62%, #a8906a);
  box-shadow: 0 0 0 2px #fffaf3, 0 0 0 4px #8a7048, 0 6px 12px rgba(90, 64, 32, 0.25);
}
.wolf-chip-face {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: none;
  place-items: center;
  border-radius: 999px;
  font-family: var(--font-heading), serif;
  font-size: 0.85rem;
  font-weight: 700;
  background:
    repeating-conic-gradient(from 8deg, rgba(255,255,255,0.4) 0 10deg, transparent 10deg 20deg),
    rgba(0, 0, 0, 0.16);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}
.wolf-chip-ask .wolf-chip-face { border-radius: 0.3rem; }
.wolf-chip-copy { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
.wolf-chip-name { max-width: 5.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wolf-chip-amount { font-variant-numeric: tabular-nums; font-size: 0.84rem; letter-spacing: 0.04em; }
.wolf-chip-kind { font-size: 0.58rem; font-weight: 750; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.92; }
`;

function Upkeep({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const owned = state.companies.filter((card) => card.managerId === state.you.id);
  const [picked, setPicked] = useState<string[]>([]);
  if (state.mustSell < 1) {
    return (
      <PhaseNote
        title="Upkeep"
        body="Waiting on a manager who cannot pay 10 per company. They sell the fewest companies to the bank for 5 each. Those companies go to the bottom of the deck. The manager cannot buy them back."
        action=""
        pending={pending}
        onClick={() => undefined}
      />
    );
  }
  return (
    <Panel
      title={`Sell ${state.mustSell} to the bank`}
      body={`You cannot cover 10 per company. Sell exactly ${state.mustSell} for 5 each.`}
      className="bg-primary/10"
    >
      <div className="flex w-full flex-wrap gap-2">
        {owned.map((card) => {
          const on = picked.includes(card.id);
          return (
            <CompanyBox
              key={card.id}
              color={stockColor(state, card.stockId)}
              title={`${card.double ? "2× " : ""}${stockName(state, card.stockId)}`}
              detail={on ? "Selected" : "Sell"}
              selected={on}
              onClick={() =>
                setPicked((prev) => (prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]))
              }
            />
          );
        })}
      </div>
      <Button disabled={pending || picked.length !== state.mustSell} onClick={() => void act({ action: "sell", cardIds: picked })}>
        Sell to the bank
      </Button>
    </Panel>
  );
}

function Auction({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const auction = state.auction;
  const [amount, setAmount] = useState("0");
  if (!auction) return null;
  const manager = state.you.role === "manager" || state.you.role === "both";
  const color = stockColor(state, auction.stockId);
  const sealed = state.seats.filter(
    (seat) => (seat.role === "manager" || seat.role === "both") && !auction.waiting.includes(seat.username)
  );
  return (
    <Card key={`${auction.stockId}:${auction.left}:${auction.tieFloor}`} className="wolf-auction overflow-hidden">
      <style>{`
        @keyframes wolf-auction-in {
          0% { transform: translateY(-3rem) rotate(-8deg) scale(0.86); opacity: 0; }
          70% { transform: translateY(0.3rem) rotate(1deg) scale(1.03); opacity: 1; }
          100% { transform: none; }
        }
        .wolf-auction { animation: wolf-auction-in 0.7s ease-out both; }
        @keyframes wolf-seal {
          0% { transform: translateY(-1rem) scale(0.8); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        .wolf-seal { animation: wolf-seal 0.45s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .wolf-auction, .wolf-seal { animation: none; }
        }
      `}</style>
      <div className="px-4 py-3" style={{ background: color, color: ink(color) }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Auction</p>
        <h2 className="font-heading text-2xl">
          {auction.double ? "2× " : ""}
          {stockName(state, auction.stockId)}
        </h2>
      </div>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          🏢 {auction.left} still up.{" "}
          {auction.tieFloor > 0 ? `Tied at 💵 ${auction.tieFloor}. Bid higher, or 0 to drop.` : "Bid 0 to pass."} Waiting
          on {auction.waiting.join(", ") || "no one"}.
        </p>
        <div className="flex flex-wrap gap-2">
          {sealed.map((seat, index) => (
            <span
              key={seat.userId}
              className="wolf-seal rounded-full bg-amber-200 px-2 py-1 text-xs font-semibold text-[#1c120c]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {seat.username} sealed
              {seat.userId === state.you.id && auction.yourBid != null ? ` 💵 ${auction.yourBid}` : ""}
            </span>
          ))}
        </div>
        {manager && auction.youBid ? (
          <div className="flex gap-2">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} className="max-w-32" aria-label="Bid" />
            <Button disabled={pending} onClick={() => void act({ action: "bid", amount: Number(amount) })}>
              Bid
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {auction.yourBid != null ? `Your bid is 💵 ${auction.yourBid}.` : "Investors watch this one."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Score({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const winners = state.winners;
  const ranked = [...state.seats].sort((a, b) => b.cash - a.cash || a.username.localeCompare(b.username));
  const names = new Set([...(winners?.managers ?? []), ...(winners?.investors ?? [])]);
  return (
    <section className="wolf-results rounded-2xl bg-primary/15 p-4 ring-1 ring-primary/30">
      <style>{`
        @keyframes wolf-results {
          0% { transform: translateY(1rem); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        .wolf-results { animation: wolf-results 0.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .wolf-results { animation: none; } }
      `}</style>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Results</p>
      <h2 className="mt-1 font-heading text-3xl">
        {winners
          ? state.combo
            ? `${winners.managers.join(", ")} wins`
            : `${winners.managers.join(", ")} · managers. ${winners.investors.join(", ")} · investors.`
          : "The street closes"}
      </h2>
      <ol className="mt-4 space-y-2">
        {ranked.map((seat, index) => {
          const companies = state.companies.filter((card) => card.managerId === seat.userId).length;
          const winner = names.has(seat.username);
          return (
            <li
              key={seat.userId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2",
                winner ? "bg-amber-300/40 ring-2 ring-amber-500" : "bg-background/70"
              )}
            >
              <span className="font-heading text-xl">
                {index + 1}. {seat.username}
                {winner ? " 🏆" : ""}
              </span>
              <span className="flex gap-3 text-sm">
                <span aria-label={`${seat.cash} cash`}>💵 {seat.cash}</span>
                <span aria-label={`${seat.tokens} tokens`}>🪙 {seat.tokens}</span>
                <span aria-label={`${companies} companies`}>🏢 {companies}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {state.you.office ? (
        <Button className="mt-4" disabled={pending} onClick={() => void act({ action: "reset" })}>
          Back to the lobby
        </Button>
      ) : null}
    </section>
  );
}

function PhaseNote({
  title,
  body,
  action,
  pending,
  onClick,
}: {
  title: string;
  body: string;
  action: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Panel title={title} body={body}>
      {action ? (
        <Button disabled={pending} onClick={onClick}>
          {action}
        </Button>
      ) : null}
    </Panel>
  );
}

function Log({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <Panel title="Tape">
      <ul className="space-y-1 text-sm text-muted-foreground">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </Panel>
  );
}

function CompanyBox({
  color,
  title,
  detail,
  children,
  tokens,
  onClick,
  disabled,
  selected,
  fill,
  className: extra,
  style: extraStyle,
}: {
  color: string;
  title: string;
  detail?: string;
  children?: ReactNode;
  tokens?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const fg = ink(color);
  const doubled = title.startsWith("2×");
  const name = doubled ? title.replace(/^2×\s*/, "") : title;
  const seal = name.slice(0, 1).toUpperCase();
  const className = cn(
    "relative min-w-0 rounded-2xl px-3 py-2.5 text-left text-sm",
    fill ? "w-full" : "min-w-40",
    onClick && "transition hover:brightness-110 disabled:opacity-50",
    selected && "ring-2 ring-offset-2",
    extra
  );
  const style = {
    background: `radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.28), transparent 42%), repeating-linear-gradient(-45deg, transparent 0 7px, rgba(0,0,0,0.05) 7px 8px), ${color}`,
    color: fg,
    boxShadow: `inset 0 0 0 1px ${fg}73, inset 0 0 0 5px transparent, inset 0 0 0 6px ${fg}59, 0 10px 18px rgba(28,18,12,0.14)`,
    outline: selected ? `2px solid ${fg}` : undefined,
    outlineOffset: selected ? 2 : undefined,
    ...extraStyle,
  };
  const body = (
    <>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
        <span>Company</span>
        <span className="rounded-full px-1.5 py-0.5 ring-1 ring-current">
          {doubled ? "2× share" : "Share"}
        </span>
      </span>
      {tokens ? <span className="relative z-[1] mb-1.5 flex flex-wrap gap-1.5">{tokens}</span> : null}
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0">
          <p className="font-heading text-lg leading-none tracking-wide">{name}</p>
          {detail ? <p className="mt-1 text-xs opacity-80">{detail}</p> : null}
        </span>
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full font-heading text-base font-semibold"
          style={{
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.6), transparent 42%), ${fg}1f`,
            boxShadow: `inset 0 0 0 2px ${fg}99, inset 0 0 0 4px transparent, inset 0 0 0 5px ${fg}66`,
          }}
        >
          {seal}
        </span>
      </span>
      {children}
    </>
  );
  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={className} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

function stockName(state: WolfView, stockId: string) {
  return state.stocks.find((stock) => stock.id === stockId)?.name ?? stockId;
}

function YouColumn({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<boolean>;
}) {
  const companies = state.companies.filter((card) => card.managerId === state.you.id).length;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">{state.you.username}</CardTitle>
          <CardDescription className="flex flex-wrap gap-3 text-base text-foreground">
            <span data-wolf={`purse:${state.you.id}`} aria-label={`${state.you.cash} cash`}>
              💵 {state.you.cash}
            </span>
            {state.you.investing ? (
              <span aria-label={`${state.you.tokens} tokens`}>🪙 {state.you.tokens}</span>
            ) : null}
            <span aria-label={`${companies} companies`}>🏢 {companies}</span>
          </CardDescription>
        </CardHeader>
      </Card>
      <Companies state={state} pending={pending} act={act} side="you" />
    </div>
  );
}

function SeatPurses({ state }: { state: WolfView }) {
  const others = state.seats.filter((seat) => seat.userId !== state.you.id);
  if (others.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {others.map((seat) => (
        <span
          key={seat.userId}
          data-wolf={`purse:${seat.userId}`}
          className="rounded-full bg-card px-3 py-1 text-sm ring-1 ring-border"
        >
          {seat.username} <span aria-label={`${seat.cash} cash`}>💵 {seat.cash}</span>
          {seat.investing ? <span aria-label={`${seat.tokens} tokens`}> 🪙 {seat.tokens}</span> : null}
        </span>
      ))}
    </div>
  );
}

type Flight = { id: string; fromKey: string; toKey: string; label: string };

function useCashFlights(state: WolfView, previous: { current: WolfView }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const hide = useRef<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === state || before.phase === state.phase) return;
    const next: Flight[] = [];
    if (state.phase === "market") {
      for (const card of state.companies) {
        if (card.investorId == null) continue;
        const stock = state.stocks.find((row) => row.id === card.stockId);
        const amount = (stock?.value ?? 0) * (card.double ? 2 : 1);
        if (amount === 0) continue;
        next.push(
          amount > 0
            ? { id: `m-${card.id}`, fromKey: `card:${card.id}`, toKey: `purse:${card.investorId}`, label: `💵 ${amount}` }
            : {
                id: `m-${card.id}`,
                fromKey: `purse:${card.investorId}`,
                toKey: `card:${card.id}`,
                label: `💵 ${Math.abs(amount)}`,
              }
        );
      }
    }
    if (state.phase === "fees" && before.phase === "market") {
      for (const card of before.companies) {
        if (card.investorId == null || card.managerId == null || !card.price) continue;
        next.push({
          id: `f-${card.id}`,
          fromKey: `purse:${card.investorId}`,
          toKey: `purse:${card.managerId}`,
          label: `💵 ${card.price}`,
        });
      }
    }
    if (next.length === 0) return;
    setFlights(next);
    if (hide.current != null) window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setFlights([]), 1700);
  }, [previous, state]);
  return flights;
}

function CashFlights({ flights }: { flights: Flight[] }) {
  const [dots, setDots] = useState<{ id: string; label: string; x: number; y: number; dx: number; dy: number }[]>([]);
  useLayoutEffect(() => {
    if (flights.length === 0) {
      setDots([]);
      return;
    }
    setDots(
      flights.flatMap((flight) => {
        const from = document.querySelector(`[data-wolf="${flight.fromKey}"]`);
        const to = document.querySelector(`[data-wolf="${flight.toKey}"]`);
        if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) return [];
        const start = from.getBoundingClientRect();
        const end = to.getBoundingClientRect();
        const x = start.left + start.width / 2;
        const y = start.top + start.height / 2;
        return [
          {
            id: flight.id,
            label: flight.label,
            x,
            y,
            dx: end.left + end.width / 2 - x,
            dy: end.top + end.height / 2 - y,
          },
        ];
      })
    );
  }, [flights]);
  if (dots.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <style>{`
        @keyframes wolf-cash {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          18% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.85); }
        }
        .wolf-cash { position: fixed; font-weight: 700; animation: wolf-cash 1.35s ease-in forwards; }
        @media (prefers-reduced-motion: reduce) { .wolf-cash { animation: none; opacity: 0; } }
      `}</style>
      {dots.map((dot, index) => (
        <span
          key={dot.id}
          className="wolf-cash"
          style={{
            left: dot.x,
            top: dot.y,
            animationDelay: `${index * 80}ms`,
            ["--dx" as string]: `${dot.dx}px`,
            ["--dy" as string]: `${dot.dy}px`,
          }}
        >
          {dot.label}
        </span>
      ))}
    </div>
  );
}
