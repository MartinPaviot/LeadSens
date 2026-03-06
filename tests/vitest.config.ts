import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 30_000,
    maxWorkers: 1,
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
  },
});
