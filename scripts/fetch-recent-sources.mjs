import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const baseline=await read('data/published/releases/generic-smartphone/globe-chain-smartphone-2023.16/fixture.json');
const dir='data/published/raw/refresh-2026-09-16/';
await mkdir(new URL(dir,root),{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function capture(name,url){
 const path=new URL(dir+name+'.json',root);
 try {return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let result;
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const body=await r.text();if(!r.ok)throw Error('HTTP '+r.status);result={url,retrievedAt:new Date().toISOString(),httpStatus:r.status,sha256:hash(body),body};JSON.parse(body);break;}catch(e){console.error(name,e.message);if(attempt===2)throw e;await new Promise(r=>setTimeout(r,3000));}
 }
 await writeFile(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
const indicators=['TX.VAL.MRCH.CD.WT','TM.VAL.MRCH.CD.WT','FI.RES.TOTL.CD'];
for(const code of indicators){const s=await capture('wdi-'+code,'https://api.worldbank.org/v2/country/AUS;COD;CHL;CHN;DEU;IDN;JPN;KOR;USA/indicator/'+code+'?date=2024:2025&format=json&per_page=100');console.log(code,JSON.parse(s.body)[1]?.filter(x=>x.value!==null).length);}
const groups=new Map();
for(const o of [...baseline.tradeObservations,...baseline.materialTradeObservations]){
 const key=o.reporterCode+'-'+o.partnerCode;
 if(!groups.has(key))groups.set(key,{reporter:o.reporterCode,partner:o.partnerCode,codes:new Set()});
 groups.get(key).codes.add(o.classificationCode);
}
const results=[];
for(const [key,g] of groups){for(const year of [2025,2024]){
 const url=new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS');
 for(const [k,v] of Object.entries({reporterCode:g.reporter,partnerCode:g.partner,cmdCode:[...g.codes].sort().join(','),flowCode:'M,X',period:year,motCode:0,partner2Code:0,customsCode:'C00',maxRecords:500}))url.searchParams.set(k,v);
 try{const s=await capture('comtrade-'+key+'-'+year,url.href);const rows=JSON.parse(s.body).data;if(!Array.isArray(rows))throw Error('No data array');if(rows.length>=500)throw Error('Truncated response');console.log(key,year,rows.length);results.push({key,year,rows:rows.length,file:'comtrade-'+key+'-'+year+'.json'});}catch(e){results.push({key,year,error:e.message});console.error('Unfilled',key,year,e.message);}
 await new Promise(r=>setTimeout(r,1500));
}}
await writeFile(new URL('docs/data-refresh/fetch-results.json',root),JSON.stringify(results,null,2)+'\n');
