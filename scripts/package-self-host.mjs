import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, readdir, rm, stat, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';

// Only reviewed application/configuration/published data. Never archive the worktree.
const roots = ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','apps/web','packages','content','data/published/manifest.json','data/published/active-manifest.json','data/published/releases'];
execFileSync('git',['diff','--quiet','HEAD','--',...roots]);
const commit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output = resolve('output/deploy');
await mkdir(output,{recursive:true});
const name = `globechain-${commit.slice(0,12)}-source.tar.gz`;
const archive = resolve(output,name);
execFileSync('git',['archive','--format=tar.gz',`--output=${archive}`,'HEAD',...roots]);
const list = () => execFileSync('tar',['-tzf',archive],{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split(/\r?\n/);
const validateEntries = entries => { for (const path of entries) {
  if (path.startsWith('/') || path.split('/').includes('..') || !roots.some(root => path===root || path.startsWith(root+'/') || root.startsWith(path))) throw new Error('Unexpected archive entry: '+path);
  if (/(^|\/)(?:\.git|\.env(?:\..*)?|node_modules|\.next|secrets)(\/|$)/.test(path) && !path.endsWith('/.env.example')) throw new Error('Private/generated entry: '+path);
} };
validateEntries(list());
const staging = await mkdtemp(resolve(output,'.stage-'));
const restoredReleaseByteLayouts = [];
let fixtureChecks = 0;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  execFileSync('tar',['-xzf',archive,'-C',staging]);
  const walk = async directory => {
    for (const entry of await readdir(directory,{withFileTypes:true})) {
      const path=resolve(directory,entry.name);
      if(entry.isDirectory()) await walk(path);
      else if(entry.name==='manifest.json'||entry.name==='active-manifest.json') {
        const manifest=JSON.parse(await readFile(path,'utf8'));
        for(const fixture of manifest.fixtures??[]) {
          const target=resolve(dirname(path),fixture.path);
          const inside=relative(staging,target);
          if(isAbsolute(inside)||inside.startsWith('..')) throw new Error('Fixture outside artifact');
          const bytes=await readFile(target);
          const expected=fixture.fixtureSha256??manifest.fixtureSha256;
          if(expected&&hash(bytes)!==expected) {
            // Older Git text attributes normalized one immutable CRLF release.
            // Restore only when the candidate exactly matches its recorded hash.
            const crlf=Buffer.from(bytes.toString('utf8').replace(/\r?\n/g,'\r\n'));
            if(hash(crlf)!==expected) throw new Error('Published fixture checksum mismatch: '+inside);
            const original=await stat(target);await writeFile(target,crlf);await utimes(target,original.atime,original.mtime);
            restoredReleaseByteLayouts.push(inside.replaceAll('\\','/'));
          }
          fixtureChecks++;
        }
      }
    }
  };
  await walk(resolve(staging,'data/published'));
  execFileSync('tar',['-czf',archive,'-C',staging,...roots]);
} finally {
  const local=relative(output,staging);
  if(isAbsolute(local)||!local.startsWith('.stage-')||local.includes('..')) throw new Error('Unsafe staging cleanup');
  await rm(staging,{recursive:true,force:true});
}
const entries=list();validateEntries(entries);
const bytes = await readFile(archive);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = { format:'globechain-self-host-source.v1', commit, archive:name, bytes:bytes.length, sha256, entryCount:entries.length, roots, fixtureChecks, restoredReleaseByteLayouts, node:'>=20.9.0; use a supported LTS on the Linux host', packageManager:JSON.parse(await readFile('package.json','utf8')).packageManager, status:'prepared_not_uploaded' };
await writeFile(resolve(output,name+'.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(output,name+'.sha256'),`${sha256}  ${name}\n`);
console.log(JSON.stringify(manifest,null,2));
