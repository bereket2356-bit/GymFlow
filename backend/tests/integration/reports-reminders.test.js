import { beforeEach, describe, expect, it } from "vitest";
import { Membership } from "../../src/models/Membership.js";
import {
  createCustomer,
  createMembership,
  createPackage,
  createSession,
  recordPayment,
  resetDb,
  signedInAgent,
  shift,
  today,
} from "../helpers/app.js";

let agent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});

async function baseScenario() {
  const pkg = await createPackage(agent, { name: "Report Monthly", price: 200 });
  const c1 = await createCustomer(agent, { name: "Cash Customer" });
  const m1 = await createMembership(agent, c1, pkg);
  await recordPayment(agent, {
    customerId: c1.id,
    membershipId: m1.id,
    amount: 50,
    method: "cash",
    reference: "=1+1",
  });

  const pkg2 = await createPackage(agent, { name: "Owing Monthly", price: 100 });
  const c2 = await createCustomer(agent, { name: "Owing Customer" });
  await createMembership(agent, c2, pkg2);
  return { pkg, pkg2, c1, c2, m1 };
}

describe("reports", () => {
  it("keeps cash, membership value and outstanding separate", async () => {
    await baseScenario();
    const response = await agent.get(`/api/v1/reports/summary?from=${shift(-6)}&to=${today()}`);
    expect(response.status).toBe(200);
    expect(response.body.data.cashReceived).toBe(50);
    expect(response.body.data.membershipValue).toBe(300);
    expect(response.body.data.outstanding).toBe(250);
    expect(response.body.data.newCustomers).toBe(2);
    expect(response.body.data.range).toEqual({ from: shift(-6), to: today() });
  });

  it("rejects an inverted date range", async () => {
    const response = await agent.get(`/api/v1/reports/summary?from=${today()}&to=${shift(-5)}`);
    expect(response.status).toBe(400);
  });

  it("returns a weekly cash series", async () => {
    await baseScenario();
    const response = await agent.get("/api/v1/reports/payments-by-week?weeks=4");
    expect(response.status).toBe(200);
    expect(response.body.data.weeks).toHaveLength(4);
    expect(response.body.data.total).toBe(50);
  });

  it("builds a 7 x 4 attendance heatmap from sessions", async () => {
    const { c1 } = await baseScenario();
    const session = await createSession(agent);
    await agent
      .put(`/api/v1/sessions/${session.id}/attendance`)
      .send({ entries: [{ customerId: c1.customerId, status: "present" }] });

    const response = await agent.get("/api/v1/reports/attendance-heatmap");
    expect(response.status).toBe(200);
    expect(response.body.data.cells).toHaveLength(28);
    expect(response.body.data.maxCount).toBe(1);
    const todayCell = response.body.data.cells.find((cell) => cell.date === today());
    expect(todayCell.count).toBe(1);
  });

  it("lists outstanding balances with membership detail", async () => {
    await baseScenario();
    const response = await agent.get("/api/v1/reports/outstanding");
    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(250);
    expect(response.body.data.rows).toHaveLength(2);
    expect(response.body.data.rows[0].balance).toBe(150);
  });

  it("exports CSV and neutralises formula cells", async () => {
    await baseScenario();
    const payments = await agent.get(`/api/v1/reports/export.csv?type=payments&from=${shift(-6)}&to=${today()}`);
    expect(payments.status).toBe(200);
    expect(payments.headers["content-type"]).toContain("text/csv");
    expect(payments.text).toContain("'=1+1");

    const summary = await agent.get(`/api/v1/reports/export.csv?type=summary&from=${shift(-6)}&to=${today()}`);
    expect(summary.text).toContain("Cash received");
    expect(summary.text).toContain('"50.00"');
    expect(summary.text).toContain('"300.00"');

    const bad = await agent.get("/api/v1/reports/export.csv?type=nope");
    expect(bad.status).toBe(400);
  });
});

