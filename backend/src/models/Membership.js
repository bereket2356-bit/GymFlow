import mongoose from "mongoose";

export const MEMBERSHIP_STATES = [
  "scheduled",
  "active",
  "renewed",
  "expired",
  "exhausted",
  "cancelled",
];

const snapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["time", "session", "both"], required: true },
    validityValue: { type: Number, required: true },
    validityUnit: { type: String, enum: ["days", "weeks", "months", "years"], required: true },
    sessionAllowance: { type: Number, required: true },
    priceCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const membershipSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true },
    packageSnapshot: { type: snapshotSchema, required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    sessionsTotal: { type: Number, default: 0, min: 0 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    sessionsRemaining: { type: Number, default: 0, min: 0 },
    agreedPriceCents: { type: Number, required: true, min: 0 },
    state: { type: String, enum: MEMBERSHIP_STATES, required: true },
    renewedFromId: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

membershipSchema.index({ customer: 1, state: 1 });
membershipSchema.index({ expiryDate: 1, state: 1 });
membershipSchema.index({ package: 1 });

export const Membership = mongoose.model("Membership", membershipSchema);
export default Membership;
