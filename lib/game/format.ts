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

export function formatCoins(amount: number) {
  return `${formatNumber(amount)}🪙`;
}
