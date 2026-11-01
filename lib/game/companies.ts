export const COMPANY_TIME_ZONE = "America/Chicago";
export const COMPANY_TIME_LABEL = "Central time (CDT, UTC−5; CST in winter)";
export const DAY_MINUTES = 24 * 60;
export const MAX_EVENTS = 40;
export const MAX_EVENT_AMOUNT = 99_999_999;
export const MAX_LOAN_TERM_DAYS = 365;

export type BankruptcyRule = "retained" | "equity";

export type CompanySettings = {
  interestPct: number;
  loanTermDays: number;
  voteHours: number;
  defaultPayoutPct: number;
  defaultCloseMin: number;
  parValue: number;
  bankruptcyRule: BankruptcyRule;
  randomEvents: boolean;
  dealOpeningShares: boolean;
  newsPerDay: number;
  rumorReliabilityPct: number;
  voteCapPct: number;
  ceoSalary: number;
};

export type CompanyEvent = {
  id: string;
  name: string;
  amount: number;
  random: boolean;
};

export function defaultCompanySettings(): CompanySettings {
  return {
    interestPct: 10,
    loanTermDays: 10,
    voteHours: 3,
    defaultPayoutPct: 100,
    defaultCloseMin: 21 * 60,
    parValue: 1,
    bankruptcyRule: "retained",
    randomEvents: true,
    dealOpeningShares: false,
    newsPerDay: 3,
    rumorReliabilityPct: 70,
    voteCapPct: 30,
    ceoSalary: 100,
  };
}

export function defaultCompanyEvents(): CompanyEvent[] {
  return [
    { id: "big-contract", name: "Landed a big contract", amount: 1200, random: false },
    { id: "product-launch", name: "Product launch hit", amount: 800, random: false },
    { id: "merger", name: "Huge merger", amount: 2000, random: false },
    { id: "subsidy", name: "Government subsidy", amount: 600, random: false },
    { id: "cost-cuts", name: "Cost-cutting program", amount: 400, random: false },
    { id: "layoffs", name: "Had to lay off employees", amount: -500, random: false },
    { id: "repairs", name: "Factory repairs", amount: -700, random: false },
    { id: "lawsuit", name: "Lawsuit settlement", amount: -1000, random: false },
    { id: "supply-chain", name: "Supply chain disruption", amount: -600, random: false },
    { id: "export-order", name: "Surprise export order", amount: 900, random: true },
    { id: "demand-spike", name: "Viral demand spike", amount: 700, random: true },
    { id: "tax-refund", name: "Tax refund", amount: 300, random: true },
    { id: "windfall", name: "Windfall investment", amount: 1500, random: true },
    { id: "breakdown", name: "Equipment failure", amount: -800, random: true },
    { id: "recall", name: "Product recall", amount: -1200, random: true },
  ];
}

