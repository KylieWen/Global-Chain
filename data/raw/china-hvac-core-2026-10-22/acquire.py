"""Capture method. Use a new workspace directory; certificate verification always remains enabled."""
from pathlib import Path
import sys,json,datetime,hashlib,urllib.request,subprocess,concurrent.futures,re,html
URLS={
'hvaccore22-wolong-motors':'https://www.wolong.com.cn/products-solutions/motors-drives/daily-motors/air-conditioning-motors',
'hvaccore22-wolong-contact':'https://www.wolong.com.cn/contact-us/online-message',
'hvaccore22-topband-hvac':'https://www.topband.com/cn/solution/hvac/',
'hvaccore22-topband-contact':'https://www.topband.com/cn/contact-us/',
'hvaccore22-dongyue-r32':'https://www.dongyuechem.com/en/product/show-1566.html',
'hvaccore22-dongyue-contact':'https://www.dongyuechem.com/en/contact.html',
'hvaccore22-daikin-refrigerants':'https://www.daikinchem.com.cn/index/product/index.html?id=12',
'hvaccore22-kingfa-housing':'https://www.kingfa.com.cn/index.php/goods/details/index/id/95/cid/92.html',
'hvaccore22-welling-motors':'https://www.wellingmotor.com/cn/product/product-detail?categoryId=100074',
'hvaccore22-kingfa-contact':'https://www.kingfa.com.cn/index.php/portal/list/index/id/53.html',
'hvaccore22-welling-contact':'https://www.wellingmotor.com/cn/join-us',
'hvaccore22-dongyue-r32-windows':'https://www.dongyuechem.com/en/product/show-1566.html',
'hvaccore22-dongyue-contact-windows':'https://www.dongyuechem.com/en/contact.html'
}
if len(sys.argv)!=2:raise SystemExit('Usage: python acquire.py NEW_BATCH_DIRECTORY')
root=Path(sys.argv[1]).resolve();workspace=Path.cwd().resolve()
if not root.is_relative_to(workspace):raise SystemExit('Directory must be inside the workspace')
if root.exists():raise SystemExit('Refusing to overwrite an existing batch')
root.mkdir(parents=True)
def fetch(pair):
 key,url=pair;p=root/(key+'.html');m={'id':key,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')}
 try:
  if key.endswith('-windows'):
   m['client']='Windows curl default certificate validation'
   r=subprocess.run(['curl.exe','--silent','--show-error','--location','--max-time','30','--output',str(p),'--write-out','%{http_code}',url],capture_output=True,text=True)
   if r.returncode or r.stdout!='200':raise RuntimeError(r.stderr.strip()+' HTTP '+r.stdout)
   raw=p.read_bytes();m['httpStatus']=200
  else:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; GlobeChain public source research)'}),timeout=35) as r:raw=r.read();m.update(httpStatus=r.status,finalUrl=r.url,contentType=r.headers.get('content-type'))
   p.write_bytes(raw)
  m.update(rawFile=p.relative_to(workspace).as_posix(),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
  s=raw.decode('utf-8',errors='replace');s=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',s,flags=re.S|re.I);s=html.unescape(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',s))).strip();t=root/(key+'.txt');t.write_text(s,encoding='utf-8');m['textFile']=t.relative_to(workspace).as_posix()
 except Exception as e:m.update(httpStatus=getattr(e,'code',None),error=str(e),rawFile=None,sha256=None)
 return m
E=list(concurrent.futures.ThreadPoolExecutor(max_workers=5).map(fetch,URLS.items()));(root/'manifest.json').write_text(json.dumps({'schemaVersion':'source-capture.v1','batchId':root.name,'entries':E},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Captured',len(E),'results; HTTP200:',sum(m.get('httpStatus')==200 for m in E))
