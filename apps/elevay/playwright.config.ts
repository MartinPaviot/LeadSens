import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./src/tests",
  timeout: 60_000,
  retries: IS_CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    headless: IS_CI,
  },
  projects: [
    {
      name: "api",
      testMatch: "api-*.spec.ts",
      use: { headless: true },
    },
    {
      name: "ui",
      testMatch: "composio-*.spec.ts",
      use: { headless: false },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
