const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DATE_COUNTING_RULES = ["start_day_is_day_one", "start_day_is_day_zero"];

export function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** "Today" in the gym's timezone, as YYYY-MM-DD. */
export function todayInTimeZone(timeZone, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/** Midnight UTC for a calendar day. Calendar dates are never shifted by offsets. */
export function parseISODate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value !== "string" || !isValidDateString(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date -> YYYY-MM-DD using UTC parts (dates are stored at UTC midnight). */
export function toISODate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso, days) {
  const date = parseISODate(iso);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

function addMonthsISO(iso, months) {
  const date = parseISODate(iso);
  if (!date) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Whole days from a to b (b - a). */
export function daysBetweenISO(a, b) {
  const from = parseISODate(a);
  const to = parseISODate(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Last valid day of a membership.
 * - start_day_is_day_zero: a 30-day membership starting Jan 1 runs to Jan 31.
 * - start_day_is_day_one: day one is the start date, so it runs to Jan 30.
 */
export function computeExpiryISO(startISO, validityValue, validityUnit, rule = "start_day_is_day_zero") {
  const value = Number(validityValue);
  if (!startISO || !Number.isFinite(value) || value < 1) return null;
  let expiry;
  switch (validityUnit) {
    case "days":
      expiry = addDaysISO(startISO, value);
      break;
    case "weeks":
      expiry = addDaysISO(startISO, value * 7);
      break;
    case "months":
      expiry = addMonthsISO(startISO, value);
      break;
    case "years":
      expiry = addMonthsISO(startISO, value * 12);
      break;
    default:
      return null;
  }
  if (rule === "start_day_is_day_one") expiry = addDaysISO(expiry, -1);
  return expiry;
}

/** Monday of the week containing the given date. */
export function startOfWeekISO(iso) {
  const date = parseISODate(iso);
  if (!date) return null;
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysISO(iso, diff);
}

export function enumerateDays(fromISO, toISO) {
  const days = [];
  const total = daysBetweenISO(fromISO, toISO);
  for (let i = 0; i <= total; i += 1) days.push(addDaysISO(fromISO, i));
  return days;
}

export function monthStartISO(todayISO) {
  return `${todayISO.slice(0, 7)}-01`;
}

export function daysFrom(todayISO, targetISO) {
  return daysBetweenISO(todayISO, targetISO);
}
