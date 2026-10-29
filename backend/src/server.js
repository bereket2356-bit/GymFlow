import env from "./config/env.js";
import connectDB, { disconnectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const app = createApp();

async function start() {
  const connected = await connectDB();
  if (!connected) {
    logger.fatal("Could not connect to MongoDB. Set MONGODB_URI and make sure the database is running.");
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(
      { port: env.port, env: env.nodeEnv, timezone: env.timezone },
      `BGMS API listening on http://localhost:${env.port}`,
    );
  });

  async function shutdown(signal) {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await disconnectDB();
      if (signal === "SIGUSR2") {
        process.kill(process.pid, "SIGUSR2");
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 3000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGUSR2", () => shutdown("SIGUSR2"));
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start the API");
  process.exit(1);
});
