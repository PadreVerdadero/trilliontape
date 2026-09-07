export function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatNumber(amount: number) {
  if (!Number.isFinite(amount)) return "0";
  return Math.round(amount).toLocaleString("en-US");
}

export function formatCoins(amount: number) {
  return `${formatNumber(amount)}🪙`;
}
