import mongoose from "mongoose";

/**
 * Expense corrections, mirroring payment adjustments. The SRS lists
 * /expenses/:id/adjustments, so corrections are stored as their own immutable
 * records rather than editing the original expense.
 */
const expenseAdjustmentSchema = new mongoose.Schema(
  {
    originalExpense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense", required: true, index: true },
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

export const ExpenseAdjustment = mongoose.model("ExpenseAdjustment", expenseAdjustmentSchema);
export default ExpenseAdjustment;
