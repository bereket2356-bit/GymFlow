import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";

const STATES = ["disconnected", "connected", "connecting", "disconnecting"];

export const health = (_req, res) => {
  res.json({
    data: {
      status: "ok",
      service: "BGMS API",
      time: new Date().toISOString(),
      database: STATES[mongoose.connection.readyState] ?? "unknown",
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
};

export const ready = asyncHandler(async (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  let ping = false;
  if (connected && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      ping = true;
    } catch {
      ping = false;
    }
  }
  const ready = connected && ping;
  res.status(ready ? 200 : 503).json({
    data: {
      status: ready ? "ready" : "not_ready",
      database: STATES[mongoose.connection.readyState] ?? "unknown",
      ping,
    },
  });
});
