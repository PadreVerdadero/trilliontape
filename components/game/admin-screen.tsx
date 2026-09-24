"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_STARTING_GOLD, STIPEND_PRESETS, stipendLabel } from "@/lib/game/catalog";
import { ItemIcon } from "@/components/game/item-icon";
import { ShareEditor } from "@/components/game/share-editor";
import { MIN_SHARE_TYPES, playItemMap, playItems } from "@/lib/game/shares";
import { MAX_COMPUTERS } from "@/lib/game/bots";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { SoundToggle } from "@/components/game/sound-toggle";
import { MobileToggle } from "@/components/game/mobile-toggle";
import { GoalEditor } from "@/components/game/goal-editor";
import { StipendEditor } from "@/components/game/stipend-editor";
import { useGame } from "@/hooks/use-game";
import { useMobileLayout } from "@/hooks/use-mobile-layout";
import { useSelectedItem } from "@/hooks/use-selected-item";
import { cn } from "@/lib/utils";
import { GAME_NAME } from "@/lib/game/brand";
import type { GameState } from "@/lib/game/types";

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminScreen({
  initialState,
  initialItemId,
}: {
  initialState: GameState;
  initialItemId?: string;
}) {
  const { state, error, loading, pending, run, setError } = useGame(initialState);
  const catalog = playItems(state?.items);
  const catalogById = playItemMap(catalog);
  const [itemId, setItemId] = useSelectedItem(
    initialItemId,
    catalog.map((item) => item.id)
  );
  const [seatId, setSeatId] = useState<number | null>(null);
  const [goldInput, setGoldInput] = useState("");
  const [qtyInput, setQtyInput] = useState("0");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [issuedDraft, setIssuedDraft] = useState<Record<string, string>>({});
  const [computerDraft, setComputerDraft] = useState(String(initialState.computerCount ?? 0));
  const [startingDraft, setStartingDraft] = useState(String(initialState.startingGold ?? 1000));
  const [startDraft, setStartDraft] = useState(() =>
    toLocalInput(initialState.scheduledStartAt ?? Date.now() + 10 * 60 * 1000)
  );
  const [inviteDraft, setInviteDraft] = useState(initialState.inviteCode ?? "");
  const [mobile, setMobile] = useMobileLayout();

  const player = state?.player;
  const roster = state?.adminRoster ?? [];
  const selectedSeat =
    roster.find((row) => row.id === seatId) ?? roster.find((row) => row.id === player?.id) ?? roster[0];
  const held = selectedSeat?.holdings[itemId] ?? 0;
  const selected = catalogById[itemId];

  useEffect(() => {
    if (player && seatId == null) setSeatId(player.id);
  }, [player?.id, seatId]);

  useEffect(() => {
    if (selectedSeat) setGoldInput(String(selectedSeat.gold));
  }, [selectedSeat?.id, selectedSeat?.gold]);

  useEffect(() => {
    setUsernameInput(selectedSeat?.username ?? "");
    setPasswordInput("");
  }, [selectedSeat?.id, selectedSeat?.username]);

  useEffect(() => {
    setQtyInput(String(held));
  }, [held, itemId, selectedSeat?.id]);

  useEffect(() => {
    setComputerDraft(String(state?.computerCount ?? 0));
  }, [state?.computerCount]);

  useEffect(() => {
    setStartingDraft(String(state?.startingGold ?? 1000));
  }, [state?.startingGold]);

  useEffect(() => {
    if (state?.scheduledStartAt) setStartDraft(toLocalInput(state.scheduledStartAt));
  }, [state?.scheduledStartAt]);

  useEffect(() => {
    if (state?.inviteCode) setInviteDraft(state.inviteCode);
  }, [state?.inviteCode]);

  const capKey = `${catalog.map((item) => item.id).join(",")}|${(state?.prices ?? [])
    .map((row) => `${row.itemId}:${row.authorized}`)
    .join("|")}`;
  useEffect(() => {
    if (!state) return;
    const next: Record<string, string> = {};
    for (const item of catalog) {
      const row = state.prices.find((price) => price.itemId === item.id);
      next[item.id] = String(row?.authorized ?? item.authorized ?? 0);
    }
    setIssuedDraft(next);
  }, [capKey]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-amber-950 px-4 text-amber-100">
        <p>Opening the admin office…</p>
      </div>
    );
  }

  if (!state || !player) {
    return (
      <div className="grid min-h-dvh place-items-center bg-amber-950 px-4 text-amber-50">
        <div className="max-w-md space-y-3 text-center">
          <p className="font-heading text-2xl">The office is locked</p>
          <p className="text-sm text-amber-100/70">{error ?? "Could not load admin."}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-amber-950 text-amber-50">
      <header className="sticky top-0 z-20 border-b border-amber-400/40 bg-amber-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-200/80 uppercase">
              {GAME_NAME}
            </p>
            <h1 className="font-heading text-2xl text-amber-100 sm:text-3xl">Admin office</h1>
            <p className="truncate text-sm text-amber-100/70">
              {player.username} · you are the admin
              {selectedSeat && selectedSeat.id !== player.id
                ? ` · editing ${selectedSeat.username}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SoundToggle className="text-amber-100/80 hover:bg-amber-900 hover:text-amber-50" />
            <MobileToggle
              checked={mobile}
              onChange={setMobile}
              className="text-amber-100/80 hover:bg-amber-900 hover:text-amber-50"
            />
            <Link
              href="/play"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 border-amber-200/40 bg-transparent text-amber-50 hover:bg-amber-900")}
            >
              Back to the desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4">
        {player.lastEvent ? (
          <p className="rounded-lg border border-amber-400/20 bg-amber-900/40 px-3 py-2 text-sm text-amber-100">
            {player.lastEvent}
          </p>
        ) : null}
        {error ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-100">
            <p>{error}</p>
            <button type="button" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="space-y-4 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg">Lobby and start</h2>
              <p className="text-sm text-amber-100/70">
                {state.gamePhase === "lobby"
                  ? "The book is closed. Travelers wait in the lobby until the clock hits the start time, then the table resets like New game."
                  : "The book is live. Set a start time to open the lobby and auto-start a new game at that moment."}
              </p>
            </div>
            <p className="rounded-full border border-amber-400/30 px-2.5 py-1 text-xs tracking-wide text-amber-100 uppercase">
              {state.gamePhase === "lobby" ? "Lobby" : "Live"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-amber-100/80">Who will play</h3>
            {(state.lobbyTravelers ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-amber-100/60">No travelers at the table yet.</p>
            ) : (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {(state.lobbyTravelers ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-amber-400/15 bg-amber-950/40 px-3 py-2 text-sm"
                  >
                    {row.username}
                    {row.username === player.username ? " · you" : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-amber-100/60">
              {(state.lobbyTravelers ?? []).length} traveler
              {(state.lobbyTravelers ?? []).length === 1 ? "" : "s"} + {state.computerCount ?? 0} computer
              {(state.computerCount ?? 0) === 1 ? "" : "s"} will take a seat when the game starts.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-start-at" className="text-amber-100/80">
                Start time
              </Label>
              <Input
                id="admin-start-at"
                type="datetime-local"
                value={startDraft}
                onChange={(event) => setStartDraft(event.target.value)}
                className="border-amber-400/30 bg-amber-950/60"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => {
                    const at = new Date(startDraft).getTime();
                    if (!Number.isFinite(at)) {
                      setError("Pick a start time.");
                      return;
                    }
                    const bots = Number(computerDraft);
                    if (!Number.isInteger(bots) || bots < 0 || bots > MAX_COMPUTERS) {
                      setError(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
                      return;
                    }
                    void run({ action: "adminScheduleStart", at, count: bots });
                  }}
                >
                  Set start time
                </Button>
                {state.scheduledStartAt ? (
                  <Button
                    variant="outline"
                    disabled={pending}
                    className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
                    onClick={() => void run({ action: "adminClearSchedule" })}
                  >
                    Clear start time
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-amber-100/60">
                {state.scheduledStartAt
                  ? `Scheduled ${new Date(state.scheduledStartAt).toLocaleString(undefined, { hour12: false })}. At that instant the table resets like New game.`
                  : "Uses this machine’s local clock. A time in the past starts immediately."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-invite" className="text-amber-100/80">
                Invite code
              </Label>
              <div className="flex items-end gap-2">
                <Input
                  id="admin-invite"
                  value={inviteDraft}
                  onChange={(event) => setInviteDraft(event.target.value.toUpperCase())}
                  spellCheck={false}
                  autoComplete="off"
                  className="border-amber-400/30 bg-amber-950/60"
                />
                <Button
                  disabled={pending}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => void run({ action: "adminInviteCode", code: inviteDraft })}
                >
                  Set
                </Button>
              </div>
              <p className="text-xs text-amber-100/60">
                New travelers must enter this code. 4–24 letters or numbers. Current code:{" "}
                <span className="font-medium text-amber-50">{state.inviteCode ?? "not set"}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <h2 className="font-heading text-lg">Traveler</h2>
          <Label htmlFor="admin-seat" className="text-amber-100/80">
            Edit this pack
          </Label>
          <select
            id="admin-seat"
            className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm text-amber-50"
            value={selectedSeat?.id ?? player.id}
            onChange={(event) => setSeatId(Number(event.target.value))}
          >
            {roster.map((row) => (
              <option key={row.id} value={row.id}>
                {row.username}
                {row.id === player.id ? " (you)" : ""}
                {row.bot ? (row.seated ? " · computer" : " · sitting out") : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-amber-100/60">
            Coins and pack qty below apply to {selectedSeat?.username ?? player.username}. Issued is a table rule
            and changes every traveler.
          </p>
          <div className="grid gap-3 border-t border-amber-400/15 pt-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-username" className="text-amber-100/80">
                Username
              </Label>
              <Input
                id="admin-username"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                autoComplete="off"
                disabled={pending || !selectedSeat || selectedSeat.bot}
                className="border-amber-400/30 bg-amber-950/60"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-password" className="text-amber-100/80">
                New password
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                autoComplete="new-password"
                disabled={pending || !selectedSeat || selectedSeat.bot}
                placeholder="Leave blank to keep it"
                className="border-amber-400/30 bg-amber-950/60"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                disabled={pending || !selectedSeat || selectedSeat.bot || !usernameInput.trim()}
                className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                onClick={() =>
                  void run({
                    action: "adminAccount",
                    targetUserId: selectedSeat?.id,
                    username: usernameInput,
                    password: passwordInput || undefined,
                  })
                }
              >
                Save account
              </Button>
              <p className="mt-2 text-xs text-amber-100/60">
                Use 3–20 letters, numbers, or underscores. A new password must be at least 4 characters;
                leave it blank to keep the current password. Existing sessions stay signed in.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
            <h2 className="font-heading text-lg">
              {selectedSeat && selectedSeat.id !== player.id
                ? `${selectedSeat.username}'s purse`
                : "Your purse"}
            </h2>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="admin-gold" className="text-amber-100/80">
                  Coins
                </Label>
                <Input
                  id="admin-gold"
                  inputMode="numeric"
                  value={goldInput}
                  onChange={(event) => setGoldInput(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
              </div>
              <Button
                disabled={pending || !selectedSeat}
                className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                onClick={() =>
                  void run({
                    action: "adminGold",
                    gold: Number(goldInput),
                    targetUserId: selectedSeat?.id,
                  })
                }
              >
                Set
              </Button>
            </div>
            <p className="text-sm text-amber-100/70">
              Now {formatCoins(selectedSeat?.gold ?? player.gold)}.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
            <h2 className="font-heading text-lg">Pack quantity</h2>
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setItemId(item.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-sm",
                    item.id === itemId
                      ? "bg-amber-300 text-amber-950"
                      : "bg-amber-950/50 text-amber-100 ring-1 ring-amber-400/20"
                  )}
                >
                  <ItemIcon item={item} /> {item.name}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="admin-qty" className="text-amber-100/80">
                  {selected ? `${selected.emoji} ${selected.name}` : "Item"} qty
                </Label>
                <Input
                  id="admin-qty"
                  inputMode="numeric"
                  value={qtyInput}
                  onChange={(event) => setQtyInput(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
              </div>
              <Button
                disabled={pending || !selected}
                className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                onClick={() =>
                  void run({
                    action: "adminItem",
                    itemId,
                    quantity: Number(qtyInput),
                    targetUserId: selectedSeat?.id,
                  })
                }
              >
                Set
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <h2 className="font-heading text-lg">Table rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="admin-stipend" className="text-amber-100/80">
                Coin drop every
              </Label>
              <select
                id="admin-stipend"
                className="h-11 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-3 text-sm text-amber-50"
                value={state.stipendMs}
                disabled={pending}
                onChange={(event) => void run({ action: "adminStipend", ms: Number(event.target.value) })}
              >
                {STIPEND_PRESETS.map((row) => (
                  <option key={row.ms} value={row.ms}>
                    {row.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-amber-100/60">
                Travelers who sit at the desk get the next ladder purse every {stipendLabel(state.stipendMs)}.
              </p>
              {state.coinDrop ? (
                <StipendEditor
                  ladder={state.coinDrop.ladder}
                  pending={pending}
                  onSave={(amounts) => run({ action: "adminStipendLadder", amounts })}
                />
              ) : null}
              <div className="space-y-1 pt-2">
                <Label htmlFor="admin-starting-gold" className="text-amber-100/80">
                  Starting purse
                </Label>
                <div className="flex items-end gap-2">
                  <Input
                    id="admin-starting-gold"
                    inputMode="numeric"
                    value={startingDraft}
                    onChange={(event) => setStartingDraft(event.target.value)}
                    className="border-amber-400/30 bg-amber-950/60"
                  />
                  <Button
                    disabled={pending}
                    className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                    onClick={() => {
                      const next = Number(startingDraft);
                      if (!Number.isInteger(next) || next < 0 || next > MAX_STARTING_GOLD) {
                        setError(`Starting coins must be a whole number from 0 to ${MAX_STARTING_GOLD.toLocaleString("en-US")}.`);
                        return;
                      }
                      void run({ action: "adminStartingGold", gold: next });
                    }}
                  >
                    Set
                  </Button>
                </div>
                <p className="text-xs text-amber-100/60">
                  New travelers (and New game) start with {formatCoins(state.startingGold ?? 1000)}.
                  Someone who joins late also gets every coin drop the table has already been paid.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-computers" className="text-amber-100/80">
                Computers at the table
              </Label>
              <div className="flex items-end gap-2">
                <Input
                  id="admin-computers"
                  inputMode="numeric"
                  min={0}
                  max={MAX_COMPUTERS}
                  value={computerDraft}
                  onChange={(event) => setComputerDraft(event.target.value)}
                  className="border-amber-400/30 bg-amber-950/60"
                />
                <Button
                  disabled={pending}
                  className="bg-amber-300 text-amber-950 hover:bg-amber-200"
                  onClick={() => {
                    const next = Number(computerDraft);
                    const current = state.computerCount ?? 0;
                    if (next < current) {
                      const ok = window.confirm(
                        "Sit some computers out? They leave the book, and their packs go back to the treasury."
                      );
                      if (!ok) return;
                    }
                    void run({ action: "adminComputers", count: next });
                  }}
                >
                  Set
                </Button>
              </div>
              <p className="text-xs text-amber-100/60">
                {state.travelerCount ?? 0} traveler{state.travelerCount === 1 ? "" : "s"} +{" "}
                {state.computerCount ?? 0} computer{(state.computerCount ?? 0) === 1 ? "" : "s"} ={" "}
                {(state.travelerCount ?? 0) + (state.computerCount ?? 0)} seats. Computers are
                0–{MAX_COMPUTERS}. Zero computers still leaves every traveler account at the table
                — leftover test names count as players.
              </p>
              {state.goal ? (
                <p className="text-xs text-amber-100/70">Goal: {state.goal.label}</p>
              ) : null}
              {state.goal ? (
                <GoalEditor
                  goal={state.goal}
                  catalog={catalog}
                  pending={pending}
                  onSave={(draft) =>
                    run({
                      action: "adminGoal",
                      mode: draft.mode,
                      score: draft.score,
                      threshold: draft.threshold,
                      durationMs: draft.durationMs,
                      needs: draft.needs,
                    })
                  }
                />
              ) : null}
              {(state.travelerCount ?? 0) > 1 ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  className="w-full border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
                  onClick={() => {
                    const extras = (state.travelerCount ?? 1) - 1;
                    const ok = window.confirm(
                      `Sit ${extras} other traveler${extras === 1 ? "" : "s"} out? Their packs go back to the treasury. You stay as the only traveler. They can sit down again by opening the desk.`
                    );
                    if (ok) void run({ action: "adminSitOthers" });
                  }}
                >
                  Sit other travelers out
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={pending}
                className="w-full border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
                onClick={() => {
                  const bots = Number(computerDraft);
                  if (!Number.isInteger(bots) || bots < 0 || bots > MAX_COMPUTERS) {
                    setError(`Computers must be a whole number from 0 to ${MAX_COMPUTERS}.`);
                    return;
                  }
                  const travelers = state.travelerCount ?? 1;
                  const seats = travelers + bots;
                  const ok = window.confirm(
                    `Start a new game? ${travelers} traveler${travelers === 1 ? "" : "s"} and ${bots} computer${
                      bots === 1 ? "" : "s"
                    } (${seats} seat${seats === 1 ? "" : "s"}). Each gets ${formatNumber(state.startingGold ?? 1000)} coins and floor(Issued ÷ ${seats}) of each good. Remainder stays in the treasury.`
                  );
                  if (ok) void run({ action: "adminNewGame", count: bots });
                }}
              >
                New game
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg">Share structure</h2>
            <ShareEditor
              pending={pending}
              count={catalog.length}
              onAdd={(draft) => run({ action: "adminShareAdd", ...draft })}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-amber-100/70">
                <tr className="border-b border-amber-400/20">
                  <th className="py-2 pr-3 font-medium">Good</th>
                  <th className="py-2 pr-3 font-medium">MV</th>
                  <th className="py-2 pr-3 font-medium">Issued</th>
                  <th className="py-2 pr-3 font-medium">Outstanding</th>
                  <th className="py-2 pr-3 font-medium">Treasury</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((item) => {
                  const row = state.prices.find((price) => price.itemId === item.id);
                  return (
                    <tr key={item.id} className="border-b border-amber-400/10">
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <ItemIcon item={item} /> {item.name}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(row?.vwap ?? item.basePrice)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Input
                            inputMode="numeric"
                            value={issuedDraft[item.id] ?? String(row?.authorized ?? 0)}
                            onChange={(event) =>
                              setIssuedDraft((prev) => ({ ...prev, [item.id]: event.target.value }))
                            }
                            className="h-8 w-20 border-amber-400/30 bg-amber-950/60 px-2"
                          />
                          <Button
                            size="sm"
                            disabled={pending}
                            className="h-8 bg-amber-300 px-2 text-amber-950 hover:bg-amber-200"
                            onClick={() =>
                              void run({
                                action: "adminIssued",
                                itemId: item.id,
                                authorized: Number(issuedDraft[item.id] ?? row?.authorized ?? 0),
                              })
                            }
                          >
                            Set
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(row?.held ?? 0)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(row?.treasury ?? 0)}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || catalog.length <= MIN_SHARE_TYPES}
                          className="h-8 border-red-400/40 bg-transparent text-red-100 hover:bg-red-950"
                          onClick={() => {
                            const ok = window.confirm(
                              `Are you sure? This removes ${item.emoji || ""} ${item.name} from the share structure. Packs, orders, and tape prints of this good are wiped.`
                            );
                            if (ok) void run({ action: "adminShareRemove", itemId: item.id });
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-100/60">
            Issued is the cap. Changing it lists leftover on the treasury or buys surplus at MV.
            Outstanding is every unit sitting in traveler packs. Treasury is Issued minus Outstanding.
            Add a share type with an emoji or image. Delete asks are you sure, and you must keep at
            least one good.
          </p>
        </section>
      </main>
    </div>
  );
}
