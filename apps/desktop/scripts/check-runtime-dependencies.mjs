import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const appRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(appRoot, "dist-electron");
const packageJsonPath = path.join(appRoot, "package.json");

const IMPORT_PATTERNS = [
  /from\s+["']([^"']+)["']/g,
  /import\(\s*["']([^"']+)["']\s*\)/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
];

const NODE_BUILTINS = new Set(
  builtinModules.flatMap((moduleName) =>
    moduleName.startsWith("node:") ? [moduleName, moduleName.slice(5)] : [moduleName],
  ),
);

const EXTERNAL_RUNTIME_ALLOWLIST = new Set(["electron"]);

function isJavaScriptModule(filePath) {
  return filePath.endsWith(".js") || filePath.endsWith(".cjs") || filePath.endsWith(".mjs");
}

function isBareModuleSpecifier(specifier) {
  return (
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("node:") &&
    !specifier.startsWith("file:")
  );
}

function normalizePackageName(specifier) {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/", 3);
    return scope && name ? `${scope}/${name}` : specifier;
  }

  const [name] = specifier.split("/", 1);
  return name;
}

function walkFiles(rootPath) {
  const pending = [rootPath];
  const results = [];

  while (pending.length > 0) {
    const currentPath = pending.pop();
    if (!currentPath) {
      continue;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile() && isJavaScriptModule(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function collectRuntimeImports(rootPath) {
  const importsByPackage = new Map();

  for (const filePath of walkFiles(rootPath)) {
    const source = fs.readFileSync(filePath, "utf8");
    const relativeFilePath = path.relative(appRoot, filePath).replace(/\\/g, "/");

    for (const pattern of IMPORT_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (!specifier || !isBareModuleSpecifier(specifier)) {
          continue;
        }

        const packageName = normalizePackageName(specifier);
        if (NODE_BUILTINS.has(packageName) || EXTERNAL_RUNTIME_ALLOWLIST.has(packageName)) {
          continue;
        }

        const currentFiles = importsByPackage.get(packageName) ?? new Set();
        currentFiles.add(relativeFilePath);
        importsByPackage.set(packageName, currentFiles);
      }
    }
  }

  return importsByPackage;
}

function main() {
  if (!fs.existsSync(distRoot)) {
    console.error(
      [
        "Desktop runtime dependency check failed.",
        `Expected build output at ${path.relative(appRoot, distRoot)} but it was not found.`,
        "Run `pnpm --filter @glyph/desktop build` before verifying runtime dependencies.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const dependencies = new Set(Object.keys(pkg.dependencies ?? {}));
  const devDependencies = new Set(Object.keys(pkg.devDependencies ?? {}));
  const optionalDependencies = new Set(Object.keys(pkg.optionalDependencies ?? {}));
  const runtimePackages = new Set([...dependencies, ...optionalDependencies]);
  const importsByPackage = collectRuntimeImports(distRoot);

  const failures = [];

  for (const [packageName, importerFiles] of [...importsByPackage.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (runtimePackages.has(packageName)) {
      continue;
    }

    const declarationStatus = devDependencies.has(packageName)
      ? "declared only in devDependencies"
      : "missing from dependencies";

    failures.push({
      declarationStatus,
      importerFiles: [...importerFiles.values()],
      packageName,
    });
  }

  if (failures.length > 0) {
    const details = failures
      .map(
        ({ declarationStatus, importerFiles, packageName }) =>
          `- ${packageName}: ${declarationStatus}\n  imported by ${importerFiles.join(", ")}`,
      )
      .join("\n");

    console.error(
      [
        "Desktop runtime dependency check failed.",
        "Built Electron files import packages that will not be available in the packaged app:",
        details,
        "Move these packages into dependencies before packaging a release.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const verifiedPackages = [...importsByPackage.keys()].sort();
  console.log(
    `Desktop runtime dependency check passed for ${verifiedPackages.length} package${verifiedPackages.length === 1 ? "" : "s"}: ${verifiedPackages.join(", ")}`,
  );
}

main();
