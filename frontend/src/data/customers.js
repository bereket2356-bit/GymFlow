import { shiftISO, TODAY } from "../lib/dates.js";

export const SEED_CUSTOMERS = [
  {
    id: "CUS-1042",
    name: "Amara Bekele",
    phone: "+251 911 204 118",
    joined: shiftISO(-190),
    archived: false,
    notes: "Training for a first amateur bout in March. Prefers the 06:00 sessions; right hand still healing, no heavy bag work on Mondays.",
    memberships: [
      { id: "MEM-3298", plan: "fightcamp", start: shiftISO(-87), end: shiftISO(-57), price: 180 },
      { id: "MEM-3312", plan: "fightcamp", start: shiftISO(-27), end: shiftISO(3), price: 180 },
    ],
  },
  {
    id: "CUS-1043",
    name: "Dawit Mekonnen",
    phone: "+251 912 887 064",
    joined: shiftISO(-120),
    archived: false,
    notes: "Books the 12-session pack every other month. Ask about the Sunday sparring block.",
    memberships: [
      { id: "MEM-3284", plan: "twelve", start: shiftISO(-100), end: shiftISO(-40), price: 150, sessionsTotal: 12, sessionsLeft: 0 },
      { id: "MEM-3301", plan: "twelve", start: shiftISO(-40), end: shiftISO(20), price: 150, sessionsTotal: 12, sessionsLeft: 0 },
    ],
  },
  {
    id: "CUS-1044",
    name: "Selam Tesfaye",
    phone: "+251 913 550 902",
    joined: shiftISO(-95),
    archived: false,
    notes: "Renewal has lapsed twice. Call before the next billing date, not after.",
    memberships: [
      { id: "MEM-3288", plan: "unlimited", start: shiftISO(-64), end: shiftISO(-34), price: 220 },
      { id: "MEM-3302", plan: "unlimited", start: shiftISO(-34), end: shiftISO(-4), price: 220 },
    ],
  },
  {
    id: "CUS-1045",
    name: "Yonas Girma",
    phone: "+251 911 772 310",
    joined: shiftISO(-60),
    archived: false,
    notes: "Pays by bank transfer on the 20th. Also rents a locker (cash, not in the ledger).",
    memberships: [
      { id: "MEM-3285", plan: "unlimited", start: shiftISO(-38), end: shiftISO(-8), price: 220 },
      { id: "MEM-3303", plan: "unlimited", start: shiftISO(-8), end: shiftISO(22), price: 220 },
    ],
  },
  {
    id: "CUS-1046",
    name: "Hana Wolde",
    phone: "+251 914 338 271",
    joined: shiftISO(-75),
    archived: false,
    notes: "Works nights; usually trains at 07:00. Session pack was bought as a trial.",
    memberships: [
      { id: "MEM-3286", plan: "eight", start: shiftISO(-40), end: shiftISO(-12), price: 110, sessionsTotal: 8, sessionsLeft: 0 },
      { id: "MEM-3304", plan: "eight", start: shiftISO(-12), end: shiftISO(48), price: 110, sessionsTotal: 8, sessionsLeft: 5 },
    ],
  },
  {
    id: "CUS-1047",
    name: "Abel Tadesse",
    phone: "+251 915 006 447",
    joined: shiftISO(-15),
    archived: false,
    notes: "New this month. Walked in from the Tuesday open ring. Owes the full first month.",
    memberships: [{ id: "MEM-3305", plan: "fightcamp", start: shiftISO(-15), end: shiftISO(15), price: 180 }],
  },
  {
    id: "CUS-1048",
    name: "Meron Assefa",
    phone: "+251 916 442 109",
    joined: shiftISO(-1),
    archived: false,
    notes: "Youth programme, parent is the contact for payments. Starts on the next Monday.",
    memberships: [{ id: "MEM-3306", plan: "youth", start: shiftISO(3), end: shiftISO(33), price: 120 }],
  },
  {
    id: "CUS-1049",
    name: "Tomas Bekele",
    phone: "+251 911 018 553",
    joined: shiftISO(-300),
    archived: true,
    notes: "Moved abroad. Left a pair of 14oz gloves in the locker room.",
    memberships: [{ id: "MEM-3290", plan: "unlimited", start: shiftISO(-70), end: shiftISO(-40), price: 220 }],
  },
  {
    id: "CUS-1050",
    name: "Rahel Desta",
    phone: "+251 917 664 238",
    joined: shiftISO(-40),
    archived: false,
    notes: "Competes in the 57kg bracket. Keeps a written training diary.",
    memberships: [
      { id: "MEM-3287", plan: "fightcamp", start: shiftISO(-50), end: shiftISO(-20), price: 180 },
      { id: "MEM-3308", plan: "fightcamp", start: shiftISO(-20), end: shiftISO(5), price: 180 },
    ],
  },
];

