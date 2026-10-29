import mongoose from "mongoose";
import env from "./env.js";
import { logger } from "../utils/logger.js";

mongoose.set("strictQuery", true);

const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 5;

let attempt = 0;

/**
 * Connect to MongoDB with a bounded retry loop. Resolves true when connected.
 * A failed connection never keeps the process from logging the reason.
 */
export async function connectDB(uri = env.mongoUri, { maxAttempts = MAX_ATTEMPTS } = {}) {
  attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info({ database: mongoose.connection.name }, "MongoDB connected");
      return true;
    } catch (err) {
      logger.error(
        { attempt, maxAttempts, error: err.message },
        "MongoDB connection failed",
      );
      if (attempt >= maxAttempts) break;
      await new Promise((resolve) => {
        setTimeout(resolve, RETRY_DELAY_MS);
      });
    }
  }
  return false;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

export default connectDB;
