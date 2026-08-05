import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/specs/**/*.test.ts"],
    // Integration tests share the real Turso dev DB — run files sequentially
    // to avoid mutating tests colliding with each other.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60000,
    hookTimeout: 60000,
    reporters: ["default"],
    env: {
      NODE_ENV: "test",
    },
  },
});
