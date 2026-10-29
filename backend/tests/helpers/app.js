import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app.js";
import { Owner } from "../../src/models/Owner.js";
import { hashPassword } from "../../src/services/authService.js";
import { clearDatabase } from "./setup.js";
import { todayInTimeZone, addDaysISO, toISODate } from "../../src/utils/dates.js";

export const app = createApp();

export const OWNER = {
  email: "owner@test.example",
  password: "correct-horse-battery-staple",
  name: "Test Owner",
};

export async function resetDb() {
  await clearDatabase();
  await Owner.deleteMany({});
}

export async function login(agent = request.agent(app), overrides = {}) {
  const email = overrides.email ?? OWNER.email;
  const password = overrides.password ?? OWNER.password;
  const response = await agent.post("/api/v1/auth/login").send({ email, password });
  return { agent, response };
}

/** Ensure an owner exists, then return a logged-in supertest agent. */
export async function signedInAgent() {
  const existing = await Owner.findOne({ email: OWNER.email });
  if (!existing) {
    await Owner.create({
      email: OWNER.email,
      passwordHash: await hashPassword(OWNER.password),
      name: OWNER.name,
      role: "owner",
    });
  }
  const agent = request.agent(app);
  const { response } = await login(agent);
  if (response.status !== 200) {
    throw new Error(`Login failed in test setup: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

export function today() {
  return todayInTimeZone("UTC");
}

export function shift(days) {
  return addDaysISO(today(), days);
}

export async function createPackage(agent, overrides = {}) {
  const payload = {
    name: overrides.name ?? `Package ${Math.random().toString(36).slice(2, 8)}`,
    description: "Test package",
    type: "time",
    validityValue: 30,
    validityUnit: "days",
    sessionAllowance: 10,
    price: 100,
    ...overrides,
  };
  const response = await agent.post("/api/v1/packages").send(payload);
  if (response.status !== 201) {
    throw new Error(`Package create failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.package;
}

export async function createCustomer(agent, overrides = {}) {
  const payload = {
    name: overrides.name ?? "Test Customer",
    phone: overrides.phone ?? "+251 911 000 111",
    ...overrides,
  };
  const response = await agent.post("/api/v1/customers").send(payload);
  if (response.status !== 201) {
    throw new Error(`Customer create failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.customer;
}

export async function createMembership(agent, customer, pkg, overrides = {}) {
  const response = await agent
    .post(`/api/v1/customers/${customer.id}/memberships`)
    .send({ packageId: pkg.id, startDate: toISODate(new Date()), ...overrides });
  if (response.status !== 201) {
    throw new Error(`Membership create failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.membership;
}

export async function createSession(agent, overrides = {}) {
  const payload = {
    title: "Test session",
    startsAt: `${today()}T18:00:00.000Z`,
    durationMinutes: 60,
    capacity: 10,
    ...overrides,
  };
  const response = await agent.post("/api/v1/sessions").send(payload);
  if (response.status !== 201) {
    throw new Error(`Session create failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.session;
}

export async function recordPayment(agent, payload) {
  return agent.post("/api/v1/payments").send(payload);
}

export { mongoose, request };
