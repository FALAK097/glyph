import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

const APP_NAME = "Glyph";
const DEV_BUNDLE_ID = "com.falakgala.glyph.dev";
const DEV_CACHE_ROOT = path.join(os.tmpdir(), "glyph-dev-electron");
const HELPER_VARIANTS = [
  { suffix: "", idSuffix: "helper" },
  { suffix: " (GPU)", idSuffix: "helper.gpu" },
  { suffix: " (Plugin)", idSuffix: "helper.plugin" },
  { suffix: " (Renderer)", idSuffix: "helper.renderer" },
];

const appRoot = path.resolve(import.meta.dirname, "..");
const iconSourcePath = path.join(appRoot, "public", "icon.icns");
const prepareOnly = process.env.GLYPH_DEV_PREPARE_ONLY === "1";
const forceRawElectron = process.env.GLYPH_USE_RAW_ELECTRON === "1";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runQuiet(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function setPlistString(plistPath, key, value) {
  const result = runQuiet("plutil", ["-replace", key, "-string", value, plistPath]);
  if (result.status !== 0) {
    throw new Error(
      `Failed updating ${key} in ${plistPath}: ${result.stderr || result.stdout || "unknown error"}`,
    );
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function renameIfNeeded(currentPath, nextPath) {
  if (currentPath === nextPath) {
    return;
  }

  if (await pathExists(nextPath)) {
    await fs.rm(nextPath, { recursive: true, force: true });
  }

  await fs.rename(currentPath, nextPath);
}

async function prepareMacDevBundle(electronBinaryPath, electronVersion) {
  const sourceBundlePath = path.resolve(path.dirname(electronBinaryPath), "..", "..");
  const bundleRoot = path.join(DEV_CACHE_ROOT, electronVersion);
  const bundlePath = path.join(bundleRoot, `${APP_NAME}.app`);
  const metadataPath = path.join(bundleRoot, "bundle-metadata.json");
  const iconStats = await fs.stat(iconSourcePath);

  const expectedMetadata = {
    appName: APP_NAME,
    bundleId: DEV_BUNDLE_ID,
    electronVersion,
    iconMtimeMs: iconStats.mtimeMs,
  };

  let shouldRebuild = !(await pathExists(bundlePath));

  if (!shouldRebuild && (await pathExists(metadataPath))) {
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
      shouldRebuild =
        metadata.appName !== expectedMetadata.appName ||
        metadata.bundleId !== expectedMetadata.bundleId ||
        metadata.electronVersion !== expectedMetadata.electronVersion ||
        metadata.iconMtimeMs !== expectedMetadata.iconMtimeMs;
    } catch {
      shouldRebuild = true;
    }
  } else if (!shouldRebuild) {
    shouldRebuild = true;
  }

  if (shouldRebuild) {
    await fs.rm(bundleRoot, { recursive: true, force: true });
    await fs.mkdir(bundleRoot, { recursive: true });
    run("ditto", [sourceBundlePath, bundlePath]);

    const contentsPath = path.join(bundlePath, "Contents");
    const resourcesPath = path.join(contentsPath, "Resources");
    const frameworksPath = path.join(contentsPath, "Frameworks");
    const mainPlistPath = path.join(contentsPath, "Info.plist");
    const mainExecutablePath = path.join(contentsPath, "MacOS", "Electron");
    const renamedMainExecutablePath = path.join(contentsPath, "MacOS", APP_NAME);

    await renameIfNeeded(mainExecutablePath, renamedMainExecutablePath);
    await fs.copyFile(iconSourcePath, path.join(resourcesPath, "icon.icns"));

    setPlistString(mainPlistPath, "CFBundleDisplayName", APP_NAME);
    setPlistString(mainPlistPath, "CFBundleExecutable", APP_NAME);
    setPlistString(mainPlistPath, "CFBundleIconFile", "icon.icns");
    setPlistString(mainPlistPath, "CFBundleIdentifier", DEV_BUNDLE_ID);
    setPlistString(mainPlistPath, "CFBundleName", APP_NAME);

    for (const helperVariant of HELPER_VARIANTS) {
      const oldHelperName = `Electron Helper${helperVariant.suffix}`;
      const newHelperName = `${APP_NAME} Helper${helperVariant.suffix}`;
      const oldHelperBundlePath = path.join(frameworksPath, `${oldHelperName}.app`);
      const newHelperBundlePath = path.join(frameworksPath, `${newHelperName}.app`);

      await renameIfNeeded(oldHelperBundlePath, newHelperBundlePath);

      const helperExecutableDir = path.join(newHelperBundlePath, "Contents", "MacOS");
      const oldHelperExecutablePath = path.join(helperExecutableDir, oldHelperName);
      const newHelperExecutablePath = path.join(helperExecutableDir, newHelperName);
      const helperPlistPath = path.join(newHelperBundlePath, "Contents", "Info.plist");

      await renameIfNeeded(oldHelperExecutablePath, newHelperExecutablePath);

      setPlistString(helperPlistPath, "CFBundleDisplayName", newHelperName);
      setPlistString(helperPlistPath, "CFBundleExecutable", newHelperName);
      setPlistString(
        helperPlistPath,
        "CFBundleIdentifier",
        `${DEV_BUNDLE_ID}.${helperVariant.idSuffix}`,
      );
      setPlistString(helperPlistPath, "CFBundleName", newHelperName);
    }

    run("codesign", ["--force", "--deep", "--sign", "-", bundlePath]);
    await fs.writeFile(metadataPath, `${JSON.stringify(expectedMetadata, null, 2)}\n`);
  }

  return path.join(bundlePath, "Contents", "MacOS", APP_NAME);
}

async function main() {
  const electronBinaryPath = require("electron");
  const electronPackage = require("electron/package.json");

  if (process.platform !== "darwin" || forceRawElectron) {
    if (prepareOnly) {
      console.log(electronBinaryPath);
      return;
    }

    const child = spawnSync(electronBinaryPath, [appRoot, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: {
        ...process.env,
        GLYPH_DEV_APP: "1",
      },
    });
    process.exit(child.status ?? 1);
  }

  if (!existsSync(iconSourcePath)) {
    throw new Error(`Missing macOS icon at ${iconSourcePath}`);
  }

  const executablePath = await prepareMacDevBundle(electronBinaryPath, electronPackage.version);

  if (prepareOnly) {
    console.log(executablePath);
    return;
  }

  const child = spawnSync(executablePath, [appRoot, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {
      ...process.env,
      GLYPH_DEV_APP: "1",
    },
  });
  process.exit(child.status ?? 1);
}

void main().catch((error) => {
  console.error("[glyph-dev-launcher]", error);
  process.exit(1);
});
