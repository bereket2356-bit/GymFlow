import mongoose from "mongoose";

/** Atomic sequence source for human-readable ids (CUS-, MEM-, PAY-, S-). */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter = mongoose.model("Counter", counterSchema);

/**
 * Increment and return a sequence value. The first call for a key starts the
 * sequence at `start` (default 1). Duplicate-key races are expected and safe.
 */
export async function nextSequence(key, { start = 1, session } = {}) {
  try {
    await Counter.create([{ _id: key, seq: start - 1 }], { session });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, session },
  );
  return doc.seq;
}

export default Counter;
