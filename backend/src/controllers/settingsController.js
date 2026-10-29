import { asyncHandler } from "../utils/asyncHandler.js";
import { getSettings, updateSettings } from "../services/settingsService.js";

function serialize(settings) {
  return {
    gymName: settings.gymName,
    currency: settings.currency,
    timezone: settings.timezone,
    reminderWindows: [...settings.reminderWindows].sort((a, b) => b - a),
    inactivityDays: settings.inactivityDays,
    dateCountingRule: settings.dateCountingRule,
    updatedAt: settings.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
  };
}

export const read = asyncHandler(async (_req, res) => {
  res.json({ data: { settings: serialize(await getSettings()) } });
});

export const update = asyncHandler(async (req, res) => {
  const { settings, changes } = await updateSettings(req.body, req.ownerId);
  res.json({ data: { settings: serialize(settings), changes } });
});
