import { beforeEach, describe, expect, it } from "vitest";
import {
  createCustomer,
  createMembership,
  createPackage,
  createSession,
  resetDb,
  recordPayment,
  signedInAgent,
  shift,
  today,
} from "../helpers/app.js";

let agent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});

describe("customers", () => {
  it("creates and reads a customer, including private notes on detail only", async () => {
    const created = await createCustomer(agent, { name: "Amara Bekele", notes: "Private note" });
    expect(created.customerId).toMatch(/^CUS-\d+$/);
    expect(created.notes).toBe("Private note");

    const list = await agent.get("/api/v1/customers");
    expect(list.status).toBe(200);
    expect(list.body.data[0].notes).toBeUndefined();
    expect(list.body.meta.total).toBe(1);

    const detail = await agent.get(`/api/v1/customers/${created.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.customer.notes).toBe("Private note");
    expect(detail.body.data.summary.balance).toBe(0);
  });

  it("updates, archives and restores", async () => {
    const customer = await createCustomer(agent);
    const update = await agent.patch(`/api/v1/customers/${customer.id}`).send({ name: "Renamed Person" });
    expect(update.status).toBe(200);
    expect(update.body.data.customer.name).toBe("Renamed Person");

    const empty = await agent.patch(`/api/v1/customers/${customer.id}`).send({});
    expect(empty.status).toBe(400);

    const archive = await agent.post(`/api/v1/customers/${customer.id}/archive`);
    expect(archive.status).toBe(200);
    expect(archive.body.data.customer.status).toBe("archived");
    expect(archive.body.data.customer.archivedAt).toBeTruthy();

    const again = await agent.post(`/api/v1/customers/${customer.id}/archive`);
    expect(again.status).toBe(422);

    const restored = await agent.post(`/api/v1/customers/${customer.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.customer.status).toBe("active");
  });

  it("searches, sorts and paginates", async () => {
    await createCustomer(agent, { name: "Alpha One" });
    await createCustomer(agent, { name: "Beta Two" });
    await createCustomer(agent, { name: "Gamma Three" });

    const search = await agent.get("/api/v1/customers?search=beta");
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].name).toBe("Beta Two");

    const paged = await agent.get("/api/v1/customers?page=2&limit=2&sort=name");
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });

    const badSort = await agent.get("/api/v1/customers?sort=notes");
    expect(badSort.status).toBe(400);

    const tooBig = await agent.get("/api/v1/customers?limit=500");
    expect(tooBig.status).toBe(400);
  });

  it("blocks new memberships for archived customers", async () => {
    const pkg = await createPackage(agent);
    const customer = await createCustomer(agent);
    await agent.post(`/api/v1/customers/${customer.id}/archive`);
    const response = await agent
      .post(`/api/v1/customers/${customer.id}/memberships`)
      .send({ packageId: pkg.id });
    expect(response.status).toBe(422);
  });
});

describe("memberships", () => {
  it("snapshots package terms and computes expiry", async () => {
    const pkg = await createPackage(agent, { name: "Monthly", price: 180, validityValue: 30 });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg, { startDate: today() });

    expect(membership.startDate).toBe(today());
    expect(membership.expiryDate).toBe(shift(30));
    expect(membership.packageSnapshot.price).toBe(180);
    expect(membership.agreedPrice).toBe(180);
    expect(membership.status).toBe("active");
    expect(membership.paymentStatus).toBe("overdue");
  });

  it("keeps existing snapshots when the package changes", async () => {
    const pkg = await createPackage(agent, { name: "Monthly", price: 180 });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);

    const update = await agent
      .patch(`/api/v1/packages/${pkg.id}`)
      .send({ price: 250, confirm: true });
    expect(update.status).toBe(200);

    const detail = await agent.get(`/api/v1/memberships/${membership.id}`);
    expect(detail.body.data.membership.agreedPrice).toBe(180);
    expect(detail.body.data.membership.packageSnapshot.price).toBe(180);
  });

  it("requires confirmation when time-based memberships overlap", async () => {
    const pkg = await createPackage(agent);
    const customer = await createCustomer(agent);
    await createMembership(agent, customer, pkg);

    const conflict = await agent
      .post(`/api/v1/customers/${customer.id}/memberships`)
      .send({ packageId: pkg.id });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.details.confirmRequired).toBe(true);

    const confirmed = await agent
      .post(`/api/v1/customers/${customer.id}/memberships`)
      .send({ packageId: pkg.id, confirm: true });
    expect(confirmed.status).toBe(201);
  });

  it("renews into a new membership and keeps the old terms", async () => {
    const pkg = await createPackage(agent, { price: 180 });
    const customer = await createCustomer(agent);
    const original = await createMembership(agent, customer, pkg, { startDate: today() });

    const renewal = await agent.post(`/api/v1/memberships/${original.id}/renew`).send({});
    expect(renewal.status).toBe(201);
    const renewed = renewal.body.data.membership;
    expect(renewed.renewedFromId).toBe(original.id);
    expect(renewed.startDate).toBe(shift(31));
    expect(renewal.body.data.previous.state).toBe("renewed");

    const oldDetail = await agent.get(`/api/v1/memberships/${original.id}`);
    expect(oldDetail.body.data.membership.agreedPrice).toBe(180);
  });

  it("cancels a membership", async () => {
    const pkg = await createPackage(agent);
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);

    const cancel = await agent.post(`/api/v1/memberships/${membership.id}/cancel`).send({ reason: "Moved away" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.membership.status).toBe("cancelled");

    const twice = await agent.post(`/api/v1/memberships/${membership.id}/cancel`).send({});
    expect(twice.status).toBe(422);
  });
});

