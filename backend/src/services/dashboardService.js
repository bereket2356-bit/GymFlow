import { Customer } from "../models/Customer.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { PaymentAdjustment } from "../models/PaymentAdjustment.js";
import { Attendance } from "../models/Attendance.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { outstandingTotal } from "./balanceService.js";
import { membershipStatus } from "./statusService.js";
import { membershipsByCustomer, pickCurrentMembership } from "./membershipService.js";
import { listReminders } from "./reminderService.js";
import { serializeSession } from "./serialize.js";
import {
  addDaysISO,
  daysBetweenISO,
  parseISODate,
  startOfWeekISO,
  toISODate,
  todayInTimeZone,
} from "../utils/dates.js";
import { fromCents } from "../utils/money.js";

const PERIODS = {
  month: "This month",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  quarter: "Last 90 days",
};

export function dashboardRange(period, today) {
  const key = PERIODS[period] ? period : "month";
  let from;
  if (key === "7d") from = addDaysISO(today, -6);
  else if (key === "30d") from = addDaysISO(today, -29);
  else if (key === "quarter") from = addDaysISO(today, -89);
  else from = `${today.slice(0, 7)}-01`;
  return { key, label: PERIODS[key], from, to: today };
}

async function cashInRange(from, to) {
  const start = parseISODate(from);
  const end = parseISODate(to);
  end.setUTCDate(end.getUTCDate() + 1);
  const [payments, adjustments] = await Promise.all([
    Payment.aggregate([
      { $match: { receivedOn: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amountCents" } } },
    ]),
    PaymentAdjustment.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amountCents" } } },
    ]),
  ]);
  return (payments[0]?.total ?? 0) + (adjustments[0]?.total ?? 0);
}

export async function dashboardSummary({ period, settings }) {
  const today = todayInTimeZone(settings.timezone);
  const range = dashboardRange(period, today);

  const [total, live, archived, memberships, collectedCents, outstandingCents, reminders] = await Promise.all([
    Customer.countDocuments({}),
    Customer.countDocuments({ status: "active" }),
    Customer.countDocuments({ status: "archived" }),
    Membership.find({ customer: { $ne: null } }).select(
      "customer startDate expiryDate sessionsTotal sessionsRemaining state packageSnapshot",
    ),
    cashInRange(range.from, range.to),
    outstandingTotal(),
    listReminders(settings),
  ]);

  const activeCustomers = await Customer.find({ status: "active" }).select("_id");
  const byCustomer = new Map();
  for (const membership of memberships) {
    const key = String(membership.customer);
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(membership);
  }

  const counts = { scheduled: 0, active: 0, expiringSoon: 0, expired: 0, exhausted: 0, cancelled: 0 };
  for (const customer of activeCustomers) {
    const list = byCustomer.get(String(customer._id)) ?? [];
    const current = pickCurrentMembership(list, today);
    if (!current) continue;
    const status = membershipStatus(current, {
      todayISO: today,
      reminderWindows: settings.reminderWindows,
    });
    if (status === "expiring_soon") counts.expiringSoon += 1;
    else if (status in counts) counts[status] += 1;
  }

  return {
    range: { ...range, period: range.key },
    currency: settings.currency,
    gymName: settings.gymName,
    timezone: settings.timezone,
    customers: { total, live, archived },
    memberships: {
      active: counts.active,
      expiringSoon: counts.expiringSoon,
      expired: counts.expired,
      exhausted: counts.exhausted,
      scheduled: counts.scheduled,
      cancelled: counts.cancelled,
    },
    cashReceived: fromCents(collectedCents),
    outstanding: fromCents(outstandingCents),
    reminders: {
      total: reminders.counts.total,
      open: reminders.counts.open,
      reviewed: reminders.counts.reviewed,
    },
  };
}

/** Today's sessions in the gym timezone, with attendance counts. */
export async function sessionsToday(settings) {
  const today = todayInTimeZone(settings.timezone);
  const start = parseISODate(addDaysISO(today, -1));
  const end = parseISODate(addDaysISO(today, 2));
  const sessions = await TrainingSession.find({ startsAt: { $gte: start, $lt: end } }).sort({ startsAt: 1 });

  const todays = sessions.filter(
    (session) => toISODate(session.startsAt) === today ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: settings.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(session.startsAt) === today,
  );
  const ids = todays.map((session) => session._id);
  const counts = await Attendance.aggregate([
    { $match: { session: { $in: ids } } },
    { $group: { _id: "$session", booked: { $sum: 1 } } },
  ]);
  const bookedMap = new Map(counts.map((row) => [String(row._id), row.booked]));

  return {
    date: today,
    sessions: todays.map((session) =>
      serializeSession(session, { bookedCount: bookedMap.get(String(session._id)) ?? 0 }),
    ),
  };
}

export { PERIODS, daysBetweenISO, startOfWeekISO };
