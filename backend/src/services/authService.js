import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { Owner } from "../models/Owner.js";
import { serializeOwner } from "./serialize.js";
import { recordAudit } from "./auditService.js";
import { badRequest, unauthenticated, emailTaken } from "../utils/errors.js";
import { logger, maskPhone } from "../utils/logger.js";

const BCRYPT_COST = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function login(email, password) {
  const owner = await Owner.findOne({ email: String(email).toLowerCase().trim() }).select("+passwordHash");
  // Always compare against something so a missing account and a bad password
  // take comparable time and share the same generic error.
  const hash = owner?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hash);
  if (!owner || !valid) {
    logger.warn({ email: String(email).slice(0, 3) + "***" }, "Failed owner login");
    throw unauthenticated("Email or password is incorrect.");
  }

  owner.lastLoginAt = new Date();
  await owner.save();

  const token = jwt.sign(
    { sub: String(owner._id), role: owner.role, tokenVersion: owner.tokenVersion ?? 0 },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: "bgms",
    },
  );

  return { token, owner: serializeOwner(owner) };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: "bgms" });
  } catch {
    throw unauthenticated("Your session has expired. Sign in again.");
  }
}

export async function getOwnerById(id) {
  const owner = await Owner.findById(id);
  if (!owner) throw unauthenticated("Your session is no longer valid.");
  return serializeOwner(owner);
}

export async function createOwner({ email, password, name, displayName, phone }) {
  const existing = await Owner.findOne({ email: String(email).toLowerCase() });
  if (existing) return existing;
  return Owner.create({
    email,
    passwordHash: await hashPassword(password),
    name,
    displayName: displayName ?? null,
    phone: phone ?? null,
    role: "owner",
  });
}

export async function updateProfile(ownerId, payload, { actor } = {}) {
  const owner = await Owner.findById(ownerId).select("+passwordHash");
  if (!owner) throw unauthenticated("Your session is no longer valid.");

  const before = {
    name: owner.name,
    displayName: owner.displayName,
    email: owner.email,
    phone: owner.phone,
  };

  if (payload.email && payload.email.toLowerCase() !== owner.email.toLowerCase()) {
    if (!payload.currentPassword) {
      throw badRequest("Current password is required to change your email address.");
    }
    const valid = await bcrypt.compare(payload.currentPassword, owner.passwordHash);
    if (!valid) {
      throw unauthenticated("Current password is incorrect.");
    }
    const existing = await Owner.findOne({
      email: payload.email.toLowerCase(),
      _id: { $ne: owner._id },
    });
    if (existing) {
      throw emailTaken();
    }
    owner.email = payload.email.toLowerCase();
  }

  if (payload.name !== undefined) owner.name = payload.name;
  if (payload.displayName !== undefined) owner.displayName = payload.displayName || null;
  if (payload.phone !== undefined) owner.phone = payload.phone || null;

  await owner.save();

  await recordAudit({
    actor: actor || owner._id,
    action: "owner.update_profile",
    entityType: "Owner",
    entityId: owner._id,
    before,
    after: {
      name: owner.name,
      displayName: owner.displayName,
      email: owner.email,
      phone: owner.phone,
    },
  });

  return serializeOwner(owner);
}

export async function changePassword(ownerId, { currentPassword, newPassword }, { actor } = {}) {
  const owner = await Owner.findById(ownerId).select("+passwordHash");
  if (!owner) throw unauthenticated("Your session is no longer valid.");

  const valid = await bcrypt.compare(currentPassword, owner.passwordHash);
  if (!valid) {
    throw unauthenticated("Current password is incorrect.");
  }

  if (currentPassword === newPassword || (await bcrypt.compare(newPassword, owner.passwordHash))) {
    throw badRequest("New password cannot match current password.");
  }

  if (
    !newPassword ||
    newPassword.length < 12 ||
    !/[a-zA-Z]/.test(newPassword) ||
    !/\d/.test(newPassword)
  ) {
    throw badRequest(
      "New password must be at least 12 characters and include at least one letter and one number.",
    );
  }

  owner.passwordHash = await hashPassword(newPassword);
  await owner.save();

  await recordAudit({
    actor: actor || owner._id,
    action: "owner.change_password",
    entityType: "Owner",
    entityId: owner._id,
    before: null,
    after: null,
  });

  return { success: true, message: "Password updated" };
}

export async function signOutAll(ownerId, currentPassword, { actor } = {}) {
  const owner = await Owner.findById(ownerId).select("+passwordHash");
  if (!owner) throw unauthenticated("Your session is no longer valid.");

  const valid = await bcrypt.compare(currentPassword, owner.passwordHash);
  if (!valid) {
    throw unauthenticated("Current password is incorrect.");
  }

  owner.tokenVersion = (owner.tokenVersion || 0) + 1;
  await owner.save();

  await recordAudit({
    actor: actor || owner._id,
    action: "owner.sign_out_all",
    entityType: "Owner",
    entityId: owner._id,
    before: null,
    after: null,
  });

  return { signedOutAll: true };
}

export { maskPhone };
