import { PLANS } from "../data/packages.js";
import { daysFromToday } from "./dates.js";

export function planOf(key) {
  return PLANS[key] || PLANS.fightcamp;
}

/** "session" when the membership is spent by attendance, otherwise "time". */
export function memType(m) {
  return m && (m.sessionsTotal != null || planOf(m.plan).type === "session") ? "session" : "time";
}

export function paymentsFor(payments, mid) {
  return payments.filter((p) => p.membershipId === mid);
}

export function memPaid(m, payments) {
  return paymentsFor(payments, m.id).reduce((s, p) => s + p.amount, 0);
}

/** Balance = agreed total − recorded payments, never below zero. */
export function memBalance(m, payments) {
  return Math.max(0, m.price - memPaid(m, payments));
}

/** Membership status: Scheduled, Active, Expiring soon, Expired or Exhausted. */
export function memStatus(m) {
  if (!m) return "None";
  if (daysFromToday(m.start) > 0) return "Scheduled";
  if (memType(m) === "session" || m.sessionsTotal != null) {
    if ((m.sessionsLeft || 0) <= 0) return "Exhausted";
    if (m.end && daysFromToday(m.end) < 0) return "Expired";
    return "Active";
  }
  if (daysFromToday(m.end) < 0) return "Expired";
  if (daysFromToday(m.end) <= 7) return "Expiring soon";
  return "Active";
}

/** Payment status: Paid, Partial or Unpaid — tracked separately from membership status. */
export function payStatus(m, payments) {
  const paid = memPaid(m, payments);
  const bal = m.price - paid;
  if (bal <= 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

/** Overdue only exists when money is still owed on a membership that has started. */
export function isOverdue(m, payments) {
  const paid = memPaid(m, payments);
  return m.price - paid > 0 && daysFromToday(m.start) < 0;
}

/** Labels for the payment pills of a membership. */
export function paymentLabels(m, payments) {
  const labels = [payStatus(m, payments)];
  if (isOverdue(m, payments)) labels.push("Overdue");
  return labels;
}

export function sortedMemberships(c) {
  return c.memberships.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export function currentMembership(c) {
  if (!c || !c.memberships.length) return null;
  const started = sortedMemberships(c).filter((m) => daysFromToday(m.start) <= 0);
  if (started.length) return started[started.length - 1];
  return sortedMemberships(c)[0];
}

export function customerBalance(c, payments) {
  return c.memberships.reduce((s, m) => s + memBalance(m, payments), 0);
}

export function lastVisit(log, cid) {
  const list = (log[cid] || []).slice().sort();
  return list.length ? list[list.length - 1] : null;
}

export function visitsIn30(log, cid) {
  return (log[cid] || []).filter((d) => daysFromToday(d) >= -30 && daysFromToday(d) <= 0).length;
}

/** The membership with an open balance that a new payment should hit first. */
export function openMembershipFor(c, payments) {
  if (!c) return null;
  const open = sortedMemberships(c).filter((m) => memBalance(m, payments) > 0);
  return open.length ? open[0] : null;
}

export function countByStatus(customers) {
  const counts = { Scheduled: 0, Active: 0, "Expiring soon": 0, Expired: 0, Exhausted: 0 };
  customers.filter((c) => !c.archived).forEach((c) => {
    const s = memStatus(currentMembership(c));
    if (counts[s] != null) counts[s] += 1;
  });
  return counts;
}