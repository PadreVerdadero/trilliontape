"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultCompanyEvents, defaultCompanySettings } from "@/lib/game/companies";
import { minutesToTimeInput } from "@/lib/game/hours";
import type { GameState } from "@/lib/game/types";

type Run = (body: Record<string, unknown> & { action: string }) => Promise<unknown>;

type EventDraft = { id: string; name: string; amount: string; random: boolean };

function toDrafts(events: { id: string; name: string; amount: number; random: boolean }[]): EventDraft[] {
  return events.map((event) => ({ id: event.id, name: event.name, amount: String(event.amount), random: event.random }));
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
}

const field =
  "h-9 w-full rounded-lg border border-amber-400/30 bg-amber-950/60 px-2 text-sm text-amber-50";

export function CompanyAdmin({ state, pending, run }: { state: GameState; pending: boolean; run: Run }) {
  const settings = state.companies.settings;
  const [draft, setDraft] = useState(() => ({
    interestPct: String(settings.interestPct),
    loanTermDays: String(settings.loanTermDays),
    voteHours: String(settings.voteHours),
    defaultPayoutPct: String(settings.defaultPayoutPct),
    defaultClose: minutesToTimeInput(settings.defaultCloseMin),
    parValue: String(settings.parValue),
    bankruptcyRule: settings.bankruptcyRule,
    randomEvents: settings.randomEvents,
    dealOpeningShares: settings.dealOpeningShares,
  }));
  const [events, setEvents] = useState<EventDraft[]>(() => toDrafts(state.companies.allEvents));
  const [message, setMessage] = useState<string | null>(null);
  const settingsDirty = useRef(false);
  const eventsDirty = useRef(false);
  const eventKey = JSON.stringify(state.companies.allEvents);
  const settingsKey = JSON.stringify(settings);

  useEffect(() => {
    if (settingsDirty.current) return;
    setDraft({
      interestPct: String(settings.interestPct),
      loanTermDays: String(settings.loanTermDays),
      voteHours: String(settings.voteHours),
      defaultPayoutPct: String(settings.defaultPayoutPct),
      defaultClose: minutesToTimeInput(settings.defaultCloseMin),
      parValue: String(settings.parValue),
      bankruptcyRule: settings.bankruptcyRule,
      randomEvents: settings.randomEvents,
      dealOpeningShares: settings.dealOpeningShares,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  useEffect(() => {
    if (eventsDirty.current) return;
    setEvents(toDrafts(state.companies.allEvents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey]);

  function edit<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    settingsDirty.current = true;
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    const closeMin = parseTime(draft.defaultClose);
    if (closeMin == null) {
      setMessage("Pick a valid default close time.");
      return;
    }
    setMessage(null);
    await run({
      action: "adminCompanySettings",
      settings: {
        interestPct: Number(draft.interestPct),
        loanTermDays: Number(draft.loanTermDays),
        voteHours: Number(draft.voteHours),
        defaultPayoutPct: Number(draft.defaultPayoutPct),
        defaultCloseMin: closeMin,
        parValue: Number(draft.parValue),
        bankruptcyRule: draft.bankruptcyRule,
        randomEvents: draft.randomEvents,
        dealOpeningShares: draft.dealOpeningShares,
      },
    });
    settingsDirty.current = false;
  }

  async function saveEvents() {
    setMessage(null);
    await run({
      action: "adminCompanyEvents",
      events: events.map((row) => ({
        id: row.id,
        name: row.name,
        amount: Number(row.amount),
        random: row.random,
      })),
    });
    eventsDirty.current = false;
  }

  function editEvent(index: number, patch: Partial<EventDraft>) {
    eventsDirty.current = true;
    setEvents((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <section className="space-y-4 rounded-xl border border-amber-400/25 bg-amber-900/30 p-4">
      <div>
        <h2 className="font-heading text-lg">Companies</h2>
        <p className="text-sm text-amber-100/70">
          Every share is a company. Books settle at 00:00 Central time. Changes apply from the next day. Starting
          capital is the issued count × the starting MV (see Share structure); a new game re-issues every company.
        </p>
      </div>
      {message ? <p className="text-sm text-red-200">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-amber-100/80">Loan interest (% of principal, total)</Label>
          <Input className={field} inputMode="numeric" value={draft.interestPct} onChange={(e) => edit("interestPct", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Loan repayment (days)</Label>
          <Input className={field} inputMode="numeric" value={draft.loanTermDays} onChange={(e) => edit("loanTermDays", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Dividend vote length (hours)</Label>
          <Input className={field} inputMode="numeric" value={draft.voteHours} onChange={(e) => edit("voteHours", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Default payout (% of prior-day net income)</Label>
          <Input className={field} inputMode="numeric" value={draft.defaultPayoutPct} onChange={(e) => edit("defaultPayoutPct", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Vote opens at (Central) if a share has no close time</Label>
          <Input className={field} type="time" value={draft.defaultClose} onChange={(e) => edit("defaultClose", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Par value per share (new games)</Label>
          <Input className={field} inputMode="numeric" value={draft.parValue} onChange={(e) => edit("parValue", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-amber-100/80">Bankruptcy when</Label>
          <select
            className={field}
            value={draft.bankruptcyRule}
            onChange={(e) => edit("bankruptcyRule", e.target.value as "retained" | "equity")}
          >
            <option value="retained">Retained earnings below zero</option>
            <option value="equity">Total equity below zero</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-amber-100/80">
          <input
            type="checkbox"
            checked={draft.randomEvents}
            onChange={(e) => edit("randomEvents", e.target.checked)}
          />
          One random event a day
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-amber-100/80">
          <input
            type="checkbox"
            checked={draft.dealOpeningShares}
            onChange={(e) => edit("dealOpeningShares", e.target.checked)}
          />
          New game deals shares to travelers (off = they buy from the treasury)
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} className="bg-amber-300 text-amber-950 hover:bg-amber-200" onClick={() => void saveSettings()}>
          Save company rules
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
          onClick={() => {
            const base = defaultCompanySettings();
            settingsDirty.current = true;
            setDraft({
              interestPct: String(base.interestPct),
              loanTermDays: String(base.loanTermDays),
              voteHours: String(base.voteHours),
              defaultPayoutPct: String(base.defaultPayoutPct),
              defaultClose: minutesToTimeInput(base.defaultCloseMin),
              parValue: String(base.parValue),
              bankruptcyRule: base.bankruptcyRule,
              randomEvents: base.randomEvents,
              dealOpeningShares: base.dealOpeningShares,
            });
          }}
        >
          Reset to defaults
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
          onClick={() => {
            const ok = window.confirm(
              "Deal the treasury's unsold shares evenly to every seated traveler right now? This works on the game in progress and cannot be undone."
            );
            if (ok) void run({ action: "adminDealShares" });
          }}
        >
          Deal shares to travelers now
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="font-heading text-base">Events players can file</h3>
        <p className="text-xs text-amber-100/70">
          Positive amounts are revenue, negative amounts are expenses. Each traveler can use each event once per game on
          any company. “Random only” events are never offered to players; they feed the daily random event (if none are
          marked, every event can come up).
        </p>
        <div className="space-y-1">
          {events.map((row, index) => (
            <div key={`${row.id}-${index}`} className="grid grid-cols-[1fr_6.5rem_auto_auto] items-center gap-2">
              <Input
                className={field}
                value={row.name}
                aria-label="Event name"
                onChange={(e) => editEvent(index, { name: e.target.value })}
              />
              <Input
                className={field}
                inputMode="numeric"
                value={row.amount}
                aria-label="Amount"
                onChange={(e) => editEvent(index, { amount: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-amber-100/80">
                <input
                  type="checkbox"
                  checked={row.random}
                  onChange={(e) => editEvent(index, { random: e.target.checked })}
                />
                Random only
              </label>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-400/40 bg-transparent text-amber-50 hover:bg-amber-900"
                onClick={() => {
                  eventsDirty.current = true;
                  setEvents((prev) => prev.filter((_, i) => i !== index));
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
            onClick={() => {
              eventsDirty.current = true;
              setEvents((prev) => [...prev, { id: "", name: "New event", amount: "500", random: false }]);
            }}
          >
            Add event
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            className="border-amber-400/50 bg-transparent text-amber-50 hover:bg-amber-900"
            onClick={() => {
              eventsDirty.current = true;
              setEvents(toDrafts(defaultCompanyEvents()));
            }}
          >
            Load default events
          </Button>
          <Button disabled={pending} className="bg-amber-300 text-amber-950 hover:bg-amber-200" onClick={() => void saveEvents()}>
            Save events
          </Button>
        </div>
      </div>
    </section>
  );
}