describe("payments", () => {
  it("records a payment, rejects overpayment and appends an adjustment", async () => {
    const pkg = await createPackage(agent, { price: 180 });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);

    const partial = await recordPayment(agent, {
      customerId: customer.id,
      membershipId: membership.id,
      amount: 120,
      method: "cash",
      reference: "CASH-1",
    });
    expect(partial.status).toBe(201);
    expect(partial.body.data.payment.amount).toBe(120);
    expect(partial.body.data.balance).toBe(60);

    const overpay = await recordPayment(agent, {
      customerId: customer.id,
      membershipId: membership.id,
      amount: 100,
      method: "card",
    });
    expect(overpay.status).toBe(422);
    expect(overpay.body.error.message).toContain("exceeds the outstanding balance");

    const adjustment = await agent
      .post(`/api/v1/payments/${partial.body.data.payment.id}/adjustments`)
      .send({ amount: -20, reason: "Partial refund" });
    expect(adjustment.status).toBe(201);
    expect(adjustment.body.data.balance).toBe(80);
    expect(adjustment.body.data.payment.netAmount).toBe(100);

    const overRefund = await agent
      .post(`/api/v1/payments/${partial.body.data.payment.id}/adjustments`)
      .send({ amount: -500, reason: "Too much" });
    expect(overRefund.status).toBe(422);

    const detail = await agent.get(`/api/v1/memberships/${membership.id}`);
    expect(detail.body.data.membership.balance).toBe(80);
    expect(detail.body.data.membership.paymentStatus).toBe("overdue");
  });

  it("exposes no update or delete endpoints for payments", async () => {
    const pkg = await createPackage(agent, { price: 50 });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);
    const payment = await recordPayment(agent, {
      customerId: customer.id,
      membershipId: membership.id,
      amount: 50,
      method: "cash",
    });
    const id = payment.body.data.payment.id;

    expect((await agent.patch(`/api/v1/payments/${id}`).send({ amount: 1 })).status).toBe(404);
    expect((await agent.delete(`/api/v1/payments/${id}`)).status).toBe(404);
  });

  it("lists payments with a signed net total", async () => {
    const pkg = await createPackage(agent, { price: 100 });
    const customer = await createCustomer(agent);
    const membership = await createMembership(agent, customer, pkg);
    await recordPayment(agent, {
      customerId: customer.id,
      membershipId: membership.id,
      amount: 60,
      method: "bank_transfer",
    });

    const list = await agent.get(`/api/v1/payments?customerId=${customer.id}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.netTotal).toBe(60);
  });
});

describe("ledger and attendance history", () => {
  it("builds a running ledger and a visit history", async () => {
    const pkg = await createPackage(agent, { price: 200 });
    const customer = await createCustomer(agent, { notes: "Owner only" });
    const membership = await createMembership(agent, customer, pkg);
    await recordPayment(agent, {
      customerId: customer.id,
      membershipId: membership.id,
      amount: 80,
      method: "cash",
    });

    const ledger = await agent.get(`/api/v1/customers/${customer.id}/ledger`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.data.entries).toHaveLength(2);
    expect(ledger.body.data.totals.agreed).toBe(200);
    expect(ledger.body.data.totals.paid).toBe(80);
    expect(ledger.body.data.totals.balance).toBe(120);
    expect(ledger.body.data.entries.at(-1).balanceAfter).toBe(120);

    const session = await createSession(agent);
    const mark = await agent
      .put(`/api/v1/sessions/${session.id}/attendance`)
      .send({ entries: [{ customerId: customer.customerId, status: "present" }] });
    expect(mark.status).toBe(200);

    const history = await agent.get(`/api/v1/customers/${customer.id}/attendance?days=30`);
    expect(history.status).toBe(200);
    expect(history.body.data.records).toHaveLength(1);
    expect(history.body.data.counts.present).toBe(1);
    expect(history.body.data.lastVisit).toBeTruthy();
  });
});
