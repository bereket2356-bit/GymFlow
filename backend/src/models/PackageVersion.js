import mongoose from "mongoose";

/**
 * Immutable copy of a package's terms at a point in time. Memberships snapshot
 * these terms, so edits to the package never rewrite an existing agreement.
 */
const packageVersionSchema = new mongoose.Schema(
  {
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["time", "session", "both"], required: true },
    validityValue: { type: Number, required: true },
    validityUnit: { type: String, enum: ["days", "weeks", "months", "years"], required: true },
    sessionAllowance: { type: Number, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "inactive"], required: true },
    changedFields: { type: [String], default: [] },
  },
  { timestamps: true },
);

packageVersionSchema.index({ package: 1, version: 1 }, { unique: true });

export const PackageVersion = mongoose.model("PackageVersion", packageVersionSchema);
export default PackageVersion;