function wholeInRange(value: unknown, min: number, max: number, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be a whole number from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`);
  }
  return n;
}

export function validateCompanySettings(raw: Partial<CompanySettings>, base = defaultCompanySettings()): CompanySettings {
  const next: CompanySettings = { ...base };
  if (raw.interestPct != null) next.interestPct = wholeInRange(raw.interestPct, 0, 100, "Interest");
  if (raw.loanTermDays != null) next.loanTermDays = wholeInRange(raw.loanTermDays, 1, MAX_LOAN_TERM_DAYS, "Loan term (days)");
  if (raw.voteHours != null) next.voteHours = wholeInRange(raw.voteHours, 1, 23, "Voting hours");
  if (raw.defaultPayoutPct != null) next.defaultPayoutPct = wholeInRange(raw.defaultPayoutPct, 0, 100, "Default payout %");
  if (raw.defaultCloseMin != null) next.defaultCloseMin = wholeInRange(raw.defaultCloseMin, 0, DAY_MINUTES - 1, "Default close minute");
  if (raw.parValue != null) next.parValue = wholeInRange(raw.parValue, 1, 1_000_000, "Par value");
  if (raw.bankruptcyRule != null) {
    if (raw.bankruptcyRule !== "retained" && raw.bankruptcyRule !== "equity") {
      throw new Error("Bankruptcy rule must be retained earnings or total equity.");
    }
    next.bankruptcyRule = raw.bankruptcyRule;
  }
  if (raw.randomEvents != null) next.randomEvents = Boolean(raw.randomEvents);
  if (raw.dealOpeningShares != null) next.dealOpeningShares = Boolean(raw.dealOpeningShares);
  if (raw.newsPerDay != null) next.newsPerDay = wholeInRange(raw.newsPerDay, 0, 10, "News stories per day");
  if (raw.rumorReliabilityPct != null) {
    next.rumorReliabilityPct = wholeInRange(raw.rumorReliabilityPct, 0, 100, "Rumor reliability");
  }
  if (raw.voteCapPct != null) next.voteCapPct = wholeInRange(raw.voteCapPct, 10, 100, "Vote cap %");
  if (raw.ceoSalary != null) next.ceoSalary = wholeInRange(raw.ceoSalary, 0, 5000, "CEO salary");
  return next;
}

export function normalizeCompanySettings(raw: unknown): CompanySettings {
  try {
    return validateCompanySettings(raw && typeof raw === "object" ? (raw as Partial<CompanySettings>) : {});
  } catch {
    return defaultCompanySettings();
  }
}

export function validateCompanyEvents(raw: unknown): CompanyEvent[] {
  if (!Array.isArray(raw)) throw new Error("Send a list of events.");
  if (raw.length > MAX_EVENTS) throw new Error(`Keep the list to ${MAX_EVENTS} events or fewer.`);
  const seen = new Set<string>();
  const out: CompanyEvent[] = [];
  for (const row of raw as Partial<CompanyEvent>[]) {
    const name = String(row?.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) throw new Error("Each event needs a name of 2 to 60 characters.");
    const amount = wholeInRange(row?.amount, -MAX_EVENT_AMOUNT, MAX_EVENT_AMOUNT, `${name} amount`);
    if (amount === 0) throw new Error(`${name} needs a non-zero amount.`);
    let id = String(row?.id ?? "").trim();
    if (!/^[a-z0-9-]{1,40}$/.test(id)) {
      id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "event";
    }
    let unique = id;
    for (let n = 2; seen.has(unique); n += 1) unique = `${id}-${n}`;
    seen.add(unique);
    out.push({ id: unique, name, amount, random: Boolean(row?.random) });
  }
  if (!out.some((event) => !event.random)) {
    throw new Error("Keep at least one event players can assign (not random-only).");
  }
  return out;
}

export function normalizeCompanyEvents(raw: unknown): CompanyEvent[] {
  try {
    return validateCompanyEvents(raw);
  } catch {
    return defaultCompanyEvents();
  }
}

// ---- Time helpers (company clock runs on Central time) ----

export function dayKeyIn(ms: number, timeZone = COMPANY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function addDaysToKey(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function minuteOfDayIn(ms: number, timeZone = COMPANY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    hour12: false,
  }).formatToParts(new Date(ms));
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

export function tzOffsetMinutes(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Converts a minute-of-day set in another time zone into company (Central) minutes. */
export function toCompanyMinute(minute: number, fromZone: string, now: number) {
  const shift = tzOffsetMinutes(now, COMPANY_TIME_ZONE) - tzOffsetMinutes(now, fromZone);
  return (((minute + shift) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

export type VoteWindow = { startMin: number; endMin: number };

/** Dividend voting opens when trading closes and stays open for `voteHours`, never past midnight. */
export function dividendVoteWindow(
  hours: { openMin: number; closeMin: number } | null | undefined,
  hoursZone: string,
  settings: Pick<CompanySettings, "voteHours" | "defaultCloseMin">,
  now: number
): VoteWindow {
  let startMin = settings.defaultCloseMin;
  if (hours && hours.openMin !== hours.closeMin) {
    startMin = toCompanyMinute(hours.closeMin, hoursZone, now);
  }
  const endMin = Math.min(DAY_MINUTES, startMin + settings.voteHours * 60);
  return { startMin, endMin };
}

export function voteOpenNow(window: VoteWindow, now: number) {
  const minute = minuteOfDayIn(now);
  return minute >= window.startMin && minute < window.endMin;
}

// ---- Shareholder math ----

export type HolderTier = "Minority" | "Significant" | "Majority";

export function holderPct(shares: number, outstanding: number) {
  if (shares <= 0 || outstanding <= 0) return 0;
  return (shares / outstanding) * 100;
}

export function holderTier(pct: number): HolderTier | null {
  if (pct <= 0) return null;
  if (pct < 20) return "Minority";
  if (pct <= 50) return "Significant";
  return "Majority";
}

export type DividendVote = { dps: number; weight: number };

/** Weighted median: the middle value by vote weight, so one extreme vote cannot drag the result. */
export function weightedMedian(items: { value: number; weight: number }[]) {
  const rows = items.filter((row) => row.weight > 0).sort((a, b) => a.value - b.value);
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (rows.length === 0 || total <= 0) return null;
  const half = total / 2;
  let cumulative = 0;
  for (let i = 0; i < rows.length; i += 1) {
    cumulative += rows[i].weight;
    if (cumulative > half) return rows[i].value;
    if (cumulative === half) return Math.round((rows[i].value + rows[i + 1].value) / 2);
  }
  return rows[rows.length - 1].value;
}

/** Median dividend per share, valid only when voters hold more than half of the total voting power. */
export function weightedDividend(votes: DividendVote[], totalPower: number) {
  const voted = votes.reduce((sum, vote) => sum + Math.max(0, vote.weight), 0);
  if (totalPower <= 0 || voted * 2 <= totalPower) return null;
  return weightedMedian(votes.map((vote) => ({ value: vote.dps, weight: vote.weight })));
}

export function defaultDividendPerShare(netIncome: number, payoutPct: number, issuedShares: number) {
  if (netIncome <= 0 || issuedShares <= 0) return 0;
  return Math.floor((netIncome * payoutPct) / 100 / issuedShares);
}

// ---- Balance sheet ----

export type Balance = {
  cash: number;
  loan: number;
  commonStock: number;
  apic: number;
  treasuryStock: number;
  retainedEarnings: number;
  /** Contra-equity: cumulative dividends declared. Reduces equity; never paid out of paid-in capital. */
  dividends: number;
};

export function availableEarnings(balance: Balance) {
  return balance.retainedEarnings - balance.dividends;
}

export function totals(balance: Balance) {
  const assets = balance.cash;
  const liabilities = balance.loan;
  const equity = balance.commonStock + balance.apic - balance.treasuryStock + balance.retainedEarnings - balance.dividends;
  return { assets, liabilities, equity };
}

export function initialBalance(issuedShares: number, issuePrice: number, par: number): Balance {
  const price = Math.max(1, Math.round(issuePrice));
  const parValue = Math.min(Math.max(1, Math.round(par)), price);
  return {
    cash: issuedShares * price,
    loan: 0,
    commonStock: issuedShares * parValue,
    apic: issuedShares * (price - parValue),
    treasuryStock: 0,
    retainedEarnings: 0,
    dividends: 0,
  };
}

export function isBankrupt(balance: Balance, rule: BankruptcyRule) {
  if (rule === "equity") return totals(balance).equity < 0;
  return availableEarnings(balance) < 0;
}

export type LoanTerms = {
  principalLeft: number;
  dailyPrincipal: number;
  dailyInterest: number;
};

export function newLoanTerms(amount: number, interestPct: number, termDays: number) {
  const dailyPrincipal = Math.max(1, Math.ceil(amount / termDays));
  const dailyInterest = Math.ceil((amount * interestPct) / 100 / termDays);
  return { dailyPrincipal, dailyInterest };
}

export type SettleInput = {
  balance: Balance;
  revenue: number;
  expenses: number;
  loans: LoanTerms[];
  rule: BankruptcyRule;
  outstanding: number;
  issued: number;
  votes: DividendVote[];
  /** Sum of every holder's capped voting power (quorum is measured against this). */
  votingPower?: number;
  payoutPct: number;
  /** Strategy cap: the dividend may be at most this % of the day's net income. */
  maxPayoutPct?: number;
};

export type SettleResult = {
  balance: Balance;
  revenue: number;
  expenses: number;
  interest: number;
  principalPaid: number;
  netIncome: number;
  bankrupt: boolean;
  dividendPerShare: number;
  dividendTotal: number;
  dividendSource: "vote" | "default" | "none";
  loans: LoanTerms[];
};

export function settleCompanyDay(input: SettleInput): SettleResult {
  const balance = { ...input.balance };
  const loans = input.loans.map((loan) => ({ ...loan }));
  let interest = 0;
  let principalPaid = 0;
  for (const loan of loans) {
    const principal = Math.min(loan.principalLeft, loan.dailyPrincipal);
    interest += loan.dailyInterest;
    principalPaid += principal;
    loan.principalLeft -= principal;
  }
  const netIncome = input.revenue - input.expenses - interest;
  balance.cash += netIncome - principalPaid;
  balance.loan = Math.max(0, balance.loan - principalPaid);
  balance.retainedEarnings += netIncome;

  const result: SettleResult = {
    balance,
    revenue: input.revenue,
    expenses: input.expenses,
    interest,
    principalPaid,
    netIncome,
    bankrupt: isBankrupt(balance, input.rule),
    dividendPerShare: 0,
    dividendTotal: 0,
    dividendSource: "none",
    loans,
  };
  if (result.bankrupt || input.outstanding <= 0) return result;

  const voted = weightedDividend(input.votes, input.votingPower ?? input.outstanding);
  let dps = voted ?? defaultDividendPerShare(netIncome, input.payoutPct, input.issued);
  const source: SettleResult["dividendSource"] = voted != null ? "vote" : "default";
  // Declared to the contra-equity Dividends account; capped by cash and by undistributed earnings.
  let cap = Math.max(0, Math.min(balance.cash, availableEarnings(balance)));
  if (input.maxPayoutPct != null && input.maxPayoutPct < 100) {
    cap = Math.min(cap, Math.max(0, Math.floor((netIncome * input.maxPayoutPct) / 100)));
  }
  dps = Math.max(0, Math.min(dps, Math.floor(cap / input.outstanding)));
  const total = dps * input.outstanding;
  if (dps > 0) {
    balance.cash -= total;
    balance.dividends += total;
  }
  result.dividendPerShare = dps;
  result.dividendTotal = total;
  result.dividendSource = dps > 0 ? source : "none";
  return result;
}

export const PROPOSAL_KINDS = ["loan", "buyback", "issue"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export function describeProposal(kind: ProposalKind, amount: number) {
  if (kind === "loan") return `Take a bank loan of ${amount.toLocaleString("en-US")} coins`;
  if (kind === "buyback") return `Buy back ${amount.toLocaleString("en-US")} share${amount === 1 ? "" : "s"} from the market`;
  return `Issue ${amount.toLocaleString("en-US")} new share${amount === 1 ? "" : "s"} to the treasury`;
}


// ---- Industries, traits, news and record date ----

export type Industry = "utility" | "tech" | "bank" | "retailer" | "startup" | "commodity";
export type Trait = "steady" | "volatile" | "shockProof" | "generous" | "thrifty" | "rumorMill";

export const INDUSTRY_IDS: Industry[] = ["utility", "tech", "bank", "retailer", "startup", "commodity"];

export const INDUSTRIES: Record<
  Industry,
  { label: string; emoji: string; swing: number; shock: number; payoutDelta: number; blurb: string; chip: string }
> = {
  utility: { label: "Utility", emoji: "💡", swing: 0.5, shock: 0.3, payoutDelta: 15, blurb: "Steady income, shrugs off random shocks, pays out more.", chip: "bg-sky-400/20 text-sky-200" },
  tech: { label: "Tech", emoji: "💻", swing: 1.5, shock: 1, payoutDelta: -15, blurb: "News hits hard. Reinvests, so the default payout is lower.", chip: "bg-violet-400/20 text-violet-200" },
  bank: { label: "Bank", emoji: "🏦", swing: 1, shock: 1, payoutDelta: 5, blurb: "Middle of the road, a little more generous.", chip: "bg-emerald-400/20 text-emerald-200" },
  retailer: { label: "Retailer", emoji: "🛒", swing: 1, shock: 1, payoutDelta: 0, blurb: "Everyday swings in both directions.", chip: "bg-amber-400/20 text-amber-200" },
  startup: { label: "Startup", emoji: "🚀", swing: 2, shock: 1.2, payoutDelta: -25, blurb: "Wild swings, rarely pays out by default.", chip: "bg-rose-400/20 text-rose-200" },
  commodity: { label: "Commodity", emoji: "⛏️", swing: 1.25, shock: 1, payoutDelta: 0, blurb: "Moves a bit more than average on news.", chip: "bg-orange-400/20 text-orange-200" },
};

export const TRAIT_IDS: Trait[] = ["steady", "volatile", "shockProof", "generous", "thrifty", "rumorMill"];

export const TRAITS: Record<Trait, { label: string; blurb: string }> = {
  steady: { label: "Steady", blurb: "News and events move income 30% less." },
  volatile: { label: "Volatile", blurb: "News and events move income 40% more." },
  shockProof: { label: "Shock-proof", blurb: "Random daily events hit it 60% less." },
  generous: { label: "Generous", blurb: "Default payout is 20 points higher." },
  thrifty: { label: "Thrifty", blurb: "Default payout is 20 points lower." },
  rumorMill: { label: "Rumor mill", blurb: "Rumors about it come true 10 points more often." },
};

const TRAIT_CONFLICTS: [Trait, Trait][] = [
  ["steady", "volatile"],
  ["generous", "thrifty"],
];

export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], rand: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Balanced, game-seeded profile: industries cycle through a shuffled order so each appears evenly. */
export function pickProfile(seed: string, itemId: string, index: number): { industry: Industry; traits: Trait[] } {
  const order = shuffled(INDUSTRY_IDS, seededRandom(hashSeed(`${seed}:industries`)));
  const industry = order[((index % order.length) + order.length) % order.length];
  const pool = shuffled(TRAIT_IDS, seededRandom(hashSeed(`${seed}:${itemId}`)));
  const traits: Trait[] = [];
  for (const trait of pool) {
    if (traits.length >= 2) break;
    if (TRAIT_CONFLICTS.some(([a, b]) => (trait === a && traits.includes(b)) || (trait === b && traits.includes(a)))) continue;
    traits.push(trait);
  }
  return { industry, traits };
}

export function parseTraits(raw: string | null | undefined): Trait[] {
  try {
    const list = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(list) ? (list.filter((t) => TRAIT_IDS.includes(t as Trait)) as Trait[]) : [];
  } catch {
    return [];
  }
}

export function asIndustry(value: string | null | undefined): Industry | null {
  return INDUSTRY_IDS.includes(value as Industry) ? (value as Industry) : null;
}

export function swingOf(industry: Industry, traits: Trait[]) {
  let m = INDUSTRIES[industry].swing;
  if (traits.includes("steady")) m *= 0.7;
  if (traits.includes("volatile")) m *= 1.4;
  return m;
}

export function shockOf(industry: Industry, traits: Trait[]) {
  let m = INDUSTRIES[industry].shock;
  if (traits.includes("shockProof")) m *= 0.4;
  return m;
}

export function payoutPctFor(base: number, industry: Industry, traits: Trait[]) {
  let pct = base + INDUSTRIES[industry].payoutDelta;
  if (traits.includes("generous")) pct += 20;
  if (traits.includes("thrifty")) pct -= 20;
  return Math.max(0, Math.min(100, pct));
}

type NewsTemplate = { rumor: string; confirm: string };

const NEWS: Record<Industry, { pos: NewsTemplate[]; neg: NewsTemplate[] }> = {
  utility: {
    pos: [
      { rumor: "is said to be winning a long grid contract", confirm: "signed the long grid contract" },
      { rumor: "may get a rate increase approved", confirm: "got its rate increase approved" },
    ],
    neg: [
      { rumor: "is rumored to face storm repair bills", confirm: "paid for storm repairs" },
      { rumor: "may be fined by regulators", confirm: "was fined by regulators" },
    ],
  },
  tech: {
    pos: [
      { rumor: "is rumored to be launching a hit product", confirm: "launched a hit product" },
      { rumor: "may be about to sign a huge licensing deal", confirm: "signed a huge licensing deal" },
    ],
    neg: [
      { rumor: "is said to be hit by a data breach", confirm: "was hit by a data breach" },
      { rumor: "may be losing its star engineers", confirm: "lost its star engineers" },
    ],
  },
  bank: {
    pos: [
      { rumor: "is said to be booking record lending profits", confirm: "booked record lending profits" },
      { rumor: "may be winning a big fund-management mandate", confirm: "won a big fund-management mandate" },
    ],
    neg: [
      { rumor: "is rumored to be sitting on bad loans", confirm: "wrote off a pile of bad loans" },
      { rumor: "may face a compliance penalty", confirm: "paid a compliance penalty" },
    ],
  },
  retailer: {
    pos: [
      { rumor: "is rumored to have a blockbuster sales weekend", confirm: "had a blockbuster sales weekend" },
      { rumor: "may be opening a profitable new chain of stores", confirm: "opened a profitable chain of stores" },
    ],
    neg: [
      { rumor: "is said to be stuck with unsold stock", confirm: "was stuck with unsold stock" },
      { rumor: "may be hit by a supplier strike", confirm: "was hit by a supplier strike" },
    ],
  },
  startup: {
    pos: [
      { rumor: "is rumored to be landing a surprise investor", confirm: "landed a surprise investor" },
      { rumor: "may be about to go viral", confirm: "went viral" },
    ],
    neg: [
      { rumor: "is said to be burning cash faster than planned", confirm: "burned through cash faster than planned" },
      { rumor: "may lose its biggest customer", confirm: "lost its biggest customer" },
    ],
  },
  commodity: {
    pos: [
      { rumor: "is said to have found a richer seam", confirm: "found a richer seam" },
      { rumor: "may be benefiting from a price spike", confirm: "cashed in on a price spike" },
    ],
    neg: [
      { rumor: "is rumored to face a supply glut", confirm: "was caught in a supply glut" },
      { rumor: "may be slowed by an equipment failure", confirm: "was slowed by an equipment failure" },
    ],
  },
};

export type NewsPlan = {
  itemId: string;
  positive: boolean;
  rumor: string;
  confirm: string;
  amount: number;
  rumorMin: number;
  confirmMin: number;
  reliable: boolean;
};

export const NEWS_FIRST_MIN = 9 * 60;
export const NEWS_LAST_CONFIRM_MIN = 20 * 60;

/** Plans a day of news: staggered rumors through the morning and early afternoon, each confirmed hours later. */
export function planNews(input: {
  companies: { itemId: string; name: string; industry: Industry; traits: Trait[] }[];
  count: number;
  reliabilityPct: number;
  rand: () => number;
}): NewsPlan[] {
  const { rand } = input;
  const count = Math.max(0, Math.min(input.count, input.companies.length));
  if (count === 0) return [];
  const picks = shuffled(input.companies, rand).slice(0, count);
  const span = 360 / count;
  return picks.map((company, index) => {
    const positive = rand() < 0.55;
    const templates = NEWS[company.industry][positive ? "pos" : "neg"];
    const template = templates[Math.floor(rand() * templates.length)];
    const rumorMin = NEWS_FIRST_MIN + Math.floor((index + rand() * 0.8) * span);
    const confirmMin = Math.min(NEWS_LAST_CONFIRM_MIN, rumorMin + 120 + Math.floor(rand() * 180));
    const base = 400 + rand() * 800;
    const magnitude = Math.max(50, Math.round((base * swingOf(company.industry, company.traits)) / 10) * 10);
    const reliability = input.reliabilityPct + (company.traits.includes("rumorMill") ? 10 : 0);
    return {
      itemId: company.itemId,
      positive,
      rumor: `${company.name} ${template.rumor}`,
      confirm: `${company.name} ${template.confirm}`,
      amount: positive ? magnitude : -magnitude,
      rumorMin,
      confirmMin,
      reliable: rand() * 100 < reliability,
    };
  });
}

/** UTC milliseconds for a minute-of-day on a Central-time calendar day. */
export function centralMs(dayKey: string, minute: number, timeZone = COMPANY_TIME_ZONE) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const noon = Date.UTC(y, (m || 1) - 1, d || 1, 12);
  const offset = tzOffsetMinutes(noon, timeZone);
  return Date.UTC(y, (m || 1) - 1, d || 1, 0, minute) - offset * 60_000;
}

/** The record time is when voting opens: holders at that moment are paid and vote on the day's dividend. */
export function recordPassed(window: VoteWindow, now: number) {
  return minuteOfDayIn(now) >= window.startMin;
}


// ---- Vote power (cap and delegation), CEO and strategy ----

export type Delegation = { from: number; to: number };

export type PowerRow = {
  userId: number;
  own: number;
  delegated: number;
  delegators: number;
  controlled: number;
  power: number;
  away: boolean;
};

/**
 * One vote per share, but nobody can carry more than capPct of the total shares (own plus lent to them).
 * Someone who lends their votes casts none themselves, and delegates cannot lend onward.
 */
export function computePower(holders: Map<number, number>, delegations: Delegation[], capPct: number) {
  const total = [...holders.values()].reduce((sum, qty) => sum + Math.max(0, qty), 0);
  const cap = capPct >= 100 ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor((total * capPct) / 100));
  const away = new Set<number>();
  const incoming = new Map<number, { shares: number; count: number }>();
  for (const row of delegations) {
    const shares = holders.get(row.from) ?? 0;
    if (shares < 1 || row.from === row.to) continue;
    away.add(row.from);
    const entry = incoming.get(row.to) ?? { shares: 0, count: 0 };
    entry.shares += shares;
    entry.count += 1;
    incoming.set(row.to, entry);
  }
  const rows = new Map<number, PowerRow>();
  const ids = new Set<number>([...holders.keys(), ...incoming.keys()]);
  for (const userId of ids) {
    const own = Math.max(0, holders.get(userId) ?? 0);
    const lent = away.has(userId);
    const delegated = lent ? 0 : (incoming.get(userId)?.shares ?? 0);
    const controlled = (lent ? 0 : own) + delegated;
    rows.set(userId, {
      userId,
      own,
      delegated,
      delegators: lent ? 0 : (incoming.get(userId)?.count ?? 0),
      controlled,
      power: lent ? 0 : Math.min(controlled, cap),
      away: lent,
    });
  }
  const totalPower = [...rows.values()].reduce((sum, row) => sum + row.power, 0);
  return { rows, totalPower, total, cap };
}

export function canDelegate(input: {
  from: number;
  to: number;
  delegations: Delegation[];
}) {
  if (input.from === input.to) return "You cannot lend your votes to yourself.";
  if (input.delegations.some((row) => row.to === input.from)) {
    return "Others have lent you their votes, so you cannot lend yours onward.";
  }
  if (input.delegations.some((row) => row.from === input.to)) {
    return "That traveler has lent their own votes away, so they cannot receive yours.";
  }
  return null;
}

export const CEO_MIN_PCT = 1;

/** Picks the new CEO from the day's ballots (by capped power); the incumbent keeps ties and an empty ballot box. */
export function tallyCeo(input: {
  ballots: { voter: number; candidate: number }[];
  power: Map<number, { power: number }>;
  eligible: (candidate: number) => boolean;
  incumbent: number;
}) {
  const totals = new Map<number, number>();
  for (const ballot of input.ballots) {
    const power = input.power.get(ballot.voter)?.power ?? 0;
    if (power < 1 || !input.eligible(ballot.candidate)) continue;
    totals.set(ballot.candidate, (totals.get(ballot.candidate) ?? 0) + power);
  }
  let best = 0;
  for (const value of totals.values()) best = Math.max(best, value);
  if (best <= 0) return input.eligible(input.incumbent) ? input.incumbent : 0;
  const leaders = [...totals.entries()].filter(([, value]) => value === best).map(([id]) => id);
  if (leaders.includes(input.incumbent)) return input.incumbent;
  return Math.min(...leaders);
}

export type Strategy = "growth" | "balanced" | "harvest";
export const STRATEGY_IDS: Strategy[] = ["growth", "balanced", "harvest"];

export const STRATEGIES: Record<
  Strategy,
  { label: string; blurb: string; maxPayoutPct: number }
> = {
  growth: {
    label: "Growth",
    blurb:
      "Reinvests. Dividends are capped at 30% of the day's net income and the default payout is no more than 30%. A profitable day adds extra revenue tomorrow (a quarter of the profit, scaled by the company's swing, capped), but the push stalls about one day in four.",
    maxPayoutPct: 30,
  },
  balanced: {
    label: "Balanced",
    blurb: "No changes. Holders' dividend vote decides the payout.",
    maxPayoutPct: 100,
  },
  harvest: {
    label: "Harvest",
    blurb:
      "Pays out. The default payout is 20 points higher, but each profitable day costs the company expenses tomorrow (15% of the profit, capped) as the business is run down.",
    maxPayoutPct: 100,
  },
};

export const GROWTH_RATE = 0.25;
export const GROWTH_CAP = 1500;
export const GROWTH_STALL_PCT = 25;
export const HARVEST_RATE = 0.15;
export const HARVEST_CAP = 1200;

export function asStrategy(value: string | null | undefined): Strategy {
  return STRATEGY_IDS.includes(value as Strategy) ? (value as Strategy) : "balanced";
}

export function payoutPctWithStrategy(basePct: number, strategy: Strategy) {
  if (strategy === "growth") return Math.min(basePct, STRATEGIES.growth.maxPayoutPct);
  if (strategy === "harvest") return Math.min(100, basePct + 20);
  return basePct;
}

/** Tomorrow's effect of today's strategy: extra revenue for Growth, extra expense for Harvest. */
export function strategyNextDay(strategy: Strategy, netIncome: number, swing: number, rand: () => number) {
  if (netIncome <= 0) return null;
  if (strategy === "growth") {
    if (rand() * 100 < GROWTH_STALL_PCT) return null;
    const amount = Math.min(GROWTH_CAP, Math.round((netIncome * GROWTH_RATE * swing) / 10) * 10);
    return amount >= 10 ? { amount, label: "Growth investment pays off" } : null;
  }
  if (strategy === "harvest") {
    const amount = Math.min(HARVEST_CAP, Math.round((netIncome * HARVEST_RATE) / 10) * 10);
    return amount >= 10 ? { amount: -amount, label: "Harvest: running the business down" } : null;
  }
  return null;
}
