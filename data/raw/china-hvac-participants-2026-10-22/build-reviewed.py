from pathlib import Path
import json, hashlib, re, html
R=Path('data/raw/china-hvac-participants-2026-10-22')
V='china-hvac-research-2026.10.2'
P={'granularity':'snapshot','start':'2026-10-22','end':'2026-10-22','label':'2026-10-22官网产品与联系入口复核'}
old=json.loads(Path('content/industry/china-hvac-reviewed-2026-10.json').read_text(encoding='utf-8'))
meta={x['id']:x for name in ['manifest.json','manifest-additional.json'] for x in json.loads((R/name).read_text(encoding='utf-8'))['entries']}
def fact(sourceIds,method='manual_topic_index',period=P):
 return {'sourceIds':sourceIds,'period':period,'unit':'not_applicable','method':method,'datasetVersion':V,'status':'validated'}
S=[]
def source(id,publisher,name,locator,linked=None):
 m=meta[id];assert m['httpStatus']==200 and m['rawFile']
 S.append({'id':id,'publisher':publisher,'name':name,'url':m['url'],'publishedAt':None,'retrievedAt':m['retrievedAt'],'license':'官网未声明开放复用许可；仅发布有限人工摘要和官方入口，原件用于复核。','scope':'官网公开的产品用途与机构入口。','locator':locator,'rawFile':m['rawFile'],'sha256':m['sha256'],'httpStatus':m['httpStatus'],'linkedRawIds':linked or [],**fact([id],'manual_review_of_official_public_material')})
