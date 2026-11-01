import { itemById, items } from "@/lib/game/catalog";
import { DESK_USERNAME, getDb, getItemAuthorized, readTradingHours, setItemAuthorized } from "@/lib/game/db";
import {
  CEO_MIN_PCT,
  COMPANY_TIME_ZONE,
  INDUSTRIES,
  STRATEGIES,
  STRATEGY_IDS,
  asStrategy,
  canDelegate,
  computePower,
  payoutPctWithStrategy,
  strategyNextDay,
  tallyCeo,
  PROPOSAL_KINDS,
  TRAITS,
  asIndustry,
  centralMs,
  parseTraits,
  payoutPctFor,
  pickProfile,
  planNews,
  recordPassed,
  shockOf,
  swingOf,
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
  type Delegation,
  type Strategy,
  type Trait,
} from "@/lib/game/companies";
import type {
  CompaniesState,
  BoardView,
  CompanyDayView,
  CompanyEntryView,
  CompanyNewsView,
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
  ceo_id: number;
  ceo_since: number | null;
  strategy: string;
  industry: string;
  traits: string;
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
  let seed = await readMeta("company_seed");
  if (!seed) {
    seed = String(now);
    await writeMeta("company_seed", seed);
  }
  for (const [index, item] of items.entries()) {
    const issued = authorizedOf(item.id);
    const existing = byId.get(item.id);
    if (existing && !asIndustry(existing.industry)) {
      const profile = pickProfile(seed, item.id, index);
      await db
        .prepare("UPDATE companies SET industry = ?, traits = ? WHERE item_id = ?")
        .run(profile.industry, JSON.stringify(profile.traits), item.id);
    }
    if (!existing) {
      const profile = pickProfile(seed, item.id, index);
      const start = initialBalance(issued, item.basePrice, settings.parValue);
      await db
        .prepare(
          `INSERT INTO companies (item_id, cash, loan, par, common_stock, apic, treasury_stock, retained, booked_shares, industry, traits)
           VALUES (?, ?, 0, ?, ?, ?, 0, 0, ?, ?, ?)`
        )
        .run(
          item.id,
          start.cash,
          Math.min(settings.parValue, item.basePrice),
          start.commonStock,
          start.apic,
          issued,
          profile.industry,
          JSON.stringify(profile.traits)
        );
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
    "company_news",
    "company_records",
    "company_delegations",
    "company_ceo_votes",
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
    DELETE FROM company_news;
    DELETE FROM company_records;
    DELETE FROM company_delegations;
    DELETE FROM company_ceo_votes;
    UPDATE players SET dividends_received = 0;
  `);
  await writeMeta("company_seed", String(now));
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

async function currentHolderMap(itemId: string) {
  const map = new Map<number, number>();
  for (const row of (await holdingRows()).filter((entry) => entry.item_id === itemId)) {
    map.set(row.user_id, row.quantity);
  }
  return map;
}

async function delegationRows(itemId: string): Promise<(Delegation & { fromName: string; toName: string })[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT d.from_user, d.to_user, uf.username AS from_name, ut.username AS to_name
       FROM company_delegations d
       JOIN users uf ON uf.id = d.from_user
       JOIN users ut ON ut.id = d.to_user
       WHERE d.item_id = ?`
    )
    .all(itemId)) as { from_user: number; to_user: number; from_name: string; to_name: string }[];
  return rows.map((row) => ({ from: row.from_user, to: row.to_user, fromName: row.from_name, toName: row.to_name }));
}

function lentMessage(toName: string | undefined) {
  return `You lent your votes${toName ? ` to ${toName}` : ""}, so you cannot vote yourself. Take them back first.`;
}

