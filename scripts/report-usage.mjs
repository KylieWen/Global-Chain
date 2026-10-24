// Run on the server over the owner's existing SSH access; no public read API.
import { readdir,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(process.env.GLOBECHAIN_USAGE_DIR??process.argv[2]??'/opt/globechain/shared/usage');
const days=[]; const totals={};
for(const file of (await readdir(root)).filter(file=>/^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort()){
 const day=JSON.parse(await readFile(resolve(root,file),'utf8'));
 if(day.schemaVersion!==1||!day.counts)throw new Error('Unknown usage schema');
 days.push(day.day);
 for(const [key,count] of Object.entries(day.counts))totals[key]=(totals[key]??0)+count;
}
console.log(JSON.stringify({days,retentionDays:30,description:'Anonymous event totals; no unique visitor or personal journey counts',counts:totals},null,2));
