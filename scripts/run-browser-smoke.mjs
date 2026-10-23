import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.BROWSER_TEST_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid browser test port');
const output = resolve(root, process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/browser-smoke');
await mkdir(output, { recursive: true });
const base = `http://127.0.0.1:${port}`;
// Refuse an occupied port; never test or stop somebody else's server.
const { createServer } = await import('node:net');
await new Promise((done, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(port, '127.0.0.1', () => probe.close(done));
});
const log = createWriteStream(resolve(output, 'server.log'));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: resolve(root, 'apps/web'), env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });
let serverFailure;
server.on('error', error => { serverFailure = error; });
const closed = new Promise(done => server.once('close', done));
const delay = ms => new Promise(done => setTimeout(done, ms));
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    if (serverFailure) throw serverFailure;
    if (server.exitCode !== null) throw new Error(`Preview exited ${server.exitCode}; see ${output}/server.log`);
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Server may not be listening yet. */ }
    await delay(250);
  }
  if (!ready) throw new Error('Browser preview did not become ready');
  const test = spawn(process.execPath, [resolve(root, 'scripts/verify-browser-smoke.mjs')], {
    cwd: root, env: { ...process.env, REVIEW_BASE_URL: base, REVIEW_OUTPUT_DIR: output }, windowsHide: true, stdio: 'inherit'
  });
  const code = await new Promise((done, reject) => { test.once('error', reject); test.once('exit', done); });
  if (code !== 0) throw new Error(`Browser smoke failed (${code})`);
} finally {
  if (server.exitCode === null) server.kill();
  await closed;
  log.end();
}
