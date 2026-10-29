import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";
import { SEED_CUSTOMERS, SEED_PAYMENTS, seedAttendanceLog } from "../data/customers.js";
import { SEED_PACKAGES, PLANS } from "../data/packages.js";
import { SEED_SESSIONS, ROSTERS, SEED_MARKS, seedSavedMarks } from "../data/sessions.js";
import { GYM } from "../data/config.js";
import { buildReminders } from "../data/reminders.js";
import { TODAY, shiftISO, monthStartISO, addDaysISO } from "../lib/dates.js";
import { toCents, setCurrencySymbol } from "../lib/money.js";
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

function resolvePlanKey(pkgDoc, snapshot) {
  const name = snapshot?.name || pkgDoc?.name || "";
  const code = pkgDoc?.code || "";
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.name === name || plan.pkg === code) return key;
  }
  const type = snapshot?.type || pkgDoc?.type;
  if (type === "session") return "twelve";
  return "fightcamp";
}

function normalizeCustomer(raw) {
  if (!raw) return null;
  const id = raw.customerId || raw.code || raw.id || raw._id;
  const memberships = (raw.memberships || []).map((m) => {
    const planKey = resolvePlanKey(m.package, m.packageSnapshot);
    const plan = PLANS[planKey] || PLANS.fightcamp;
    return {
      id: m.code || m.id,
      _id: m.id || m._id,
      plan: planKey,
      start: m.startDate ? String(m.startDate).slice(0, 10) : (m.start || TODAY),
      end: m.expiryDate ? String(m.expiryDate).slice(0, 10) : (m.end || addDaysISO(m.start || TODAY, plan.days || 30)),
      price: m.agreedPrice != null ? m.agreedPrice : (m.price != null ? m.price : plan.price),
      sessionsTotal: m.sessionsTotal != null ? m.sessionsTotal : (m.packageSnapshot?.sessionAllowance ?? (plan.sessions || 0)),
      sessionsLeft: m.sessionsRemaining != null ? m.sessionsRemaining : (m.sessionsLeft != null ? m.sessionsLeft : (plan.sessions || 0)),
      status: m.status,
      balance: m.balance,
      paymentStatus: m.paymentStatus,
    };
  });

  return {
    id,
    _id: raw.id || raw._id,
    customerId: raw.customerId || id,
    name: raw.name || "",
    phone: raw.phone || "",
    joined: raw.registeredAt ? String(raw.registeredAt).slice(0, 10) : (raw.joined || TODAY),
    archived: raw.status === "archived" || raw.archived === true,
    notes: raw.notes || "",
    memberships,
  };
}

