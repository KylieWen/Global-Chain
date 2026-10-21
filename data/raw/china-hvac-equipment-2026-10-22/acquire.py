"""Acquisition method record: archive the recorded official URLs into a NEW batch directory."""
from pathlib import Path
import sys,json,urllib.request,datetime,hashlib
R=Path(__file__).resolve().parent
if len(sys.argv)!=2:raise SystemExit('Usage: python acquire.py NEW_BATCH_DIRECTORY')
W=Path.cwd().resolve();D=Path(sys.argv[1]).resolve()
if not D.is_relative_to(W) or D.exists():raise SystemExit('Require a new directory inside the workspace; archived batches are never overwritten')
D.mkdir(parents=True)
urls={x['id']:x['url'] for f in R.glob('manifest*.json') for x in json.loads(f.read_text(encoding='utf-8'))['entries']};results=[]
for key,url in urls.items():
 m={'id':key,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; GlobeChain public source research)'}),timeout=30) as r:b=r.read();m.update(httpStatus=r.status,finalUrl=r.url,contentType=r.headers.get('content-type'))
  p=D/(key+('.js' if key.endswith('-app') else '.html'));p.write_bytes(b);m.update(rawFile=p.relative_to(W).as_posix(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
 except Exception as e:m.update(httpStatus=getattr(e,'code',None),error=str(e),rawFile=None,sha256=None)
 results.append(m)
(D/'manifest.json').write_text(json.dumps({'schemaVersion':'source-capture.v1','batchId':D.name,'entries':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
