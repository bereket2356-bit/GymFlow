import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, default: null, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: ["active", "archived"], default: "active", required: true },
    registeredAt: { type: Date, required: true, default: () => new Date() },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerSchema.index({ name: "text" });
customerSchema.index({ phone: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
