import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const phase=process.argv[2]??'before';
const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const versions=['globe-chain-smartphone-2026.4','globe-chain-smartphone-2026.3','globe-chain-smartphone-2026.2'];
const measurements=[];
for(let round=0;round<4;round++)for(const datasetVersion of versions){
  const start=performance.now();const response=await fetch(`${base}/map?product=generic-smartphone&datasetVersion=${datasetVersion}`);const html=await response.text();
  if(response.status!==200)throw new Error('Map benchmark returned '+response.status);
  measurements.push({datasetVersion,round,ms:Number((performance.now()-start).toFixed(2)),bytes:Buffer.byteLength(html)});
}
const times=measurements.filter(row=>row.round>0).map(row=>row.ms).sort((a,b)=>a-b);
const result={phase,sampleCount:measurements.length,warmMedianMs:times[Math.floor(times.length/2)],warmMaxMs:times.at(-1),measurements};
const folder=resolve('output/qa/2026-10-23-claude-completion');await mkdir(folder,{recursive:true});await writeFile(resolve(folder,`http-${phase}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
