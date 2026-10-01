// The workspace lives on a fixed business day so reports stay comparable.
// Time keeps moving from that point while the tab is open, so new actions
// appear as "just now" and sort after generated activity.
export const ANCHOR = "2026-09-29T13:32:00Z";
export const TODAY = ANCHOR.slice(0, 10);
export const HISTORY_START = "2025-04-01";

const anchorMs = Date.parse(ANCHOR);
const openedAt = typeof performance !== "undefined" ? performance.now() : 0;

export function now(): string {
  const elapsed = typeof performance !== "undefined" ? performance.now() - openedAt : 0;
  return new Date(anchorMs + Math.max(0, elapsed)).toISOString();
}

export const DAY = 86_400_000;
export const dayMs = (isoDate: string) => Date.parse(isoDate.slice(0, 10) + "T00:00:00Z");
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (isoDate: string, days: number) => isoDay(dayMs(isoDate) + days * DAY);
export const daysBetween = (from: string, to: string) => Math.round((dayMs(to) - dayMs(from)) / DAY);
