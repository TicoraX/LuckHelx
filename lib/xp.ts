export const MIN_XP = 5;
export const MAX_XP = 100;

export function clampXp(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_XP;
  return Math.min(MAX_XP, Math.max(MIN_XP, Math.round(raw)));
}

export function normalizeDescription(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
