"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SeatRole, StockDef, WolfView } from "@/lib/wolf/types";

type Action = Record<string, unknown> & { action: string };

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

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-200/80 uppercase">TrillionTape</p>
            <h1 className="font-heading text-2xl">Wolf Street</h1>
          </div>
          <div className="text-right text-sm">
            <p>
              {state.phase === "lobby" ? "Lobby" : `Round ${state.round} · ${phaseLabel(state.phase)}`}
              {clock ? ` · ${clock}` : ""}
            </p>
            {state.you.seated ? (
              <p className="text-zinc-400">
                {state.you.username} ·{" "}
                {state.phase === "lobby" && state.plan === "both"
                  ? "Manager and investor"
                  : roleLabel(state.you.role)}
                {state.phase === "lobby" ? "" : ` · ${state.you.cash} cash`}
                {state.phase !== "lobby" && state.you.investing ? ` · ${state.you.tokens} tokens` : ""}
              </p>
            ) : (
              <p className="text-zinc-400">{state.you.username}</p>
            )}
          </div>
          <Link href="/play" className="text-sm text-amber-200 underline-offset-2 hover:underline">
            Desk
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 pb-16">
        {error ? (
          <p className="rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">
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

function Tracks({ stocks }: { stocks: WolfView["stocks"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stocks.map((stock) => (
        <section key={stock.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-heading text-lg" style={{ color: stock.color }}>
              {stock.name}
            </h2>
            <p className="text-sm tabular-nums">
              {stock.roll == null ? "Start" : stock.roll > 0 ? `+${stock.roll}` : stock.roll} · {stock.value}
            </p>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {stock.track.map((value, index) => (
              <div
                key={`${stock.id}-${index}`}
                className="rounded px-0.5 py-1 text-center text-[11px] tabular-nums"
                style={{
                  background: index === stock.index ? stock.color : "transparent",
                  color: index === stock.index ? "#18181b" : "#e4e4e7",
                  outline: index === stock.startIndex ? `1px solid ${stock.color}` : undefined,
                }}
              >
                {value}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
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
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <h2 className="font-heading text-xl">Who is at the table</h2>
        <p className="text-sm text-zinc-400">{planText} Everyone starts with 120. Investors hold 10 tokens.</p>
      </div>
      <ul className="space-y-2">
        {state.seats.map((seat) => (
          <li key={seat.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {seat.username}
              {seat.userId === state.you.id ? " · you" : ""}
            </span>
            {state.you.office && plan !== "both" ? (
              <select
                className="h-9 rounded-md border border-white/15 bg-zinc-900 px-2"
                value={seat.role}
                onChange={(event) =>
                  void act({ action: "assign", userId: seat.userId, role: event.target.value })
                }
              >
                <option value="investor">Investor</option>
                <option value="manager">Manager</option>
              </select>
            ) : (
              <span className="text-zinc-400">
                {plan === "both" ? "Manager and investor" : roleLabel(seat.role)}
              </span>
            )}
          </li>
        ))}
        {state.seats.length === 0 ? <li className="text-sm text-zinc-400">No one is seated.</li> : null}
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
    </section>
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
    <div className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="font-heading text-lg">Stocks</h3>
      <p className="text-sm text-zinc-400">
        Each stock has its own 8-space track and 6-face die. Ordinary cards and 2× cards are separate. A full set at
        the end is one company of every stock.
      </p>
      {stocks.map((stock) => (
        <StockRow key={stock.id} stock={stock} pending={pending} act={act} />
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="new-stock">New stock</Label>
          <Input id="new-stock" value={name} onChange={(event) => setName(event.target.value)} className="bg-zinc-900" />
        </div>
        <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28 bg-zinc-900" />
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
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <div className="flex flex-wrap gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-40 bg-zinc-900" />
        <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28 bg-zinc-900" />
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
      <Input value={track} onChange={(event) => setTrack(event.target.value)} className="bg-zinc-900" />
      <Label>Die</Label>
      <Input value={die} onChange={(event) => setDie(event.target.value)} className="bg-zinc-900" />
      <div className="flex flex-wrap gap-2">
        <Input value={normalCards} onChange={(event) => setNormal(event.target.value)} className="w-24 bg-zinc-900" />
        <Input value={doubleCards} onChange={(event) => setDouble(event.target.value)} className="w-24 bg-zinc-900" />
        <Input value={startIndex} onChange={(event) => setStart(event.target.value)} className="w-24 bg-zinc-900" />
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
      <p className="text-xs text-zinc-500">Ordinary cards, 2× cards, and the start space (1–8).</p>
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
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-heading text-xl">Keep one company</h2>
      <p className="text-sm text-zinc-400">
        You have kept {draft.kept}. Still choosing: {draft.waiting.join(", ") || "no one"}.
      </p>
      <div className="flex flex-wrap gap-2">
        {draft.hand.map((card) => (
          <Button key={card.id} disabled={pending} onClick={() => void act({ action: "draft", cardId: card.id })}>
            Keep {card.double ? "2× " : ""}
            {stockName(state, card.stockId)}
          </Button>
        ))}
        {draft.hand.length === 0 ? <p className="text-sm text-zinc-400">Waiting on the other managers.</p> : null}
      </div>
    </section>
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
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-heading text-xl">Make an offer</h2>
      <p className="text-sm text-zinc-400">
        An offer goes to one traveler. A locked deal cannot be pulled. Unlocked deals can be replaced or dropped until
        the clock ends.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="h-10 rounded-md border border-white/15 bg-zinc-900 px-2" value={cardId} onChange={(event) => setCardId(event.target.value)}>
          {state.companies.map((card) => (
            <option key={card.id} value={card.id}>
              {card.double ? "2× " : ""}
              {stockName(state, card.stockId)} · {card.managerName}
              {card.price != null ? ` · ${card.price}${card.locked ? " locked" : ""}` : ""}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border border-white/15 bg-zinc-900 px-2" value={toId} onChange={(event) => setToId(event.target.value)}>
          <option value="">To whom</option>
          {targets.map((seat) => (
            <option key={seat.userId} value={seat.userId}>
              {seat.username} · {seat.cash} cash{seat.investing ? ` · ${seat.tokens} tokens` : ""}
            </option>
          ))}
        </select>
        <Input value={price} onChange={(event) => setPrice(event.target.value)} className="bg-zinc-900" />
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
        <ul className="space-y-2">
          {state.offers.map((offer) => (
            <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {offer.fromName} → {offer.toName}: {offer.price}
                {offer.lock ? " · lock" : ""} on {companyLabel(state, offer.cardId)}
              </span>
              <span className="flex gap-2">
                {offer.toId === state.you.id ? (
                  <Button size="sm" disabled={pending} onClick={() => void act({ action: "accept", offerId: offer.id })}>
                    Accept
                  </Button>
                ) : null}
                {offer.fromId === state.you.id ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => void act({ action: "cancelOffer", offerId: offer.id })}>
                    Pull offer
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No open offers.</p>
      )}
    </section>
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
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-lg">Companies</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {state.companies.map((card) => {
          const mine = card.managerId === state.you.id || card.investorId === state.you.id;
          return (
            <li key={card.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <p style={{ color: state.stocks.find((stock) => stock.id === card.stockId)?.color }}>
                {card.double ? "2× " : ""}
                {stockName(state, card.stockId)}
              </p>
              <p className="text-zinc-400">
                {card.managerName}
                {card.investorName ? ` · ${card.investorName} at ${card.price}` : " · unsold"}
                {card.locked ? " · locked" : ""}
              </p>
              {state.phase === "negotiation" && mine && card.investorId != null ? (
                <span className="mt-2 flex gap-2">
                  {!card.locked ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => void act({ action: "pull", cardId: card.id })}>
                      Pull deal
                    </Button>
                  ) : null}
                  {!card.locked ? (
                    <Button size="sm" disabled={pending} onClick={() => void act({ action: "lock", cardId: card.id })}>
                      Lock
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
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
    <section className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-950/30 p-4">
      <h2 className="font-heading text-xl">Sell {state.mustSell} to the bank</h2>
      <p className="text-sm text-zinc-300">You cannot cover 10 per company. Sell exactly {state.mustSell} for 5 each.</p>
      <div className="flex flex-wrap gap-2">
        {owned.map((card) => {
          const on = picked.includes(card.id);
          return (
            <Button
              key={card.id}
              variant={on ? "default" : "outline"}
              onClick={() =>
                setPicked((prev) => (prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]))
              }
            >
              {card.double ? "2× " : ""}
              {stockName(state, card.stockId)}
            </Button>
          );
        })}
      </div>
      <Button disabled={pending || picked.length !== state.mustSell} onClick={() => void act({ action: "sell", cardIds: picked })}>
        Sell to the bank
      </Button>
    </section>
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
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-heading text-xl">
        Blind bid · {auction.double ? "2× " : ""}
        {stockName(state, auction.stockId)}
      </h2>
      <p className="text-sm text-zinc-400">
        {auction.left} still up. {auction.tieFloor > 0 ? `Tied at ${auction.tieFloor}. Bid higher, or 0 to drop.` : "Bid 0 to pass."} Waiting
        on {auction.waiting.join(", ") || "no one"}.
      </p>
      {manager && auction.youBid ? (
        <div className="flex gap-2">
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} className="max-w-32 bg-zinc-900" />
          <Button disabled={pending} onClick={() => void act({ action: "bid", amount: Number(amount) })}>
            Bid
          </Button>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">{auction.yourBid != null ? `Your bid is ${auction.yourBid}.` : "Investors watch this one."}</p>
      )}
    </section>
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
    <section className="space-y-3 rounded-xl border border-amber-300/40 bg-amber-950/40 p-4">
      <h2 className="font-heading text-xl">The street closes</h2>
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
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-heading text-xl">{title}</h2>
      <p className="text-sm text-zinc-400">{body}</p>
      {action ? (
        <Button disabled={pending} onClick={onClick}>
          {action}
        </Button>
      ) : null}
    </section>
  );
}

function Log({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section>
      <h2 className="font-heading text-lg">Tape</h2>
      <ul className="mt-2 space-y-1 text-sm text-zinc-400">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </section>
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
