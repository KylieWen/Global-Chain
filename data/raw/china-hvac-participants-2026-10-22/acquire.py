"""Method record. Capture public pages into a NEW directory; never overwrite archived responses."""
from pathlib import Path
import sys,json,datetime,hashlib,urllib.request,concurrent.futures,re,html
URLS={
'hvac22-huafeng-aluminium':'https://www.huafeng.com/product/8.html',
'hvac22-lihua-brazing':'https://lihuachina.com/html/product_1540.html',
'hvac22-lihua-contact':'https://lihuachina.com/html/about_474.html',
'hvac22-jinchen-home':'https://www.newjinchen.com/',
'hvac22-jinchen-contact':'https://www.newjinchen.com/about_lxwm/lxwmfda.html',
'hvac22-jinchen-condenser':'https://www.newjinchen.com/product/741.html',
'hvac22-wayeal-vacuum':'https://www.wayeal.com.cn/Product/32.html',
'hvac22-benrun-home':'https://www.hzbrzl.com/',
'hvac22-jieyang-home':'https://www.hzjyang.com/',
'hvac22-gmcc-contact-check':'https://www.gmcc-welling.com/en/join-us',
'hvac22-wayeal-home-refrigeration':'https://www.wayeal.com.cn/Product_1/166.html',
'hvac22-wayeal-contact':'https://www.wayeal.com.cn/Contact.html',
'hvac22-wayeal-applications':'https://www.wayeal.com.cn/Solution_1/13.html',
'hvac22-jieyang-body':'https://img.wanwang.xin/pubsf/10370/10370600/cdn-static-pages/pages/pc/32_zh-cn.html.Body.js?version=20260911113412'
}
if len(sys.argv)!=2:raise SystemExit('Usage: python acquire.py NEW_BATCH_DIRECTORY')
root=Path(sys.argv[1]).resolve();workspace=Path.cwd().resolve()
if not root.is_relative_to(workspace):raise SystemExit('New batch directory must be inside the workspace')
if root.exists():raise SystemExit('Refusing to overwrite an existing batch directory')
root.mkdir(parents=True)
def fetch(pair):
 key,url=pair;result={'id':key,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; GlobeChain public source research)'}),timeout=35) as r:raw=r.read();result.update(httpStatus=r.status,finalUrl=r.url,contentType=r.headers.get('content-type'))
  path=root/(key+('.js' if key.endswith('-body') else '.html'));path.write_bytes(raw)
  result.update(rawFile=path.relative_to(workspace).as_posix(),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
  text=raw.decode('utf-8',errors='replace')
  if key.endswith('-body'):text=re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m[1],16)),text).replace('\\r',' ').replace('\\n',' ').replace('\\t',' ')
  text=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',text,flags=re.S|re.I);text=html.unescape(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',text))).strip()
  p=root/(key+'.txt');p.write_text(text,encoding='utf-8');result['textFile']=p.relative_to(workspace).as_posix()
 except Exception as e:result.update(httpStatus=getattr(e,'code',None),error=str(e),rawFile=None,sha256=None)
 return result
entries=list(concurrent.futures.ThreadPoolExecutor(max_workers=5).map(fetch,URLS.items()))
(root/'manifest.json').write_text(json.dumps({'schemaVersion':'source-capture.v1','batchId':root.name,'entries':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Saved',len(entries),'acquisition results; HTTP200:',sum(x.get('httpStatus')==200 for x in entries))
