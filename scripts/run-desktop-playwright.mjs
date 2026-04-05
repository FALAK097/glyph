import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pnpmBinary = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rawArgs = process.argv.slice(2);
const extraArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

const child = spawn(
  pnpmBinary,
  [
    "--filter",
    "@glyph/desktop",
    "exec",
    "playwright",
    "test",
    "-c",
    "playwright.config.ts",
    ...extraArgs,
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
