import { beforeEach, describe, expect, it } from "vitest";
import {
  createCustomer,
  createMembership,
  createPackage,
  createSession,
  resetDb,
  signedInAgent,
  today,
} from "../helpers/app.js";

let agent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});

async function mark(agent, session, entries) {
  return agent.put(`/api/v1/sessions/${session.id}/attendance`).send({ entries });
}

describe("attendance and session deduction", () => {
  it("deducts once, never twice, and restores on change", async () => {
    const pkg = await createPackage(agent, {
      name: "4-Session Pack",
      type: "session",
      sessionAllowance: 4,
      price: 100,
    });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);
    const session = await createSession(agent);

    expect(membership.sessionsRemaining).toBe(4);

    const first = await mark(agent, session, [{ customerId: customer.customerId, status: "present" }]);
    expect(first.status).toBe(200);
    expect(first.body.data.deducted).toBe(1);

    let current = await agent.get(`/api/v1/memberships/${membership.id}`);
    expect(current.body.data.membership.sessionsRemaining).toBe(3);
    expect(current.body.data.membership.sessionsUsed).toBe(1);

    const repeat = await mark(agent, session, [{ customerId: customer.customerId, status: "present" }]);
    expect(repeat.body.data.deducted).toBe(0);

    current = await agent.get(`/api/v1/memberships/${membership.id}`);
    expect(current.body.data.membership.sessionsRemaining).toBe(3);

    const absent = await mark(agent, session, [{ customerId: customer.customerId, status: "absent" }]);
    expect(absent.body.data.restored).toBe(1);
    current = await agent.get(`/api/v1/memberships/${membership.id}`);
    expect(current.body.data.membership.sessionsRemaining).toBe(4);

    const late = await mark(agent, session, [{ customerId: customer.customerId, status: "late" }]);
    expect(late.body.data.deducted).toBe(1);
    const attendance = await agent.get(`/api/v1/sessions/${session.id}/attendance`);
    expect(attendance.body.data.attendance).toHaveLength(1);
    expect(attendance.body.data.attendance[0].deducted).toBe(true);
  });

  it("does not deduct for time-based memberships", async () => {
    const pkg = await createPackage(agent, { type: "time", price: 100 });
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, pkg);
    const session = await createSession(agent);

    const response = await mark(agent, session, [{ customerId: customer.customerId, status: "present" }]);
    expect(response.status).toBe(200);
    expect(response.body.data.deducted).toBe(0);
  });

  it("supports bulk entries and rejects cancelled sessions", async () => {
    const customerA = await createCustomer(agent, { name: "A Person" });
    const customerB = await createCustomer(agent, { name: "B Person" });
    const session = await createSession(agent);

    const response = await mark(agent, session, [
      { customerId: customerA.customerId, status: "present" },
      { customerId: customerB.customerId, status: "absent" },
    ]);
    expect(response.body.data.updated).toBe(2);

    await agent.post(`/api/v1/sessions/${session.id}/cancel`);
    const rejected = await mark(agent, session, [{ customerId: customerA.customerId, status: "present" }]);
    expect(rejected.status).toBe(422);
  });

  it("rejects unknown customers and empty batches", async () => {
    const session = await createSession(agent);
    const unknown = await mark(agent, session, [{ customerId: "CUS-9999", status: "present" }]);
    expect(unknown.status).toBe(404);

    const empty = await mark(agent, session, []);
    expect(empty.status).toBe(400);
  });
});

