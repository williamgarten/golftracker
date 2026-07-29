import type { DateString } from "./types.js";

/** Parses a "YYYY-MM-DD" string into a UTC-anchored Date (no timezone drift). */
function parseDate(date: DateString): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date): DateString {
  return date.toISOString().slice(0, 10);
}

export function todayDateString(): DateString {
  return formatDate(new Date());
}

/** Returns the Monday..Sunday week (as date strings) containing the given date. */
export function weekBoundsFor(date: DateString): { weekStart: DateString; weekEnd: DateString } {
  const d = parseDate(date);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { weekStart: formatDate(monday), weekEnd: formatDate(sunday) };
}

export function shiftWeek(weekStart: DateString, deltaWeeks: number): DateString {
  const d = parseDate(weekStart);
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return formatDate(d);
}

export function formatWeekLabel(weekStart: DateString, weekEnd: DateString): string {
  const start = parseDate(weekStart);
  const end = parseDate(weekEnd);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${startLabel} – ${endLabel}`;
}
