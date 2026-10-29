import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/helpers/setup.js"],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/bgms-test",
      JWT_SECRET: "test-secret-that-is-long-enough-for-tests",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGIN: "http://localhost:5173",
      GYM_NAME: "Foundry Boxing Club",
      CURRENCY: "USD",
      TIMEZONE: "UTC",
      REMINDER_WINDOWS: "7,3,1",
      INACTIVITY_DAYS: "14",
      LOG_LEVEL: "silent",
    },
    coverage: {
      provider: "v8",
      include: ["src/services/**/*.js"],
      reporter: ["text", "html"],
    },
  },
});
