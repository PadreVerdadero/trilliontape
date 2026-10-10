import { itemById, items } from "@/lib/game/catalog";
import { DESK_USERNAME, getDb, getItemAuthorized, readTradingHours, setItemAuthorized } from "@/lib/game/db";
import {
  COMPANY_TIME_ZONE,
  PROPOSAL_KINDS,
  addDaysToKey,
  defaultCompanyEvents,
  defaultCompanySettings,
  defaultDividendPerShare,
  describeProposal,
  dayKeyIn,
  dividendVoteWindow,
  holderPct,
  holderTier,
  initialBalance,
  newLoanTerms,
  normalizeCompanyEvents,
  normalizeCompanySettings,
  settleCompanyDay,
  totals,
  validateCompanyEvents,
  validateCompanySettings,
  voteOpenNow,
  type Balance,
  type CompanyEvent,
  type CompanySettings,
  type ProposalKind,
} from "@/lib/game/companies";
import type {
  CompaniesState,
  CompanyDayView,
  CompanyEntryView,
  CompanyView,
  ProposalView,
} from "@/lib/game/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CATCH_UP_DAYS = 14;
const PROPOSAL_LIFETIME_MS = DAY_MS;
const MAX_ISSUED = 99_999;

type CompanyRow = {
  item_id: string;
  cash: number;
  loan: number;
  par: number;
  common_stock: number;
  apic: number;
  treasury_stock: number;
  retained: number;
  dividends: number;
  booked_shares: number;
  bankrupt: number;
};

function balanceOf(row: CompanyRow): Balance {
  return {
    cash: row.cash,
    loan: row.loan,
    commonStock: row.common_stock,
    apic: row.apic,
    treasuryStock: row.treasury_stock,
    retainedEarnings: row.retained,
    dividends: row.dividends ?? 0,
  };
}

async function writeBalance(itemId: string, balance: Balance) {
  await getDb()
    .prepare(
      `UPDATE companies SET cash = ?, loan = ?, common_stock = ?, apic = ?, treasury_stock = ?, retained = ?, dividends = ?
       WHERE item_id = ?`
    )
    .run(
      balance.cash,
      balance.loan,
      balance.commonStock,
      balance.apic,
      balance.treasuryStock,
      balance.retainedEarnings,
      balance.dividends,
      itemId
    );
}

// ---- Meta (settings, events, day cursor) ----

