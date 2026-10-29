export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export const TODAY = todayISO();

export function parseISO(iso) {
  const p = String(iso).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

export function addDaysISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function shiftISO(days, from) {
  return addDaysISO(from || TODAY, days);
}

export function daysFromToday(iso) {
  return Math.round((parseISO(iso) - parseISO(TODAY)) / 86400000);
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

export function fmtShort(iso) {
  const d = parseISO(iso);
  return d.getDate() + " " + MONTHS[d.getMonth()];
}

export function fmtLong(iso) {
  const d = parseISO(iso);
  return WEEKDAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS_LONG[d.getMonth()] + " " + d.getFullYear();
}

export function monthStartISO() {
  return TODAY.slice(0, 8) + "01";
}

export function plural(n, one, many) {
  return n === 1 ? one : many || one + "s";
}

export function daysLabel(n) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 0) return "in " + n + " days";
  return Math.abs(n) + " days ago";
}

export function clockLabel() {
  const d = new Date();
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

export function timeToMin(t) {
  const p = t.split(":").map(Number);
  return p[0] * 60 + p[1];
}