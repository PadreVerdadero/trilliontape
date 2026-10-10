"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemIcon } from "@/components/game/item-icon";
import { formatCoins, formatNumber } from "@/lib/game/format";
import { minutesToTimeInput } from "@/lib/game/hours";
import { cn } from "@/lib/utils";
import type { CompanyView, GameState, ProposalView } from "@/lib/game/types";

type Run = (body: Record<string, unknown> & { action: string }) => Promise<unknown>;

const TZ_LABEL = "Central time";

function signed(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

function tone(value: number) {
  return value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-muted-foreground";
}

function centralClock(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useLiveNow(serverNow: number) {
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [offset]);
  return now;
}

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-0.5", strong && "border-t border-border/60 pt-1 font-medium")}>
      <span className="text-muted-foreground">
        {label}
        {note ? <span className="ml-1 text-[10px]">{note}</span> : null}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2 rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10", className)}>
      <h3 className="font-heading text-base">{title}</h3>
      {children}
    </section>
  );
}

function tierClass(tier: CompanyView["myTier"]) {
  if (tier === "Majority") return "bg-amber-400/20 text-amber-200";
  if (tier === "Significant") return "bg-sky-400/20 text-sky-200";
  return "bg-muted text-muted-foreground";
}

function ProposalRow({
  proposal,
  canVote,
  pending,
  run,
  now,
}: {
  proposal: ProposalView;
  canVote: boolean;
  pending: boolean;
  run: Run;
  now: number;
}) {
  const open = proposal.status === "open";
  return (
    <li className="space-y-1 rounded-lg bg-background/50 p-2 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{proposal.description}</p>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] uppercase",
            proposal.status === "open" && "bg-sky-400/20 text-sky-200",
            proposal.status === "passed" && "bg-emerald-400/20 text-emerald-200",
            proposal.status !== "open" && proposal.status !== "passed" && "bg-rose-400/20 text-rose-200"
          )}
        >
          {proposal.status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        By {proposal.proposedBy} · yes {proposal.yesPct.toFixed(0)}% · no {proposal.noPct.toFixed(0)}% of voting shares
        {open ? ` · closes in ${countdown(proposal.closesAt - now)}` : ""}
      </p>
      {proposal.note ? <p className="text-xs">{proposal.note}</p> : null}
      {open && canVote ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={proposal.myVote === true ? "default" : "outline"}
            disabled={pending}
            onClick={() => void run({ action: "companyVote", proposalId: proposal.id, yes: true })}
          >
            Vote yes
          </Button>
          <Button
            size="sm"
            variant={proposal.myVote === false ? "default" : "outline"}
            disabled={pending}
            onClick={() => void run({ action: "companyVote", proposalId: proposal.id, yes: false })}
          >
            Vote no
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function CompanyDetail({
  company,
  state,
  pending,
  run,
  now,
}: {
  company: CompanyView;
  state: GameState;
  pending: boolean;
  run: Run;
  now: number;
}) {
  const [dps, setDps] = useState(company.vote.myDps != null ? String(company.vote.myDps) : "");
  const [kind, setKind] = useState<"loan" | "buyback" | "issue">("loan");
  const [amount, setAmount] = useState("");
  const holder = company.myShares > 0;
  const netToday = company.todayRevenue - company.todayExpenses;
  const win = `${minutesToTimeInput(company.vote.startMin)}–${minutesToTimeInput(company.vote.endMin)}`;
  const treasuryNote = "Counted in dividends, not in votes";

  return (
    <div className="space-y-3">
      {company.bankrupt ? (
        <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-400/40">
          {company.name} is bankrupt. Shares were wiped out and trading is closed.
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Balance sheet">
          <Row label="Cash" value={formatCoins(company.cash)} />
          <Row label="Total assets" value={formatCoins(company.assets)} strong />
          <Row label="Loan balance" value={formatCoins(company.loan)} />
          <Row label="Total liabilities" value={formatCoins(company.liabilities)} strong />
          <Row label="Common stock" value={formatCoins(company.commonStock)} note="at par" />
          <Row label="Additional paid-in capital" value={formatCoins(company.apic)} />
          <Row label="Treasury stock" value={`−${formatCoins(company.treasuryStock)}`} note="bought back" />
          <Row label="Retained earnings" value={formatCoins(company.retainedEarnings)} />
          <Row label="Dividends declared" value={`−${formatCoins(company.dividendsDeclared)}`} note="contra equity" />
          <Row label="Total equity" value={formatCoins(company.equity)} strong />
          <p className="pt-1 text-[11px] text-muted-foreground">
            Assets {formatNumber(company.assets)} = liabilities {formatNumber(company.liabilities)} + equity{" "}
            {formatNumber(company.equity)}.
          </p>
        </Panel>

        <Panel title="Shares and your vote">
          <Row label="Issued" value={formatNumber(company.issued)} />
          <Row label="Outstanding (can vote)" value={formatNumber(company.outstanding)} />
          <Row label="Treasury shares" value={formatNumber(company.treasuryShares)} note={treasuryNote} />
          <Row label="Market value" value={formatCoins(company.mv)} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="tabular-nums">
              You hold {formatNumber(company.myShares)} ({company.myPct.toFixed(1)}%)
            </span>
            {company.myTier ? (
              <span className={cn("rounded px-1.5 py-0.5 text-xs", tierClass(company.myTier))}>
                {company.myTier} Shareholder
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Not a shareholder</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            1 vote per share. Minority under 20%, Significant 20–50%, Majority over 50%.
          </p>
        </Panel>

        <Panel title="Today (counts at 00:00 settlement)">
          <Row label="Revenue" value={formatCoins(company.todayRevenue)} />
          <Row label="Expenses" value={formatCoins(company.todayExpenses)} />
          <Row label="Net so far" value={signed(netToday)} strong />
          {company.loans.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Loan payments due tonight:{" "}
              {formatCoins(company.loans.reduce((sum, loan) => sum + loan.dailyPayment, 0))} (interest counts as an expense).
            </p>
          ) : null}
          {company.todayEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events filed today.</p>
          ) : (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
              {company.todayEntries.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {entry.label}
                    <span className="text-muted-foreground"> · {entry.username ?? "random"}</span>
                  </span>
                  <span className={cn("tabular-nums", tone(entry.amount))}>{signed(entry.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Dividend vote">
          <p className="text-xs text-muted-foreground">
            Voting is open {win} {TZ_LABEL} (after trading closes). The weighted average of votes pays at 00:00 if
            voters hold over half the shares; otherwise {state.companies.settings.defaultPayoutPct}% of the net
            income ÷ issued shares (now {formatCoins(company.vote.defaultDps)} per share). Capped at the company&apos;s
            cash.
          </p>
          <p className="text-xs">
            {company.vote.open ? (
              <span className="text-emerald-300">Voting is open now.</span>
            ) : (
              <span className="text-amber-300">Voting is closed right now.</span>
            )}{" "}
            Votes cast so far: {company.vote.votedPct.toFixed(0)}% of voting shares.
          </p>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor={`dps-${company.itemId}`}>
                Your dividend per share
              </label>
              <Input
                id={`dps-${company.itemId}`}
                inputMode="numeric"
                value={dps}
                onChange={(event) => setDps(event.target.value)}
                className="w-28"
                disabled={!holder || company.bankrupt}
              />
            </div>
            <Button
              disabled={pending || !holder || !company.vote.open || company.bankrupt}
              onClick={() => void run({ action: "companyDividendVote", itemId: company.itemId, dps: Number(dps) })}
            >
              {company.vote.myDps != null ? "Update vote" : "Cast vote"}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Shareholder votes (loan, buyback, new shares)">
        <p className="text-xs text-muted-foreground">
          Needs more than half of the voting shares. Loans come from the bank at {state.companies.settings.interestPct}%
          interest over {state.companies.settings.loanTermDays} days. A buyback buys shares from players&apos; asks at their
          price using company cash. New shares go to the treasury and add cash at MV. Max loan{" "}
          {formatCoins(company.maxLoan)}.
        </p>
        {holder && !company.bankrupt ? (
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Vote type"
            >
              <option value="loan">Take a loan (coins)</option>
              <option value="buyback">Buy back shares</option>
              <option value="issue">Issue new shares</option>
            </select>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={kind === "loan" ? "Coins" : "Shares"}
              className="w-28"
              aria-label="Amount"
            />
            <Button
              disabled={pending}
              onClick={() =>
                void run({ action: "companyPropose", itemId: company.itemId, kind, amount: Number(amount) }).then(() =>
                  setAmount("")
                )
              }
            >
              Propose
            </Button>
          </div>
        ) : null}
        {company.proposals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No votes in the last day.</p>
        ) : (
          <ul className="space-y-2">
            {company.proposals.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                proposal={proposal}
                canVote={holder && !company.bankrupt}
                pending={pending}
                run={run}
                now={now}
              />
            ))}
          </ul>
        )}
        {company.loans.length > 0 ? (
          <ul className="text-xs text-muted-foreground">
            {company.loans.map((loan, index) => (
              <li key={index}>
                Loan: {formatCoins(loan.principalLeft)} left · {formatCoins(loan.dailyPayment)} a day with interest
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Recent days">
        {company.history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No settled days yet. The first settlement is at 00:00 Central.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">Day</th>
                  <th className="py-1 pr-2 font-medium">Revenue</th>
                  <th className="py-1 pr-2 font-medium">Expenses</th>
                  <th className="py-1 pr-2 font-medium">Interest</th>
                  <th className="py-1 pr-2 font-medium">Net income</th>
                  <th className="py-1 pr-2 font-medium">Dividend / share</th>
                  <th className="py-1 font-medium">Paid out</th>
                </tr>
              </thead>
              <tbody>
                {company.history.map((day) => (
                  <tr key={day.dayKey} className="border-t border-border/40 tabular-nums">
                    <td className="py-1 pr-2">{day.dayKey}</td>
                    <td className="py-1 pr-2">{formatNumber(day.revenue)}</td>
                    <td className="py-1 pr-2">{formatNumber(day.expenses)}</td>
                    <td className="py-1 pr-2">{formatNumber(day.interest)}</td>
                    <td className={cn("py-1 pr-2", tone(day.netIncome))}>{signed(day.netIncome)}</td>
                    <td className="py-1 pr-2">
                      {day.bankrupt ? "Bankrupt" : `${formatNumber(day.dividendPerShare)} (${day.source})`}
                    </td>
                    <td className="py-1">{formatNumber(day.dividendTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function CompaniesScreen({
  state,
  pending,
  run,
  selectedItemId,
  onSelectItem,
}: {
  state: GameState;
  pending: boolean;
  run: Run;
  selectedItemId: string;
  onSelectItem: (id: string) => void;
}) {
  const { companies } = state;
  const now = useLiveNow(state.now);
  const [eventPick, setEventPick] = useState<Record<string, string>>({});
  const selected =
    companies.companies.find((row) => row.itemId === selectedItemId) ?? companies.companies[0] ?? null;
  const settle = companies.nextSettleAt - now;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-heading text-xl sm:text-2xl">Companies</p>
          <p className="text-xs text-muted-foreground">
            Each share is a company. Players file revenue and expenses, holders vote on dividends, and the books settle
            at 00:00 Central. Dividends replace coin drops.
          </p>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs tabular-nums">
          {TZ_LABEL} {centralClock(now, companies.timeZone)} · {companies.dayKey} · settles in {countdown(settle)}
          <br />
          Dividends received: {formatCoins(companies.myDividendsTotal)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[56rem] text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-2 py-2 font-medium">Assets</th>
              <th className="px-2 py-2 font-medium">Liabilities</th>
              <th className="px-2 py-2 font-medium">Equity</th>
              <th className="px-2 py-2 font-medium">Revenue (today)</th>
              <th className="px-2 py-2 font-medium">Expenses (today)</th>
              <th className="px-2 py-2 font-medium">Net income (last day)</th>
              <th className="px-2 py-2 font-medium">Dividend / share</th>
              <th className="px-2 py-2 font-medium">You own</th>
            </tr>
          </thead>
          <tbody>
            {companies.companies.map((company) => (
              <tr
                key={company.itemId}
                onClick={() => onSelectItem(company.itemId)}
                className={cn(
                  "cursor-pointer border-t border-border/40 tabular-nums hover:bg-background/50",
                  selected?.itemId === company.itemId && "bg-primary/15"
                )}
              >
                <td className="px-3 py-2">
                  <span className="mr-1 text-base">
                    <ItemIcon item={company} />
                  </span>
                  {company.name}
                  {company.bankrupt ? <span className="ml-1 rounded bg-rose-400/20 px-1 text-rose-200">bankrupt</span> : null}
                </td>
                <td className="px-2 py-2">{formatNumber(company.assets)}</td>
                <td className="px-2 py-2">{formatNumber(company.liabilities)}</td>
                <td className={cn("px-2 py-2", company.equity < 0 && "text-rose-300")}>{formatNumber(company.equity)}</td>
                <td className="px-2 py-2">{formatNumber(company.todayRevenue)}</td>
                <td className="px-2 py-2">{formatNumber(company.todayExpenses)}</td>
                <td className={cn("px-2 py-2", tone(company.lastDay?.netIncome ?? 0))}>
                  {company.lastDay ? signed(company.lastDay.netIncome) : "—"}
                </td>
                <td className="px-2 py-2">
                  {company.lastDay ? `${formatNumber(company.lastDay.dividendPerShare)} (${formatNumber(company.lastDay.dividendTotal)})` : "—"}
                </td>
                <td className="px-2 py-2">
                  {company.myShares > 0 ? `${formatNumber(company.myShares)} · ${company.myPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-1">
        {companies.companies.map((company) => (
          <button
            key={company.itemId}
            type="button"
            title={company.name}
            onClick={() => onSelectItem(company.itemId)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-xl ring-1",
              selected?.itemId === company.itemId ? "bg-primary/25 ring-primary" : "bg-background/60 ring-foreground/10"
            )}
          >
            <ItemIcon item={company} />
          </button>
        ))}
      </div>

      {selected ? (
        <div className="space-y-3">
          <p className="font-heading text-lg">
            <ItemIcon item={selected} /> {selected.name}
          </p>
          <CompanyDetail key={selected.itemId} company={selected} state={state} pending={pending} run={run} now={now} />
        </div>
      ) : null}

      <Panel title="Your events (each one can be used once per game)">
        <p className="text-xs text-muted-foreground">
          Assign events to companies. Gains count as revenue, losses as expenses. Place them where they matter: one
          random event also hits a random company every day.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {companies.myEvents.map((event) => {
            const used = event.usedItemId != null;
            const usedOn = companies.companies.find((row) => row.itemId === event.usedItemId);
            const choice = eventPick[event.id] ?? selected?.itemId ?? "";
            return (
              <li
                key={event.id}
                className={cn("space-y-1 rounded-lg bg-background/50 p-2 ring-1 ring-foreground/10", used && "opacity-60")}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{event.name}</span>
                  <span className={cn("tabular-nums", tone(event.amount))}>{signed(event.amount)}</span>
                </div>
                {used ? (
                  <p className="text-xs text-muted-foreground">Used on {usedOn?.name ?? event.usedItemId}</p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={choice}
                      onChange={(e) => setEventPick((prev) => ({ ...prev, [event.id]: e.target.value }))}
                      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                      aria-label={`Company for ${event.name}`}
                    >
                      {companies.companies
                        .filter((company) => !company.bankrupt)
                        .map((company) => (
                          <option key={company.itemId} value={company.itemId}>
                            {company.emoji} {company.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={pending || !choice}
                      onClick={() => void run({ action: "companyEvent", eventId: event.id, itemId: choice })}
                    >
                      File
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title={companies.payouts ? `Dividend payments for ${companies.payouts.dayKey}` : "Dividend payments"}>
        {!companies.payouts ? (
          <p className="text-xs text-muted-foreground">No dividends have been paid yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Your payments: {formatCoins(companies.payouts.myTotal)}
              </p>
              {companies.payouts.mine.length === 0 ? (
                <p className="text-xs text-muted-foreground">You held no paying shares.</p>
              ) : (
                <ul className="space-y-0.5 text-xs">
                  {companies.payouts.mine.map((row) => {
                    const company = companies.companies.find((entry) => entry.itemId === row.itemId);
                    return (
                      <li key={row.itemId} className="flex justify-between gap-2 tabular-nums">
                        <span>
                          {company?.emoji} {company?.name ?? row.itemId}: {formatNumber(row.shares)} × {formatNumber(row.dps)}
                        </span>
                        <span>{formatCoins(row.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">All players</p>
              <ul className="space-y-0.5 text-xs">
                {companies.payouts.players.map((row) => (
                  <li key={row.username} className="flex justify-between gap-2 tabular-nums">
                    <span>{row.username}</span>
                    <span>{formatCoins(row.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
