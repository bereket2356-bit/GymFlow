/**
 * Seed the database with the same sample data the frontend prototype shows.
 *
 * Usage:
 *   npm run seed             idempotent upsert
 *   npm run seed -- --reset  wipe and reseed
 *
 * In production, --confirm is required in addition to --reset.
 */
import mongoose from "mongoose";
import env from "../config/env.js";
import connectDB from "../config/db.js";
import { Owner } from "../models/Owner.js";
import { Customer } from "../models/Customer.js";
import { Package } from "../models/Package.js";
import { PackageVersion } from "../models/PackageVersion.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { Attendance } from "../models/Attendance.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { Settings } from "../models/Settings.js";
import { Counter } from "../models/Counter.js";
import { hashPassword } from "../services/authService.js";
import { defaultSettings } from "../services/settingsService.js";
import { membershipStatus } from "../services/statusService.js";
import { addDaysISO, parseISODate, toISODate, todayInTimeZone } from "../utils/dates.js";

const today = todayInTimeZone(env.timezone);

const PACKAGES = [
  {
    code: "PKG-MONTHLY",
    name: "Monthly Training",
    description: "Open gym and coached sessions, billed one month at a time.",
    type: "time",
    validityValue: 1,
    validityUnit: "months",
    sessionAllowance: 1,
    priceCents: 12000,
    status: "active",
    version: 1,
  },
  {
    code: "PKG-TEN",
    name: "10-Session Pack",
    description: "Ten coached sessions, used at the member’s own pace.",
    type: "session",
    validityValue: 2,
    validityUnit: "months",
    sessionAllowance: 10,
    priceCents: 9000,
    status: "active",
    version: 1,
  },
  {
    code: "PKG-QUARTER",
    name: "3-Month Plan",
    description: "The monthly programme paid three months at a time.",
    type: "time",
    validityValue: 3,
    validityUnit: "months",
    sessionAllowance: 1,
    priceCents: 30000,
    status: "active",
    version: 1,
  },
  {
    code: "PKG-FIVE",
    name: "5-Session Drop-in",
    description: "A short pack for visitors and returning members.",
    type: "session",
    validityValue: 2,
    validityUnit: "months",
    sessionAllowance: 5,
    priceCents: 5000,
    status: "active",
    version: 1,
  },
  {
    code: "PKG-TRIAL",
    name: "Trial Week",
    description: "Seven days for a first-time visitor. Retired from new assignments.",
    type: "time",
    validityValue: 7,
    validityUnit: "days",
    sessionAllowance: 1,
    priceCents: 2500,
    status: "inactive",
    version: 1,
  },
];

/** Membership plans as the frontend displays them, with their catalogue package. */
const PLANS = {
  fightcamp: {
    name: "Fight Camp · 3×/week",
    type: "time",
    priceCents: 18000,
    validityValue: 30,
    validityUnit: "days",
    sessionAllowance: 1,
    packageCode: "PKG-MONTHLY",
  },
  unlimited: {
    name: "Unlimited Monthly",
    type: "time",
    priceCents: 22000,
    validityValue: 30,
    validityUnit: "days",
    sessionAllowance: 1,
    packageCode: "PKG-QUARTER",
  },
  youth: {
    name: "Youth Fundamentals",
    type: "time",
    priceCents: 12000,
    validityValue: 30,
    validityUnit: "days",
    sessionAllowance: 1,
    packageCode: "PKG-MONTHLY",
  },
  twelve: {
    name: "12-Session Pack",
    type: "session",
    priceCents: 15000,
    validityValue: 60,
    validityUnit: "days",
    sessionAllowance: 12,
    packageCode: "PKG-TEN",
  },
  eight: {
    name: "8-Session Pack",
    type: "session",
    priceCents: 11000,
    validityValue: 60,
    validityUnit: "days",
    sessionAllowance: 8,
    packageCode: "PKG-FIVE",
  },
};

