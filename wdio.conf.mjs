import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { browser } from "@wdio/globals";

const artifactsDir = path.resolve("e2e-artifacts");
const obsidianVersions = process.env.OBSIDIAN_VERSIONS;
if (!obsidianVersions) {
  throw new Error(
    "OBSIDIAN_VERSIONS is required (format: <app-version>/<installer-version>)",
  );
}
const [appVersion, installerVersion, unexpectedPart] =
  obsidianVersions.split("/");
if (!appVersion || !installerVersion || unexpectedPart) {
  throw new Error(
    "OBSIDIAN_VERSIONS must contain one app version and one installer version",
  );
}

export const config = {
  runner: "local",
  framework: "mocha",
  specs: ["./e2e/**/*.e2e.js"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "obsidian",
      "wdio:obsidianOptions": {
        appVersion,
        installerVersion,
        plugins: [".", ".e2e-plugins/base-board"],
        vault: "e2e/vault",
      },
    },
  ],
  services: ["obsidian"],
  reporters: ["obsidian"],
  mochaOpts: { ui: "bdd", timeout: 60_000 },
  waitforInterval: 250,
  waitforTimeout: 10_000,
  logLevel: "warn",
  cacheDir: path.resolve(".obsidian-cache"),
  outputDir: path.join(artifactsDir, "wdio"),
  injectGlobals: true,
  afterTest: async function (_test, _context, result) {
    if (result.passed) return;
    fs.mkdirSync(artifactsDir, { recursive: true });
    await browser.saveScreenshot(path.join(artifactsDir, "failure.png"));
    try {
      const logs = await browser.getLogs("browser");
      fs.writeFileSync(
        path.join(artifactsDir, "browser-console.json"),
        `${JSON.stringify(logs, null, 2)}\n`,
      );
    } catch (error) {
      fs.writeFileSync(
        path.join(artifactsDir, "browser-console-error.txt"),
        `${String(error)}\n`,
      );
    }
  },
};
