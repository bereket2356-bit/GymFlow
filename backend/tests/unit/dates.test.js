import { describe, expect, it } from "vitest";
import {
  computeExpiryISO,
  addDaysISO,
  daysBetweenISO,
  isValidDateString,
  startOfWeekISO,
  todayInTimeZone,
  toISODate,
} from "../../src/utils/dates.js";

describe("dates", () => {
  it("validates calendar dates strictly", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-2-3")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });

  it("adds and subtracts whole days", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetweenISO("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("computes expiry for each validity unit", () => {
    expect(computeExpiryISO("2026-01-01", 7, "days")).toBe("2026-01-08");
    expect(computeExpiryISO("2026-01-01", 2, "weeks")).toBe("2026-01-15");
    expect(computeExpiryISO("2026-01-01", 1, "months")).toBe("2026-02-01");
    expect(computeExpiryISO("2026-01-01", 1, "years")).toBe("2027-01-01");
  });

  it("clamps month arithmetic to the last day", () => {
    expect(computeExpiryISO("2026-01-31", 1, "months")).toBe("2026-02-28");
  });

  it("honours the date-counting rule", () => {
    expect(computeExpiryISO("2026-01-01", 30, "days", "start_day_is_day_zero")).toBe("2026-01-31");
    expect(computeExpiryISO("2026-01-01", 30, "days", "start_day_is_day_one")).toBe("2026-01-30");
  });

  it("finds the Monday of a week", () => {
    expect(startOfWeekISO("2026-10-29")).toBe("2026-10-26");
    expect(startOfWeekISO("2026-10-26")).toBe("2026-10-26");
    expect(startOfWeekISO("2026-11-01")).toBe("2026-10-26");
  });

  it("derives today in a timezone", () => {
    const instant = new Date("2026-01-01T22:30:00.000Z");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-01-01");
    expect(todayInTimeZone("Africa/Addis_Ababa", instant)).toBe("2026-01-02");
    expect(toISODate(instant)).toBe("2026-01-01");
  });
});
