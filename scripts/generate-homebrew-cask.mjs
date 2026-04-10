#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_OWNER = "FALAK097";
const DEFAULT_REPO = "glyph";
const DEFAULT_CASK_NAME = "glyph";
const DEFAULT_PRODUCT_NAME = "Glyph";
const DEFAULT_DESCRIPTION = "Minimal markdown viewer and editor";
const DEFAULT_HOMEPAGE = `https://github.com/${DEFAULT_OWNER}/${DEFAULT_REPO}`;
const DEFAULT_BUNDLE_ID = "com.falakgala.glyph";

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function requireArg(flag) {
  const value = getArgValue(flag);

  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }

  return value;
}

function escapeRubyString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function hashFile(artifactPath) {
  const fileBuffer = readFileSync(artifactPath);
  return createHash("sha256").update(fileBuffer).digest("hex");
}

function getArtifactNameTemplate(artifactName, version) {
  if (artifactName.includes(version)) {
    return artifactName.replace(version, "#{version}");
  }

  return artifactName;
}

function buildCaskContents({
  version,
  sha256,
  owner,
  repo,
  caskName,
  productName,
  description,
  homepage,
  bundleId,
  artifactNameTemplate,
}) {
  return `cask "${escapeRubyString(caskName)}" do
  version "${escapeRubyString(version)}"
  sha256 "${escapeRubyString(sha256)}"

  url "https://github.com/${escapeRubyString(owner)}/${escapeRubyString(repo)}/releases/download/v#{version}/${escapeRubyString(artifactNameTemplate)}"
  name "${escapeRubyString(productName)}"
  desc "${escapeRubyString(description)}"
  homepage "${escapeRubyString(homepage)}"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "${escapeRubyString(productName)}.app"

  zap trash: [
    "~/Library/Application Support/${escapeRubyString(productName)}",
    "~/Library/Preferences/${escapeRubyString(bundleId)}.plist",
    "~/Library/Saved Application State/${escapeRubyString(bundleId)}.savedState",
  ]
end
`;
}

function main() {
  const version = requireArg("--version");
  const owner = getArgValue("--owner") ?? DEFAULT_OWNER;
  const repo = getArgValue("--repo") ?? DEFAULT_REPO;
  const caskName = getArgValue("--cask-name") ?? DEFAULT_CASK_NAME;
  const productName = getArgValue("--product-name") ?? DEFAULT_PRODUCT_NAME;
  const description = getArgValue("--description") ?? DEFAULT_DESCRIPTION;
  const homepage = getArgValue("--homepage") ?? DEFAULT_HOMEPAGE;
  const bundleId = getArgValue("--bundle-id") ?? DEFAULT_BUNDLE_ID;
  const outputDirArg = getArgValue("--output-dir");
  const explicitSha256 = getArgValue("--sha256");
  const artifactPathArg = getArgValue("--artifact-path");
  const artifactPath = artifactPathArg ? path.resolve(repoRoot, artifactPathArg) : null;
  const outputRoot = outputDirArg ? path.resolve(repoRoot, outputDirArg) : repoRoot;

  if (!explicitSha256 && !artifactPath) {
    throw new Error("Provide either --artifact-path or --sha256.");
  }

  const artifactName =
    getArgValue("--artifact-name") ??
    (artifactPath ? path.basename(artifactPath) : `${productName}-mac.dmg`);

  const sha256 = explicitSha256 ?? hashFile(artifactPath);
  const artifactNameTemplate = getArtifactNameTemplate(artifactName, version);
  const caskContents = buildCaskContents({
    version,
    sha256,
    owner,
    repo,
    caskName,
    productName,
    description,
    homepage,
    bundleId,
    artifactNameTemplate,
  });

  const caskDir = path.join(outputRoot, "Casks");
  mkdirSync(caskDir, { recursive: true });
  const caskPath = path.join(caskDir, `${caskName}.rb`);
  writeFileSync(caskPath, caskContents, "utf8");

  process.stdout.write(`Updated ${path.relative(outputRoot, caskPath)} for ${version}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unable to generate Homebrew cask.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
