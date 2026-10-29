/** Convert a decimal amount (number or numeric string) into integer cents. */
export function toCents(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const n = typeof value === "string" ? Number(value.replace(/[$\s,]/g, "")) : Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

/** Convert integer cents into a 2-decimal number for API responses. */
export function fromCents(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

/** Format cents as a plain decimal string with two places. */
export function centsToString(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2);
}

export function sumCents(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}
