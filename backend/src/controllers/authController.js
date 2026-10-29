import env from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  changePassword as changeOwnerPassword,
  login as loginOwner,
  signOutAll as signOutAllOwner,
  updateProfile as updateOwnerProfile,
} from "../services/authService.js";
import { serializeOwner } from "../services/serialize.js";

const COOKIE_OPTIONS = () => {
  if (env.isTest) {
    return {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "strict",
      path: "/",
    };
  }
  const isProd =
    env.isProduction ||
    process.env.RENDER === "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "strict",
    path: "/",
  };
};

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

export const updateProfile = asyncHandler(async (req, res) => {
  const owner = await updateOwnerProfile(req.ownerId, req.body, { actor: req.ownerId });
  res.json({ data: { owner } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await changeOwnerPassword(req.ownerId, req.body, { actor: req.ownerId });
  res.json({ data: result });
});

export const signOutAll = asyncHandler(async (req, res) => {
  const result = await signOutAllOwner(req.ownerId, req.body.currentPassword, { actor: req.ownerId });
  res.clearCookie(env.cookieName, COOKIE_OPTIONS());
  res.json({ data: result });
});
