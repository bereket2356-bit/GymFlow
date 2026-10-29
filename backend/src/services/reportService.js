import { Customer } from "../models/Customer.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { PaymentAdjustment } from "../models/PaymentAdjustment.js";
import { Attendance } from "../models/Attendance.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { customerBalances, membershipBalances, outstandingTotal } from "./balanceService.js";
import { membershipStatus, paymentStatus } from "./statusService.js";
import { pickCurrentMembership } from "./membershipService.js";
import { serializeCustomerSummary } from "./serialize.js";
import { parseISODate, addDaysISO, startOfWeekISO, daysBetweenISO, toISODate, todayInTimeZone } from "../utils/dates.js";
import { fromCents } from "../utils/money.js";
import { toCsv } from "../utils/csv.js";
import { badRequest } from "../utils/errors.js";

function resolveRange({ from, to }, settings) {
  const today = todayInTimeZone(settings.timezone);
  const end = to ?? today;
  const start = from ?? addDaysISO(end, -29);
  if (start > end) throw badRequest("The start date must be on or before the end date.");
  return { from: start, to: end };
}

function rangeBounds(from, to) {
  const start = parseISODate(from);
  const end = parseISODate(to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** The three money figures are returned as separate fields, never combined. */
export async function reportSummary({ from, to, settings }) {
  const range = resolveRange({ from, to }, settings);
  const { start, end } = rangeBounds(range.from, range.to);

  const [paymentRows, adjustmentRows, membershipRows, newCustomers, outstanding, sessions] = await Promise.all([
    Payment.aggregate([
      { $match: { receivedOn: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ]),
    PaymentAdjustment.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ]),
    Membership.aggregate([
      { $match: { startDate: { $gte: start, $lt: end }, state: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$agreedPriceCents" }, count: { $sum: 1 } } },
    ]),
    Customer.countDocuments({ registeredAt: { $gte: start, $lt: end } }),
    outstandingTotal(),
    TrainingSession.find({ startsAt: { $gte: start, $lt: end } }).select("_id"),
  ]);

  const sessionIds = sessions.map((session) => session._id);
  const attendanceRows = await Attendance.aggregate([
    { $match: { session: { $in: sessionIds } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const attendance = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
  for (const row of attendanceRows) {
    attendance[row._id] = row.count;
    attendance.total += row.count;
  }

  return {
    range,
    currency: settings.currency,
    cashReceived: fromCents((paymentRows[0]?.total ?? 0) + (adjustmentRows[0]?.total ?? 0)),
    paymentsRecorded: paymentRows[0]?.count ?? 0,
    adjustmentsRecorded: adjustmentRows[0]?.count ?? 0,
    membershipValue: fromCents(membershipRows[0]?.total ?? 0),
    membershipsStarted: membershipRows[0]?.count ?? 0,
    outstanding: fromCents(outstanding),
    newCustomers,
    attendance,
  };
}

/** Cash received per week, signed adjustments included at their record date. */
export async function paymentsByWeek({ weeks = 8, to, settings }) {
  const count = Math.min(Math.max(Number(weeks) || 8, 1), 26);
  const end = to ?? todayInTimeZone(settings.timezone);
  const currentWeekStart = startOfWeekISO(end);
  const firstWeekStart = addDaysISO(currentWeekStart, -(count - 1) * 7);
  const { start, end: endExclusive } = rangeBounds(firstWeekStart, end);

  const [payments, adjustments] = await Promise.all([
    Payment.find({ receivedOn: { $gte: start, $lt: endExclusive } }).select("amountCents receivedOn"),
    PaymentAdjustment.find({ createdAt: { $gte: start, $lt: endExclusive } }).select("amountCents createdAt"),
  ]);

  const buckets = [];
  for (let i = 0; i < count; i += 1) {
    const weekStart = addDaysISO(firstWeekStart, i * 7);
    buckets.push({
      from: weekStart,
      to: addDaysISO(weekStart, 6),
      totalCents: 0,
    });
  }
  for (const payment of payments) {
    const date = toISODate(payment.receivedOn);
    const index = Math.floor(daysBetweenISO(firstWeekStart, date) / 7);
    if (buckets[index]) buckets[index].totalCents += payment.amountCents;
  }
  for (const adjustment of adjustments) {
    const date = toISODate(adjustment.createdAt);
    const index = Math.floor(daysBetweenISO(firstWeekStart, date) / 7);
    if (buckets[index]) buckets[index].totalCents += adjustment.amountCents;
  }

  return {
    from: firstWeekStart,
    to: end,
    total: fromCents(buckets.reduce((sum, bucket) => sum + bucket.totalCents, 0)),
    weeks: buckets.map((bucket) => ({
      from: bucket.from,
      to: bucket.to,
      total: fromCents(bucket.totalCents),
    })),
  };
}

/** 7 weekdays × N weeks of present/late attendance. */
export async function attendanceHeatmap({ weeks = 4, to, settings }) {
  const count = Math.min(Math.max(Number(weeks) || 4, 1), 12);
  const end = to ?? todayInTimeZone(settings.timezone);
  const currentWeekStart = startOfWeekISO(end);
  const firstWeekStart = addDaysISO(currentWeekStart, -(count - 1) * 7);
  const lastWeekEnd = addDaysISO(currentWeekStart, 6);

  const sessions = await TrainingSession.find({
    startsAt: { $gte: parseISODate(firstWeekStart), $lt: parseISODate(addDaysISO(lastWeekEnd, 1)) },
    status: { $ne: "cancelled" },
  }).select("_id startsAt");
  const dateBySession = new Map(
    sessions.map((session) => [String(session._id), toISODate(session.startsAt)]),
  );

  const records = await Attendance.find({
    session: { $in: sessions.map((session) => session._id) },
    status: { $in: ["present", "late"] },
  }).select("session");

  const counts = new Map();
  for (const record of records) {
    const date = dateBySession.get(String(record.session));
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const cells = [];
  for (let week = 0; week < count; week += 1) {
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const date = addDaysISO(firstWeekStart, week * 7 + (weekday - 1));
      cells.push({ week, weekday, date, count: counts.get(date) ?? 0 });
    }
  }

  return {
    from: firstWeekStart,
    to: lastWeekEnd,
    weeks: count,
    maxCount: cells.reduce((max, cell) => Math.max(max, cell.count), 0),
    cells,
  };
}

export async function outstandingReport({ settings }) {
  const today = todayInTimeZone(settings.timezone);
  const customers = await Customer.find({ status: "active" });
  const balances = await customerBalances(customers.map((customer) => customer._id));
  const memberships = await Membership.find({ customer: { $in: customers.map((c) => c._id) } }).sort({ startDate: 1 });
  const byCustomer = new Map();
  for (const membership of memberships) {
    const key = String(membership.customer);
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(membership);
  }

  const rows = [];
  let totalCents = 0;
  for (const customer of customers) {
    const balance = balances.get(String(customer._id));
    if (!balance || balance.balanceCents <= 0) continue;
    const current = pickCurrentMembership(byCustomer.get(String(customer._id)) ?? [], today);
    const membershipBalancesMap = current ? await membershipBalances([current._id]) : new Map();
    const currentBalance = current ? membershipBalancesMap.get(String(current._id)) : null;
    totalCents += balance.balanceCents;
    rows.push({
      customer: serializeCustomerSummary(customer),
      phone: customer.phone,
      balance: fromCents(balance.balanceCents),
      membership: current
        ? {
            id: String(current._id),
            code: current.code,
            name: current.packageSnapshot.name,
            status: membershipStatus(current, {
              todayISO: today,
              reminderWindows: settings.reminderWindows,
            }),
          }
        : null,
      paymentStatus: current
        ? paymentStatus(
            {
              balanceCents: currentBalance?.balanceCents ?? balance.balanceCents,
              paidCents: currentBalance?.paidCents ?? balance.paidCents,
              startDate: current.startDate,
            },
            today,
          )
        : "unpaid",
    });
  }

  rows.sort((a, b) => b.balance - a.balance);
  return { today, total: fromCents(totalCents), rows };
}

export async function exportCsv({ type, from, to, settings }) {
  const currency = settings.currency;
  let rows;
  let filename;

  if (type === "payments") {
    const range = resolveRange({ from, to }, settings);
    const { start, end } = rangeBounds(range.from, range.to);
    const payments = await Payment.find({ receivedOn: { $gte: start, $lt: end } })
      .sort({ receivedOn: 1 })
      .populate("customer")
      .populate("membership");
    rows = [["Date", "Code", "Customer", "Customer ID", `Amount (${currency})`, "Method", "Reference"]];
    for (const payment of payments) {
      rows.push([
        toISODate(payment.receivedOn),
        payment.code,
        payment.customer?.name ?? "",
        payment.customer?.customerId ?? "",
        fromCents(payment.amountCents).toFixed(2),
        payment.method,
        payment.reference ?? "",
      ]);
    }
    filename = `payments-${range.from}-to-${range.to}.csv`;
  } else if (type === "outstanding") {
    const report = await outstandingReport({ settings });
    rows = [["Customer ID", "Name", "Phone", "Package", "Membership status", "Balance", "Payment status"]];
    for (const row of report.rows) {
      rows.push([
        row.customer.customerId,
        row.customer.name,
        row.phone,
        row.membership?.name ?? "",
        row.membership?.status ?? "",
        row.balance.toFixed(2),
        row.paymentStatus,
      ]);
    }
    filename = `outstanding-${report.today}.csv`;
  } else if (type === "attendance") {
    const range = resolveRange({ from, to }, settings);
    const { start, end } = rangeBounds(range.from, range.to);
    const sessions = await TrainingSession.find({ startsAt: { $gte: start, $lt: end } }).select("_id title startsAt");
    const dateBySession = new Map(sessions.map((s) => [String(s._id), s]));
    const records = await Attendance.find({ session: { $in: sessions.map((s) => s._id) } })
      .populate("customer")
      .sort({ markedAt: 1 });
    rows = [["Date", "Session", "Customer ID", "Customer", "Status", "Deducted"]];
    for (const record of records) {
      const session = dateBySession.get(String(record.session));
      rows.push([
        session ? toISODate(session.startsAt) : "",
        session?.title ?? "",
        record.customer?.customerId ?? "",
        record.customer?.name ?? "",
        record.status,
        record.deducted ? "yes" : "no",
      ]);
    }
    filename = `attendance-${range.from}-to-${range.to}.csv`;
  } else if (type === "summary") {
    const report = await reportSummary({ from, to, settings });
    rows = [
      ["Metric", "Value"],
      ["From", report.range.from],
      ["To", report.range.to],
      [`Cash received (${currency})`, report.cashReceived.toFixed(2)],
      [`Membership value sold (${currency})`, report.membershipValue.toFixed(2)],
      [`Outstanding balance (${currency})`, report.outstanding.toFixed(2)],
      ["New customers", report.newCustomers],
      ["Attendance — present", report.attendance.present],
      ["Attendance — late", report.attendance.late],
      ["Attendance — absent", report.attendance.absent],
      ["Attendance — excused", report.attendance.excused],
    ];
    filename = `summary-${report.range.from}-to-${report.range.to}.csv`;
  } else {
    throw badRequest("type must be one of: summary, payments, outstanding, attendance.");
  }

  return { filename, csv: toCsv(rows) };
}

export { resolveRange };
