import { beforeEach, describe, expect, it } from "vitest";
import { app, OWNER, resetDb, request, signedInAgent } from "../helpers/app.js";

beforeEach(async () => {
  await resetDb();
});

describe("health", () => {
  it("reports status and database state", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.database).toBe("connected");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("checks the database for readiness", async () => {
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body.data.ping).toBe(true);
  });
});

describe("auth", () => {
  it("logs in with an httpOnly SameSite=Strict cookie and no token in the body", async () => {
    const owner = await signedInAgent();
    expect(owner).toBeTruthy();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: OWNER.email, password: OWNER.password });

    expect(response.status).toBe(200);
    expect(response.body.data.owner.email).toBe(OWNER.email);
    expect(JSON.stringify(response.body)).not.toContain("token");
    const cookie = response.headers["set-cookie"].join(";");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("rejects unauthenticated API calls", async () => {
    const response = await request(app).get("/api/v1/customers");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the signed-in owner from /auth/me", async () => {
    const agent = await signedInAgent();
    const response = await agent.get("/api/v1/auth/me");
    expect(response.status).toBe(200);
    expect(response.body.data.owner.email).toBe(OWNER.email);
    expect(response.body.data.owner.passwordHash).toBeUndefined();
  });

  it("clears the cookie on logout", async () => {
    const agent = await signedInAgent();
    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(200);
    const after = await agent.get("/api/v1/auth/me");
    expect(after.status).toBe(401);
  });

  it("fails with a generic message for wrong credentials", async () => {
    await signedInAgent();
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: OWNER.email, password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Email or password is incorrect.");
  });

  it("validates input and rejects unknown fields", async () => {
    const missing = await request(app).post("/api/v1/auth/login").send({ email: OWNER.email });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");

    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: OWNER.email, password: "x", extra: true });
    expect(unknown.status).toBe(400);
  });

  it("rejects Mongo operator keys", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: { $ne: null }, password: "x" });
    expect(response.status).toBe(400);
  });

  it("returns a structured 404 for unknown routes", async () => {
    const agent = await signedInAgent();
    const response = await agent.get("/api/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
