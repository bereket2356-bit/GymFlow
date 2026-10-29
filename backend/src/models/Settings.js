import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "settings", unique: true, immutable: true },
    gymName: { type: String, required: true, trim: true, maxlength: 120 },
    currency: { type: String, required: true, uppercase: true, trim: true, maxlength: 3 },
    timezone: { type: String, required: true, trim: true },
    reminderWindows: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((n) => Number.isInteger(n) && n >= 1 && n <= 365)
          );
        },
        message: "reminderWindows must be a non-empty list of day counts between 1 and 365.",
      },
    },
    inactivityDays: { type: Number, required: true, min: 1, max: 365 },
    dateCountingRule: {
      type: String,
      enum: ["start_day_is_day_one", "start_day_is_day_zero"],
      required: true,
    },
  },
  { timestamps: true },
);

settingsSchema.set("toJSON", { versionKey: false });

export const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
