import { describe, expect, it } from "vitest";
import { membershipStatus, paymentStatus } from "../../src/services/statusService.js";

const today = "2026-10-29";
const windows = [7, 3, 1];

function timeMembership({ start, expiry, state = "active" }) {
  return {
    state,
    startDate: new Date(`${start}T00:00:00.000Z`),
    expiryDate: expiry ? new Date(`${expiry}T00:00:00.000Z`) : null,
    sessionsTotal: 0,
    sessionsRemaining: 0,
    packageSnapshot: { type: "time" },
  };
}

function sessionMembership({ remaining, expiry = null }) {
  return {
    state: "active",
    startDate: new Date(`${today}T00:00:00.000Z`),
    expiryDate: expiry ? new Date(`${expiry}T00:00:00.000Z`) : null,
    sessionsTotal: 10,
    sessionsRemaining: remaining,
    packageSnapshot: { type: "session" },
  };
}

describe("membershipStatus", () => {
  it("is scheduled before the start date", () => {
    expect(membershipStatus(timeMembership({ start: "2026-11-01", expiry: "2026-12-01" }), { todayISO: today, reminderWindows: windows })).toBe("scheduled");
  });

  it("is active well before expiry", () => {
    expect(membershipStatus(timeMembership({ start: "2026-10-01", expiry: "2026-11-30" }), { todayISO: today, reminderWindows: windows })).toBe("active");
  });

  it("is expiring soon inside the widest window", () => {
    expect(membershipStatus(timeMembership({ start: "2026-10-01", expiry: "2026-11-03" }), { todayISO: today, reminderWindows: windows })).toBe("expiring_soon");
  });

  it("is expired after the expiry date", () => {
    expect(membershipStatus(timeMembership({ start: "2026-09-01", expiry: "2026-09-30" }), { todayISO: today, reminderWindows: windows })).toBe("expired");
  });

  it("is exhausted when a session pack hits zero", () => {
    expect(membershipStatus(sessionMembership({ remaining: 0 }), { todayISO: today, reminderWindows: windows })).toBe("exhausted");
  });

  it("keeps a session pack active while sessions remain", () => {
    expect(membershipStatus(sessionMembership({ remaining: 3 }), { todayISO: today, reminderWindows: windows })).toBe("active");
  });

  it("expires a session pack with a past expiry even with sessions left", () => {
    expect(membershipStatus(sessionMembership({ remaining: 3, expiry: "2026-10-01" }), { todayISO: today, reminderWindows: windows })).toBe("expired");
  });

  it("treats cancelled memberships as cancelled", () => {
    expect(membershipStatus(timeMembership({ start: "2026-10-01", expiry: "2026-11-30", state: "cancelled" }), { todayISO: today, reminderWindows: windows })).toBe("cancelled");
  });

  it("handles a missing membership", () => {
    expect(membershipStatus(null, { todayISO: today, reminderWindows: windows })).toBeNull();
  });
});

describe("paymentStatus", () => {
  it("is paid when nothing is owed", () => {
    expect(paymentStatus({ balanceCents: 0, paidCents: 100, startDate: new Date() }, today)).toBe("paid");
  });

  it("is overdue once the membership has started with a balance", () => {
    expect(paymentStatus({ balanceCents: 50, paidCents: 0, startDate: new Date("2026-10-01T00:00:00Z") }, today)).toBe("overdue");
  });

  it("is partial for a future membership with some payment", () => {
    expect(paymentStatus({ balanceCents: 50, paidCents: 10, startDate: new Date("2026-11-01T00:00:00Z") }, today)).toBe("partial");
  });

  it("is unpaid for a future membership with no payment", () => {
    expect(paymentStatus({ balanceCents: 50, paidCents: 0, startDate: new Date("2026-11-01T00:00:00Z") }, today)).toBe("unpaid");
  });
});
