import { asyncHandler } from "../utils/asyncHandler.js";
import { getSettings } from "../services/settingsService.js";
import {
  cancelMembership,
  createMembership,
  getMembership,
  renewMembership,
} from "../services/membershipService.js";

export const createForCustomer = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await createMembership(req.params.id, req.body, { actor: req.ownerId, settings });
  res.status(201).json({ data });
});

export const renew = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await renewMembership(req.params.id, req.body, { actor: req.ownerId, settings });
  res.status(201).json({ data });
});

export const detail = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await getMembership(req.params.id, settings) });
});

export const cancel = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await cancelMembership(req.params.id, {
    reason: req.body.reason,
    actor: req.ownerId,
    settings,
  });
  res.json({ data });
});
