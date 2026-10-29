import env from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { login as loginOwner } from "../services/authService.js";
import { serializeOwner } from "../services/serialize.js";

const COOKIE_OPTIONS = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict",
  path: "/",
});

export const login = asyncHandler(async (req, res) => {
  const { token, owner } = await loginOwner(req.body.email, req.body.password);
  res.cookie(env.cookieName, token, { ...COOKIE_OPTIONS(), maxAge: env.sessionMaxAgeMs });
  res.json({ data: { owner } });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(env.cookieName, COOKIE_OPTIONS());
  res.json({ data: { loggedOut: true } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ data: { owner: serializeOwner(req.owner) } });
});
