"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_NAME } from "@/lib/game/brand";
import { cn } from "@/lib/utils";
import type { SeatRole, StockDef, WolfView } from "@/lib/wolf/types";

type Action = Record<string, unknown> & { action: string };

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

export function WolfScreen({ initial }: { initial: WolfView }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(initial.now);

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
        return;
      }
      setState(data);
    } catch {
      setError("Network hiccup. Try again.");
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
        <p className="w-full truncate px-3 pb-2 text-sm text-muted-foreground sm:px-4">
          {state.phase === "lobby" ? "Lobby" : `Round ${state.round} · ${phaseLabel(state.phase)}`}
          {clock ? ` · ${clock}` : ""}
          {state.you.seated ? ` · ${role}` : ""}
          {state.you.seated && state.phase !== "lobby" ? ` · ${state.you.cash} cash` : ""}
          {state.you.seated && state.phase !== "lobby" && state.you.investing
            ? ` · ${state.you.tokens} tokens`
            : ""}
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-4">
        {error ? (
          <p className="rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
            {error}
            <button type="button" className="ml-3 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </p>
        ) : null}
        <Tracks stocks={state.stocks} />
        {state.phase === "lobby" ? <Lobby state={state} pending={pending} act={act} /> : null}
        {state.phase === "draft" && state.draft ? (
          <Draft state={state} pending={pending} act={act} />
        ) : null}
        {state.phase === "negotiation" ? <Floor state={state} pending={pending} act={act} /> : null}
        {state.phase === "market" ? (
          <PhaseNote
            title="The market moved"
            body="Investors have been paid, or billed, for every company they held."
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
                ? "A traveler who cannot cover every fee pays the managers nothing. Their cash and investor tokens are wiped, and they stay in as a manager."
                : "A traveler who cannot cover every fee pays the managers nothing. Their cash is wiped, the bank lends 100, and one token is repaid at the end. Cash on the table is public, so a manager can judge whether the promise is good."
            }
            action="Pay upkeep"
            pending={pending}
            onClick={() => void act({ action: "upkeep" })}
          />
        ) : null}
        {state.phase === "upkeep" ? <Upkeep state={state} pending={pending} act={act} /> : null}
        {state.phase === "auction" && state.auction ? (
          <Auction state={state} pending={pending} act={act} />
        ) : null}
        {state.phase === "score" ? <Score state={state} pending={pending} act={act} /> : null}
        <Companies state={state} pending={pending} act={act} />
        <Log lines={state.log} />
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

function Tracks({ stocks }: { stocks: WolfView["stocks"] }) {
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="grid grid-cols-8 gap-1">
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
  act: (body: Action) => Promise<void>;
}) {
  const plan = state.plan;
  const planText =
    plan === "both"
      ? "With 3 or 4 travelers, each person is both manager and investor."
      : plan
        ? `This table needs ${plan.managers} managers and ${plan.investors} investors.`
        : "Seat 3 to 11 travelers.";
  return (
    <Panel title="Who is at the table" body={`${planText} Everyone starts with 120. Investors hold 10 tokens.`}>
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
      {state.you.office && state.catalog ? <StockEditor stocks={state.catalog} pending={pending} act={act} /> : null}
    </Panel>
  );
}

