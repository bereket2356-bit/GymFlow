import mongoose from "mongoose";

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "mobile_money"];

const paymentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    amountCents: { type: Number, required: true, min: 1, validate: Number.isInteger },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    receivedOn: { type: Date, required: true },
    reference: { type: String, trim: true, maxlength: 80, default: null },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
  },
  { timestamps: true },
);

paymentSchema.index({ customer: 1, receivedOn: -1 });
paymentSchema.index({ membership: 1 });
paymentSchema.index({ receivedOn: -1 });

export const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
