import { beforeEach, describe, expect, it } from "vitest";
import { app, OWNER, resetDb, request, signedInAgent } from "../helpers/app.js";
import { Owner } from "../../src/models/Owner.js";
import { AuditLog } from "../../src/models/AuditLog.js";

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

  it("returns profile fields including avatar initials from /auth/me", async () => {
    const agent = await signedInAgent();
    const response = await agent.get("/api/v1/auth/me");
    expect(response.status).toBe(200);
    const { owner } = response.body.data;
    expect(owner.name).toBe(OWNER.name);
    expect(owner.email).toBe(OWNER.email);
    expect(owner.displayName).toBeNull();
    expect(owner.avatarInitials).toBeTruthy();
  });

  it("updates owner profile fields and records an audit log", async () => {
    const agent = await signedInAgent();
    const update = await agent.patch("/api/v1/auth/me").send({
      name: "Bereket Tadesse",
      displayName: "Berry",
      phone: "+251 911 223 344",
    });
    expect(update.status).toBe(200);
    expect(update.body.data.owner.name).toBe("Bereket Tadesse");
    expect(update.body.data.owner.displayName).toBe("Berry");
    expect(update.body.data.owner.phone).toBe("+251 911 223 344");
    expect(update.body.data.owner.avatarInitials).toBe("BE");

    const audit = await AuditLog.findOne({ action: "owner.update_profile" });
    expect(audit).toBeTruthy();
    expect(audit.after.displayName).toBe("Berry");
  });

  it("requires current password when changing email, and rejects duplicate email with 409", async () => {
    const agent = await signedInAgent();

    // Create a second owner in the database to trigger duplicate
    await Owner.create({
      name: "Second Owner",
      email: "second@gymflow.local",
      passwordHash: "hash",
      role: "owner",
    });

    // Attempt to change without current password
    const noPass = await agent.patch("/api/v1/auth/me").send({ email: "second@gymflow.local" });
    expect(noPass.status).toBe(400);

    // Attempt to change with wrong current password
    const wrongPass = await agent
      .patch("/api/v1/auth/me")
      .send({ email: "second@gymflow.local", currentPassword: "wrong" });
    expect(wrongPass.status).toBe(401);

    // Attempt to change with duplicate email
    const duplicate = await agent
      .patch("/api/v1/auth/me")
      .send({ email: "second@gymflow.local", currentPassword: OWNER.password });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_TAKEN");

    // Success email change
    const success = await agent
      .patch("/api/v1/auth/me")
      .send({ email: "newemail@gymflow.local", currentPassword: OWNER.password });
    expect(success.status).toBe(200);
    expect(success.body.data.owner.email).toBe("newemail@gymflow.local");
  });

  it("changes password with complexity checks, rejects wrong or reused password", async () => {
    const agent = await signedInAgent();

    // Wrong current password
    const wrongCurrent = await agent.post("/api/v1/auth/change-password").send({
      currentPassword: "wrong-password",
      newPassword: "BrandNewPassword123!",
    });
    expect(wrongCurrent.status).toBe(401);

    // Weak new password (too short)
    const tooShort = await agent.post("/api/v1/auth/change-password").send({
      currentPassword: OWNER.password,
      newPassword: "short1",
    });
    expect(tooShort.status).toBe(400);

    // Reused password
    const reused = await agent.post("/api/v1/auth/change-password").send({
      currentPassword: OWNER.password,
      newPassword: OWNER.password,
    });
    expect(reused.status).toBe(400);

    // Success change
    const updated = await agent.post("/api/v1/auth/change-password").send({
      currentPassword: OWNER.password,
      newPassword: "StrongNewPassword123",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.message).toBe("Password updated");

    // Current session remains valid
    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(200);

    // Can log in with new password
    const loginNew = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: OWNER.email, password: "StrongNewPassword123" });
    expect(loginNew.status).toBe(200);

    // Old password fails
    const loginOld = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: OWNER.email, password: OWNER.password });
    expect(loginOld.status).toBe(401);
  });

  it("signs out of all sessions, increments tokenVersion and invalidates existing tokens", async () => {
    const agent = await signedInAgent();
    const otherAgent = await signedInAgent();

    // Wrong password fails
    const wrong = await agent.post("/api/v1/auth/sign-out-all").send({ currentPassword: "wrong" });
    expect(wrong.status).toBe(401);

    // Successful sign out all
    const res = await agent.post("/api/v1/auth/sign-out-all").send({ currentPassword: OWNER.password });
    expect(res.status).toBe(200);
    expect(res.body.data.signedOutAll).toBe(true);

    // Calling device cookie was cleared
    const after = await agent.get("/api/v1/auth/me");
    expect(after.status).toBe(401);
    expect(after.body.error.message).toBe("Authentication required.");

    // Other active session with prior tokenVersion is invalidated
    const otherAfter = await otherAgent.get("/api/v1/auth/me");
    expect(otherAfter.status).toBe(401);
    expect(otherAfter.body.error.message).toBe("Your session is no longer valid.");
  });
});
