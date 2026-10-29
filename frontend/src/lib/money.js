let currentCurrencySymbol = "$";

export function setCurrencySymbol(symbol) {
  if (symbol) currentCurrencySymbol = symbol;
}

export function getCurrencySymbol() {
  return currentCurrencySymbol;
}

/** Currency formatting with dynamic gym currency support. */
export function money(n, symbol) {
  const sym = symbol || currentCurrencySymbol;
  const v = Math.abs(Number(n) || 0);
  const s = Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = sym === "$" ? "$" : `${sym} `;
  return (n < 0 ? "−" : "") + prefix + s;
}

export function num(n) {
  return Number(n).toLocaleString("en-US");
}

/** Parses a user-typed amount. Returns NaN when it is not a number. */
export function parseAmount(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return NaN;
  return Number(raw.replace(/[$\s,]/g, ""));
}

/** Formats an amount to two decimals when the field loses focus. */
export function formatOnBlur(value) {
  const n = parseAmount(value);
  if (!isFinite(n)) return String(value == null ? "" : value).trim();
  return n.toFixed(2);
}

/** Rounds to cents so ledger maths never drifts. */
export function toCents(n) {
  return Math.round(Number(n) * 100) / 100;
}