export async function castDividendVote(userId: number, itemId: string, dps: number, now = Date.now()) {
  await requireCompany(itemId);
  if (!Number.isInteger(dps) || dps < 0 || dps > 1_000_000) {
    throw new Error("Dividend per share must be a whole number of coins from 0 to 1,000,000.");
  }
  const settings = await readCompanySettings();
  const book = await readTradingHours();
  const window = dividendVoteWindow(book.hours[itemId], book.timeZone, settings, now);
  if (!voteOpenNow(window, now)) throw new Error("Dividend voting is closed. It opens when trading closes.");
  await snapshotIfNeeded(itemId, dayKeyIn(now));
  const records = new Map((await recordRows(dayKeyIn(now), itemId)).map((row) => [row.user_id, row.shares]));
  const delegations = await delegationRows(itemId);
  const row = computePower(records, delegations, settings.voteCapPct).rows.get(userId);
  if (row?.away) throw new Error(lentMessage(delegations.find((entry) => entry.from === userId)?.toName));
  if (!row || row.power < 1) {
    throw new Error("Only holders at the record time (or the traveler they lent votes to) can vote on today's dividend.");
  }
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
  const settings = await readCompanySettings();
  const delegations = await delegationRows(proposal.item_id);
  const power = computePower(await currentHolderMap(proposal.item_id), delegations, settings.voteCapPct);
  const mine = power.rows.get(userId);
  if (mine?.away) throw new Error(lentMessage(delegations.find((entry) => entry.from === userId)?.toName));
  if (!mine || mine.power < 1) throw new Error("Only shareholders (or the traveler they lent votes to) can vote.");
  await db
    .prepare(
      `INSERT INTO company_proposal_votes (proposal_id, user_id, yes) VALUES (?, ?, ?)
       ON CONFLICT(proposal_id, user_id) DO UPDATE SET yes = excluded.yes`
    )
    .run(proposalId, userId, yes ? 1 : 0);
  const ballots = (await db
    .prepare("SELECT user_id, yes FROM company_proposal_votes WHERE proposal_id = ?")
    .all(proposalId)) as { user_id: number; yes: number }[];
  let yesPower = 0;
  let noPower = 0;
  for (const ballot of ballots) {
    const weight = power.rows.get(ballot.user_id)?.power ?? 0;
    if (ballot.yes === 1) yesPower += weight;
    else noPower += weight;
  }
  let status: ProposalOutcome["status"] = "open";
  if (yesPower * 2 > power.totalPower) status = "passed";
  else if (noPower * 2 >= power.totalPower) status = "failed";
  if (status !== "open") {
    const info = await db
      .prepare("UPDATE company_proposals SET status = ?, decided_at = ? WHERE id = ? AND status = 'open'")
      .run(status, now, proposalId);
    if (info.changes < 1) status = "open";
  }
  return { id: proposalId, itemId: proposal.item_id, kind: proposal.kind, amount: proposal.amount, status };
}

export async function castCeoVote(userId: number, itemId: string, candidateName: string | null, now = Date.now()) {
  await requireCompany(itemId);
  const settings = await readCompanySettings();
  const book = await readTradingHours();
  const window = dividendVoteWindow(book.hours[itemId], book.timeZone, settings, now);
  if (!voteOpenNow(window, now)) throw new Error("CEO voting is open while the dividend vote is open (after trading closes).");
  const day = dayKeyIn(now);
  await snapshotIfNeeded(itemId, day);
  const records = await recordRows(day, itemId);
  const delegations = await delegationRows(itemId);
  const mine = computePower(new Map(records.map((row) => [row.user_id, row.shares])), delegations, settings.voteCapPct).rows.get(userId);
  if (mine?.away) throw new Error(lentMessage(delegations.find((entry) => entry.from === userId)?.toName));
  if (!mine || mine.power < 1) throw new Error("Only holders at the record time (or their delegates) can vote for CEO.");
  const db = getDb();
  const name = (candidateName ?? "").trim();
  if (!name) {
    await db.prepare("DELETE FROM company_ceo_votes WHERE item_id = ? AND day_key = ? AND voter_id = ?").run(itemId, day, userId);
    return null;
  }
  const candidate = (await db
    .prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE")
    .get(name)) as { id: number; username: string } | undefined;
  if (!candidate) throw new Error("No such traveler.");
  const total = records.reduce((sum, row) => sum + row.shares, 0);
  const held = records.find((row) => row.user_id === candidate.id)?.shares ?? 0;
  if (total < 1 || (held / total) * 100 < CEO_MIN_PCT) {
    throw new Error(`${candidate.username} needs at least ${CEO_MIN_PCT}% of the shares at the record time to be CEO.`);
  }
  await db
    .prepare(
      `INSERT INTO company_ceo_votes (item_id, day_key, voter_id, candidate_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, day_key, voter_id) DO UPDATE SET candidate_id = excluded.candidate_id`
    )
    .run(itemId, day, userId, candidate.id);
  return candidate.username;
}

