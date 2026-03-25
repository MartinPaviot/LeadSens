import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3001",
    headless: false,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
