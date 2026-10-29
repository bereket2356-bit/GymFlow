import { GYM } from "./config.js";
import { money } from "../lib/money.js";
import { daysFromToday, daysLabel, plural } from "../lib/dates.js";
import { currentMembership, memType, memBalance, memStatus, lastVisit } from "../lib/status.js";

/**
 * Reminder rules: expiry windows, zero sessions, overdue balances and inactivity.
 * Reminders are dashboard-only internal notes — no message is sent to the customer.
 */
export const REMINDER_RULES = {
  order: ["expired", "balance", "sessions", "expiry", "inactive"],
  label: {
    expired: "Expired",
    balance: "Overdue",
    sessions: "Zero sessions",
    expiry: "expiry window",
    inactive: "inactive",
  },
};

export function buildReminders({ customers, payments, attendanceLog, rules = GYM }) {
  const out = [];
  customers.filter((c) => !c.archived).forEach((c) => {
    const m = currentMembership(c);
    if (!m) return;
    const status = memStatus(m);
    const push = (type, rule, text, tone) =>
      out.push({ key: type + ":" + c.id, type, rule, text, customer: c, tone: tone || "neutral" });

    if (memType(m) === "time") {
      const d = daysFromToday(m.end);
      if (d < 0) push("expired", "Expired", "Membership expired " + Math.abs(d) + " " + plural(Math.abs(d), "day") + " ago", "danger");
      else if (d <= rules.warn1) push("expiry", rules.warn1 + "-day window", "Membership expires " + daysLabel(d), "warning");
      else if (d <= rules.warn3) push("expiry", rules.warn3 + "-day window", "Membership expires " + daysLabel(d), "warning");
      else if (d <= rules.warn7) push("expiry", rules.warn7 + "-day window", "Membership expires " + daysLabel(d), "warning");
    } else if ((m.sessionsLeft || 0) <= 0) {
      push("sessions", "Zero sessions", "Session pack exhausted — 0 of " + m.sessionsTotal + " left", "info");
    }

    const bal = memBalance(m, payments);
    if (bal > 0 && daysFromToday(m.start) < 0 && status !== "Scheduled") {
      push("balance", "Overdue", "Balance of " + money(bal) + " outstanding", "danger");
    }

    const last = lastVisit(attendanceLog, c.id);
    if (last && daysFromToday(last) < 0 && Math.abs(daysFromToday(last)) >= rules.inactive) {
      push("inactive", "Inactive " + rules.inactive + " days", "No visit in " + Math.abs(daysFromToday(last)) + " days", "neutral");
    }
  });

  return out.sort((a, b) => {
    const oa = REMINDER_RULES.order.indexOf(a.type);
    const ob = REMINDER_RULES.order.indexOf(b.type);
    const da = oa < 0 ? 9 : oa;
    const db = ob < 0 ? 9 : ob;
    if (da !== db) return da - db;
    return a.customer.name.localeCompare(b.customer.name);
  });
}