function formatMethod(method) {
  if (!method) return "Cash";
  const m = String(method).toLowerCase();
  if (m === "cash") return "Cash";
  if (m === "bank_transfer") return "Bank transfer";
  if (m === "card") return "Card";
  if (m === "mobile_money") return "Mobile money";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function normalizePayment(p) {
  const amount = typeof p.amount === "number" ? p.amount : (p.amountCents ? p.amountCents / 100 : 0);
  return {
    id: p.code || p.id,
    _id: p.id || p._id,
    customerId: p.customer?.customerId || p.customer?.id || p.customerId,
    membershipId: p.membership?.code || p.membership?.id || p.membershipId,
    amount,
    date: p.receivedOn ? String(p.receivedOn).slice(0, 10) : (p.date || TODAY),
    method: formatMethod(p.method),
    ref: p.reference || p.ref || "—",
    kind: p.kind || "payment",
    reason: p.reason || "",
  };
}

function normalizePackage(pkg) {
  return {
    id: pkg.code || pkg.id,
    _id: pkg.id || pkg._id,
    code: pkg.code,
    name: pkg.name,
    description: pkg.description || "",
    type: pkg.type,
    validity: pkg.validityValue ? { n: pkg.validityValue, unit: pkg.validityUnit } : pkg.validity,
    sessions: pkg.sessionAllowance != null ? pkg.sessionAllowance : pkg.sessions,
    price: pkg.price != null ? pkg.price : (pkg.priceCents ? pkg.priceCents / 100 : 0),
    active: pkg.status === "active",
  };
}

function normalizeSession(s) {
  let time = s.time || "06:00";
  let end = s.end || "07:00";
  if (s.startsAt) {
    const d = new Date(s.startsAt);
    time = d.toISOString().substring(11, 16);
    const endD = new Date(d.getTime() + (s.durationMinutes || 60) * 60000);
    end = endD.toISOString().substring(11, 16);
  }
  const statusRaw = s.status || "scheduled";
  const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
  return {
    id: s.code || s.id,
    _id: s.id || s._id,
    code: s.code,
    time,
    end,
    title: s.title,
    coach: s.instructor || s.coach || "Bereket K.",
    status,
    cap: s.capacity || s.cap || 14,
    booked: s.booked || 0,
  };
}

function normalizeGym(settings) {
  if (!settings) return GYM;
  const windows = settings.reminderWindows || [7, 3, 1];
  return {
    name: settings.gymName || GYM.name,
    warn7: windows[0] || 7,
    warn3: windows[1] || 3,
    warn1: windows[2] || 1,
    inactive: settings.inactivityDays || GYM.inactive,
  };
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [marks, setMarks] = useState({});
  const [savedMarks, setSavedMarks] = useState({});
  const [attendanceLog, setAttendanceLog] = useState({});
  const [deductions, setDeductions] = useState({});
  const [reviewed, setReviewed] = useState([]);
  const [gym, setGym] = useState({ ...GYM });
  const [period, setPeriod] = useState("month");
  const [reports, setReports] = useState({ from: monthStartISO(), to: TODAY });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ids = useRef({ customer: 1051, membership: 3315, payment: 9064, package: 6 });

  // Initial load from backend API when authenticated
  const loadInitialData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [custRes, pkgRes, payRes, setRes, remRes, todaySessRes, sessRes] = await Promise.allSettled([
        api.customers.list({ limit: 100 }),
        api.packages.list({ limit: 100 }),
        api.payments.list({ limit: 100 }),
        api.settings.get(),
        api.dashboard.reminders(),
        api.dashboard.todaySessions(),
        api.sessions.list({ limit: 50 }),
      ]);

      if (custRes.status === "fulfilled" && custRes.value?.data) {
        const normCustomers = custRes.value.data.map(normalizeCustomer);
        setCustomers(normCustomers);
      }

      if (pkgRes.status === "fulfilled" && pkgRes.value?.data) {
        setPackages(pkgRes.value.data.map(normalizePackage));
      }

      if (payRes.status === "fulfilled" && payRes.value?.data) {
        const normPayments = payRes.value.data.map(normalizePayment);
        setPayments(normPayments);
      }

      if (setRes.status === "fulfilled" && setRes.value?.data?.settings) {
        const normGym = normalizeGym(setRes.value.data.settings);
        setGym(normGym);
        setCurrencySymbol(normGym.currency);
      }

      if (remRes.status === "fulfilled" && remRes.value?.data?.reminders) {
        const revKeys = remRes.value.data.reminders.filter((r) => r.reviewed).map((r) => r.key);
        setReviewed(revKeys);
      }

      const sessionsList =
        (todaySessRes.status === "fulfilled" && todaySessRes.value?.data?.sessions?.length
          ? todaySessRes.value.data.sessions
          : null) ||
        (sessRes.status === "fulfilled" && sessRes.value?.data?.length
          ? sessRes.value.data
          : null);

      if (sessionsList) {
        setSessions(sessionsList.map(normalizeSession));
      }

      // Load attendance marks for today's sessions
      if (sessionsList) {
        const newMarks = {};
        const newSaved = {};
        const logMap = {};

        await Promise.all(
          sessionsList.map(async (s) => {
            const sid = s.code || s.id;
            try {
              const attRes = await api.sessions.getAttendance(s.id || s._id);
              if (attRes?.data?.attendance) {
                const sessionMarkMap = {};
                attRes.data.attendance.forEach((record) => {
                  const cid = record.customer?.customerId || record.customer?.id;
                  const st = record.status;
                  const letter = st === "present" ? "P" : st === "late" ? "L" : st === "absent" ? "A" : st === "excused" ? "E" : "";
                  if (cid && letter) {
                    sessionMarkMap[cid] = letter;
                    if (st === "present" || st === "late") {
                      if (!logMap[cid]) logMap[cid] = [];
                      const d = (record.markedAt || TODAY).slice(0, 10);
                      if (!logMap[cid].includes(d)) logMap[cid].push(d);
                    }
                  }
                });
                newMarks[sid] = sessionMarkMap;
                newSaved[sid] = { ...sessionMarkMap };
              }
            } catch {
              // ignore session attendance fetch failure
            }
          }),
        );

        if (Object.keys(newMarks).length > 0) {
          setMarks((prev) => ({ ...prev, ...newMarks }));
          setSavedMarks((prev) => ({ ...prev, ...newSaved }));
        }

        if (Object.keys(logMap).length > 0) {
          setAttendanceLog((prev) => ({ ...prev, ...logMap }));
        }
      }

      if (custRes.status === "rejected" && pkgRes.status === "rejected") {
        setError(custRes.reason?.message || "Failed to connect to the gym server.");
      }
    } catch (err) {
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /* ---------- customers ---------- */
  const customerById = useCallback(
    (id) => customers.find((c) => c.id === id || c._id === id || c.customerId === id) || null,
    [customers],
  );

  const fetchCustomerDetail = useCallback(async (id) => {
    try {
      const res = await api.customers.get(id);
      if (res?.data?.customer) {
        const fullCust = normalizeCustomer({
          ...res.data.customer,
          memberships: res.data.memberships,
        });
        setCustomers((list) => list.map((c) => (c.id === fullCust.id || c._id === fullCust._id ? fullCust : c)));
        return fullCust;
      }
    } catch (err) {
      // handled
    }
    return null;
  }, []);

  const addCustomer = useCallback(
    async ({ name, phone, planKey, start, notes }) => {
      const plan = PLANS[planKey] || PLANS.fightcamp;
      try {
        const res = await api.customers.create({ name, phone, notes });
        const createdCust = res?.data?.customer;
        const custId = createdCust?.id || createdCust?._id;

        // Create starting membership
        const targetPkg =
          packages.find((p) => p.code === plan.pkg || p.id === plan.pkg || p.name === plan.name) || packages[0];

        if (targetPkg && custId) {
          try {
            await api.customers.createMembership(custId, {
              packageId: targetPkg._id || targetPkg.id,
              startDate: start,
              agreedPrice: plan.price,
              confirm: true,
            });
          } catch (memErr) {
            // handled
          }
        }

        // Re-fetch customer list to keep IDs and balances synced
        const refreshed = await api.customers.list({ limit: 100 });
        if (refreshed?.data) {
          const list = refreshed.data.map(normalizeCustomer);
          setCustomers(list);
          const found = list.find((c) => c._id === custId || c.name === name);
          if (found) return found;
        }

        const normalized = normalizeCustomer(createdCust);
        setCustomers((list) => [...list, normalized]);
        return normalized;
      } catch (err) {
        throw err;
      }
    },
    [packages],
  );

  const editCustomer = useCallback(
    async (id, patch) => {
      // Optimistic update
      setCustomers((list) =>
        list.map((c) => (c.id === id || c._id === id || c.customerId === id ? { ...c, ...patch } : c)),
      );

      const target = customerById(id);
      if (target?._id || target?.id) {
        try {
          await api.customers.update(target._id || target.id, {
            name: patch.name,
            phone: patch.phone,
            notes: patch.notes,
          });
        } catch (err) {
          // handled
        }
      }
    },
    [customerById],
  );

  const setArchived = useCallback(
    async (id, archived) => {
      // Optimistic update
      setCustomers((list) =>
        list.map((c) => (c.id === id || c._id === id || c.customerId === id ? { ...c, archived } : c)),
      );

      const target = customerById(id);
      if (target?._id || target?.id) {
        try {
          if (archived) {
            await api.customers.archive(target._id || target.id);
          } else {
            await api.customers.restore(target._id || target.id);
          }
        } catch (err) {
          // ignore or rethrow
        }
      }
    },
    [customerById],
  );

  const deleteCustomer = useCallback(
    async (id) => {
      const target = customerById(id);
      const targetId = target?._id || target?.id || id;
      await api.customers.delete(targetId);
      setCustomers((list) =>
        list.filter((c) => c.id !== id && c._id !== targetId && c.customerId !== id && c._id !== id),
      );
    },
    [customerById],
  );

  const saveNotes = useCallback(
    async (id, notes) => {
      // Optimistic update
      setCustomers((list) =>
        list.map((c) => (c.id === id || c._id === id || c.customerId === id ? { ...c, notes } : c)),
      );

      const target = customerById(id);
      if (target?._id || target?.id) {
        try {
          await api.customers.update(target._id || target.id, { notes });
        } catch (err) {
          // handled
        }
      }
    },
    [customerById],
  );

  /** Renewals and new memberships */
  const addMembership = useCallback(
    async ({ customerId, planKey, start, price }) => {
      const plan = PLANS[planKey] || PLANS.fightcamp;
      const targetCustomer = customerById(customerId);
      const targetPkg =
        packages.find((p) => p.code === plan.pkg || p.id === plan.pkg || p.name === plan.name) || packages[0];

      if (targetCustomer && targetPkg) {
        try {
          await api.customers.createMembership(targetCustomer._id || targetCustomer.id, {
            packageId: targetPkg._id || targetPkg.id,
            startDate: start,
            agreedPrice: Number(price),
            confirm: true,
          });

          // Refresh customer list to get server-generated membership
          const refreshed = await api.customers.list({ limit: 100 });
          if (refreshed?.data) {
            setCustomers(refreshed.data.map(normalizeCustomer));
          }
          return;
        } catch (err) {
          // handled
        }
      }

      // Optimistic fallback
      const mid = "MEM-" + ids.current.membership++;
      const membership = { id: mid, plan: planKey, start, end: addDaysISO(start, plan.days), price: toCents(price) };
      if (plan.type === "session") {
        membership.sessionsTotal = plan.sessions;
        membership.sessionsLeft = plan.sessions;
      }
      setCustomers((list) =>
        list.map((c) =>
          c.id === customerId || c._id === customerId || c.customerId === customerId
            ? { ...c, memberships: [...c.memberships, membership] }
            : c,
        ),
      );
      return membership;
    },
    [customerById, packages],
  );

  /* ---------- payments ---------- */
  const addPayment = useCallback(
    async ({ customerId, membershipId, amount, date, method, ref }) => {
      const targetCustomer = customerById(customerId);
      const targetM = targetCustomer?.memberships.find((m) => m.id === membershipId || m._id === membershipId);

      const methodKey = String(method || "cash").toLowerCase().replace(/\s+/g, "_");
      const safeMethod = ["cash", "bank_transfer", "card", "mobile_money"].includes(methodKey)
        ? methodKey
        : "cash";

      try {
        const res = await api.payments.create({
          customerId: targetCustomer?._id || targetCustomer?.id || customerId,
          membershipId: targetM?._id || targetM?.id || membershipId || undefined,
          amount: Number(amount),
          method: safeMethod,
          receivedOn: date || TODAY,
          reference: ref || null,
        });

        // Re-fetch payments and customers to maintain strict balance consistency
        const [payRes, custRes] = await Promise.all([
          api.payments.list({ limit: 100 }),
          api.customers.list({ limit: 100 }),
        ]);

        if (payRes?.data) setPayments(payRes.data.map(normalizePayment));
        if (custRes?.data) setCustomers(custRes.data.map(normalizeCustomer));

        return res?.data?.payment?.id || "PAY-" + ids.current.payment++;
      } catch (err) {
        // handled
        // Optimistic fallback
        const id = "PAY-" + ids.current.payment++;
        setPayments((list) => [
          ...list,
          { id, customerId, membershipId, amount: toCents(amount), date, method, ref: ref || "—" },
        ]);
        return id;
      }
    },
    [customerById],
  );

  /** Corrections are appended as their own line; nothing is edited or erased. */
  const addCorrection = useCallback(
    async ({ customerId, membershipId, amount, reason }) => {
      // Find a payment for this customer / membership to attach adjustment to
      const targetCust = customerById(customerId);
      const targetPayments = payments.filter(
        (p) =>
          (p.customerId === customerId || p.customerId === targetCust?._id || p.customerId === targetCust?.id) &&
          (!membershipId || p.membershipId === membershipId),
      );
      const originalPay = targetPayments[0];

      if (originalPay?._id || originalPay?.id) {
        try {
          await api.payments.createAdjustment(originalPay._id || originalPay.id, {
            amount: Number(amount),
            reason,
          });

          // Refresh payments
          const [payRes, custRes] = await Promise.all([
            api.payments.list({ limit: 100 }),
            api.customers.list({ limit: 100 }),
          ]);
          if (payRes?.data) setPayments(payRes.data.map(normalizePayment));
          if (custRes?.data) setCustomers(custRes.data.map(normalizeCustomer));
          return originalPay.id;
        } catch (err) {
          // handled
        }
      }

      // Optimistic fallback
      const id = "PAY-" + ids.current.payment++;
      setPayments((list) => [
        ...list,
        {
          id,
          customerId,
          membershipId,
          amount: toCents(amount),
          date: TODAY,
          method: "Correction",
          ref: "CORR-" + id.slice(-4),
          kind: "correction",
          reason,
        },
      ]);
      return id;
    },
    [customerById, payments],
  );

  /* ---------- attendance ---------- */
  const toggleMark = useCallback((sid, cid, mark) => {
    setMarks((prev) => {
      const session = { ...(prev[sid] || {}) };
      session[cid] = (session[cid] || "") === mark ? "" : mark;
      return { ...prev, [sid]: session };
    });
  }, []);

  /** Writes marks, deductions (once per session) and today's visit log. */
  const saveAttendance = useCallback(
    async (sid) => {
      const marksNow = marks[sid] || {};
      const saved = savedMarks[sid] || {};
      const bucket = { ...(deductions[sid] || {}) };
      let deducted = 0;
      let restored = 0;
      const logAdd = [];
      const leftAfter = {};

      const sessionObj = sessions.find((s) => s.id === sid || s.code === sid || s._id === sid);
      const sessionRoster = ROSTERS[sid] || ROSTERS[sessionObj?.code] || [];

      // Try saving to backend
      if (sessionObj) {
        const entries = [];
        const statusMap = { P: "present", L: "late", A: "absent", E: "excused" };
        sessionRoster.forEach((cid) => {
          const letter = marksNow[cid];
          if (letter && statusMap[letter]) {
            const c = customerById(cid);
            entries.push({
              customerId: c?._id || c?.id || cid,
              status: statusMap[letter],
            });
          }
        });

        if (entries.length > 0) {
          try {
            const attRes = await api.sessions.markAttendance(sessionObj._id || sessionObj.id, entries);
            if (attRes?.data) {
              if (attRes.data.deducted) deducted = attRes.data.deducted;
              if (attRes.data.restored) restored = attRes.data.restored;
            }
          } catch (err) {
            // handled
          }
        }
      }

      sessionRoster.forEach((cid) => {
        const now = marksNow[cid] === "P" || marksNow[cid] === "L";
        const was = saved[cid] === "P" || saved[cid] === "L";
        if (now && !was) logAdd.push(cid);
        const customer = customerById(cid);
        if (!customer) return;
        const m = currentMembership(customer);
        if (!m || memType(m) !== "session") return;
        if (now && !was && (m.sessionsLeft || 0) > 0) {
          leftAfter[customer.id] = { mid: m.id, delta: -1 };
          bucket[cid] = true;
          if (!deducted) deducted += 1;
        } else if (!now && was && bucket[cid]) {
          leftAfter[customer.id] = { mid: m.id, delta: 1 };
          delete bucket[cid];
          if (!restored) restored += 1;
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
          s.id === sid || s.code === sid
            ? {
                ...s,
                booked: sessionRoster.filter((cid) => marksNow[cid] === "P" || marksNow[cid] === "L").length,
              }
            : s,
        ),
      );

      return { deducted, restored };
    },
    [marks, savedMarks, deductions, sessions, customerById],
  );

  /* ---------- packages ---------- */
  const upsertPackage = useCallback(
    async (pkg) => {
      const payload = {
        name: pkg.name,
        description: pkg.description || "",
        type: pkg.type || "time",
        validityValue: pkg.validity?.n || 1,
        validityUnit: pkg.validity?.unit || "months",
        sessionAllowance: pkg.sessions || 1,
        price: typeof pkg.price === "number" ? (pkg.price > 1000 ? pkg.price / 100 : pkg.price) : 100,
        status: pkg.active ? "active" : "inactive",
      };

      if (pkg.id && pkg.id !== "__new__") {
        setPackages((list) => list.map((p) => (p.id === pkg.id || p.code === pkg.id ? { ...p, ...pkg } : p)));
        const target = packages.find((p) => p.id === pkg.id || p.code === pkg.id);
        if (target?._id || target?.id) {
          try {
            await api.packages.update(target._id || target.id, { ...payload, confirm: true });
            const refreshed = await api.packages.list({ limit: 100 });
            if (refreshed?.data) setPackages(refreshed.data.map(normalizePackage));
          } catch (err) {
            // handled
          }
        }
        return pkg.id;
      }

      // New package
      try {
        const res = await api.packages.create(payload);
        if (res?.data?.package) {
          const normalized = normalizePackage(res.data.package);
          setPackages((list) => [...list, normalized]);
          return normalized.id;
        }
      } catch (err) {
        // handled
      }

      const id = "PKG-" + String(ids.current.package++).padStart(2, "0");
      setPackages((list) => [...list, { ...pkg, id }]);
      return id;
    },
    [packages],
  );

  const setPackageActive = useCallback(
    async (id, active) => {
      setPackages((list) => list.map((p) => (p.id === id || p.code === id ? { ...p, active } : p)));
      const target = packages.find((p) => p.id === id || p.code === id);
      if (target?._id || target?.id) {
        try {
          if (active) {
            await api.packages.activate(target._id || target.id, true);
          } else {
            await api.packages.deactivate(target._id || target.id, true);
          }
        } catch (err) {
          // handled
        }
      }
    },
    [packages],
  );

  /* ---------- reminders / settings ---------- */
  const isReviewed = useCallback((key) => reviewed.includes(key), [reviewed]);

  const markReviewed = useCallback(async (key) => {
    setReviewed((list) => (list.includes(key) ? list : [...list, key]));
    try {
      await api.dashboard.reviewReminder(key);
    } catch (err) {
      // handled
    }
  }, []);

  const updateGym = useCallback(async (patch) => {
    setGym((prev) => ({ ...prev, ...patch }));
    try {
      const windows = [patch.warn7, patch.warn3, patch.warn1].filter((w) => typeof w === "number" && w > 0);
      await api.settings.update({
        gymName: patch.name,
        reminderWindows: windows.length ? windows : undefined,
        inactivityDays: patch.inactive,
      });
    } catch (err) {
      // handled
    }
  }, []);

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
      loading,
      error,
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
      fetchCustomerDetail,
      addCustomer,
      editCustomer,
      deleteCustomer,
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
      refreshData: loadInitialData,
    }),
    [
      loading, error, customers, payments, packages, sessions, marks, savedMarks, attendanceLog, deductions, reviewed, gym, period, reports,
      sel, customerById, fetchCustomerDetail, addCustomer, editCustomer, deleteCustomer, setArchived, saveNotes, addMembership, addPayment, addCorrection,
      toggleMark, saveAttendance, upsertPackage, setPackageActive, isReviewed, markReviewed, updateGym, loadInitialData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
