import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { SEED_CUSTOMERS, SEED_PAYMENTS, seedAttendanceLog } from "../data/customers.js";
import { SEED_PACKAGES, PLANS } from "../data/packages.js";
import { SEED_SESSIONS, ROSTERS, SEED_MARKS, seedSavedMarks } from "../data/sessions.js";
import { GYM } from "../data/config.js";
import { buildReminders } from "../data/reminders.js";
import { TODAY, shiftISO, monthStartISO, addDaysISO } from "../lib/dates.js";
import { toCents } from "../lib/money.js";
import {
  currentMembership,
  memStatus,
  memType,
  memPaid,
  memBalance,
  payStatus,
  isOverdue,
  paymentLabels,
  customerBalance,
  lastVisit as lastVisitOf,
  visitsIn30 as visitsIn30Of,
  openMembershipFor as openMembershipForOf,
  countByStatus as countByStatusOf,
} from "../lib/status.js";

const DataContext = createContext(null);

const clone = (v) => JSON.parse(JSON.stringify(v));
const inRange = (date, from, to) => date >= from && date <= to;

/**
 * Shared in-memory store for every screen: customers, payments, packages,
 * sessions, attendance, reminders and settings. Nothing is persisted.
 */
export function DataProvider({ children }) {
  const [customers, setCustomers] = useState(() => clone(SEED_CUSTOMERS));
  const [payments, setPayments] = useState(() => clone(SEED_PAYMENTS));
  const [packages, setPackages] = useState(() => clone(SEED_PACKAGES));
  const [sessions, setSessions] = useState(() => clone(SEED_SESSIONS));
  const [marks, setMarks] = useState(() => clone(SEED_MARKS));
  const [savedMarks, setSavedMarks] = useState(seedSavedMarks);
  const [attendanceLog, setAttendanceLog] = useState(seedAttendanceLog);
  const [deductions, setDeductions] = useState({});
  const [reviewed, setReviewed] = useState([]);
  const [gym, setGym] = useState({ ...GYM });
  const [period, setPeriod] = useState("month");
  const [reports, setReports] = useState({ from: monthStartISO(), to: TODAY });
  const ids = useRef({ customer: 1051, membership: 3315, payment: 9064, package: 6 });

  /* ---------- customers ---------- */
  const customerById = useCallback((id) => customers.find((c) => c.id === id) || null, [customers]);

  const addCustomer = useCallback(({ name, phone, planKey, start, notes }) => {
    const plan = PLANS[planKey];
    const cid = "CUS-" + ids.current.customer++;
    const mid = "MEM-" + ids.current.membership++;
    const membership = { id: mid, plan: planKey, start, end: addDaysISO(start, plan.days), price: plan.price };
    if (plan.type === "session") {
      membership.sessionsTotal = plan.sessions;
      membership.sessionsLeft = plan.sessions;
    }
    const customer = { id: cid, name, phone, joined: TODAY, archived: false, notes, memberships: [membership] };
    setCustomers((list) => [...list, customer]);
    return customer;
  }, []);

  const editCustomer = useCallback((id, patch) => {
    setCustomers((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const setArchived = useCallback((id, archived) => {
    setCustomers((list) => list.map((c) => (c.id === id ? { ...c, archived } : c)));
  }, []);

  const saveNotes = useCallback((id, notes) => {
    setCustomers((list) => list.map((c) => (c.id === id ? { ...c, notes } : c)));
  }, []);

  /** Renewals and new memberships append; history is never rewritten. */
  const addMembership = useCallback(({ customerId, planKey, start, price }) => {
    const plan = PLANS[planKey];
    const mid = "MEM-" + ids.current.membership++;
    const membership = { id: mid, plan: planKey, start, end: addDaysISO(start, plan.days), price: toCents(price) };
    if (plan.type === "session") {
      membership.sessionsTotal = plan.sessions;
      membership.sessionsLeft = plan.sessions;
    }
    setCustomers((list) => list.map((c) => (c.id === customerId ? { ...c, memberships: [...c.memberships, membership] } : c)));
    return membership;
  }, []);

  /* ---------- payments ---------- */
  const addPayment = useCallback(({ customerId, membershipId, amount, date, method, ref }) => {
    const id = "PAY-" + ids.current.payment++;
    setPayments((list) => [...list, { id, customerId, membershipId, amount: toCents(amount), date, method, ref: ref || "—" }]);
    return id;
  }, []);

  /** Corrections are appended as their own line; nothing is edited or erased. */
  const addCorrection = useCallback(({ customerId, membershipId, amount, reason }) => {
    const id = "PAY-" + ids.current.payment++;
    setPayments((list) => [
      ...list,
      { id, customerId, membershipId, amount: toCents(amount), date: TODAY, method: "Correction", ref: "CORR-" + id.slice(-4), kind: "correction", reason },
    ]);
    return id;
  }, []);

  /* ---------- attendance ---------- */
  const toggleMark = useCallback((sid, cid, mark) => {
    setMarks((prev) => {
      const session = { ...(prev[sid] || {}) };
      session[cid] = (session[cid] || "") === mark ? "" : mark;
      return { ...prev, [sid]: session };
    });
  }, []);

  /** Writes marks, deductions (once per session) and today's visit log. */
  const saveAttendance = useCallback((sid) => {
    const marksNow = marks[sid] || {};
    const saved = savedMarks[sid] || {};
    const bucket = { ...(deductions[sid] || {}) };
    let deducted = 0;
    let restored = 0;
    const logAdd = [];
    const leftAfter = {};

    (ROSTERS[sid] || []).forEach((cid) => {
      const now = marksNow[cid] === "P" || marksNow[cid] === "L";
      const was = saved[cid] === "P" || saved[cid] === "L";
      if (now && !was) logAdd.push(cid);
      const customer = customers.find((c) => c.id === cid);
      if (!customer) return;
      const m = currentMembership(customer);
      if (!m || memType(m) !== "session") return;
      if (now && !was && (m.sessionsLeft || 0) > 0) {
        leftAfter[cid] = { mid: m.id, delta: -1 };
        bucket[cid] = true;
        deducted += 1;
      } else if (!now && was && bucket[cid]) {
        leftAfter[cid] = { mid: m.id, delta: 1 };
        delete bucket[cid];
        restored += 1;
      }
    });

    setCustomers((list) =>
      list.map((c) => {
        const change = leftAfter[c.id];
        if (!change) return c;
        return {
          ...c,
          memberships: c.memberships.map((m) => {
            if (m.id !== change.mid) return m;
            const total = m.sessionsTotal || 0;
            const next = (m.sessionsLeft || 0) + change.delta;
            return { ...m, sessionsLeft: Math.max(0, Math.min(total, next)) };
          }),
        };
      }),
    );
    setAttendanceLog((log) => {
      const next = { ...log };
      logAdd.forEach((cid) => {
        const list = next[cid] ? [...next[cid]] : [];
        if (!list.includes(TODAY)) list.push(TODAY);
        next[cid] = list;
      });
      return next;
    });
    setDeductions((prev) => ({ ...prev, [sid]: bucket }));
    setSavedMarks((prev) => ({ ...prev, [sid]: { ...marksNow } }));
    setSessions((list) =>
      list.map((s) =>
        s.id === sid
          ? { ...s, booked: (ROSTERS[sid] || []).filter((cid) => marksNow[cid] === "P" || marksNow[cid] === "L").length }
          : s,
      ),
    );
    return { deducted, restored };
  }, [marks, savedMarks, deductions, customers]);

  /* ---------- packages ---------- */
  const upsertPackage = useCallback((pkg) => {
    if (pkg.id && pkg.id !== "__new__") {
      setPackages((list) => list.map((p) => (p.id === pkg.id ? pkg : p)));
      return pkg.id;
    }
    const id = "PKG-" + String(ids.current.package++).padStart(2, "0");
    setPackages((list) => [...list, { ...pkg, id }]);
    return id;
  }, []);

  const setPackageActive = useCallback((id, active) => {
    setPackages((list) => list.map((p) => (p.id === id ? { ...p, active } : p)));
  }, []);

  /* ---------- reminders / settings ---------- */
  const isReviewed = useCallback((key) => reviewed.includes(key), [reviewed]);
  const markReviewed = useCallback((key) => setReviewed((list) => (list.includes(key) ? list : [...list, key])), []);
  const updateGym = useCallback((patch) => setGym((prev) => ({ ...prev, ...patch })), []);

  /* ---------- selectors ---------- */
  const sel = useMemo(() => {
    const nonArchived = () => customers.filter((c) => !c.archived);
    const paidOf = (m) => memPaid(m, payments);
    const balanceOf = (m) => memBalance(m, payments);
    const payStatusOf = (m) => payStatus(m, payments);
    const overdueOf = (m) => isOverdue(m, payments);
    const labelsOf = (m) => paymentLabels(m, payments);
    const balanceOfCustomer = (c) => customerBalance(c, payments);
    const openMembershipFor = (c) => openMembershipForOf(c, payments);
    const paymentsIn = (from, to) => payments.filter((p) => p.kind !== "correction" && inRange(p.date, from, to));
    const collectedIn = (from, to) => paymentsIn(from, to).reduce((s, p) => s + p.amount, 0);
    const membershipValueIn = (from, to) =>
      nonArchived().reduce(
        (sum, c) => sum + c.memberships.reduce((s, m) => s + (inRange(m.start, from, to) ? m.price : 0), 0),
        0,
      );
    const totalOutstanding = () => nonArchived().reduce((s, c) => s + balanceOfCustomer(c), 0);
    const newCustomersIn = (from, to) => nonArchived().filter((c) => inRange(c.joined, from, to)).length;
    const counts = countByStatusOf(customers);
    const range =
      period === "7d"
        ? { from: shiftISO(-6), to: TODAY, label: "Last 7 days" }
        : period === "30d"
          ? { from: shiftISO(-29), to: TODAY, label: "Last 30 days" }
          : period === "quarter"
            ? { from: shiftISO(-89), to: TODAY, label: "Last 90 days" }
            : { from: monthStartISO(), to: TODAY, label: "This month" };
    const kpi = {
      total: customers.length,
      live: nonArchived().length,
      archived: customers.length - nonArchived().length,
      active: counts.Active + counts["Expiring soon"],
      expiring: counts["Expiring soon"],
      expired: counts.Expired,
      exhausted: counts.Exhausted,
      scheduled: counts.Scheduled,
      collected: collectedIn(range.from, range.to),
      outstanding: totalOutstanding(),
      counts,
      range,
    };
    const weeklyCollected = (n) => {
      const out = [];
      for (let i = n - 1; i >= 0; i -= 1) out.push(collectedIn(shiftISO(-7 * i - 6), shiftISO(-7 * i)));
      return out;
    };
    const weeklySeries = (n) => {
      const out = [];
      for (let w = n - 1; w >= 0; w -= 1) {
        const to = shiftISO(-7 * w);
        const from = shiftISO(-7 * w - 6);
        out.push({ from, to, value: collectedIn(from, to) });
      }
      return out;
    };
    const reminders = buildReminders({ customers, payments, attendanceLog, rules: gym });
    const packageStats = (id) => {
      const rows = [];
      customers.forEach((c) =>
        c.memberships.forEach((m) => {
          if (PLANS[m.plan] && PLANS[m.plan].pkg === id) rows.push({ customer: c, membership: m });
        }),
      );
      const activeRows = rows.filter((r) => !r.customer.archived && ["Active", "Expiring soon"].includes(memStatus(r.membership)));
      const seen = {};
      const names = [];
      activeRows.forEach((r) => {
        if (!seen[r.customer.id]) {
          seen[r.customer.id] = true;
          names.push(r.customer.name);
        }
      });
      const idsOf = {};
      rows.forEach((r) => (idsOf[r.membership.id] = true));
      const revenue = payments
        .filter((p) => p.kind !== "correction" && idsOf[p.membershipId])
        .reduce((s, p) => s + p.amount, 0);
      return { active: activeRows.length, total: rows.length, names, revenue };
    };
    return {
      nonArchived,
      paidOf,
      balanceOf,
      payStatusOf,
      overdueOf,
      labelsOf,
      balanceOfCustomer,
      openMembershipFor,
      lastVisit: (cid) => lastVisitOf(attendanceLog, cid),
      visitsIn30: (cid) => visitsIn30Of(attendanceLog, cid),
      collectedIn,
      membershipValueIn,
      totalOutstanding,
      newCustomersIn,
      paymentsIn,
      counts,
      range,
      kpi,
      weeklyCollected,
      weeklySeries,
      reminders,
      packageStats,
    };
  }, [customers, payments, attendanceLog, period, gym]);

  const value = useMemo(
    () => ({
      customers,
      payments,
      packages,
      sessions,
      marks,
      savedMarks,
      attendanceLog,
      deductions,
      reviewed,
      gym,
      period,
      reports,
      sel,
      customerById,
      addCustomer,
      editCustomer,
      setArchived,
      saveNotes,
      addMembership,
      addPayment,
      addCorrection,
      toggleMark,
      saveAttendance,
      upsertPackage,
      setPackageActive,
      isReviewed,
      markReviewed,
      updateGym,
      setPeriod,
      setReports,
    }),
    [
      customers, payments, packages, sessions, marks, savedMarks, attendanceLog, deductions, reviewed, gym, period, reports,
      sel, customerById, addCustomer, editCustomer, setArchived, saveNotes, addMembership, addPayment, addCorrection,
      toggleMark, saveAttendance, upsertPackage, setPackageActive, isReviewed, markReviewed, updateGym,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}