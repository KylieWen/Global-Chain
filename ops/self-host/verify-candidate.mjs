import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

// Run from an extracted release; only built-in Node modules are needed.
const base = process.env.CANDIDATE_BASE_URL ?? 'http://127.0.0.1:3001';
const checks = [];
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Candidate may be starting. */ }
  await new Promise(done => setTimeout(done, 250));
}
assert.ok(ready, 'Candidate health');
const manifest = JSON.parse(await readFile('data/published/manifest.json', 'utf8'));
const html = async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, path);
  const body = await response.text();
  assert.ok(body.includes('Global Chain'), path);
  checks.push(path);
  return body;
};
const home = await html('/');
for (const label of ['persona-home', '公众探索', '产业参与者', '高校研究者']) assert.ok(home.includes(label), label);
for (const { productId, datasetVersion } of manifest.fixtures) {
  for (const path of ['/products/' + productId, '/map?product=' + productId, '/map/china?product=' + productId]) await html(path);
  const response = await fetch(base + '/api/products/' + productId + '/research-export');
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.release.datasetVersion.version, datasetVersion);
  checks.push({ productId, datasetVersion, completeExport: true });
}
const version = 'globe-chain-smartphone-2026.2';
const historical = await fetch(base + '/api/products/generic-smartphone/research-export?datasetVersion=' + version);
assert.equal(historical.status, 200);
assert.equal((await historical.json()).release.datasetVersion.version, version);
checks.push({ historicalExport: version });
const current = await fetch(base + '/api/products/generic-smartphone/research-export', { headers: { 'if-none-match': historical.headers.get('etag') } });
assert.equal(current.status, 200);
assert.notEqual(current.headers.get('etag'), historical.headers.get('etag'));
await current.arrayBuffer();
checks.push('Historical ETag cannot make the current snapshot respond 304');
for (const [productId, requestedVersion] of [['generic-smartphone', 'missing-snapshot'], ['generic-home-air-conditioner', version]]) {
  const response = await fetch(base + '/api/products/' + productId + '/research-export?datasetVersion=' + requestedVersion);
  assert.equal(response.status, 404);
  checks.push({ rejectedProduct: productId, rejectedVersion: requestedVersion });
}
const provenance = await html('/products/generic-smartphone/provenance?datasetVersion=' + version);
assert.ok(provenance.includes('/research-export?datasetVersion=' + version));
const guide = await html('/trade-guide?product=generic-smartphone&datasetVersion=' + version);
assert.ok(guide.includes('name="datasetVersion" value="' + version + '"'));
const result = { commit: process.env.CANDIDATE_COMMIT, checkedAt: new Date().toISOString(), base, checks };
await writeFile(process.env.CANDIDATE_REPORT ?? 'candidate-check.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ candidate: 'passed', checks: checks.length, commit: result.commit }));