describe("reminders", () => {
  async function reminderScenario() {
    const pkg = await createPackage(agent, { name: "Reminder Monthly", price: 180 });
    const expiring = await createCustomer(agent, { name: "Expiring Member" });
    await createMembership(agent, expiring, pkg, { startDate: shift(-27) });

    const lapsed = await createCustomer(agent, { name: "Lapsed Member" });
    await createMembership(agent, lapsed, pkg, { startDate: shift(-40) });

    const packPkg = await createPackage(agent, {
      name: "Reminder Sessions",
      type: "session",
      sessionAllowance: 4,
      price: 100,
    });
    const exhausted = await createCustomer(agent, { name: "Exhausted Member" });
    const pack = await createMembership(agent, exhausted, packPkg);
    await Membership.updateOne(
      { _id: pack.id },
      { $set: { sessionsUsed: 4, sessionsRemaining: 0, state: "exhausted" } },
    );

    const inactive = await createCustomer(agent, {
      name: "Inactive Member",
      registeredAt: shift(-30),
    });
    const inactiveMembership = await createMembership(agent, inactive, pkg, { startDate: shift(-20) });
    return { expiring, lapsed, exhausted, inactive, inactiveMembership };
  }

  it("derives expiry, expired, balance, sessions and inactivity reminders", async () => {
    await reminderScenario();
    const response = await agent.get("/api/v1/dashboard/reminders");
    expect(response.status).toBe(200);
    const types = new Set(response.body.data.reminders.map((reminder) => reminder.type));
    expect(types.has("expiry")).toBe(true);
    expect(types.has("expired")).toBe(true);
    expect(types.has("balance")).toBe(true);
    expect(types.has("sessions")).toBe(true);
    expect(types.has("inactive")).toBe(true);

    const expiry = response.body.data.reminders.find((reminder) => reminder.type === "expiry");
    expect(expiry.rule).toBe("3-day window");
    expect(expiry.key).toMatch(/^expiry:CUS-\d+$/);
    expect(expiry.reviewed).toBe(false);
  });

  it("records a review without touching the underlying record", async () => {
    const { expiring } = await reminderScenario();
    const before = await agent.get("/api/v1/dashboard/reminders");
    const key = before.body.data.reminders.find(
      (reminder) => reminder.type === "expiry" && reminder.customer.name === "Expiring Member",
    ).key;

    const viewed = await agent.get(`/api/v1/customers/${expiring.id}`);
    const stateBefore = viewed.body.data.memberships[0].state;

    const review = await agent.post(`/api/v1/dashboard/reminders/${encodeURIComponent(key)}/review`);
    expect(review.status).toBe(200);
    expect(review.body.data.reviewed).toBe(true);

    const after = await agent.get("/api/v1/dashboard/reminders");
    const reviewed = after.body.data.reminders.find((reminder) => reminder.key === key);
    expect(reviewed.reviewed).toBe(true);
    expect(after.body.data.counts.reviewed).toBeGreaterThanOrEqual(1);

    const viewedAfter = await agent.get(`/api/v1/customers/${expiring.id}`);
    expect(viewedAfter.body.data.memberships[0].state).toBe(stateBefore);
  });

  it("rejects reviewing a key that is not a current reminder", async () => {
    const response = await agent.post("/api/v1/dashboard/reminders/expiry:CUS-9999/review");
    expect(response.status).toBe(404);
  });
});

describe("dashboard", () => {
  it("summarises customers, memberships, cash and outstanding balances", async () => {
    await baseScenario();
    const response = await agent.get("/api/v1/dashboard/summary");
    expect(response.status).toBe(200);
    expect(response.body.data.customers.total).toBe(2);
    expect(response.body.data.customers.live).toBe(2);
    expect(response.body.data.cashReceived).toBe(50);
    expect(response.body.data.outstanding).toBe(250);
    expect(response.body.data.memberships.active).toBe(2);
    expect(response.body.data.reminders.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data.range.from).toBe(`${today().slice(0, 7)}-01`);
  });

  it("lists today's sessions with booked counts", async () => {
    const { c1 } = await baseScenario();
    const session = await createSession(agent, { title: "Evening class" });
    await agent
      .put(`/api/v1/sessions/${session.id}/attendance`)
      .send({ entries: [{ customerId: c1.customerId, status: "present" }] });

    const response = await agent.get("/api/v1/dashboard/sessions-today");
    expect(response.status).toBe(200);
    expect(response.body.data.sessions).toHaveLength(1);
    expect(response.body.data.sessions[0].booked).toBe(1);
  });
});

describe("settings and audit", () => {
  it("updates settings and writes an audit entry", async () => {
    const before = await agent.get("/api/v1/settings");
    expect(before.status).toBe(200);
    expect(before.body.data.settings.reminderWindows).toEqual([7, 3, 1]);

    const update = await agent.patch("/api/v1/settings").send({
      reminderWindows: [10, 5, 2],
      inactivityDays: 21,
    });
    expect(update.status).toBe(200);
    expect(update.body.data.settings.reminderWindows).toEqual([10, 5, 2]);

    const audit = await agent.get("/api/v1/audit?entityType=Settings");
    expect(audit.status).toBe(200);
    expect(audit.body.data.length).toBeGreaterThanOrEqual(1);
    expect(audit.body.data[0].action).toBe("settings.update");
  });

  it("rejects invalid settings input", async () => {
    const bad = await agent.patch("/api/v1/settings").send({ timezone: "Mars/Olympus" });
    expect(bad.status).toBe(400);

    const empty = await agent.patch("/api/v1/settings").send({});
    expect(empty.status).toBe(400);
  });
});
