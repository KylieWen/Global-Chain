import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const {feature}=await import(pathToFileURL(require.resolve('topojson-client')).href);
const load=async name=>{const path=require.resolve(`world-atlas/${name}`);const bytes=await readFile(path);return {topology:JSON.parse(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}};
const coarse=await load('countries-110m.json'),detailed=await load('countries-50m.json');
const coarseFeatures=feature(coarse.topology,coarse.topology.objects.countries).features;
const ids=new Set(coarseFeatures.map(item=>String(item.id)));
const features=feature(detailed.topology,detailed.topology.objects.countries).features.filter(item=>/^\d+$/.test(String(item.id))&&!ids.has(String(item.id)));
const data={schemaVersion:'world-country-supplement.v1',type:'FeatureCollection',datasetVersion:'world-atlas-small-countries-2.0.2',period:{granularity:'monthly',start:'2026-10-23',end:'2026-10-23',label:'2026-10-23 地理资料提取'},unit:'decimal_degrees',method:'derived',dataStatus:'observed',source:{url:'https://github.com/topojson/world-atlas',version:'world-atlas 2.0.2 / Natural Earth 4.1.0',license:'Natural Earth public domain; world-atlas package ISC',inputs:[{path:'countries-110m.json',sha256:coarse.sha256},{path:'countries-50m.json',sha256:detailed.sha256}],transformation:'Only add valid M49 features absent from the existing 110m geometry; do not replace existing boundaries or infer trade coverage.'},features};
await writeFile(new URL('../content/geography/world-small-country-geometry.json',import.meta.url),JSON.stringify(data)+'\n');
console.log(JSON.stringify({addedFeatures:features.length,hasSingapore:features.some(item=>String(item.id)==='702')}));
