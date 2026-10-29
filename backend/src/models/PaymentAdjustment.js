import mongoose from "mongoose";

const paymentAdjustmentSchema = new mongoose.Schema(
  {
    originalPayment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    amountCents: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return Number.isInteger(value) && value !== 0;
        },
        message: "amountCents must be a non-zero integer number of cents.",
      },
    },
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 240 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
  },
  { timestamps: true },
);

export const PaymentAdjustment = mongoose.model("PaymentAdjustment", paymentAdjustmentSchema);
export default PaymentAdjustment;