source('hvac22-huafeng-aluminium','华峰集团 / 上海华峰铝业股份有限公司','铝热传输材料与国内销售入口','铝合金板带箔材料；应用场景含民用/商用空调热管理；页面列上海与重庆机构信息和国内销售热线。')
source('hvac22-lihua-brazing','广东力华感应设备有限公司','空调配管高频自动钎焊机','产品名称与制冷暖通行业分类；页面推荐分流管、分配器、三工位铜管与铜弯管钎焊设备。')
source('hvac22-lihua-contact','广东力华感应设备有限公司','联系方式','企业公开的机构地址、联系方式与咨询入口。')
source('hvac22-jinchen-home','浙江新金宸机械有限公司','微通道换热器产品与应用','微通道冷凝器等产品；家用/商用空调、机房空调、热泵热水器、冷冻冷藏等应用；页脚sales邮箱。')
source('hvac22-wayeal-home-refrigeration','安徽皖仪科技股份有限公司','家用制冷行业真空箱检漏系统','适用家用空调冷凝器/蒸发器、压缩机、热交换器、膨胀阀等泄漏检测。')
source('hvac22-wayeal-contact','安徽皖仪科技股份有限公司','联系我们','机构地址、统一服务专线、机构邮箱与采购需求表单入口；仅提供链接，不提交。')
source('hvac22-wayeal-applications','安徽皖仪科技股份有限公司','家电制冷行业应用','制冷行业—家用空调密封性检测解决方案：辅助抽空和人工喷氦检漏。')
source('hvac22-jieyang-home','杭州捷阳电器有限公司','翅片式冷凝器、蒸发器及应用','官网HTML直接引用Body.js，正文说明翅片式冷凝器/蒸发器用于机柜空调、制冰机、冷水机、除湿机、冷干机等；页内联系与售后导航。',['hvac22-jieyang-body'])
source('hvac22-gmcc-contact-check','GMCC / Midea Group','GMCC Contact us入口复核','页面标题与正文均为Contact us / Contact Information，含China机构地址、机构邮箱；路径join-us在此站不是招聘页。')
T=[]
def topic(id,label,kind,description,sourceIds):T.append({'id':id,'label':label,'kind':kind,'description':description,**fact(sourceIds)})
topic('hvac22-aluminium-thermal-material','铝合金板带箔热传输材料','material','用于空调热管理等场景的铝合金板、带、箔材料，可从官方页面查看产品及国内销售入口。',['hvac22-huafeng-aluminium'])
topic('hvac22-brazing-equipment','空调配管高频钎焊设备','equipment','对空调配管、分流管、分配器及铜弯管进行感应加热钎焊的设备。',['hvac22-lihua-brazing'])
topic('hvac22-vacuum-leak-equipment','家用制冷真空箱检漏设备','equipment','用于空调冷凝器、蒸发器、压缩机和阀件等的密封性检测。',['hvac22-wayeal-home-refrigeration'])
topic('hvac22-finned-coil','翅片式冷凝器与蒸发器','component','连接多种制冷设备的换热部件，应用包括制冰、冷水、除湿及机柜空调。',['hvac22-jieyang-home'])
topic('hvac22-microchannel-exchanger','微通道换热器','component','包含微通道冷凝器等形式，服务家用、商用、机房空调与热泵等场景。',['hvac22-jinchen-home'])
topic('hvac22-commercial-ac','商用空调系统','product','微通道换热器和铝热传输材料的应用方向之一。',['hvac22-jinchen-home','hvac22-huafeng-aluminium'])
topic('hvac22-cabinet-ac','机柜与机房空调','product','面向机柜、电气或机房的温控设备，可采用翅片或微通道换热器。',['hvac22-jinchen-home','hvac22-jieyang-home'])
topic('hvac22-dehumidifier','除湿机','product','翅片式冷凝器和蒸发器的下游应用之一。',['hvac22-jieyang-home'])
topic('hvac22-refrigerated-dryer','冷冻式干燥机','product','翅片式换热器的下游应用之一，官网列冷干机换热器产品。',['hvac22-jieyang-home'])
topic('hvac22-heat-pump-water-heater','热泵热水器','product','微通道换热器的公开应用方向之一。',['hvac22-jinchen-home'])
E=[]
def edge(a,b,kind,description,sourceIds,period=P):E.append({'fromTopicId':a,'toTopicId':b,'kind':kind,'description':description,**fact(sourceIds,'manual_technical_adjacency_not_customer_supply',period)})
edge('tube-manufacturing','copper-tube','used_in','铜管制造环节产出内螺纹管、复绕盘管与空调直管。',['jintian-copper-tube'],old['period'])
edge('hvac22-aluminium-thermal-material','room-air-conditioner','used_in','铝热传输材料用于民用空调热管理。',['hvac22-huafeng-aluminium'])
edge('hvac22-aluminium-thermal-material','hvac22-commercial-ac','used_in','铝热传输材料用于商用空调热管理。',['hvac22-huafeng-aluminium'])
edge('hvac22-brazing-equipment','brazing','equipment_for','高频感应设备用于空调配管和铜管组件钎焊。',['hvac22-lihua-brazing'])
edge('copper-tube','brazing','process_input','铜管、铜弯管与配管组件进入高频钎焊加工。',['hvac22-lihua-brazing'])
edge('hvac22-vacuum-leak-equipment','leak-testing','equipment_for','真空箱设备用于制冷部件泄漏检测。',['hvac22-wayeal-home-refrigeration'])
edge('leak-testing','heat-exchanger','used_in','对家用空调冷凝器、蒸发器和热交换器进行泄漏检测。',['hvac22-wayeal-home-refrigeration'])
edge('leak-testing','compressor','used_in','真空箱产品适用压缩机的泄漏检测。',['hvac22-wayeal-home-refrigeration'])
edge('leak-testing','control-valve','used_in','真空箱产品适用膨胀阀等阀件泄漏检测。',['hvac22-wayeal-home-refrigeration'])
for a,b in [('hvac22-finned-coil','ice-machine'),('hvac22-finned-coil','water-chiller'),('hvac22-finned-coil','hvac22-cabinet-ac'),('hvac22-finned-coil','hvac22-dehumidifier'),('hvac22-finned-coil','hvac22-refrigerated-dryer')]:
 edge(a,b,'used_in','翅片式冷凝器与蒸发器用于该类制冷设备。',['hvac22-jieyang-home'])
for b in ['room-air-conditioner','hvac22-commercial-ac','hvac22-cabinet-ac','hvac22-heat-pump-water-heater']:
 edge('hvac22-microchannel-exchanger',b,'used_in','微通道换热器用于该类空调或热管理系统。',['hvac22-jinchen-home'])
for a,ss in [('hvac22-aluminium-thermal-material',['hvac22-huafeng-aluminium']),('hvac22-brazing-equipment',['hvac22-lihua-contact']),('hvac22-vacuum-leak-equipment',['hvac22-wayeal-contact']),('hvac22-finned-coil',['hvac22-jieyang-home']),('hvac22-microchannel-exchanger',['hvac22-jinchen-home'])]:
 edge(a,'b2b-official-contact','sold_through','打开企业官方产品、机构联系或销售入口。',ss)
O=[]
def org(id,name,topics,product,contact,ss,description,extra=None):
 O.append({'id':id,'name':name,'topicIds':topics,'productUrl':product,'contactUrl':contact,'description':description,**fact(ss,'manual_review_of_official_public_material'),**(extra or {})})
