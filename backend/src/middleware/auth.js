import env from "../config/env.js";
import { verifyToken } from "../services/authService.js";
import { Owner } from "../models/Owner.js";
import { unauthenticated } from "../utils/errors.js";

/** Every API route except login and health runs behind this guard. */
export async function requireOwner(req, _res, next) {
  try {
    const token = req.cookies?.[env.cookieName];
    if (!token) throw unauthenticated("Authentication required.");
    const payload = verifyToken(token);
    const owner = await Owner.findById(payload.sub);
    if (!owner || owner.role !== "owner") throw unauthenticated("Your session is no longer valid.");
    req.owner = owner;
    req.ownerId = owner._id;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireOwner;
