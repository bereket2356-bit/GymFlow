import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import env from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestId, rejectDangerousKeys, requestTimeout } from "./middleware/requestContext.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { health, ready } from "./controllers/healthController.js";
import routes from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const allowedOrigins = [
    ...env.corsOrigin,
    "https://ethiogymflow.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ];

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, "");
        if (
          allowedOrigins.includes(cleanOrigin) ||
          cleanOrigin.endsWith(".vercel.app") ||
          cleanOrigin.includes("ethiogymflow")
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
      exposedHeaders: ["Set-Cookie"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(rejectDangerousKeys);
  app.use(requestTimeout());

  morgan.token("id", (req) => req.id);
  if (!env.isTest) {
    app.use(
      morgan(":id :method :url :status :response-time ms", {
        stream: { write: (line) => logger.info(line.trim()) },
      }),
    );
  }

  app.get("/health", health);
  app.get("/health/ready", ready);
  // Backwards-compatible path used by the earlier prototype shell.
  app.get("/api/health", health);

  app.use("/api", globalLimiter);
  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
