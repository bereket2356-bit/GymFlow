import mongoose from "mongoose";

const ownerSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, maxlength: 40, default: null },
    phone: { type: String, trim: true, default: null },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, enum: ["owner"], default: "owner", required: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ownerSchema.set("toJSON", {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export const Owner = mongoose.model("Owner", ownerSchema);
export default Owner;