export async function setCompanyStrategy(userId: number, itemId: string, strategy: string) {
  const company = await requireCompany(itemId);
  if (company.ceo_id !== userId) throw new Error("Only the CEO can set the strategy.");
  if (!STRATEGY_IDS.includes(strategy as Strategy)) throw new Error("Pick Growth, Balanced or Harvest.");
  await getDb().prepare("UPDATE companies SET strategy = ? WHERE item_id = ?").run(strategy, itemId);
  return strategy as Strategy;
}

export async function setDelegation(userId: number, itemId: string, toName: string | null) {
  await requireCompany(itemId);
  const db = getDb();
  const name = (toName ?? "").trim();
  if (!name) {
    await db.prepare("DELETE FROM company_delegations WHERE item_id = ? AND from_user = ?").run(itemId, userId);
    return null;
  }
  if ((await sharesHeld(userId, itemId)) < 1) throw new Error("Only shareholders can lend their votes.");
  const target = (await db
    .prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE")
    .get(name)) as { id: number; username: string } | undefined;
  if (!target) throw new Error("No such traveler.");
  const others = (await delegationRows(itemId)).filter((row) => row.from !== userId);
  const problem = canDelegate({ from: userId, to: target.id, delegations: others });
  if (problem) throw new Error(problem);
  await db
    .prepare(
      `INSERT INTO company_delegations (item_id, from_user, to_user, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, from_user) DO UPDATE SET to_user = excluded.to_user, created_at = excluded.created_at`
    )
    .run(itemId, userId, target.id, Date.now());
  return target.username;
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

// ---- Record date snapshots and news ----

async function recordMarker(day: string, itemId: string) {
  const row = await getDb()
    .prepare("SELECT 1 AS x FROM company_records WHERE day_key = ? AND item_id = ? AND user_id = 0")
    .get(day, itemId);
  return Boolean(row);
}

async function recordRows(day: string, itemId: string) {
  return (await getDb()
    .prepare("SELECT user_id, shares FROM company_records WHERE day_key = ? AND item_id = ? AND user_id > 0")
    .all(day, itemId)) as { user_id: number; shares: number }[];
}

/** Freezes who holds each company at the record time (when dividend voting opens). */
async function snapshotIfNeeded(itemId: string, day: string) {
  if (await recordMarker(day, itemId)) return;
  const db = getDb();
  const holders = (await holdingRows()).filter((row) => row.item_id === itemId);
  await db.transaction(async () => {
    await db
      .prepare("INSERT INTO company_records (day_key, item_id, user_id, shares) VALUES (?, ?, 0, 0) ON CONFLICT DO NOTHING")
      .run(day, itemId);
    for (const holder of holders) {
      await db
        .prepare("INSERT INTO company_records (day_key, item_id, user_id, shares) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
        .run(day, itemId, holder.user_id, holder.quantity);
    }
  });
}

async function takeSnapshots(now: number, settings: CompanySettings) {
  const today = dayKeyIn(now);
  const book = await readTradingHours();
  const rows = (await getDb().prepare("SELECT item_id FROM companies WHERE bankrupt = 0").all()) as { item_id: string }[];
  for (const row of rows) {
    const window = dividendVoteWindow(book.hours[row.item_id], book.timeZone, settings, now);
    if (recordPassed(window, now)) await snapshotIfNeeded(row.item_id, today);
  }
}

function profileOf(row: CompanyRow) {
  return { industry: asIndustry(row.industry) ?? "retailer", traits: parseTraits(row.traits) };
}

async function ensureNews(now: number, settings: CompanySettings) {
  const db = getDb();
  const today = dayKeyIn(now);
  if (settings.newsPerDay < 1) return;
  const has = await db.prepare("SELECT 1 AS x FROM company_news WHERE day_key = ? LIMIT 1").get(today);
  if (has) return;
  const rows = (await db.prepare("SELECT * FROM companies WHERE bankrupt = 0").all()) as CompanyRow[];
  if (rows.length === 0) return;
  const plans = planNews({
    companies: rows.map((row) => ({
      itemId: row.item_id,
      name: itemById[row.item_id]?.name ?? row.item_id,
      ...profileOf(row),
    })),
    count: settings.newsPerDay,
    reliabilityPct: settings.rumorReliabilityPct,
    rand: Math.random,
  });
  const dayEnd = centralMs(addDaysToKey(today, 1), 0);
  await db.transaction(async () => {
    let late = 0;
    for (const plan of plans) {
      let rumorAt = centralMs(today, plan.rumorMin);
      let confirmAt = centralMs(today, plan.confirmMin);
      if (rumorAt < now) {
        // A game that starts mid-day gets its news rolled out from now instead of all at once.
        const length = confirmAt - rumorAt;
        rumorAt = now + 60_000 + late * 10 * 60_000;
        confirmAt = rumorAt + length;
        late += 1;
      }
      if (confirmAt > dayEnd - 5 * 60_000) continue;
      await db
        .prepare(
          `INSERT INTO company_news (item_id, day_key, rumor_text, confirm_text, amount, rumor_at, confirm_at, reliable, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rumor')`
        )
        .run(plan.itemId, today, plan.rumor, plan.confirm, plan.amount, rumorAt, confirmAt, plan.reliable ? 1 : 0);
    }
  });
}

async function processNews(now: number) {
  const db = getDb();
  const due = (await db
    .prepare("SELECT * FROM company_news WHERE status = 'rumor' AND confirm_at <= ? ORDER BY id")
    .all(now)) as {
    id: number;
    item_id: string;
    confirm_text: string;
    amount: number;
    reliable: number;
  }[];
  for (const news of due) {
    const company = (await db.prepare("SELECT bankrupt FROM companies WHERE item_id = ?").get(news.item_id)) as
      | { bankrupt: number }
      | undefined;
    const confirmed = Boolean(news.reliable) && company != null && !company.bankrupt;
    const info = await db
      .prepare("UPDATE company_news SET status = ? WHERE id = ? AND status = 'rumor'")
      .run(confirmed ? "confirmed" : "fizzled", news.id);
    if (info.changes < 1 || !confirmed) continue;
    await db
      .prepare(
        `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
         VALUES (?, ?, ?, ?, NULL, 'news', ?)`
      )
      .run(news.item_id, dayKeyIn(now), `News: ${news.confirm_text}`, news.amount, now);
  }
}

async function companyTick(now: number, settings: CompanySettings) {
  await ensureNews(now, settings);
  await processNews(now);
  await takeSnapshots(now, settings);
}

// ---- Daily settlement ----

const clock = globalThis as unknown as { bazaarCompanyClock?: Promise<boolean> };

/** Settles every finished Central-time day (runs at 00:00). Safe to call on every request. */
export async function runCompanyClock(now = Date.now()) {
  if (clock.bazaarCompanyClock) return clock.bazaarCompanyClock;
  const run = (async () => {
    await ensureCompanies(now);
    await companyTick(now, await readCompanySettings());
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
        const profile = profileOf(target);
        const scaled = Math.round((event.amount * swingOf(profile.industry, profile.traits) * shockOf(profile.industry, profile.traits)) / 10) * 10;
        const amount = scaled === 0 ? Math.sign(event.amount) * 10 : scaled;
        await db
          .prepare(
            `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
             VALUES (?, ?, ?, ?, NULL, 'random', ?)`
          )
          .run(target.item_id, day, `Random event: ${event.name}`, amount, now);
      }
    }

    const current = await holdingRows();
    const authorizedOf = await authorizedLookup();
    const paid = new Map<number, { total: number; parts: string[] }>();
    const notes = new Map<number, string[]>();
    const addNote = (userId: number, text: string) => {
      const list = notes.get(userId) ?? [];
      list.push(text);
      notes.set(userId, list);
    };

    for (const company of companies) {
      let salary = 0;
      let ceoName = "";
      if (company.ceo_id > 0 && settings.ceoSalary > 0) {
        const ceo = (await db.prepare("SELECT username FROM users WHERE id = ?").get(company.ceo_id)) as
          | { username: string }
          | undefined;
        if (ceo) {
          salary = settings.ceoSalary;
          ceoName = ceo.username;
          await db
            .prepare(
              `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
               VALUES (?, ?, ?, ?, ?, 'strategy', ?)`
            )
            .run(company.item_id, day, `CEO salary (${ceo.username})`, -salary, company.ceo_id, now);
        }
      }
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
      const currentMine = current.filter((row) => row.item_id === company.item_id);
      // Holders at the record time are paid and vote; without a snapshot, fall back to today's holders.
      const mine: { user_id: number; quantity: number }[] = (await recordMarker(day, company.item_id))
        ? (await recordRows(day, company.item_id)).map((row) => ({ user_id: row.user_id, quantity: row.shares }))
        : currentMine.map((row) => ({ user_id: row.user_id, quantity: row.quantity }));
      const profile = profileOf(company);
      const outstanding = mine.reduce((sum, row) => sum + row.quantity, 0);
      const issued = authorizedOf(company.item_id);
      const voteRows = (await db
        .prepare("SELECT user_id, dps FROM company_dividend_votes WHERE item_id = ? AND day_key = ?")
        .all(company.item_id, day)) as { user_id: number; dps: number }[];
      const delegations = await delegationRows(company.item_id);
      const powerRes = computePower(
        new Map(mine.map((row) => [row.user_id, row.quantity])),
        delegations,
        settings.voteCapPct
      );
      const votes = voteRows
        .map((vote) => ({ dps: vote.dps, weight: powerRes.rows.get(vote.user_id)?.power ?? 0 }))
        .filter((vote) => vote.weight > 0);
      const strategy = company.ceo_id > 0 ? asStrategy(company.strategy) : "balanced";

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
        votingPower: powerRes.totalPower,
        payoutPct: payoutPctWithStrategy(
          payoutPctFor(settings.defaultPayoutPct, profile.industry, profile.traits),
          strategy
        ),
        maxPayoutPct: STRATEGIES[strategy].maxPayoutPct,
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
        for (const holder of currentMine) {
          const note = `${name} went bankrupt. Your ${holder.quantity.toLocaleString("en-US")} share${holder.quantity === 1 ? "" : "s"} are wiped out.`;
          await db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(note, holder.user_id);
        }
        await db.prepare("DELETE FROM inventory WHERE item_id = ?").run(company.item_id);
        await db.prepare("DELETE FROM orders WHERE item_id = ?").run(company.item_id);
        continue;
      }
      const effect = strategyNextDay(strategy, result.netIncome, swingOf(profile.industry, profile.traits), Math.random);
      if (effect) {
        await db
          .prepare(
            `INSERT INTO company_entries (item_id, day_key, label, amount, user_id, source, created_at)
             VALUES (?, ?, ?, ?, NULL, 'strategy', ?)`
          )
          .run(company.item_id, addDaysToKey(day, 1), effect.label, effect.amount, now);
      }
      if (salary > 0) {
        await db.prepare("UPDATE players SET gold = gold + ? WHERE user_id = ?").run(salary, company.ceo_id);
        addNote(company.ceo_id, `CEO salary from ${name}: +${salary.toLocaleString("en-US")} coins.`);
      }
      void ceoName;
      const ballots = (await db
        .prepare("SELECT voter_id AS voter, candidate_id AS candidate FROM company_ceo_votes WHERE item_id = ? AND day_key = ?")
        .all(company.item_id, day)) as { voter: number; candidate: number }[];
      const winner = tallyCeo({
        ballots,
        power: powerRes.rows,
        eligible: (id) =>
          id > 0 && outstanding > 0 && (((mine.find((row) => row.user_id === id)?.quantity ?? 0) / outstanding) * 100) >= CEO_MIN_PCT,
        incumbent: company.ceo_id,
      });
      if (winner !== company.ceo_id) {
        await db
          .prepare("UPDATE companies SET ceo_id = ?, ceo_since = ?, strategy = 'balanced' WHERE item_id = ?")
          .run(winner, winner > 0 ? now : null, company.item_id);
        if (winner > 0) addNote(winner, `You were elected CEO of ${name}.`);
        if (company.ceo_id > 0) addNote(company.ceo_id, winner > 0 ? `You are no longer CEO of ${name}.` : `${name} has no CEO any more.`);
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
    for (const userId of new Set([...paid.keys(), ...notes.keys()])) {
      const parts: string[] = [];
      const entry = paid.get(userId);
      if (entry) parts.push(`Dividends for ${day}: +${entry.total.toLocaleString("en-US")} coins (${entry.parts.join(", ")}).`);
      parts.push(...(notes.get(userId) ?? []));
      await db.prepare("UPDATE players SET last_event = ? WHERE user_id = ?").run(parts.join(" "), userId);
    }
  });
}

// ---- View model ----

function pickIndustryView(id: keyof typeof INDUSTRIES) {
  const { label, emoji, blurb, chip } = INDUSTRIES[id];
  return { label, emoji, blurb, chip };
}

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
  const [entryRows, dayRows, proposalRows, voteRows, dividendVotes, loanRows, uses, payoutDayRow, totalRow, recordAll, newsRows] =
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
      db
        .prepare("SELECT item_id, user_id, shares FROM company_records WHERE day_key = ?")
        .all(today) as Promise<{ item_id: string; user_id: number; shares: number }[]>,
      db
        .prepare("SELECT * FROM company_news WHERE day_key >= ? AND rumor_at <= ? ORDER BY rumor_at DESC, id DESC LIMIT 40")
        .all(addDaysToKey(today, -1), now) as Promise<
        {
          id: number;
          item_id: string;
          rumor_text: string;
          confirm_text: string;
          amount: number;
          rumor_at: number;
          confirm_at: number;
          status: string;
        }[]
      >,
    ]);

  const delegRows = (await db
    .prepare(
      `SELECT d.item_id, d.from_user, d.to_user, uf.username AS from_name, ut.username AS to_name
       FROM company_delegations d
       JOIN users uf ON uf.id = d.from_user
       JOIN users ut ON ut.id = d.to_user`
    )
    .all()) as { item_id: string; from_user: number; to_user: number; from_name: string; to_name: string }[];
  const ceoVoteRows = (await db
    .prepare(
      `SELECT v.item_id, v.voter_id, v.candidate_id, u.username AS cand_name
       FROM company_ceo_votes v JOIN users u ON u.id = v.candidate_id WHERE v.day_key = ?`
    )
    .all(today)) as { item_id: string; voter_id: number; candidate_id: number; cand_name: string }[];
  const ceoIds = [...new Set(companyRows.filter((row) => row.ceo_id > 0).map((row) => row.ceo_id))];
  const ceoNames = new Map<number, string>();
  if (ceoIds.length > 0) {
    const rows = (await db
      .prepare(`SELECT id, username FROM users WHERE id IN (${ceoIds.map(() => "?").join(",")})`)
      .all(...ceoIds)) as { id: number; username: string }[];
    for (const row of rows) ceoNames.set(row.id, row.username);
  }

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
        source:
          entry.source === "random"
            ? "random"
            : entry.source === "news"
              ? "news"
              : entry.source === "strategy"
                ? "strategy"
                : "player",
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
    const recordHere = recordAll.filter((rec) => rec.item_id === item.id);
    const recorded = recordHere.some((rec) => rec.user_id === 0);
    const recBag = new Map(recordHere.filter((rec) => rec.user_id > 0).map((rec) => [rec.user_id, rec.shares]));
    const voteBag = recorded ? recBag : bag;
    const voteTotal = [...voteBag.values()].reduce((sum, qty) => sum + qty, 0);
    const profile = profileOf(row);
    const strategy = row.ceo_id > 0 ? asStrategy(row.strategy) : "balanced";
    const itemDelegs = delegRows.filter((entry) => entry.item_id === item.id);
    const delegPairs = itemDelegs.map((entry) => ({ from: entry.from_user, to: entry.to_user }));
    const power = computePower(voteBag, delegPairs, settings.voteCapPct);
    const curPower = computePower(bag, delegPairs, settings.voteCapPct);
    const votedPower = votesToday.reduce((sum, vote) => sum + (power.rows.get(vote.user_id)?.power ?? 0), 0);
    const names = new Map<number, string>();
    for (const holder of holders) if (holder.item_id === item.id) names.set(holder.user_id, holder.username);
    for (const entry of itemDelegs) {
      names.set(entry.from_user, entry.from_name);
      names.set(entry.to_user, entry.to_name);
    }
    const itemCeoVotes = ceoVoteRows.filter((entry) => entry.item_id === item.id);
    for (const entry of itemCeoVotes) names.set(entry.candidate_id, entry.cand_name);
    if (row.ceo_id > 0 && ceoNames.has(row.ceo_id)) names.set(row.ceo_id, ceoNames.get(row.ceo_id) as string);
    const tallyByName = new Map<string, number>();
    for (const entry of itemCeoVotes) {
      tallyByName.set(entry.cand_name, (tallyByName.get(entry.cand_name) ?? 0) + (power.rows.get(entry.voter_id)?.power ?? 0));
    }
    const board: BoardView = {
      ceo: row.ceo_id > 0 ? { id: row.ceo_id, name: names.get(row.ceo_id) ?? "Unknown", since: row.ceo_since } : null,
      strategy,
      isMeCeo: row.ceo_id === userId,
      salary: settings.ceoSalary,
      voteCapPct: settings.voteCapPct,
      candidates: [...bag.entries()]
        .filter(([, qty]) => outstanding > 0 && (qty / outstanding) * 100 >= CEO_MIN_PCT)
        .map(([id, qty]) => ({ id, name: names.get(id) ?? "Unknown", pct: (qty / outstanding) * 100 }))
        .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name)),
      myCeoVote: itemCeoVotes.find((entry) => entry.voter_id === userId)?.cand_name ?? null,
      ceoTally: [...tallyByName.entries()]
        .map(([name, weight]) => ({ name, votePct: power.totalPower > 0 ? (weight / power.totalPower) * 100 : 0 }))
        .sort((a, b) => b.votePct - a.votePct),
      control: [...power.rows.values()]
        .filter((entry) => entry.controlled > 0)
        .sort((a, b) => b.controlled - a.controlled || a.userId - b.userId)
        .slice(0, 6)
        .map((entry) => ({
          userId: entry.userId,
          username: names.get(entry.userId) ?? "Unknown",
          ownPct: voteTotal > 0 ? (entry.own / voteTotal) * 100 : 0,
          controlPct: voteTotal > 0 ? (entry.controlled / voteTotal) * 100 : 0,
          votePct: power.totalPower > 0 ? (entry.power / power.totalPower) * 100 : 0,
          delegators: entry.delegators,
          capped: entry.controlled > entry.power,
          isMe: entry.userId === userId,
        })),
      myDelegateTo: itemDelegs.find((entry) => entry.from_user === userId)?.to_name ?? null,
      myDelegators: itemDelegs.filter((entry) => entry.to_user === userId).map((entry) => entry.from_name),
      myVotePct: power.totalPower > 0 ? ((power.rows.get(userId)?.power ?? 0) / power.totalPower) * 100 : 0,
    };
    const myRecorded = recBag.get(userId) ?? 0;
    const proposals: ProposalView[] = proposalRows
      .filter((proposal) => proposal.item_id === item.id)
      .map((proposal) => {
        const ballots = voteRows.filter((vote) => vote.proposal_id === proposal.id);
        const weight = (yes: number) =>
          ballots
            .filter((vote) => vote.yes === yes)
            .reduce((sum, vote) => sum + (curPower.rows.get(vote.user_id)?.power ?? 0), 0);
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
          yesPct: curPower.totalPower > 0 ? (weight(1) / curPower.totalPower) * 100 : 0,
          noPct: curPower.totalPower > 0 ? (weight(0) / curPower.totalPower) * 100 : 0,
          myVote: mineBallot ? mineBallot.yes === 1 : null,
          note: proposal.note,
        };
      });
    companies.push({
      itemId: item.id,
      board,
      industry: { id: profile.industry, ...pickIndustryView(profile.industry) },
      traits: profile.traits.map((trait: Trait) => ({ id: trait, ...TRAITS[trait] })),
      record: {
        startMin: window.startMin,
        passed: recorded || recordPassed(window, now),
        myShares: recorded ? myRecorded : myShares,
        paysMe: (recorded ? myRecorded : myShares) > 0,
      },
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
        votedPct: power.totalPower > 0 ? (votedPower / power.totalPower) * 100 : 0,
        defaultDps: defaultDividendPerShare(
          todayRevenue - todayExpenses - scheduledInterest,
          payoutPctWithStrategy(payoutPctFor(settings.defaultPayoutPct, profile.industry, profile.traits), strategy),
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
    news: newsRows.map(
      (news): CompanyNewsView => ({
        id: news.id,
        itemId: news.item_id,
        status: news.status === "confirmed" ? "confirmed" : news.status === "fizzled" ? "fizzled" : "rumor",
        headline: news.status === "confirmed" ? news.confirm_text : news.rumor_text,
        positive: news.amount > 0,
        rumorAt: news.rumor_at,
        confirmAt: news.confirm_at,
        amount: news.status === "confirmed" ? news.amount : null,
      })
    ),
    payouts,
    myDividendsTotal: totalRow?.total ?? 0,
    allEvents: isAdmin ? events : [],
  };
}