const CUSTOMERS = [
  {
    customerId: "CUS-1042",
    name: "Amara Bekele",
    phone: "+251 911 204 118",
    joined: -190,
    archived: false,
    notes:
      "Training for a first amateur bout in March. Prefers the 06:00 sessions; right hand still healing, no heavy bag work on Mondays.",
    memberships: [
      { code: "MEM-3298", plan: "fightcamp", start: -87, end: -57, price: 180 },
      { code: "MEM-3312", plan: "fightcamp", start: -27, end: 3, price: 180 },
    ],
  },
  {
    customerId: "CUS-1043",
    name: "Dawit Mekonnen",
    phone: "+251 912 887 064",
    joined: -120,
    archived: false,
    notes: "Books the 12-session pack every other month. Ask about the Sunday sparring block.",
    memberships: [
      { code: "MEM-3284", plan: "twelve", start: -100, end: -40, price: 150, sessionsTotal: 12, sessionsLeft: 0 },
      { code: "MEM-3301", plan: "twelve", start: -40, end: 20, price: 150, sessionsTotal: 12, sessionsLeft: 0 },
    ],
  },
  {
    customerId: "CUS-1044",
    name: "Selam Tesfaye",
    phone: "+251 913 550 902",
    joined: -95,
    archived: false,
    notes: "Renewal has lapsed twice. Call before the next billing date, not after.",
    memberships: [
      { code: "MEM-3288", plan: "unlimited", start: -64, end: -34, price: 220 },
      { code: "MEM-3302", plan: "unlimited", start: -34, end: -4, price: 220 },
    ],
  },
  {
    customerId: "CUS-1045",
    name: "Yonas Girma",
    phone: "+251 911 772 310",
    joined: -60,
    archived: false,
    notes: "Pays by bank transfer on the 20th. Also rents a locker (cash, not in the ledger).",
    memberships: [
      { code: "MEM-3285", plan: "unlimited", start: -38, end: -8, price: 220 },
      { code: "MEM-3303", plan: "unlimited", start: -8, end: 22, price: 220 },
    ],
  },
  {
    customerId: "CUS-1046",
    name: "Hana Wolde",
    phone: "+251 914 338 271",
    joined: -75,
    archived: false,
    notes: "Works nights; usually trains at 07:00. Session pack was bought as a trial.",
    memberships: [
      { code: "MEM-3286", plan: "eight", start: -40, end: -12, price: 110, sessionsTotal: 8, sessionsLeft: 0 },
      { code: "MEM-3304", plan: "eight", start: -12, end: 48, price: 110, sessionsTotal: 8, sessionsLeft: 5 },
    ],
  },
  {
    customerId: "CUS-1047",
    name: "Abel Tadesse",
    phone: "+251 915 006 447",
    joined: -15,
    archived: false,
    notes: "New this month. Walked in from the Tuesday open ring. Owes the full first month.",
    memberships: [{ code: "MEM-3305", plan: "fightcamp", start: -15, end: 15, price: 180 }],
  },
  {
    customerId: "CUS-1048",
    name: "Meron Assefa",
    phone: "+251 916 442 109",
    joined: -1,
    archived: false,
    notes: "Youth programme, parent is the contact for payments. Starts on the next Monday.",
    memberships: [{ code: "MEM-3306", plan: "youth", start: 3, end: 33, price: 120 }],
  },
  {
    customerId: "CUS-1049",
    name: "Tomas Bekele",
    phone: "+251 911 018 553",
    joined: -300,
    archived: true,
    notes: "Moved abroad. Left a pair of 14oz gloves in the locker room.",
    memberships: [{ code: "MEM-3290", plan: "unlimited", start: -70, end: -40, price: 220 }],
  },
  {
    customerId: "CUS-1050",
    name: "Rahel Desta",
    phone: "+251 917 664 238",
    joined: -40,
    archived: false,
    notes: "Competes in the 57kg bracket. Keeps a written training diary.",
    memberships: [
      { code: "MEM-3287", plan: "fightcamp", start: -50, end: -20, price: 180 },
      { code: "MEM-3308", plan: "fightcamp", start: -20, end: 5, price: 180 },
    ],
  },
];