function StockEditor({
  stocks,
  pending,
  act,
}: {
  stocks: StockDef[];
  pending: boolean;
  act: (body: Action) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a8a29e");
  return (
    <div className="w-full space-y-3 border-t border-border pt-4">
      <h3 className="font-heading text-lg">Stocks</h3>
      <p className="text-sm text-muted-foreground">
        Each stock has its own 8-space track and 6-face die. Ordinary cards and 2× cards are separate. A full set at
        the end is one company of every stock.
      </p>
      {stocks.map((stock) => (
        <StockRow key={stock.id} stock={stock} pending={pending} act={act} />
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="new-stock">New stock</Label>
          <Input id="new-stock" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28" />
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
    </div>
  );
}

function StockRow({
  stock,
  pending,
  act,
}: {
  stock: StockDef;
  pending: boolean;
  act: (body: Action) => Promise<void>;
}) {
  const [track, setTrack] = useState(stock.track.join(", "));
  const [die, setDie] = useState(stock.die.join(", "));
  const [normalCards, setNormal] = useState(String(stock.normalCards));
  const [doubleCards, setDouble] = useState(String(stock.doubleCards));
  const [startIndex, setStart] = useState(String(stock.startIndex + 1));
  const [name, setName] = useState(stock.name);
  const [color, setColor] = useState(stock.color);
  return (
    <div className="overflow-hidden rounded-xl bg-background/40 ring-1 ring-foreground/10">
      <div className="h-2" style={{ background: color }} />
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-40" />
          <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28" />
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void act({ action: "removeStock", stockId: stock.id })}
          >
            Remove
          </Button>
        </div>
        <Label>Track</Label>
        <Input value={track} onChange={(event) => setTrack(event.target.value)} />
        <Label>Die</Label>
        <Input value={die} onChange={(event) => setDie(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Input value={normalCards} onChange={(event) => setNormal(event.target.value)} className="w-24" />
          <Input value={doubleCards} onChange={(event) => setDouble(event.target.value)} className="w-24" />
          <Input value={startIndex} onChange={(event) => setStart(event.target.value)} className="w-24" />
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              void act({
                action: "saveStock",
                stockId: stock.id,
                name,
                color,
                track: track.split(/[^-\d]+/).filter(Boolean).map(Number),
                die: die.split(/[^-\d]+/).filter(Boolean).map(Number),
                startIndex: Number(startIndex) - 1,
                normalCards: Number(normalCards),
                doubleCards: Number(doubleCards),
              })
            }
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Ordinary cards, 2× cards, and the start space (1–8).</p>
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
  act: (body: Action) => Promise<void>;
}) {
  const draft = state.draft;
  if (!draft) return null;
  return (
    <Panel
      title="Keep one company"
      body={`You have kept ${draft.kept}. Still choosing: ${draft.waiting.join(", ") || "no one"}.`}
    >
      <div className="flex w-full flex-wrap gap-2">
        {draft.hand.map((card) => (
          <CompanyBox
            key={card.id}
            color={stockColor(state, card.stockId)}
            title={`${card.double ? "2× " : ""}${stockName(state, card.stockId)}`}
            detail="Keep"
            disabled={pending}
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

function Floor({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<void>;
}) {
  const [price, setPrice] = useState("10");
  const [toId, setToId] = useState("");
  const [cardId, setCardId] = useState(state.companies[0]?.id ?? "");
  const [lock, setLock] = useState(false);
  const targets = state.seats.filter((seat) => seat.userId !== state.you.id);
  return (
    <Panel
      title="Make an offer"
      body="An offer goes to one traveler. A locked deal cannot be pulled. Unlocked deals can be replaced or dropped until the clock ends."
    >
      <div className="grid w-full gap-2 sm:grid-cols-2">
        <select className={fieldClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
          {state.companies.map((card) => (
            <option key={card.id} value={card.id}>
              {card.double ? "2× " : ""}
              {stockName(state, card.stockId)} · {card.managerName}
              {card.price != null ? ` · ${card.price}${card.locked ? " locked" : ""}` : ""}
            </option>
          ))}
        </select>
        <select className={fieldClass} value={toId} onChange={(event) => setToId(event.target.value)}>
          <option value="">To whom</option>
          {targets.map((seat) => (
            <option key={seat.userId} value={seat.userId}>
              {seat.username} · {seat.cash} cash{seat.investing ? ` · ${seat.tokens} tokens` : ""}
            </option>
          ))}
        </select>
        <Input value={price} onChange={(event) => setPrice(event.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lock} onChange={(event) => setLock(event.target.checked)} />
          Lock if they accept
        </label>
      </div>
      <Button
        disabled={pending || !cardId || !toId}
        onClick={() => void act({ action: "offer", cardId, toId: Number(toId), price: Number(price), lock })}
      >
        Send offer
      </Button>
      {state.offers.length > 0 ? (
        <ul className="w-full space-y-2">
          {state.offers.map((offer) => {
            const card = state.companies.find((row) => row.id === offer.cardId);
            const color = stockColor(state, card?.stockId ?? "");
            return (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <CompanyBox
                    color={color}
                    title={companyLabel(state, offer.cardId)}
                    detail={`${offer.fromName} → ${offer.toName}: ${offer.price}${offer.lock ? " · lock" : ""}`}
                  />
                </span>
                <span className="flex gap-2">
                  {offer.toId === state.you.id ? (
                    <Button size="sm" disabled={pending} onClick={() => void act({ action: "accept", offerId: offer.id })}>
                      Accept
                    </Button>
                  ) : null}
                  {offer.fromId === state.you.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void act({ action: "cancelOffer", offerId: offer.id })}
                    >
                      Pull offer
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No open offers.</p>
      )}
    </Panel>
  );
}

function Companies({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<void>;
}) {
  if (state.companies.length === 0 || state.phase === "lobby") return null;
  const tables = state.seats
    .map((seat) => ({
      seat,
      cards: state.companies.filter((card) => card.managerId === seat.userId),
    }))
    .filter((table) => table.cards.length > 0);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tables.map(({ seat, cards }) => (
        <Card key={seat.userId} className="min-w-0">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {seat.username}&apos;s table
              {seat.userId === state.you.id ? " · you" : ""}
            </CardTitle>
            <CardDescription>
              {seat.cash} cash
              {seat.investing ? ` · ${seat.tokens} tokens` : ""}
              {` · ${cards.length} ${cards.length === 1 ? "company" : "companies"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cards.map((card) => {
              const mine = card.managerId === state.you.id || card.investorId === state.you.id;
              return (
                <CompanyBox
                  key={card.id}
                  fill
                  color={stockColor(state, card.stockId)}
                  title={`${card.double ? "2× " : ""}${stockName(state, card.stockId)}`}
                  detail={
                    card.investorName
                      ? `${card.investorName} at ${card.price}${card.locked ? " · locked" : ""}`
                      : "Unsold"
                  }
                >
                  {state.phase === "negotiation" && mine && card.investorId != null && !card.locked ? (
                    <span className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => void act({ action: "pull", cardId: card.id })}
                      >
                        Pull deal
                      </Button>
                      <Button size="sm" disabled={pending} onClick={() => void act({ action: "lock", cardId: card.id })}>
                        Lock
                      </Button>
                    </span>
                  ) : null}
                </CompanyBox>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Upkeep({
  state,
  pending,
  act,
}: {
  state: WolfView;
  pending: boolean;
  act: (body: Action) => Promise<void>;
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
  act: (body: Action) => Promise<void>;
}) {
  const auction = state.auction;
  const [amount, setAmount] = useState("0");
  if (!auction) return null;
  const manager = state.you.role === "manager" || state.you.role === "both";
  const color = stockColor(state, auction.stockId);
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3" style={{ background: color, color: ink(color) }}>
        <h2 className="font-heading text-xl">
          Blind bid · {auction.double ? "2× " : ""}
          {stockName(state, auction.stockId)}
        </h2>
      </div>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {auction.left} still up.{" "}
          {auction.tieFloor > 0 ? `Tied at ${auction.tieFloor}. Bid higher, or 0 to drop.` : "Bid 0 to pass."} Waiting
          on {auction.waiting.join(", ") || "no one"}.
        </p>
        {manager && auction.youBid ? (
          <div className="flex gap-2">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} className="max-w-32" />
            <Button disabled={pending} onClick={() => void act({ action: "bid", amount: Number(amount) })}>
              Bid
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {auction.yourBid != null ? `Your bid is ${auction.yourBid}.` : "Investors watch this one."}
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
  act: (body: Action) => Promise<void>;
}) {
  const winners = state.winners;
  return (
    <Panel title="The street closes" className="bg-primary/15">
      {winners ? (
        <p>
          {state.combo
            ? `${winners.managers.join(", ")} wins.`
            : `${winners.managers.join(", ")} wins among managers. ${winners.investors.join(", ")} wins among investors.`}
        </p>
      ) : null}
      <ul className="text-sm">
        {state.seats.map((seat) => (
          <li key={seat.userId}>
            {seat.username} · {roleLabel(seat.role)} · {seat.cash}
            {seat.lostTokens > 0 ? ` · repaid ${seat.lostTokens} token${seat.lostTokens === 1 ? "" : "s"}` : ""}
          </li>
        ))}
      </ul>
      {state.you.office ? (
        <Button disabled={pending} onClick={() => void act({ action: "reset" })}>
          Back to the lobby
        </Button>
      ) : null}
    </Panel>
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
  onClick,
  disabled,
  selected,
  fill,
}: {
  color: string;
  title: string;
  detail?: string;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  fill?: boolean;
}) {
  const fg = ink(color);
  const className = cn(
    "rounded-xl px-3 py-2 text-left text-sm ring-1 ring-black/15",
    fill ? "w-full" : "min-w-40",
    onClick && "transition hover:brightness-110 disabled:opacity-50",
    selected && "ring-2 ring-offset-2"
  );
  const style = {
    background: color,
    color: fg,
    outline: selected ? `2px solid ${fg}` : undefined,
    outlineOffset: selected ? 2 : undefined,
  };
  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={className} style={style}>
        <p className="font-heading text-base leading-tight">{title}</p>
        {detail ? <p className="text-xs opacity-80">{detail}</p> : null}
        {children}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      <p className="font-heading text-base leading-tight">{title}</p>
      {detail ? <p className="text-xs opacity-80">{detail}</p> : null}
      {children}
    </div>
  );
}

function stockName(state: WolfView, stockId: string) {
  return state.stocks.find((stock) => stock.id === stockId)?.name ?? stockId;
}

function companyLabel(state: WolfView, cardId: string) {
  const card = state.companies.find((row) => row.id === cardId);
  if (!card) return "a company";
  return `${card.double ? "2× " : ""}${stockName(state, card.stockId)}`;
}