describe("package lifecycle", () => {
  it("versions edits and never rewrites existing memberships", async () => {
    const pkg = await createPackage(agent, { price: 100 });
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, pkg);

    const first = await agent.get(`/api/v1/packages/${pkg.id}`);
    expect(first.body.data.versions).toHaveLength(1);

    const updated = await agent.patch(`/api/v1/packages/${pkg.id}`).send({
      price: 150,
      name: "Renamed Package",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.package.version).toBe(2);

    const second = await agent.get(`/api/v1/packages/${pkg.id}`);
    expect(second.body.data.versions).toHaveLength(2);
    expect(second.body.data.versions[0].changedFields).toEqual(
      expect.arrayContaining(["priceCents", "name"]),
    );
    expect(second.body.data.package.affectedMembershipCount).toBe(1);
  });

  it("requires confirmation for structural changes with active memberships", async () => {
    const pkg = await createPackage(agent, { type: "time", sessionAllowance: 5 });
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, pkg);

    const blocked = await agent.patch(`/api/v1/packages/${pkg.id}`).send({ type: "session" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.confirmRequired).toBe(true);
    expect(blocked.body.error.details.affectedMembershipCount).toBe(1);

    const confirmed = await agent
      .patch(`/api/v1/packages/${pkg.id}`)
      .send({ type: "session", sessionAllowance: 12, confirm: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.package.type).toBe("session");
  });

  it("deactivates only after confirmation, blocking new memberships", async () => {
    const pkg = await createPackage(agent);
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, pkg);

    const blocked = await agent.post(`/api/v1/packages/${pkg.id}/deactivate`).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.affectedMembershipCount).toBe(1);

    const confirmed = await agent.post(`/api/v1/packages/${pkg.id}/deactivate`).send({ confirm: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.package.status).toBe("inactive");
    expect(confirmed.body.data.affectedMembershipCount).toBe(1);

    const other = await createCustomer(agent, { name: "Another Person" });
    const rejected = await agent
      .post(`/api/v1/customers/${other.id}/memberships`)
      .send({ packageId: pkg.id });
    expect(rejected.status).toBe(422);

    const reactivated = await agent.post(`/api/v1/packages/${pkg.id}/activate`).send({});
    expect(reactivated.body.data.package.status).toBe("active");
  });

  it("refuses to delete a referenced package but deletes an unused one", async () => {
    const used = await createPackage(agent, { name: "Used Package" });
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, used);

    const blocked = await agent.delete(`/api/v1/packages/${used.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.membershipCount).toBe(1);

    const unused = await createPackage(agent, { name: "Unused Package" });
    const deleted = await agent.delete(`/api/v1/packages/${unused.id}`);
    expect(deleted.status).toBe(200);

    const missing = await agent.get(`/api/v1/packages/${unused.id}`);
    expect(missing.status).toBe(404);
  });

  it("filters and searches the catalogue", async () => {
    await createPackage(agent, { name: "Alpha Time", type: "time" });
    await createPackage(agent, { name: "Beta Sessions", type: "session" });

    const sessions = await agent.get("/api/v1/packages?type=session");
    expect(sessions.body.data).toHaveLength(1);
    expect(sessions.body.data[0].name).toBe("Beta Sessions");

    const search = await agent.get("/api/v1/packages?search=alpha");
    expect(search.body.data).toHaveLength(1);
  });
});

describe("expenses", () => {
  it("records immutable expenses and appends adjustments", async () => {
    const created = await agent
      .post("/api/v1/expenses")
      .send({ category: "Equipment", description: "Gloves", amount: 100, incurredOn: today() });
    expect(created.status).toBe(201);
    const expense = created.body.data.expense;

    const patch = await agent.patch(`/api/v1/expenses/${expense.id}`).send({ amount: 1 });
    expect(patch.status).toBe(404);
    const remove = await agent.delete(`/api/v1/expenses/${expense.id}`);
    expect(remove.status).toBe(404);

    const adjustment = await agent
      .post(`/api/v1/expenses/${expense.id}/adjustments`)
      .send({ amount: -25, reason: "Returned pair" });
    expect(adjustment.status).toBe(201);
    expect(adjustment.body.data.netAmount).toBe(75);

    const list = await agent.get("/api/v1/expenses");
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].netAmount).toBe(75);
  });
});
