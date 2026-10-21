import urllib.request,urllib.error,concurrent.futures,pathlib,hashlib,json,datetime,sys,re,html
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path('data/raw/china-hvac-participants-2026-10-21')
rows=[('gmcc-contact','https://www.gmcc-welling.com/en/join-us'),('snowman-evaporative','https://www.snowman.cn/en/product/evaporative_condenser.html'),('snowman-contact','https://www.snowman.cn/en/about/contact_us.html'),('jintian-contact','https://www.jtcopper.com/contact')]
for id in ['jingda-fin-press','jingda-expander','jingda-home']:
 s=(root/(id+'.html')).read_text(encoding='utf-8')
 for u in re.findall(r"src='([^']+\.Body\.js[^']*)'",s):rows.append((id+'-body',u))
def f(pair):
 id,url=pair;m={'id':id,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'httpStatus':None,'contentType':None,'file':None,'bytes':0,'sha256':None}
 try:
  with urllib.request.urlopen(url,timeout=20) as r:
   b=r.read();m.update(httpStatus=r.status,contentType=r.headers.get('Content-Type'),finalUrl=r.geturl(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),file=id+('.js' if '-body' in id else '.html'));(root/m['file']).write_bytes(b)
 except urllib.error.HTTPError as e:m.update(httpStatus=e.code,error=str(e))
 except Exception as e:m['error']=str(e)
 return m
r=list(concurrent.futures.ThreadPoolExecutor(max_workers=7).map(f,rows));(root/'manifest-additional.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for x in r:print(json.dumps(x,ensure_ascii=False))
