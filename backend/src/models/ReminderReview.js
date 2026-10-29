import mongoose from "mongoose";

const reminderReviewSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    reviewedAt: { type: Date, required: true, default: () => new Date() },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
  },
  { timestamps: true },
);

export const ReminderReview = mongoose.model("ReminderReview", reminderReviewSchema);
export default ReminderReview;
