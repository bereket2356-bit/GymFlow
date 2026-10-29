const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * Escape a CSV cell. Cells that begin with a formula character are prefixed
 * with a single quote so spreadsheets never evaluate user-supplied text.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (text.length > 0 && FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
