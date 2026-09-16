export function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatEta(ms: number) {
  if (ms <= 0) return "now";
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 48) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const leftover = hours % 24;
  return leftover ? `${days}d ${leftover}h` : `${days}d`;
}

export function formatNumber(amount: number) {
  if (!Number.isFinite(amount)) return "0";
  return Math.round(amount).toLocaleString("en-US");
}

const COMPACT_NAMED: [divisor: number, suffix: string][] = [
  [1_000, "k"],
  [1_000_000, "M"],
  [1_000_000_000, "B"],
  [1_000_000_000_000, "T"],
];

export function formatCompact(amount: number) {
  if (!Number.isFinite(amount)) return "0";
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(Math.round(amount));
  if (n < 1000) return `${sign}${n.toLocaleString("en-US")}`;
  for (const [divisor, suffix] of COMPACT_NAMED) {
    const scaled = Math.round(n / divisor);
    if (scaled < 1000) return `${sign}${scaled}${suffix}`;
  }
  for (let exp = 15; exp <= 306; exp += 3) {
    const scaled = Math.round(n / 10 ** exp);
    if (!Number.isFinite(scaled)) break;
    if (scaled < 1000) return `${sign}${scaled}E${exp}`;
  }
  return `${sign}∞`;
}

export function formatPctChange(delta: number, base: number) {
  if (!Number.isFinite(delta) || !Number.isFinite(base) || base === 0) return "0%";
  const pct = (delta / base) * 100;
  if (Math.abs(pct) < 0.05) return "0%";
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  const n = Math.abs(pct).toFixed(digits);
  return `${pct > 0 ? "+" : "-"}${n}%`;
}

export function formatCoins(amount: number) {
  return `${formatNumber(amount)}🪙`;
}

export function formatNetWorth(amount: number) {
  return `${formatNumber(amount)}💰`;
}

export function formatCompactNetWorth(amount: number) {
  return `${formatCompact(amount)}💰`;
}

export function formatMilitary(hour: number, minute = 0) {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = Math.min(59, Math.max(0, Math.round(minute)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMilitaryTime(ms: number, withSeconds = false) {
  const date = new Date(ms);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  if (!withSeconds) return `${hour}:${minute}`;
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

export function formatMilitaryRange(startHour: number, endHour: number) {
  return `${formatMilitary(startHour)}–${formatMilitary(endHour)}`;
}
