import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(import.meta.dirname, '..');
const configFile = 'content/geography/regional-review-supplement-2026-10-23.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildRegionalReviewSupplement(root = rootDirectory) {
  const config = JSON.parse(await readFile(resolve(root, configFile), 'utf8'));
  const baseBytes = await readFile(resolve(root, config.basePath));
  if (sha(baseBytes) !== config.baseSha256) throw new Error('Changed regional baseline');
  const atlas = JSON.parse(baseBytes.toString('utf8'));
  atlas.datasetVersion = config.datasetVersion;
  atlas.reviewedAt = config.reviewedAt;
  for (const record of [...atlas.nodes, ...atlas.connections]) record.datasetVersion = config.datasetVersion;
  for (const source of config.sources) {
    const bytes = await readFile(resolve(root, source.rawPath));
    const metadata = JSON.parse(await readFile(resolve(root, source.rawPath.replace(/\.html$/, '.meta.json')), 'utf8'));
    if (metadata.httpStatus !== 200 || metadata.sha256 !== source.sha256 || sha(bytes) !== source.sha256 || metadata.url !== source.url) throw new Error(`Unverified regional source: ${source.id}`);
    atlas.sources.push({ ...source, retrievedAt: metadata.retrievedAt });
  }
  for (const place of config.places) {
    const coordinateSource = atlas.sources.find(source => source.id === place.coordinateSourceId);
    if (!coordinateSource) throw new Error(`Missing city source: ${place.id}`);
    const bytes = await readFile(resolve(root, coordinateSource.rawPath));
    if (sha(bytes) !== coordinateSource.sha256) throw new Error(`Changed geometry: ${place.id}`);
    const geometry = JSON.parse(bytes.toString('utf8'));
    const city = geometry.features.find(feature => feature.properties.adcode === place.cityCode);
    if (!city?.properties.center || String(city.properties.parent.adcode) !== place.provinceCode) throw new Error(`Missing city anchor: ${place.id}`);
    const { cityCode, ...fields } = place;
    atlas.places.push({ ...fields, coordinates: city.properties.center.map(value => Math.round(value * 100) / 100), coordinateMethod: 'approximate_city_anchor' });
  }
  const provenance = { unit: 'not_applicable', method: 'curated', dataStatus: 'observed', datasetVersion: config.datasetVersion };
  for (const node of config.nodes) atlas.nodes.push({ organizationIds: [], topicIds: [], ...node, ...provenance });
  for (const edge of config.connections) {
    const from = atlas.nodes.find(node => node.id === edge.from);
    const to = atlas.nodes.find(node => node.id === edge.to);
    if (!from || !to || from.productId !== to.productId) throw new Error(`Invalid connection: ${edge.id}`);
    atlas.connections.push({ ...edge, ...provenance, period: config.connectionPeriod,
      description: '按环节组织的代表性区域联系；资料分别支持两端产业角色，未核验具体企业间供货或运输。',
      sourceIds: [...new Set([...from.sourceIds, ...to.sourceIds])],
      evidenceLevel: 'representative', value: null, valueDataStatus: 'unknown' });
  }
  return { atlas, outputPath: resolve(root, config.outputPath) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { atlas, outputPath } = await buildRegionalReviewSupplement();
  const text = JSON.stringify(atlas, null, 2) + '\n';
  if (existsSync(outputPath)) {
    if (await readFile(outputPath, 'utf8') !== text) throw new Error('Refusing to overwrite a different regional release');
  } else await writeFile(outputPath, text, { flag: 'wx' });
  console.log(JSON.stringify({ version: atlas.datasetVersion, nodes: atlas.nodes.length, connections: atlas.connections.length, outputPath }));
}
