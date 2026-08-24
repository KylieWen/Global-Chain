import { spawn } from "node:child_process";

const env = {
  ...process.env,
  GLOBECHAIN_DATA_MODE: "preview"
};

// Node 24 requires a shell for .cmd shims on Windows. The command is static,
// so this does not interpolate user input.
const child = process.platform === "win32"
  ? spawn("pnpm --filter @globe-chain/web dev", { env, shell: true, stdio: "inherit" })
  : spawn("pnpm", ["--filter", "@globe-chain/web", "dev"], { env, stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
