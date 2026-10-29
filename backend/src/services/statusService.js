import { daysFrom, toISODate } from "../utils/dates.js";

/**
 * Membership status, derived on read:
 * scheduled | active | expiring_soon | expired | exhausted | cancelled
 *
 * Time-based memberships become expiring_soon inside the widest reminder
 * window. Session-based memberships are exhausted at zero sessions.
 */
export function membershipStatus(membership, { todayISO, reminderWindows = [7, 3, 1] } = {}) {
  if (!membership) return null;
  if (membership.state === "cancelled") return "cancelled";

  const startISO = toISODate(membership.startDate);
  if (startISO && startISO > todayISO) return "scheduled";

  const type = membership.packageSnapshot?.type ?? membership.type;
  const isSession = type === "session" || type === "both" || membership.sessionsTotal > 0;
  if (isSession && membership.sessionsTotal > 0 && membership.sessionsRemaining <= 0) {
    // A pack with zero sessions left is exhausted even if it still has time.
    if (type === "session") return "exhausted";
  }

  if (membership.expiryDate) {
    const expiryISO = toISODate(membership.expiryDate);
    if (expiryISO < todayISO) return "expired";
    const daysLeft = daysFrom(todayISO, expiryISO);
    const widest = Math.max(...reminderWindows, 0);
    if (daysLeft <= widest) return "expiring_soon";
  }

  if (isSession && membership.sessionsTotal > 0 && membership.sessionsRemaining <= 0) return "exhausted";
  return "active";
}

/**
 * Payment status, independent from membership status:
 * paid | overdue | partial | unpaid.
 * A membership is overdue when its balance is open and its start date has passed.
 */
export function paymentStatus({ balanceCents, paidCents = 0, startDate }, todayISO) {
  if (balanceCents <= 0) return "paid";
  const startISO = toISODate(startDate);
  if ((startISO && startISO < todayISO) || startISO === todayISO) return "overdue";
  if (paidCents > 0) return "partial";
  return "unpaid";
}

export function membershipType(snapshot) {
  if (!snapshot) return "time";
  if (snapshot.type === "both") return "both";
  return snapshot.type === "session" ? "session" : "time";
}

export function isTimeLimited(snapshot) {
  return snapshot?.type === "time" || snapshot?.type === "both";
}

export function isSessionBased(snapshot) {
  return snapshot?.type === "session" || snapshot?.type === "both";
}
