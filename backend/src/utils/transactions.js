import mongoose from "mongoose";
import { logger } from "./logger.js";

function isTransactionUnsupported(err) {
  const message = String(err?.message || "");
  return (
    err?.code === 20 ||
    err?.codeName === "IllegalOperation" ||
    message.includes("Transaction numbers are only allowed") ||
    message.includes("replica set") ||
    message.includes("Transactions are not supported")
  );
}

/**
 * Run `fn(session)` in a MongoDB transaction. Standalone servers cannot run
 * transactions, so the work is retried once without a session and a warning is
 * logged. The attendance service relies on the transactional path to keep
 * session deduction exactly-once.
 */
export async function withOptionalTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (!isTransactionUnsupported(err)) throw err;
    logger.warn("MongoDB transactions unavailable; retrying without a transaction.");
    return fn(null);
  } finally {
    await session.endSession();
  }
}
