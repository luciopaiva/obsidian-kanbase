import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const manifest = JSON.parse(
  fs.readFileSync(path.resolve("manifest.json"), "utf8"),
);
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!tag || !semver.test(tag)) {
  throw new Error(
    `Release tag must be valid semver without a v prefix: ${tag}`,
  );
}
if (tag !== manifest.version) {
  throw new Error(
    `Release tag ${tag} does not match manifest version ${manifest.version}`,
  );
}

console.log(`Release tag ${tag} matches manifest.json.`);
