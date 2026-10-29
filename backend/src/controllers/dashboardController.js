import { asyncHandler } from "../utils/asyncHandler.js";
import { getSettings } from "../services/settingsService.js";
import { dashboardSummary, sessionsToday } from "../services/dashboardService.js";
import { listReminders, reviewReminder } from "../services/reminderService.js";

export const summary = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await dashboardSummary({ period: req.query.period, settings });
  res.json({ data });
});

export const reminders = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ data: await listReminders(settings) });
});

export const review = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await reviewReminder(req.params.key, { actor: req.ownerId, settings });
  res.json({ data });
});

export const todaySessions = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  res.json({ data: await sessionsToday(settings) });
});
