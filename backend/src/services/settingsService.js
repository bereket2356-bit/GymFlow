import env from "../config/env.js";
import { Settings } from "../models/Settings.js";
import { recordAudit, shallowDiff } from "./auditService.js";
import { badRequest } from "../utils/errors.js";

export function defaultSettings() {
  return {
    gymName: env.gymName,
    currency: env.currency,
    timezone: env.timezone,
    reminderWindows: env.reminderWindows,
    inactivityDays: env.inactivityDays,
    dateCountingRule: env.dateCountingRule,
  };
}

/** The singleton is created from configuration the first time it is read. */
export async function getSettings() {
  let settings = await Settings.findOne({ singleton: "settings" });
  if (!settings) {
    try {
      settings = await Settings.create({ singleton: "settings", ...defaultSettings() });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      settings = await Settings.findOne({ singleton: "settings" });
    }
  }
  return settings;
}

export async function updateSettings(patch, actor) {
  const settings = await getSettings();
  const before = settings.toObject();

  if (patch.gymName !== undefined) settings.gymName = patch.gymName;
  if (patch.currency !== undefined) settings.currency = patch.currency;
  if (patch.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: patch.timezone }).format(new Date());
    } catch {
      throw badRequest(`timezone "${patch.timezone}" is not a valid IANA timezone.`);
    }
    settings.timezone = patch.timezone;
  }
  if (patch.reminderWindows !== undefined) {
    const windows = [...new Set(patch.reminderWindows.map(Number))].sort((a, b) => b - a);
    settings.reminderWindows = windows;
  }
  if (patch.inactivityDays !== undefined) settings.inactivityDays = patch.inactivityDays;
  if (patch.dateCountingRule !== undefined) settings.dateCountingRule = patch.dateCountingRule;

  await settings.save();

  const after = settings.toObject();
  await recordAudit({
    actor,
    action: "settings.update",
    entityType: "Settings",
    entityId: String(settings._id),
    before,
    after,
  });

  return { settings, changes: shallowDiff(before, after) };
}
