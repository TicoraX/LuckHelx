export function usdToXp(usd: number | null | undefined, fallback = 50): number {
  if (usd === null || usd === undefined || !Number.isFinite(usd) || usd < 0) {
    return fallback;
  }
  return Math.max(1, Math.round(usd));
}
