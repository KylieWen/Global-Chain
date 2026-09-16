import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
// Pattern scan only; report locations and rule names, never matched secrets.
const rules=[['github-token',/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/],['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['openai-key',/sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],['aws-key',/AKIA[0-9A-Z]{16}/],['credential-url',/https?:\/\/[^\s/:"'<>\\]+:[^\s/@"'<>\\]{8,}@/],['credential-assignment',/(?:api[_-]?key|password|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_+\/=-]{20,}["']/i]];
const ignored=new Set(['.git','node_modules','.next','.pnpm-store','coverage']);
const findings=[];let files=0,blobs=0,commits=0;let skippedBinary=0;
function scan(buffer,where){if(buffer.subarray(0,8192).includes(0)){skippedBinary++;return}const s=buffer.toString('utf8');for(const [rule,re]of rules)if(re.test(s))findings.push({where,rule});}
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(ignored.has(e.name))continue;const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()){files++;scan(await readFile(p),p);}}}
await walk('.');
const gitExecutable=process.env.GIT_EXECUTABLE ?? 'git';
const git=(args)=>{const r=spawnSync(gitExecutable,args,{encoding:'utf8',maxBuffer:128*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Git command failed: '+args[0]);return r.stdout;};
scan(Buffer.from(git(['config','--local','--list'])),'git:local-config');
const objects=git(['rev-list','--objects','--all']).trim().split('\n');
const ids=objects.map(l=>l.split(' ')[0]);
const types=spawnSync(gitExecutable,['cat-file','--batch-check=%(objectname) %(objecttype)'],{input:ids.join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024,windowsHide:true});
if(types.status!==0)throw Error('Git object inventory failed');
for(const line of types.stdout.trim().split('\n')){const [oid,type]=line.split(' ');if(!['blob','commit'].includes(type))continue;const r=spawnSync(gitExecutable,['cat-file',type,oid],{maxBuffer:128*1024*1024,windowsHide:true});if(r.status!==0)throw Error('Object read failed');scan(r.stdout,'git:'+oid);if(type==='blob')blobs++;else commits++;}
const shallow=git(['rev-parse','--is-shallow-repository']).trim();
const report={checkedAt:new Date().toISOString(),gitExecutable,workspaceFiles:files,historyBlobs:blobs,historyCommits:commits,shallowRepository:shallow,skippedBinary,findings,limitations:'Pattern scan of workspace text and all reachable local refs, including commit messages; not credential revocation, remote audit, unreachable object scan, or binary/OCR inspection.'};
await mkdir('.preview/review-fix',{recursive:true});await writeFile('.preview/review-fix/security.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(findings.length)process.exitCode=1;
