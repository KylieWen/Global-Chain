import { readdir,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(process.argv[2]??'/opt/globechain/shared/usage');
const cutoff=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
for(const name of await readdir(root)){
 if(/^\d{4}-\d{2}-\d{2}\.json$/.test(name)&&name.slice(0,10)<cutoff)await unlink(resolve(root,name));
}