org('hvac22-org-huafeng','上海华峰铝业股份有限公司',['hvac22-aluminium-thermal-material'],'https://www.huafeng.com/product/8.html','https://www.huafeng.com/product/8.html',['hvac22-huafeng-aluminium'],'铝合金板带箔热传输材料，官网列民用与商用空调应用、国内销售及机构入口。')
org('hvac22-org-lihua','广东力华感应设备有限公司',['hvac22-brazing-equipment'],'https://lihuachina.com/html/product_1540.html','https://lihuachina.com/html/about_474.html',['hvac22-lihua-brazing','hvac22-lihua-contact'],'空调配管、分流管、分配器及铜弯管等高频感应钎焊设备。')
org('hvac22-org-wayeal','安徽皖仪科技股份有限公司',['hvac22-vacuum-leak-equipment'],'https://www.wayeal.com.cn/Product_1/166.html','https://www.wayeal.com.cn/Contact.html',['hvac22-wayeal-home-refrigeration','hvac22-wayeal-contact','hvac22-wayeal-applications'],'家用制冷真空箱检漏系统与家用空调密封性检测方案，覆盖换热器、压缩机和阀件。')
org('hvac22-org-jieyang','杭州捷阳电器有限公司',['hvac22-finned-coil'],'https://www.hzjyang.com/','https://www.hzjyang.com/',['hvac22-jieyang-home'],'翅片式冷凝器、蒸发器，面向制冰机、冷水机、除湿机、冷干机和机柜空调等用途。')
org('hvac22-org-jinchen','浙江新金宸机械有限公司',['hvac22-microchannel-exchanger'],'https://www.newjinchen.com/','https://www.newjinchen.com/',['hvac22-jinchen-home'],'微通道换热器及相关部件，面向家用、商用、机房空调与热泵热水器。官网页脚提供销售入口。')
obj={'schemaVersion':'china-hvac-research.v1','id':'china-hvac-supplement-2026-10-22','label':'中国空调材料、设备与应用追加研究','reviewedAt':'2026-10-22','period':P,'datasetVersion':V,'method':'manual_review_of_official_public_material','status':'validated','scope':'补充公开产品能力、制造设备、技术用途与官方联系入口。','limitations':['企业公开产品说明与技术用途不等于企业间实际供货。','华峰来源说明铝合金板带箔与空调热管理，未把其材料指定为某品牌或某型号翅片。','新金宸具体产品页与联系子页返回319，本批只使用已取得正文的主站和页脚机构销售入口。','捷阳主站正文来自HTML直接引用的Body.js，离线解码不执行；商品0.00为网站占位，不提取为价格。','杭州本润获取出现TLS连接中断，未降低证书验证或列入已核验企业。'],'sources':S,'topics':T,'relations':E,'organizations':O,'verificationNotes':[{'organizationId':'org-gmcc','sourceId':'hvac22-gmcc-contact-check','result':'旧join-us URL正文确为Contact us机构联系页，保留原入口。'}]}
# Validation uses existing reviewed references and the independent supplemental batch.
sids={x['id'] for x in old['sources']+S};tids={x['id'] for x in old['topics']+T}
assert len({x['id'] for x in S})==len(S) and len({x['id'] for x in T})==len(T)
for item in T+E+O:assert set(item['sourceIds'])<=sids
for e in E:assert e['fromTopicId'] in tids and e['toTopicId'] in tids
for o in O:assert set(o['topicIds'])<=tids
for item in meta.values():
 if item.get('httpStatus')==200:assert hashlib.sha256(Path(item['rawFile']).read_bytes()).hexdigest()==item['sha256']
for s in S:
 assert hashlib.sha256(Path(s['rawFile']).read_bytes()).hexdigest()==s['sha256']
 for rawId in s['linkedRawIds']:assert meta[rawId]['httpStatus']==200
# Produce a readable derivative from the directly linked script without executing it.
s=Path(meta['hvac22-jieyang-body']['rawFile']).read_text(encoding='utf-8')
s=re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m[1],16)),s).replace('\\r',' ').replace('\\n',' ').replace('\\t',' ')
s=html.unescape(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',s)))
(R/'hvac22-jieyang-body.txt').write_text(s,encoding='utf-8')
out=Path('content/industry/china-hvac-supplement-2026-10-22.json');out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Validated supplemental sources:',len(S),'topics:',len(T),'relations:',len(E),'organizations:',len(O),'raw HTTP200:',sum(x.get('httpStatus')==200 for x in meta.values()))