export const SEED_PAYMENTS = [
  { id: "PAY-9041", customerId: "CUS-1042", membershipId: "MEM-3298", amount: 180, date: shiftISO(-87), method: "Cash", ref: "CASH-1180" },
  { id: "PAY-9052", customerId: "CUS-1042", membershipId: "MEM-3312", amount: 120, date: shiftISO(-27), method: "Bank transfer", ref: "TRF-4482" },
  { id: "PAY-9053", customerId: "CUS-1043", membershipId: "MEM-3284", amount: 150, date: shiftISO(-100), method: "Cash", ref: "CASH-1094" },
  { id: "PAY-9054", customerId: "CUS-1043", membershipId: "MEM-3301", amount: 150, date: shiftISO(-40), method: "Cash", ref: "CASH-1194" },
  { id: "PAY-9055", customerId: "CUS-1044", membershipId: "MEM-3288", amount: 220, date: shiftISO(-64), method: "Cash", ref: "CASH-1121" },
  { id: "PAY-9056", customerId: "CUS-1044", membershipId: "MEM-3302", amount: 40, date: shiftISO(-33), method: "Mobile money", ref: "MM-77120" },
  { id: "PAY-9057", customerId: "CUS-1045", membershipId: "MEM-3285", amount: 220, date: shiftISO(-38), method: "Card", ref: "POS-3391" },
  { id: "PAY-9058", customerId: "CUS-1045", membershipId: "MEM-3303", amount: 220, date: shiftISO(-5), method: "Bank transfer", ref: "TRF-4501" },
  { id: "PAY-9059", customerId: "CUS-1049", membershipId: "MEM-3290", amount: 220, date: shiftISO(-70), method: "Cash", ref: "CASH-1097" },
  { id: "PAY-9060", customerId: "CUS-1050", membershipId: "MEM-3287", amount: 180, date: shiftISO(-50), method: "Cash", ref: "CASH-1166" },
  { id: "PAY-9061", customerId: "CUS-1050", membershipId: "MEM-3308", amount: 180, date: shiftISO(-20), method: "Bank transfer", ref: "TRF-4470" },
  { id: "PAY-9062", customerId: "CUS-1046", membershipId: "MEM-3286", amount: 110, date: shiftISO(-40), method: "Cash", ref: "CASH-1192" },
  { id: "PAY-9063", customerId: "CUS-1048", membershipId: "MEM-3306", amount: 60, date: TODAY, method: "Mobile money", ref: "MM-77884" },
];

/** Visit dates as offsets from today, converted to ISO dates on load. */
export const SEED_ATTENDANCE = {
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

export function seedAttendanceLog() {
  const log = {};
  Object.keys(SEED_ATTENDANCE).forEach((cid) => {
    log[cid] = SEED_ATTENDANCE[cid].map((off) => shiftISO(off));
  });
  return log;
}

export const PHONE_RE = /^[+0-9][0-9 ()-]{6,}$/;