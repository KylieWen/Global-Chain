import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const captures = [
  ['dongguan-terminals', 'https://tjj.dg.gov.cn/gzdt/sgzdt/content/post_4559582.html'],
  ['dongguan-industry', 'https://www.dg.gov.cn/jjdz/bmdt/content/post_4465945.html'],
  ['ningbo-shirts', 'https://zlzx.zjamr.zj.gov.cn/bzzx/public/std/companyStdview/1d68d5473dc14c5c88c33f0c80c4688e.html'],
  ['tianjin-soy', 'http://www.zkgbgroup.com/about_52.html'],
  ['ningbo-knitwear', 'https://jobs.tiangong.edu.cn/company/index/id/2446.html'],
  ['suzhou-drives', 'https://www.bafang-e.com/en/home'],
  ['xinxiang-copper', 'https://www.hist.edu.cn/info/2651/261941.htm'],
  ['shenzhou-home', 'https://www.shenzhouintl.com/']
];
const args = process.argv.slice(2);
const ids = args.filter(argument => argument !== '--raw');
const directory = resolve(args.includes('--raw') ? 'data/raw/regional-review-2026-10-23' : 'output/research/regional-review-2026-10-23');
await mkdir(directory, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const results = [];
for (const [id, url] of captures) {
  if (ids.length && !ids.includes(id)) continue;
  const rawFile = resolve(directory, `${id}.html`);
  const metaFile = resolve(directory, `${id}.meta.json`);
  if (existsSync(rawFile) && existsSync(metaFile)) {
    const meta = JSON.parse(await readFile(metaFile, 'utf8'));
    if (sha(await readFile(rawFile)) !== meta.sha256) throw new Error(`Changed capture: ${id}`);
    results.push({ id, status: meta.httpStatus, reused: true });
    continue;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) throw new Error('Oversized HTML capture');
    await writeFile(rawFile, bytes, { flag: 'wx' });
    await writeFile(metaFile, JSON.stringify({ id, url, finalUrl: response.url, httpStatus: response.status, retrievedAt: new Date().toISOString(), contentType: response.headers.get('content-type'), sha256: sha(bytes) }, null, 2) + '\n', { flag: 'wx' });
    results.push({ id, status: response.status, bytes: bytes.length });
  } catch (error) { results.push({ id, error: error.message }); }
}
await writeFile(resolve(directory, 'fetch-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
