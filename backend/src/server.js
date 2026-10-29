import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import connectDB from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    service: "BGMS API",
    time: new Date().toISOString(),
    database: states[mongoose.connection.readyState] ?? "unknown",
  });
});

// Nothing here awaits the database, so the API comes up immediately whether or
// not MongoDB is reachable. A failed connection is logged by connectDB.
connectDB();

app.listen(PORT, () => {
  console.log(`BGMS API listening on http://localhost:${PORT}`);
});
