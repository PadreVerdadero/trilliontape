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

export type DividendVote = { dps: number; shares: number };

/** Weighted-average dividend per share, valid only when voters hold more than half of the voting shares. */
export function weightedDividend(votes: DividendVote[], outstanding: number) {
  const voted = votes.reduce((sum, vote) => sum + vote.shares, 0);
  if (outstanding <= 0 || voted * 2 <= outstanding) return null;
  const total = votes.reduce((sum, vote) => sum + vote.dps * vote.shares, 0);
  return Math.round(total / voted);
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
  payoutPct: number;
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

  const voted = weightedDividend(input.votes, input.outstanding);
  let dps = voted ?? defaultDividendPerShare(netIncome, input.payoutPct, input.issued);
  const source: SettleResult["dividendSource"] = voted != null ? "vote" : "default";
  // Declared to the contra-equity Dividends account; capped by cash and by undistributed earnings.
  const cap = Math.max(0, Math.min(balance.cash, availableEarnings(balance)));
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
