import urllib.request,urllib.error,concurrent.futures,pathlib,hashlib,json,datetime,sys,re,html
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path('data/raw/china-hvac-participants-2026-10-21')
rows=[
('gmcc-home','https://www.gmcc-welling.com/'),
('jintian-copper-tube','https://www.jtcopper.com/branch/tong-guan'),
('huafeng-aluminium','https://www.huafeng.com/product/8.html'),
('huabei-ac-foil','https://www.chinanca.com/cpsj/ktlb/'),
('jingda-fin-press','https://www.nbjingda.com/productinfo/652949.html'),
('jingda-expander','https://www.nbjingda.com/productinfo/652887.html'),
('jingda-home','https://www.nbjingda.com/'),
('xinrui-brazing','https://www.xinruigroup.com/h-col-152.html'),
('wayeal-home','https://www.wayeal.com.cn/'),
('dunan-chiller','https://www.dunanac.com/product_list.aspx'),
('snowman-ice','https://www.snowman.cn/en/product/icemachine.html'),
('gree-home','https://www.gree.com/'),
('gree-store','https://mall.gree.com/?spreadId=10')]
def f(pair):
 id,url=pair;meta={'id':id,'url':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'httpStatus':None,'contentType':None,'file':None,'bytes':0,'sha256':None}
 try:
  with urllib.request.urlopen(url,timeout=25) as r:
   b=r.read();meta.update(httpStatus=r.status,contentType=r.headers.get('Content-Type'),finalUrl=r.geturl(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),file=id+'.html');(root/meta['file']).write_bytes(b)
   enc=r.headers.get_content_charset() or 'utf-8';s=b.decode(enc,'replace');s=re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>',' ',s,flags=re.I);t=html.unescape(re.sub('<[^>]+>',' ',s));t=re.sub(r'\s+',' ',t);(root/(id+'.txt')).write_text(t,encoding='utf-8')
 except urllib.error.HTTPError as e:meta.update(httpStatus=e.code,error=str(e))
 except Exception as e:meta['error']=str(e)
 return meta
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(f,rows));(root/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for x in results:print(json.dumps(x,ensure_ascii=False))
