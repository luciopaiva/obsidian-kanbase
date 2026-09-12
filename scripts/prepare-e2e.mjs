import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const version = "2.5.1";
const destination = path.resolve(".e2e-plugins/base-board");
const assets = {
  "main.js": "18c21c235d97f399a66db81d264d03dcc4f1cae907befb51910a9c2a6b119255",
  "manifest.json":
    "c62113223cc7185138bfc3ec403130ae10a8cef67f4aaa863589f19ed8217b3b",
  "styles.css":
    "953df74bb11083095897fa7122aebf22d10b9fbdf41e1262cadc9f0e9d62dd51",
};

await fs.mkdir(destination, { recursive: true });

for (const [name, expectedHash] of Object.entries(assets)) {
  const output = path.join(destination, name);
  let contents;
  try {
    contents = await fs.readFile(output);
  } catch {
    const url = `https://github.com/mderazon/obsidian-base-board/releases/download/${version}/${name}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}`);
    contents = Buffer.from(await response.arrayBuffer());
  }

  const actualHash = crypto.createHash("sha256").update(contents).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Checksum mismatch for Base Board ${version} ${name}`);
  }
  await fs.writeFile(output, contents);
}

console.log(`Prepared Base Board ${version} for coexistence testing.`);
