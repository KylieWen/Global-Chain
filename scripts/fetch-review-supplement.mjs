import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../data/raw/review-supplement-2026-10-23/', import.meta.url);
await mkdir(directory, {recursive:true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const indicator of ['TX.VAL.MRCH.CD.WT','TM.VAL.MRCH.CD.WT','FI.RES.TOTL.CD']) {
  const target = new URL(`wdi-${indicator}.json`, directory);
  try {
    const existing = JSON.parse(await readFile(target,'utf8'));
    if (hash(existing.body)!==existing.sha256) throw new Error('Existing capture hash mismatch');
    console.log(`${indicator}: verified existing capture`);continue;
  } catch(error) { if(error.code!=='ENOENT') throw error; }
  const url = `https://api.worldbank.org/v2/country/CHN;DEU;USA;SGP;VNM;IND;BGD;BRA/indicator/${indicator}?date=2024:2025&format=json&per_page=100`;
  const response = await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`${indicator}: HTTP ${response.status}`);
  const body = await response.text();const parsed=JSON.parse(body);
  if(!Array.isArray(parsed[1]) || parsed[0].pages!==1) throw new Error('Missing or truncated WDI data');
  const capture={url,retrievedAt:new Date().toISOString(),httpStatus:response.status,sha256:hash(body),body};
  await writeFile(target,JSON.stringify(capture,null,2)+'\n',{flag:'wx'});
  console.log(`${indicator}: ${parsed[1].filter(row=>row.value!==null).length} published values`);
}
for(const [name,url] of [
 ['customs-query','https://online.customs.gov.cn/ocportal/mySearch/'],
 ['export-tax-query','https://tianjin.chinatax.gov.cn/nsrxt/11200000000/0500/050011/20250603142736825.shtml']
]){
 const target=new URL(`${name}.html`,directory);try{await readFile(target);console.log(`${name}: existing capture`);continue}catch(error){if(error.code!=='ENOENT')throw error}
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 await writeFile(target,bytes,{flag:'wx'});
 await writeFile(new URL(`${name}.meta.json`,directory),JSON.stringify({url,retrievedAt:new Date().toISOString(),httpStatus:response.status,sha256:hash(bytes),contentType:response.headers.get('content-type')},null,2)+'\n',{flag:'wx'});
 console.log(`${name}: captured ${bytes.length} bytes`);
}
