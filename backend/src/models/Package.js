import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    type: { type: String, enum: ["time", "session", "both"], required: true },
    validityValue: { type: Number, required: true, min: 1, max: 365 },
    validityUnit: { type: String, enum: ["days", "weeks", "months", "years"], required: true },
    sessionAllowance: { type: Number, required: true, min: 1, max: 500 },
    priceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    version: { type: Number, default: 1, required: true },
  },
  { timestamps: true },
);

packageSchema.index({ status: 1, type: 1 });

export const Package = mongoose.model("Package", packageSchema);
export default Package;
