/**
 * Week utility helpers for Weekly Competitions.
 *
 * Week definition: ISO 8601 weeks, Monday 00:00 UTC → next Monday 00:00 UTC.
 * weekId format: "2026-W26" (ISO week numbering, year-week)
 */

/**
 * Returns the Monday 00:00 UTC → next Monday 00:00 UTC window for the current moment.
 */
export function getCurrentWeekWindow(): { start: Date; end: Date } {
  const now = new Date();
  return getWeekWindow(now);
}

/**
 * Returns the Monday 00:00 UTC → next Monday 00:00 UTC window for a given date.
 */
export function getWeekWindow(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Monday = 1, Sunday = 7 (ISO). Adjust to get previous Monday.
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(d);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/**
 * Returns the ISO week ID string (e.g., "2026-W26") for a given date.
 */
export function getWeekId(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum =
    d.getUTCDay() === 0
      ? 7 // Sunday → 7 in ISO
      : d.getUTCDay();

  // Set to nearest Thursday (ISO week definition)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Format a week window as a human-readable string.
 * e.g., "Mon 15 Jun → Sun 21 Jun 2026"
 */
export function formatWeekRange(start: Date, end: Date): string {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const sDay = start.getUTCDate();
  const sMonth = monthNames[start.getUTCMonth()];
  const eDay = new Date(end.getTime() - 86400000).getUTCDate(); // Sunday
  const eMonth = monthNames[new Date(end.getTime() - 86400000).getUTCMonth()];
  const year = start.getUTCFullYear();

  return `Mon ${sDay} ${sMonth} → Sun ${eDay} ${eMonth} ${year}`;
}

/**
 * Parse a weekId like "2026-W26" into a { start, end } window.
 * Returns null for invalid format.
 */
export function parseWeekId(
  weekId: string,
): { start: Date; end: Date } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  // ISO weeks: January 4th is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();

  // Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  // Monday of the target week
  const start = new Date(week1Monday);
  start.setUTCDate(start.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
}

/**
 * Valid week categories for the weekly leaderboard.
 */
export type WeeklyCategory =
  | "best_total_time"
  | "best_first_lap"
  | "best_lap"
  | "race_cash_earned"
  | "missions_completed"
  | "races_finished";

export const VALID_WEEKLY_CATEGORIES: Set<string> = new Set([
  "best_total_time",
  "best_first_lap",
  "best_lap",
  "race_cash_earned",
  "missions_completed",
  "races_finished",
]);

/** Whether lower-is-better (time) or higher-is-better (volume). */
export const TIME_CATEGORIES: Set<WeeklyCategory> = new Set([
  "best_total_time",
  "best_first_lap",
  "best_lap",
]);

export const VOLUME_CATEGORIES: Set<WeeklyCategory> = new Set([
  "race_cash_earned",
  "missions_completed",
  "races_finished",
]);

export function parseWeeklyCategory(raw: string | null): WeeklyCategory {
  if (raw && VALID_WEEKLY_CATEGORIES.has(raw)) return raw as WeeklyCategory;
  return "best_total_time";
}