const PAYMENTS = [
  { code: "PAY-9041", customerId: "CUS-1042", membershipCode: "MEM-3298", amount: 180, date: -87, method: "cash", ref: "CASH-1180" },
  { code: "PAY-9052", customerId: "CUS-1042", membershipCode: "MEM-3312", amount: 120, date: -27, method: "bank_transfer", ref: "TRF-4482" },
  { code: "PAY-9053", customerId: "CUS-1043", membershipCode: "MEM-3284", amount: 150, date: -100, method: "cash", ref: "CASH-1094" },
  { code: "PAY-9054", customerId: "CUS-1043", membershipCode: "MEM-3301", amount: 150, date: -40, method: "cash", ref: "CASH-1194" },
  { code: "PAY-9055", customerId: "CUS-1044", membershipCode: "MEM-3288", amount: 220, date: -64, method: "cash", ref: "CASH-1121" },
  { code: "PAY-9056", customerId: "CUS-1044", membershipCode: "MEM-3302", amount: 40, date: -33, method: "mobile_money", ref: "MM-77120" },
  { code: "PAY-9057", customerId: "CUS-1045", membershipCode: "MEM-3285", amount: 220, date: -38, method: "card", ref: "POS-3391" },
  { code: "PAY-9058", customerId: "CUS-1045", membershipCode: "MEM-3303", amount: 220, date: -5, method: "bank_transfer", ref: "TRF-4501" },
  { code: "PAY-9059", customerId: "CUS-1049", membershipCode: "MEM-3290", amount: 220, date: -70, method: "cash", ref: "CASH-1097" },
  { code: "PAY-9060", customerId: "CUS-1050", membershipCode: "MEM-3287", amount: 180, date: -50, method: "cash", ref: "CASH-1166" },
  { code: "PAY-9061", customerId: "CUS-1050", membershipCode: "MEM-3308", amount: 180, date: -20, method: "bank_transfer", ref: "TRF-4470" },
  { code: "PAY-9062", customerId: "CUS-1046", membershipCode: "MEM-3286", amount: 110, date: -40, method: "cash", ref: "CASH-1192" },
  { code: "PAY-9063", customerId: "CUS-1048", membershipCode: "MEM-3306", amount: 60, date: 0, method: "mobile_money", ref: "MM-77884" },
];

const SESSIONS = [
  { code: "S-1", time: "05:30", title: "Strength & conditioning", coach: "Bereket K.", status: "completed", cap: 14 },
  { code: "S-2", time: "07:00", title: "Boxing fundamentals", coach: "Hana G.", status: "completed", cap: 16 },
  { code: "S-3", time: "17:30", title: "Fight camp", coach: "Bereket K.", status: "scheduled", cap: 12 },
  { code: "S-4", time: "19:00", title: "Open ring", coach: "Dawit M.", status: "scheduled", cap: 20 },
  { code: "S-5", time: "20:00", title: "Sparring", coach: "Bereket K.", status: "cancelled", cap: 10 },
];

const ROSTERS = {
  "S-1": ["CUS-1043", "CUS-1045", "CUS-1042"],
  "S-2": ["CUS-1043", "CUS-1046", "CUS-1044", "CUS-1050"],
  "S-3": ["CUS-1042", "CUS-1043", "CUS-1045", "CUS-1046", "CUS-1047", "CUS-1050"],
  "S-4": ["CUS-1045", "CUS-1050", "CUS-1042", "CUS-1044"],
  "S-5": [],
};

const MARKS = {
  "S-1": { "CUS-1043": "present", "CUS-1045": "present", "CUS-1042": "present" },
  "S-2": { "CUS-1043": "present", "CUS-1046": "present", "CUS-1044": "absent", "CUS-1050": "present" },
  "S-3": { "CUS-1045": "present", "CUS-1046": "late", "CUS-1047": "absent" },
};

const VISITS = {
  "CUS-1042": [-2, -4, -7, -9, -11, -14, -16, -18, -21, -23, -25, -28],
  "CUS-1043": [-6, -13, -20, -27],
  "CUS-1044": [-5, -12, -19, -26],
  "CUS-1045": [-1, -3, -6, -8, -10, -13, -15, -17, -20, -22, -24, -27],
  "CUS-1046": [-2, -9, -16],
  "CUS-1047": [-16, -25],
  "CUS-1048": [],
  "CUS-1049": [-45],
  "CUS-1050": [-3, -5, -8, -12, -15, -19, -22, -26],
};

