import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const lockRoot = lock.packages?.[""];
const nodeVersion = fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim();

assert(manifest.id === "kanbase", 'manifest.json id must be "kanbase"');
assert(manifest.name === "Kanbase", 'manifest.json name must be "Kanbase"');
assert(semver.test(manifest.version), "manifest.json version must be semver");
assert(semver.test(manifest.minAppVersion), "minAppVersion must be semver");
assert(
  pkg.version === manifest.version,
  "package and manifest versions differ",
);
assert(pkg.name === "obsidian-kanbase", "unexpected package name");
assert(pkg.main === "main.js", 'package main must be "main.js"');
assert(nodeVersion === "24", ".nvmrc must pin Node 24");
assert(pkg.engines?.node === ">=24 <25", "package engines must pin Node 24");
assert(lockRoot, "package-lock.json has no root package");
assert(lockRoot.name === pkg.name, "package-lock package name differs");
assert(lockRoot.version === pkg.version, "package-lock version differs");
assert(
  versions[manifest.version] === manifest.minAppVersion,
  "versions.json must map the current version to minAppVersion",
);

console.log(`Metadata valid for ${manifest.id} ${manifest.version}.`);