async function readMeta(key: string) {
  const row = (await getDb().prepare("SELECT value FROM game_meta WHERE key = ?").get(key)) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

async function writeMeta(key: string, value: string) {
  await getDb()
    .prepare(
      `INSERT INTO game_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export async function readCompanySettings(): Promise<CompanySettings> {
  const raw = await readMeta("company_settings");
  if (!raw) return defaultCompanySettings();
  try {
    return normalizeCompanySettings(JSON.parse(raw));
  } catch {
    return defaultCompanySettings();
  }
}

export async function writeCompanySettings(raw: Partial<CompanySettings>) {
  const next = validateCompanySettings(raw, await readCompanySettings());
  await writeMeta("company_settings", JSON.stringify(next));
  return next;
}

export async function readCompanyEvents(): Promise<CompanyEvent[]> {
  const raw = await readMeta("company_events");
  if (!raw) return defaultCompanyEvents();
  try {
    return normalizeCompanyEvents(JSON.parse(raw));
  } catch {
    return defaultCompanyEvents();
  }
}

export async function writeCompanyEvents(raw: unknown) {
  const next = validateCompanyEvents(raw);
  await writeMeta("company_events", JSON.stringify(next));
  return next;
}

// ---- Setup ----

async function holdingRows() {
  return (await getDb()
    .prepare(
      `SELECT i.item_id, i.user_id, i.quantity, u.username
       FROM inventory i JOIN users u ON u.id = i.user_id
       WHERE i.quantity > 0 AND u.username NOT IN ('Banker', ?)`
    )
    .all(DESK_USERNAME)) as { item_id: string; user_id: number; quantity: number; username: string }[];
}

async function authorizedLookup() {
  const rows = (await getDb().prepare("SELECT item_id, authorized FROM item_caps").all()) as {
    item_id: string;
    authorized: number;
  }[];
  const caps = new Map<string, number>();
  for (const row of rows) {
    if (Number.isInteger(row.authorized) && row.authorized > 0) caps.set(row.item_id, row.authorized);
  }
  return (itemId: string) => caps.get(itemId) ?? itemById[itemId]?.authorized ?? 0;
}

/** Keeps one company per share type and reconciles the books when the issued count changes. */
export async function ensureCompanies(now = Date.now()) {
  const db = getDb();
  const settings = await readCompanySettings();
  const rows = (await db.prepare("SELECT * FROM companies").all()) as CompanyRow[];
  const byId = new Map(rows.map((row) => [row.item_id, row]));
  const authorizedOf = await authorizedLookup();
  for (const item of items) {
    const issued = authorizedOf(item.id);
    const existing = byId.get(item.id);
    if (!existing) {
      const start = initialBalance(issued, item.basePrice, settings.parValue);
      await db
        .prepare(
          `INSERT INTO companies (item_id, cash, loan, par, common_stock, apic, treasury_stock, retained, booked_shares)
           VALUES (?, ?, 0, ?, ?, ?, 0, 0, ?)`
        )
        .run(item.id, start.cash, Math.min(settings.parValue, item.basePrice), start.commonStock, start.apic, issued);
      continue;
    }
    if (existing.bankrupt || existing.booked_shares === issued) continue;
    const delta = issued - existing.booked_shares;
    const price = Math.max(1, Math.round(item.basePrice));
    const par = Math.min(existing.par, price);
    await db
      .prepare(
        `UPDATE companies SET cash = cash + ?, common_stock = common_stock + ?, apic = apic + ?, booked_shares = ?
         WHERE item_id = ?`
      )
      .run(delta * price, delta * par, delta * (price - par), issued, item.id);
  }
  const live = new Set(items.map((item) => item.id));
  for (const row of rows) {
    if (live.has(row.item_id)) continue;
    await removeCompanyData(row.item_id);
  }
  if (!(await readMeta("company_day_cursor"))) {
    await writeMeta("company_day_cursor", dayKeyIn(now));
  }
}

async function removeCompanyData(itemId: string) {
  const db = getDb();
  for (const table of [
    "companies",
    "company_entries",
    "company_event_uses",
    "company_dividend_votes",
    "company_loans",
    "company_days",
    "company_payouts",
  ]) {
    await db.prepare(`DELETE FROM ${table} WHERE item_id = ?`).run(itemId);
  }
  const proposals = (await db
    .prepare("SELECT id FROM company_proposals WHERE item_id = ?")
    .all(itemId)) as { id: number }[];
  for (const row of proposals) {
    await db.prepare("DELETE FROM company_proposal_votes WHERE proposal_id = ?").run(row.id);
  }
  await db.prepare("DELETE FROM company_proposals WHERE item_id = ?").run(itemId);
}

/** New game: wipe company history and issue the opening shares (cash = issued × issue price). */
export async function resetCompanies(now = Date.now()) {
  const db = getDb();
  await db.exec(`
    DELETE FROM companies;
    DELETE FROM company_entries;
    DELETE FROM company_event_uses;
    DELETE FROM company_dividend_votes;
    DELETE FROM company_proposals;
    DELETE FROM company_proposal_votes;
    DELETE FROM company_loans;
    DELETE FROM company_days;
    DELETE FROM company_payouts;
    UPDATE players SET dividends_received = 0;
  `);
  await writeMeta("company_day_cursor", dayKeyIn(now));
  await ensureCompanies(now);
}

export async function bankruptItemIds() {
  const rows = (await getDb().prepare("SELECT item_id FROM companies WHERE bankrupt = 1").all()) as {
    item_id: string;
  }[];
  return new Set(rows.map((row) => row.item_id));
}

// ---- Player actions ----

async function requireCompany(itemId: string) {
  const row = (await getDb().prepare("SELECT * FROM companies WHERE item_id = ?").get(itemId)) as
    | CompanyRow
    | undefined;
  if (!row || !itemById[itemId]) throw new Error("No such company.");
  if (row.bankrupt) throw new Error(`${itemById[itemId].name} is bankrupt.`);
  return row;
}

async function sharesHeld(userId: number, itemId: string) {
  const row = (await getDb()
    .prepare("SELECT COALESCE(quantity, 0) AS quantity FROM inventory WHERE user_id = ? AND item_id = ?")
    .get(userId, itemId)) as { quantity: number } | undefined;
  return row?.quantity ?? 0;
}

async function outstandingShares(itemId: string) {
  const row = (await getDb()
    .prepare(
      `SELECT COALESCE(SUM(i.quantity), 0) AS qty
       FROM inventory i JOIN users u ON u.id = i.user_id
       WHERE i.item_id = ? AND u.username NOT IN ('Banker', ?)`
    )
    .get(itemId, DESK_USERNAME)) as { qty: number };
  return row.qty;
}

export async function assignCompanyEvent(userId: number, eventId: string, itemId: string, now = Date.now()) {
  await requireCompany(itemId);
  const event = (await readCompanyEvents()).find((row) => row.id === eventId && !row.random);
  if (!event) throw new Error("That event is not available.");
  const db = getDb();
  const used = await db
    .prepare("SELECT item_id FROM company_event_uses WHERE user_id = ? AND event_id = ?")
    .get(userId, eventId);
  if (used) throw new Error("You already used that event this game.");
  await db.transaction(async () => {
    await db
      .prepare("INSERT INTO company_event_uses (user_id, event_id, item_id, created_at) VALUES (?, ?, ?, ?)")
      .run(userId, eventId, itemId, now);
    await db
      .prepare(
        `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
         VALUES (?, ?, ?, ?, ?, 'player', ?)`
      )
      .run(itemId, dayKeyIn(now), event.name, event.amount, userId, now);
  });
  return { event, name: itemById[itemId].name };
}

export async function castDividendVote(userId: number, itemId: string, dps: number, now = Date.now()) {
  await requireCompany(itemId);
  if (!Number.isInteger(dps) || dps < 0 || dps > 1_000_000) {
    throw new Error("Dividend per share must be a whole number of coins from 0 to 1,000,000.");
  }
  if ((await sharesHeld(userId, itemId)) < 1) throw new Error("Only shareholders can vote.");
  const settings = await readCompanySettings();
  const book = await readTradingHours();
  const window = dividendVoteWindow(book.hours[itemId], book.timeZone, settings, now);
  if (!voteOpenNow(window, now)) throw new Error("Dividend voting is closed. It opens when trading closes.");
  await getDb()
    .prepare(
      `INSERT INTO company_dividend_votes (item_id, day_key, user_id, dps, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(item_id, day_key, user_id) DO UPDATE SET dps = excluded.dps, created_at = excluded.created_at`
    )
    .run(itemId, dayKeyIn(now), userId, dps, now);
}

type ProposalRow = {
  id: number;
  item_id: string;
  kind: ProposalKind;
  amount: number;
  status: "open" | "passed" | "failed" | "expired";
  created_by: number;
  created_at: number;
  closes_at: number;
  note: string | null;
};

export async function createProposal(
  userId: number,
  itemId: string,
  kind: ProposalKind,
  amount: number,
  mv: number,
  now = Date.now()
) {
  const company = await requireCompany(itemId);
  if (!PROPOSAL_KINDS.includes(kind)) throw new Error("Unknown proposal.");
  if (!Number.isInteger(amount) || amount < 1) throw new Error("Enter a whole number above zero.");
  if ((await sharesHeld(userId, itemId)) < 1) throw new Error("Only shareholders can propose.");
  const db = getDb();
  const open = await db
    .prepare("SELECT id FROM company_proposals WHERE item_id = ? AND kind = ? AND status = 'open'")
    .get(itemId, kind);
  if (open) throw new Error("There is already an open vote of that kind for this company.");
  const outstanding = await outstandingShares(itemId);
  if (kind === "loan") {
    const room = Math.max(0, company.common_stock + company.apic - company.loan);
    if (amount > room) throw new Error(`A loan can be at most ${room.toLocaleString("en-US")} coins (paid-in capital less debt).`);
  } else if (kind === "buyback") {
    if (amount > outstanding) throw new Error("You cannot buy back more shares than are outstanding.");
    if (amount * Math.max(1, mv) > company.cash) throw new Error("The company does not have the cash for that buyback at MV.");
  } else {
    const issued = await getItemAuthorized(itemId);
    if (amount > issued) throw new Error("A new issue can be at most the current share count.");
    if (issued + amount > MAX_ISSUED) throw new Error(`Issued shares cannot exceed ${MAX_ISSUED.toLocaleString("en-US")}.`);
  }
  const info = await db
    .prepare(
      `INSERT INTO company_proposals (item_id, kind, amount, status, created_by, created_at, closes_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?)`
    )
    .run(itemId, kind, amount, userId, now, now + PROPOSAL_LIFETIME_MS);
  const id = Number(info.lastInsertRowid);
  return await castProposalVote(userId, id, true, now);
}

export type ProposalOutcome = {
  id: number;
  itemId: string;
  kind: ProposalKind;
  amount: number;
  status: "open" | "passed" | "failed";
};

export async function castProposalVote(
  userId: number,
  proposalId: number,
  yes: boolean,
  now = Date.now()
): Promise<ProposalOutcome> {
  const db = getDb();
  const proposal = (await db
    .prepare("SELECT * FROM company_proposals WHERE id = ?")
    .get(proposalId)) as ProposalRow | undefined;
  if (!proposal) throw new Error("No such vote.");
  if (proposal.status !== "open") throw new Error("That vote is already closed.");
  if (now >= proposal.closes_at) {
    await db
      .prepare("UPDATE company_proposals SET status = 'expired', decided_at = ? WHERE id = ? AND status = 'open'")
      .run(now, proposalId);
    throw new Error("That vote has expired.");
  }
  await requireCompany(proposal.item_id);
  if ((await sharesHeld(userId, proposal.item_id)) < 1) throw new Error("Only shareholders can vote.");
  await db
    .prepare(
      `INSERT INTO company_proposal_votes (proposal_id, user_id, yes) VALUES (?, ?, ?)
       ON CONFLICT(proposal_id, user_id) DO UPDATE SET yes = excluded.yes`
    )
    .run(proposalId, userId, yes ? 1 : 0);
  const outstanding = await outstandingShares(proposal.item_id);
  const tally = (await db
    .prepare(
      `SELECT v.yes AS yes, COALESCE(SUM(i.quantity), 0) AS shares
       FROM company_proposal_votes v
       JOIN inventory i ON i.user_id = v.user_id AND i.item_id = ?
       WHERE v.proposal_id = ?
       GROUP BY v.yes`
    )
    .all(proposal.item_id, proposalId)) as { yes: number; shares: number }[];
  const yesShares = tally.find((row) => row.yes === 1)?.shares ?? 0;
  const noShares = tally.find((row) => row.yes === 0)?.shares ?? 0;
  let status: ProposalOutcome["status"] = "open";
  if (yesShares * 2 > outstanding) status = "passed";
  else if (noShares * 2 >= outstanding) status = "failed";
  if (status !== "open") {
    const info = await db
      .prepare("UPDATE company_proposals SET status = ?, decided_at = ? WHERE id = ? AND status = 'open'")
      .run(status, now, proposalId);
    if (info.changes < 1) status = "open";
  }
  return { id: proposalId, itemId: proposal.item_id, kind: proposal.kind, amount: proposal.amount, status };
}

export async function setProposalNote(proposalId: number, note: string) {
  await getDb().prepare("UPDATE company_proposals SET note = ? WHERE id = ?").run(note, proposalId);
}

export async function applyLoan(itemId: string, amount: number, now = Date.now()) {
  await requireCompany(itemId);
  const settings = await readCompanySettings();
  const terms = newLoanTerms(amount, settings.interestPct, settings.loanTermDays);
  const db = getDb();
  await db.transaction(async () => {
    await db
      .prepare(
        `INSERT INTO company_loans (item_id, principal, principal_left, daily_principal, daily_interest, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(itemId, amount, amount, terms.dailyPrincipal, terms.dailyInterest, now);
    await db
      .prepare("UPDATE companies SET cash = cash + ?, loan = loan + ? WHERE item_id = ?")
      .run(amount, amount, itemId);
  });
}

/** Issues new shares to the treasury at the current MV. The caller re-aligns the treasury desk. */
export async function applyIssue(itemId: string, shares: number, mv: number) {
  const company = await requireCompany(itemId);
  const price = Math.max(1, Math.round(mv));
  const par = Math.min(company.par, price);
  const issued = await getItemAuthorized(itemId);
  const db = getDb();
  await db.transaction(async () => {
    await setItemAuthorized(itemId, issued + shares);
    await db
      .prepare(
        `UPDATE companies SET cash = cash + ?, common_stock = common_stock + ?, apic = apic + ?, booked_shares = ?
         WHERE item_id = ?`
      )
      .run(shares * price, shares * par, shares * (price - par), issued + shares, itemId);
  });
  return { price, issued: issued + shares };
}

export async function applyBuyback(itemId: string, cost: number) {
  if (cost <= 0) return;
  await getDb()
    .prepare("UPDATE companies SET cash = cash - ?, treasury_stock = treasury_stock + ? WHERE item_id = ?")
    .run(cost, cost, itemId);
}

export async function companyCash(itemId: string) {
  const row = (await getDb().prepare("SELECT cash FROM companies WHERE item_id = ?").get(itemId)) as
    | { cash: number }
    | undefined;
  return row?.cash ?? 0;
}

// ---- Daily settlement ----

const clock = globalThis as unknown as { bazaarCompanyClock?: Promise<boolean> };

/** Settles every finished Central-time day (runs at 00:00). Safe to call on every request. */
export async function runCompanyClock(now = Date.now()) {
  if (clock.bazaarCompanyClock) return clock.bazaarCompanyClock;
  const run = (async () => {
    await ensureCompanies(now);
    const today = dayKeyIn(now);
    let cursor = (await readMeta("company_day_cursor")) ?? today;
    if (cursor >= today) return false;
    const settings = await readCompanySettings();
    if (cursor < addDaysToKey(today, -MAX_CATCH_UP_DAYS)) cursor = addDaysToKey(today, -MAX_CATCH_UP_DAYS);
    while (cursor < today) {
      await settleDay(cursor, settings, now);
      cursor = addDaysToKey(cursor, 1);
      await writeMeta("company_day_cursor", cursor);
    }
    await expireProposals(now);
    return true;
  })();
  clock.bazaarCompanyClock = run;
  try {
    return await run;
  } finally {
    if (clock.bazaarCompanyClock === run) clock.bazaarCompanyClock = undefined;
  }
}

async function expireProposals(now: number) {
  await getDb()
    .prepare("UPDATE company_proposals SET status = 'expired', decided_at = ? WHERE status = 'open' AND closes_at <= ?")
    .run(now, now);
}

async function settleDay(day: string, settings: CompanySettings, now: number) {
  const db = getDb();
  await db.transaction(async () => {
    const companies = (await db
      .prepare("SELECT * FROM companies WHERE bankrupt = 0 ORDER BY item_id")
      .all()) as CompanyRow[];
    if (companies.length === 0) return;

    if (settings.randomEvents) {
      const events = await readCompanyEvents();
      const pool = events.filter((event) => event.random);
      const choices = pool.length > 0 ? pool : events;
      const event = choices[Math.floor(Math.random() * choices.length)];
      const target = companies[Math.floor(Math.random() * companies.length)];
      if (event && target) {
        await db
          .prepare(
            `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
             VALUES (?, ?, ?, ?, NULL, 'random', ?)`
          )
          .run(target.item_id, day, `Random event: ${event.name}`, event.amount, now);
      }
    }

    const holders = await holdingRows();
    const authorizedOf = await authorizedLookup();
    const paid = new Map<number, { total: number; parts: string[] }>();

    for (const company of companies) {
      const entries = (await db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS revenue,
                  COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS expenses
           FROM company_entries WHERE item_id = ? AND day_key = ?`
        )
        .get(company.item_id, day)) as { revenue: number; expenses: number };
      const loanRows = (await db
        .prepare("SELECT * FROM company_loans WHERE item_id = ? ORDER BY id")
        .all(company.item_id)) as {
        id: number;
        principal_left: number;
        daily_principal: number;
        daily_interest: number;
      }[];
      const mine = holders.filter((row) => row.item_id === company.item_id);
      const outstanding = mine.reduce((sum, row) => sum + row.quantity, 0);
      const issued = authorizedOf(company.item_id);
      const voteRows = (await db
        .prepare("SELECT user_id, dps FROM company_dividend_votes WHERE item_id = ? AND day_key = ?")
        .all(company.item_id, day)) as { user_id: number; dps: number }[];
      const votes = voteRows
        .map((vote) => ({
          dps: vote.dps,
          shares: mine.find((row) => row.user_id === vote.user_id)?.quantity ?? 0,
        }))
        .filter((vote) => vote.shares > 0);

      const result = settleCompanyDay({
        balance: balanceOf(company),
        revenue: entries.revenue,
        expenses: entries.expenses,
        loans: loanRows.map((loan) => ({
          principalLeft: loan.principal_left,
          dailyPrincipal: loan.daily_principal,
          dailyInterest: loan.daily_interest,
        })),
        rule: settings.bankruptcyRule,
        outstanding,
        issued,
        votes,
        payoutPct: settings.defaultPayoutPct,
      });

      await writeBalance(company.item_id, result.balance);
      for (const [index, loan] of result.loans.entries()) {
        const id = loanRows[index].id;
        if (loan.principalLeft > 0 && !result.bankrupt) {
          await db.prepare("UPDATE company_loans SET principal_left = ? WHERE id = ?").run(loan.principalLeft, id);
        } else {
          await db.prepare("DELETE FROM company_loans WHERE id = ?").run(id);
        }
      }
      await db
        .prepare(
          `INSERT INTO company_days (item_id, day_key, revenue, expenses, interest, principal_paid, net_income,
             dividend_per_share, dividend_total, source, bankrupt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(item_id, day_key) DO NOTHING`
        )
        .run(
          company.item_id,
          day,
          result.revenue,
          result.expenses,
          result.interest,
          result.principalPaid,
          result.netIncome,
          result.dividendPerShare,
          result.dividendTotal,
          result.dividendSource,
          result.bankrupt ? 1 : 0
        );

      const name = itemById[company.item_id]?.name ?? company.item_id;
      if (result.bankrupt) {
        await db
          .prepare("UPDATE companies SET bankrupt = 1, bankrupt_at = ? WHERE item_id = ?")
          .run(now, company.item_id);
        for (const holder of mine) {
          const note = `${name} went bankrupt. Your ${holder.quantity.toLocaleString("en-US")} share${holder.quantity === 1 ? "" : "s"} are wiped out.`;
          await db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(note, holder.user_id);
        }
        await db.prepare("DELETE FROM inventory WHERE item_id = ?").run(company.item_id);
        await db.prepare("DELETE FROM orders WHERE item_id = ?").run(company.item_id);
        continue;
      }
      if (result.dividendPerShare > 0) {
        for (const holder of mine) {
          const amount = result.dividendPerShare * holder.quantity;
          await db
            .prepare("UPDATE players SET gold = gold + ?, dividends_received = COALESCE(dividends_received, 0) + ? WHERE user_id = ?")
            .run(amount, amount, holder.user_id);
          await db
            .prepare(
              `INSERT INTO company_payouts (day_key, item_id, user_id, shares, dps, amount)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(day_key, item_id, user_id) DO NOTHING`
            )
            .run(day, company.item_id, holder.user_id, holder.quantity, result.dividendPerShare, amount);
          const entry = paid.get(holder.user_id) ?? { total: 0, parts: [] };
          entry.total += amount;
          entry.parts.push(`${name} ${amount.toLocaleString("en-US")}`);
          paid.set(holder.user_id, entry);
        }
      }
    }
    for (const [userId, entry] of paid) {
      const note = `Dividends for ${day}: +${entry.total.toLocaleString("en-US")} coins (${entry.parts.join(", ")}).`;
      await db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(note, userId);
    }
  });
}

// ---- View model ----

function toDayView(row: {
  day_key: string;
  revenue: number;
  expenses: number;
  interest: number;
  principal_paid: number;
  net_income: number;
  dividend_per_share: number;
  dividend_total: number;
  source: string;
  bankrupt: number;
}): CompanyDayView {
  return {
    dayKey: row.day_key,
    revenue: row.revenue,
    expenses: row.expenses,
    interest: row.interest,
    principalPaid: row.principal_paid,
    netIncome: row.net_income,
    dividendPerShare: row.dividend_per_share,
    dividendTotal: row.dividend_total,
    source: row.source === "vote" ? "vote" : row.source === "default" ? "default" : "none",
    bankrupt: Boolean(row.bankrupt),
  };
}

function nextCentralMidnight(now: number) {
  const today = dayKeyIn(now);
  const tomorrow = addDaysToKey(today, 1);
  // Probe forward in 15-minute steps until the Central date flips (handles DST).
  let guess = now + 60_000;
  while (dayKeyIn(guess) !== tomorrow && guess < now + 2 * DAY_MS) guess += 15 * 60_000;
  let low = guess - 15 * 60_000;
  let high = guess;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (dayKeyIn(mid) === tomorrow) high = mid;
    else low = mid;
  }
  return high;
}

export async function buildCompaniesState(
  userId: number,
  isAdmin: boolean,
  mvByItem: Record<string, number>,
  now = Date.now()
): Promise<CompaniesState> {
  const db = getDb();
  const today = dayKeyIn(now);
  const since = addDaysToKey(today, -7);
  const [settings, events, book, companyRows, holders] = await Promise.all([
    readCompanySettings(),
    readCompanyEvents(),
    readTradingHours(),
    db.prepare("SELECT * FROM companies").all() as Promise<CompanyRow[]>,
    holdingRows(),
  ]);
  const [entryRows, dayRows, proposalRows, voteRows, dividendVotes, loanRows, uses, payoutDayRow, totalRow] =
    await Promise.all([
      db
        .prepare(
          `SELECT e.id, e.item_id, e.label, e.amount, e.source, e.created_at, u.username
           FROM company_entries e LEFT JOIN users u ON u.id = e.user_id
           WHERE e.day_key = ? ORDER BY e.id DESC LIMIT 300`
        )
        .all(today) as Promise<
        { id: number; item_id: string; label: string; amount: number; source: string; created_at: number; username: string | null }[]
      >,
      db
        .prepare("SELECT * FROM company_days WHERE day_key >= ? ORDER BY day_key DESC")
        .all(since) as Promise<(Parameters<typeof toDayView>[0] & { item_id: string })[]>,
      db
        .prepare(
          `SELECT p.id, p.item_id, p.kind, p.amount, p.status, p.created_at, p.closes_at, p.note, u.username
           FROM company_proposals p JOIN users u ON u.id = p.created_by
           WHERE p.status = 'open' OR p.decided_at >= ?
           ORDER BY p.id DESC LIMIT 100`
        )
        .all(now - DAY_MS) as Promise<
        {
          id: number;
          item_id: string;
          kind: ProposalKind;
          amount: number;
          status: ProposalView["status"];
          created_at: number;
          closes_at: number;
          note: string | null;
          username: string;
        }[]
      >,
      db
        .prepare(
          `SELECT v.proposal_id, v.user_id, v.yes FROM company_proposal_votes v
           JOIN company_proposals p ON p.id = v.proposal_id
           WHERE p.status = 'open' OR p.decided_at >= ?`
        )
        .all(now - DAY_MS) as Promise<{ proposal_id: number; user_id: number; yes: number }[]>,
      db
        .prepare("SELECT item_id, user_id, dps FROM company_dividend_votes WHERE day_key = ?")
        .all(today) as Promise<{ item_id: string; user_id: number; dps: number }[]>,
      db.prepare("SELECT item_id, principal_left, daily_principal, daily_interest FROM company_loans").all() as Promise<
        { item_id: string; principal_left: number; daily_principal: number; daily_interest: number }[]
      >,
      db
        .prepare("SELECT event_id, item_id FROM company_event_uses WHERE user_id = ?")
        .all(userId) as Promise<{ event_id: string; item_id: string }[]>,
      db.prepare("SELECT MAX(day_key) AS day_key FROM company_payouts").get() as Promise<
        { day_key: string | null } | undefined
      >,
      db
        .prepare("SELECT COALESCE(dividends_received, 0) AS total FROM players WHERE user_id = ?")
        .get(userId) as Promise<{ total: number } | undefined>,
    ]);

  const shareOf = new Map<string, Map<number, number>>();
  for (const row of holders) {
    const bag = shareOf.get(row.item_id) ?? new Map<number, number>();
    bag.set(row.user_id, row.quantity);
    shareOf.set(row.item_id, bag);
  }

  const companies: CompanyView[] = [];
  for (const item of items) {
    const row = companyRows.find((entry) => entry.item_id === item.id);
    if (!row) continue;
    const bag = shareOf.get(item.id) ?? new Map<number, number>();
    const outstanding = [...bag.values()].reduce((sum, qty) => sum + qty, 0);
    const issued = Math.max(outstanding, row.booked_shares);
    const myShares = bag.get(userId) ?? 0;
    const myPct = holderPct(myShares, outstanding);
    const balance = balanceOf(row);
    const sums = totals(balance);
    const entries: CompanyEntryView[] = entryRows
      .filter((entry) => entry.item_id === item.id)
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        amount: entry.amount,
        source: entry.source === "random" ? "random" : "player",
        username: entry.username,
        createdAt: entry.created_at,
      }));
    const todayRevenue = entries.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0);
    const todayExpenses = entries.reduce((sum, entry) => sum + Math.max(0, -entry.amount), 0);
    const loans = loanRows.filter((loan) => loan.item_id === item.id);
    const scheduledInterest = loans.reduce((sum, loan) => sum + loan.daily_interest, 0);
    const history = dayRows.filter((day) => day.item_id === item.id).map(toDayView);
    const window = dividendVoteWindow(book.hours[item.id], book.timeZone, settings, now);
    const votesToday = dividendVotes.filter((vote) => vote.item_id === item.id);
    const votedShares = votesToday.reduce((sum, vote) => sum + (bag.get(vote.user_id) ?? 0), 0);
    const proposals: ProposalView[] = proposalRows
      .filter((proposal) => proposal.item_id === item.id)
      .map((proposal) => {
        const ballots = voteRows.filter((vote) => vote.proposal_id === proposal.id);
        const weight = (yes: number) =>
          ballots.filter((vote) => vote.yes === yes).reduce((sum, vote) => sum + (bag.get(vote.user_id) ?? 0), 0);
        const mineBallot = ballots.find((vote) => vote.user_id === userId);
        return {
          id: proposal.id,
          kind: proposal.kind,
          amount: proposal.amount,
          description: describeProposal(proposal.kind, proposal.amount),
          status: proposal.status,
          proposedBy: proposal.username,
          createdAt: proposal.created_at,
          closesAt: proposal.closes_at,
          yesPct: outstanding > 0 ? (weight(1) / outstanding) * 100 : 0,
          noPct: outstanding > 0 ? (weight(0) / outstanding) * 100 : 0,
          myVote: mineBallot ? mineBallot.yes === 1 : null,
          note: proposal.note,
        };
      });
    companies.push({
      itemId: item.id,
      name: item.name,
      emoji: item.emoji,
      image: item.image ?? null,
      mv: Math.round(mvByItem[item.id] ?? item.basePrice),
      cash: balance.cash,
      loan: balance.loan,
      commonStock: balance.commonStock,
      apic: balance.apic,
      treasuryStock: balance.treasuryStock,
      retainedEarnings: balance.retainedEarnings,
      dividendsDeclared: balance.dividends,
      assets: sums.assets,
      liabilities: sums.liabilities,
      equity: sums.equity,
      bankrupt: Boolean(row.bankrupt),
      issued,
      outstanding,
      treasuryShares: Math.max(0, issued - outstanding),
      myShares,
      myPct,
      myTier: holderTier(myPct),
      todayRevenue,
      todayExpenses,
      todayEntries: entries.slice(0, 40),
      lastDay: history[0] ?? null,
      history: history.slice(0, 7),
      vote: {
        open: !row.bankrupt && voteOpenNow(window, now),
        startMin: window.startMin,
        endMin: window.endMin,
        myDps: votesToday.find((vote) => vote.user_id === userId)?.dps ?? null,
        votedPct: outstanding > 0 ? (votedShares / outstanding) * 100 : 0,
        defaultDps: defaultDividendPerShare(
          todayRevenue - todayExpenses - scheduledInterest,
          settings.defaultPayoutPct,
          issued
        ),
      },
      proposals,
      loans: loans.map((loan) => ({
        principalLeft: loan.principal_left,
        dailyPayment: Math.min(loan.principal_left, loan.daily_principal) + loan.daily_interest,
      })),
      maxLoan: row.bankrupt ? 0 : Math.max(0, balance.commonStock + balance.apic - balance.loan),
    });
  }

  let payouts: CompaniesState["payouts"] = null;
  if (payoutDayRow?.day_key) {
    const rows = (await db
      .prepare(
        `SELECT p.item_id, p.user_id, p.shares, p.dps, p.amount, u.username
         FROM company_payouts p JOIN users u ON u.id = p.user_id WHERE p.day_key = ?`
      )
      .all(payoutDayRow.day_key)) as {
      item_id: string;
      user_id: number;
      shares: number;
      dps: number;
      amount: number;
      username: string;
    }[];
    const byPlayer = new Map<string, number>();
    for (const row of rows) byPlayer.set(row.username, (byPlayer.get(row.username) ?? 0) + row.amount);
    const mine = rows
      .filter((row) => row.user_id === userId)
      .map((row) => ({ itemId: row.item_id, shares: row.shares, dps: row.dps, amount: row.amount }));
    payouts = {
      dayKey: payoutDayRow.day_key,
      mine,
      myTotal: mine.reduce((sum, row) => sum + row.amount, 0),
      players: [...byPlayer.entries()]
        .map(([username, amount]) => ({ username, amount }))
        .sort((a, b) => b.amount - a.amount || a.username.localeCompare(b.username)),
    };
  }

  const usedBy = new Map(uses.map((row) => [row.event_id, row.item_id]));
  return {
    timeZone: COMPANY_TIME_ZONE,
    dayKey: today,
    nextSettleAt: nextCentralMidnight(now),
    settings,
    myEvents: events
      .filter((event) => !event.random)
      .map((event) => ({
        id: event.id,
        name: event.name,
        amount: event.amount,
        usedItemId: usedBy.get(event.id) ?? null,
      })),
    companies,
    payouts,
    myDividendsTotal: totalRow?.total ?? 0,
    allEvents: isAdmin ? events : [],
  };
}