/** Convert a gym-local calendar date and time into a UTC instant. */
function zonedDateTime(dateISO, time, timeZone) {
  const naive = new Date(`${dateISO}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(naive).map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(naive.getTime() - (asUTC - naive.getTime()));
}

async function upsert(model, filter, doc) {
  return model.findOneAndUpdate(filter, { $setOnInsert: doc }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const confirmed = args.includes("--confirm");

  if (env.isProduction && !confirmed) {
    throw new Error("Refusing to seed in production without --confirm.");
  }
  if (!env.seedOwnerEmail || !env.seedOwnerPassword) {
    throw new Error("Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD before seeding.");
  }

  const connected = await connectDB();
  if (!connected) throw new Error("Could not connect to MongoDB.");

  if (reset) {
    await mongoose.connection.dropDatabase();
    console.log(`Reset ${mongoose.connection.name}.`);
  }

  const owner =
    (await Owner.findOne({ email: env.seedOwnerEmail.toLowerCase() })) ??
    (await Owner.create({
      email: env.seedOwnerEmail,
      passwordHash: await hashPassword(env.seedOwnerPassword),
      name: "Bereket Kassa",
      role: "owner",
    }));

  await Settings.findOneAndUpdate(
    { singleton: "settings" },
    { $setOnInsert: { singleton: "settings", ...defaultSettings() } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  const packagesByCode = new Map();
  for (const pkg of PACKAGES) {
    const doc = await upsert(Package, { code: pkg.code }, pkg);
    packagesByCode.set(pkg.code, doc);
    await upsert(
      PackageVersion,
      { package: doc._id, version: 1 },
      {
        package: doc._id,
        version: 1,
        name: doc.name,
        description: doc.description,
        type: doc.type,
        validityValue: doc.validityValue,
        validityUnit: doc.validityUnit,
        sessionAllowance: doc.sessionAllowance,
        priceCents: doc.priceCents,
        status: doc.status,
        changedFields: ["created"],
      },
    );
  }

  const customersByCode = new Map();
  for (const customer of CUSTOMERS) {
    const doc = await upsert(
      Customer,
      { customerId: customer.customerId },
      {
        customerId: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
        status: customer.archived ? "archived" : "active",
        registeredAt: parseISODate(addDaysISO(today, customer.joined)),
        archivedAt: customer.archived ? parseISODate(addDaysISO(today, -200)) : null,
      },
    );
    customersByCode.set(customer.customerId, doc);
  }

  const membershipsByCode = new Map();
  for (const customer of CUSTOMERS) {
    for (const membership of customer.memberships) {
      const plan = PLANS[membership.plan];
      const pkg = packagesByCode.get(plan.packageCode);
      const sessionsTotal = plan.type === "session" ? plan.sessionAllowance : 0;
      const sessionsRemaining = membership.sessionsLeft ?? sessionsTotal;
      const expiryDate = parseISODate(addDaysISO(today, membership.end));
      const snapshot = {
        name: plan.name,
        type: plan.type,
        validityValue: plan.validityValue,
        validityUnit: plan.validityUnit,
        sessionAllowance: plan.sessionAllowance,
        priceCents: plan.priceCents,
      };
      const startDate = parseISODate(addDaysISO(today, membership.start));
      const status = membershipStatus(
        { startDate, expiryDate, sessionsTotal, sessionsRemaining, packageSnapshot: snapshot },
        { todayISO: today, reminderWindows: defaultSettings().reminderWindows },
      );
      const state =
        status === "expiring_soon" ? "active" : status === "scheduled" ? "scheduled" : status;

      const doc = await upsert(
        Membership,
        { code: membership.code },
        {
          code: membership.code,
          customer: customersByCode.get(customer.customerId)._id,
          package: pkg._id,
          packageSnapshot: snapshot,
          startDate,
          expiryDate,
          sessionsTotal,
          sessionsUsed: sessionsTotal - sessionsRemaining,
          sessionsRemaining,
          agreedPriceCents: membership.price * 100,
          state,
        },
      );
      membershipsByCode.set(membership.code, doc);
    }
  }

  for (const payment of PAYMENTS) {
    await upsert(
      Payment,
      { code: payment.code },
      {
        code: payment.code,
        customer: customersByCode.get(payment.customerId)._id,
        membership: membershipsByCode.get(payment.membershipCode)?._id ?? null,
        amountCents: payment.amount * 100,
        method: payment.method,
        receivedOn: parseISODate(addDaysISO(today, payment.date)),
        reference: payment.ref,
        recordedBy: owner._id,
      },
    );
  }

  function membershipForVisit(customerCode, dateISO) {
    const customer = CUSTOMERS.find((c) => c.customerId === customerCode);
    if (!customer) return null;
    const covering = customer.memberships
      .filter((m) => {
        const start = addDaysISO(today, m.start);
        const end = addDaysISO(today, m.end);
        return start <= dateISO && dateISO <= end;
      })
      .pop();
    const fallback = customer.memberships[customer.memberships.length - 1];
    return membershipsByCode.get((covering ?? fallback).code) ?? null;
  }

  const sessionsByCode = new Map();
  for (const session of SESSIONS) {
    const startsAt = zonedDateTime(today, session.time, env.timezone);
    const doc = await upsert(
      TrainingSession,
      { code: session.code },
      {
        code: session.code,
        title: session.title,
        startsAt,
        durationMinutes: 60,
        capacity: session.cap,
        status: session.status,
        instructor: session.coach,
      },
    );
    sessionsByCode.set(session.code, doc);
  }

  for (const [code, roster] of Object.entries(ROSTERS)) {
    const session = sessionsByCode.get(code);
    if (!session) continue;
    for (const customerCode of roster) {
      const status = MARKS[code]?.[customerCode];
      if (!status) continue;
      const membership = membershipForVisit(customerCode, today);
      await upsert(
        Attendance,
        { session: session._id, customer: customersByCode.get(customerCode)._id },
        {
          customer: customersByCode.get(customerCode)._id,
          session: session._id,
          membership: membership?._id ?? null,
          status,
          markedBy: owner._id,
          markedAt: session.startsAt,
          deducted: ["present", "late"].includes(status),
        },
      );
    }
  }

  // Historical visits are attached to a completed "Open ring" session per day.
  for (const [customerCode, offsets] of Object.entries(VISITS)) {
    for (const offset of offsets) {
      const dateISO = addDaysISO(today, offset);
      const code = `S-H-${dateISO.replace(/-/g, "")}`;
      const startsAt = zonedDateTime(dateISO, "19:00", env.timezone);
      const session = await upsert(
        TrainingSession,
        { code },
        {
          code,
          title: "Open ring",
          startsAt,
          durationMinutes: 60,
          capacity: 20,
          status: "completed",
          instructor: "Bereket K.",
        },
      );
      const membership = membershipForVisit(customerCode, dateISO);
      await upsert(
        Attendance,
        { session: session._id, customer: customersByCode.get(customerCode)._id },
        {
          customer: customersByCode.get(customerCode)._id,
          session: session._id,
          membership: membership?._id ?? null,
          status: "present",
          markedBy: owner._id,
          markedAt: startsAt,
          deducted: Boolean(membership && membership.sessionsTotal > 0),
        },
      );
    }
  }

  for (const [key, seq] of [
    ["customer", 1050],
    ["membership", 3312],
    ["payment", 9063],
    ["session", 5],
    ["package", 5],
  ]) {
    await Counter.updateOne({ _id: key }, { $max: { seq } }, { upsert: true });
  }

  const [customerCount, membershipCount, paymentCount, attendanceCount] = await Promise.all([
    Customer.countDocuments(),
    Membership.countDocuments(),
    Payment.countDocuments(),
    Attendance.countDocuments(),
  ]);

  console.log("Seed complete.");
  console.log(`  owner:       ${owner.email}`);
  console.log(`  customers:   ${customerCount}`);
  console.log(`  memberships: ${membershipCount}`);
  console.log(`  payments:    ${paymentCount}`);
  console.log(`  attendance:  ${attendanceCount}`);
  console.log(`  packages:    ${await Package.countDocuments()}`);
  console.log(`  sessions:    ${await TrainingSession.countDocuments()}`);
  if (toISODate(new Date()) !== today) {
    console.log(`  gym date:    ${today} (timezone ${env.timezone})`);
  }
}

main()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
