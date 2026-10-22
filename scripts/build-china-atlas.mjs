import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const input = JSON.parse(await readFile(resolve(root,'content/geography/china-atlas-input-2026-10-22.json'),'utf8'));
const rawDir = resolve(root,'data/raw/china-atlas-2026-10-22');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const date = '2026-10-22T00:00:00.000Z';
const geometry = JSON.parse(await readFile(resolve(rawDir,'100000_full.json'),'utf8'));
const sources = [];
for (const code of ['100000', ...new Set(input.places.filter(place=>place.cityCode!==Number(place.provinceCode)).map(place=>place.provinceCode))]) {
  const name = `${code}_full.json`; const bytes = await readFile(resolve(rawDir,name));
  const retrievedAt = existsSync(resolve(rawDir,`${name}.meta.json`)) ? JSON.parse(await readFile(resolve(rawDir,`${name}.meta.json`),'utf8')).retrievedAt : (await stat(resolve(rawDir,name))).mtime.toISOString();
  sources.push({id:`datav-${code}`,name:code==='100000'?'中国省级边界与南海诸岛线':'城市参考位置',publisher:'阿里云 DataV.GeoAtlas',url:`https://geo.datav.aliyun.com/areas_v3/bound/${name}`,retrievedAt,rawPath:`data/raw/china-atlas-2026-10-22/${name}`,sha256:sha(bytes),scope:'保留原始边界；城市中心仅作区域示意点，非工厂地址。'});
}
for (const source of input.sources) {
  const path = resolve(rawDir,`${source.id}.html`);
  if (!existsSync(path)) throw new Error(`Missing raw source ${source.id}`);
  const bytes = await readFile(path);
  const meta = JSON.parse(await readFile(`${path}.meta.json`,'utf8'));
  if(meta.status!==200) throw new Error(`Unsuccessful raw source ${source.id}`);
  sources.push({id:source.id,name:source.name,publisher:source.publisher,url:source.url,retrievedAt:meta.retrievedAt,rawPath:`data/raw/china-atlas-2026-10-22/${source.id}.html`,sha256:sha(bytes),scope:source.scope});
}
const fact = sourceIds => ({period:{granularity:'snapshot',start:'2026-10-22',end:'2026-10-22',label:'2026-10-22整理；各原始资料年份见来源'},unit:'not_applicable',method:'curated',dataStatus:'observed',datasetVersion:input.datasetVersion,sourceIds});
const nodes = input.nodes.map(node=>{
  const years=node.sourceIds.map(id=>input.sources.find(source=>source.id===id).year);
  const year=Math.min(...years); const period=year===2026?fact([]).period:{granularity:'annual',start:`${year}-01-01`,end:`${year}-12-31`,label:`${year}年资料`};
  return {...node,organizationIds:node.organizationIds??[],topicIds:node.topicIds??[],...fact(node.sourceIds),period};
});
const places = [];
for(const place of input.places) {
  const code=place.cityCode===Number(place.provinceCode)?'100000':place.provinceCode;
  const geo=JSON.parse(await readFile(resolve(rawDir,`${code}_full.json`),'utf8'));
  const item=geo.features.find(feature=>feature.properties.adcode===place.cityCode);
  if(!item?.properties.center)throw new Error(`Missing city anchor ${place.id}`);
  const {cityCode,...fields}=place;
  places.push({...fields,coordinates:item.properties.center.map(n=>Math.round(n*100)/100),coordinateMethod:'approximate_city_anchor',coordinateSourceId:`datav-${code}`});
}
const connections = input.connections.map((edge,index)=>{
  const sourceIds=[...new Set([nodes.find(node=>node.id===edge.from),nodes.find(node=>node.id===edge.to)].flatMap(node=>node.sourceIds))];
  return {...edge,id:`cn-route-${index+1}`,description:'按生产环节组织的代表性区域连接；两端资料分别支持区域角色，不证明这两地或企业间的实际供货、运输路线或交易金额。',evidenceLevel:'representative',value:null,valueDataStatus:'unknown',...fact(sourceIds)};
});
const output={schemaVersion:'regional-supply-atlas.v1',datasetVersion:input.datasetVersion,reviewedAt:date,regionEntityId:'country-cn',sources,places,nodes,connections};
await writeFile(resolve(root,'content/geography/china-supply-atlas-2026-10-22.json'),JSON.stringify(output,null,2)+'\n');
await mkdir(resolve(root,'apps/web/lib/geo'),{recursive:true});
// Keep every original feature, including the South China Sea island/dash geometry.
await writeFile(resolve(root,'apps/web/lib/geo/china-provinces.json'),JSON.stringify(geometry));
console.log(JSON.stringify({version:input.datasetVersion,products:new Set(nodes.map(node=>node.productId)).size,nodes:nodes.length,connections:connections.length,features:geometry.features.length}));
