#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const replace = process.argv.includes("--replace") ? ["--replace"] : [];
const scripts = [
  "fetch-published-sources.mjs",
  "fetch-material-snapshot.mjs",
  "fetch-material-role-pairs.mjs",
  "fetch-material-intermediate-snapshot.mjs"
];

function run(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(root, "scripts", script), ...replace], { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${script} exited with code ${code}`)));
  });
}

for (const script of scripts) {
  console.log(`==> ${script}`);
  await run(script);
}
console.log("All published source snapshots are ready.");
