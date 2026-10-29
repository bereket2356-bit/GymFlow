import mongoose from "mongoose";

const trainingSessionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 480 },
    capacity: { type: Number, required: true, min: 1, max: 200 },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    instructor: { type: String, trim: true, maxlength: 120, default: null },
  },
  { timestamps: true },
);

trainingSessionSchema.index({ startsAt: 1 });

export const TrainingSession = mongoose.model("TrainingSession", trainingSessionSchema);
export default TrainingSession;
