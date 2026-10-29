import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    amountCents: { type: Number, required: true, min: 1, validate: Number.isInteger },
    incurredOn: { type: Date, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
  },
  { timestamps: true },
);

expenseSchema.index({ incurredOn: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
