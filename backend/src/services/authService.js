import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { Owner } from "../models/Owner.js";
import { serializeOwner } from "./serialize.js";
import { unauthenticated } from "../utils/errors.js";
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

  const token = jwt.sign({ sub: String(owner._id), role: owner.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: "bgms",
  });

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

export async function createOwner({ email, password, name }) {
  const existing = await Owner.findOne({ email: String(email).toLowerCase() });
  if (existing) return existing;
  return Owner.create({
    email,
    passwordHash: await hashPassword(password),
    name,
    role: "owner",
  });
}

export { maskPhone };
