import { describe, expect, it } from "vitest";
import { centsToString, fromCents, sumCents, toCents } from "../../src/utils/money.js";
import { escapeCsvCell, toCsv } from "../../src/utils/csv.js";

describe("money", () => {
  it("converts decimals to integer cents without float drift", () => {
    expect(toCents(180)).toBe(18000);
    expect(toCents(0.1)).toBe(10);
    expect(toCents("1,234.56")).toBe(123456);
    expect(toCents("$99.99")).toBe(9999);
    expect(toCents(19.995)).toBe(2000);
  });

  it("rejects non-numeric input", () => {
    expect(Number.isNaN(toCents("abc"))).toBe(true);
    expect(Number.isNaN(toCents(""))).toBe(true);
    expect(Number.isNaN(toCents(undefined))).toBe(true);
  });

  it("round-trips cents to decimal", () => {
    expect(fromCents(18000)).toBe(180);
    expect(fromCents(123456)).toBe(1234.56);
    expect(fromCents(0)).toBe(0);
    expect(centsToString(9999)).toBe("99.99");
    expect(sumCents([1, 2, 3])).toBe(6);
  });
});

describe("csv", () => {
  it("escapes quotes and wraps cells", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvCell(null)).toBe('""');
  });

  it("prefixes formula cells so spreadsheets do not evaluate them", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("\"'=SUM(A1)\"");
    expect(escapeCsvCell("+1")).toBe("\"'+1\"");
    expect(escapeCsvCell("-1")).toBe("\"'-1\"");
    expect(escapeCsvCell("@cmd")).toBe("\"'@cmd\"");
  });

  it("joins rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["c"]])).toBe('"a","b"\r\n"c"');
  });
});
