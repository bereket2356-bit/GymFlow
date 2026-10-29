import mongoose from "mongoose";

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"];

const attendanceSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "TrainingSession", required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
    markedAt: { type: Date, required: true, default: () => new Date() },
    deducted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

attendanceSchema.index({ session: 1, customer: 1 }, { unique: true });
attendanceSchema.index({ customer: 1, markedAt: -1 });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
