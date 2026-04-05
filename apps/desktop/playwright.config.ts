import { defineConfig } from "@playwright/test";

const reporter = [
  ["html", { open: "never", outputFolder: "./playwright-report" }],
  ["list"],
] as const;

if (process.env.PLAYWRIGHT_JUNIT_OUTPUT) {
  reporter.push(["junit", { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT }]);
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  preserveOutput: "failures-only",
  workers: 1,
  reporter,
  outputDir: "./test-results",
});
