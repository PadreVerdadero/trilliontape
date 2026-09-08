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

export function formatCompact(amount: number) {
  if (!Number.isFinite(amount)) return "0";
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(Math.round(amount));
  if (n < 1000) return `${sign}${n.toLocaleString("en-US")}`;
  const thousands = Math.round(n / 1000);
  if (thousands < 1000) return `${sign}${thousands}k`;
  const millions = Math.round(n / 1_000_000);
  if (millions < 1000) return `${sign}${millions}M`;
  return `${sign}${Math.round(n / 1_000_000_000)}B`;
}

export function formatCoins(amount: number) {
  return `${formatNumber(amount)}🪙`;
}

export function formatMilitary(hour: number, minute = 0) {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = Math.min(59, Math.max(0, Math.round(minute)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMilitaryRange(startHour: number, endHour: number) {
  return `${formatMilitary(startHour)}–${formatMilitary(endHour)}`;
}
