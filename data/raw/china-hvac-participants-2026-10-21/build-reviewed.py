from pathlib import Path
import json,hashlib,re
R=Path('data/raw/china-hvac-participants-2026-10-21');V='china-hvac-research-2026.10.1';P={'granularity':'snapshot','start':'2026-10-21','end':'2026-10-21','label':'2026-10-21官网公开产品能力快照；不是产销统计年度'};H={'granularity':'annual','start':'1997-01-01','end':'1997-12-31','label':'1997 DOE历史技术参考'}
meta={x['id']:x for f in ['manifest.json','manifest-additional.json'] for x in json.loads((R/f).read_text(encoding='utf-8'))}
sources=[]
def source(id,publisher,name,locator,ids=None):
 m=meta[id];sources.append({'id':id,'publisher':publisher,'name':name,'url':m['url'],'publishedAt':None,'retrievedAt':m['retrievedAt'],'license':'官网未声明开放复用许可；保留原文供审计，仅发布有限人工摘要和官方入口。','scope':'企业自述的公开产品/联系入口，不验证产品表现、市场地位或供货客户。','locator':locator,'rawFile':'data/raw/china-hvac-participants-2026-10-21/'+m['file'],'sha256':m['sha256'],'httpStatus':m['httpStatus'],'linkedRawIds':ids or [],'period':P,'unit':'not_applicable','method':'manual_review_of_official_public_material','datasetVersion':V,'status':'validated'})
source('jintian-copper-tube','宁波金田铜管有限公司 / 金田铜业','金田铜管官方产品与制造设备说明','主营产品：内螺纹铜管、水平复绕盘管、空调直管；先进设备：水平连铸炉、三辊行星轧机、盘拉机、内螺纹成型机。')
source('jintian-contact','金田铜业','联系金田','联系金田官方页面；仅保存公开机构入口，不抄录个人联系人。')
source('gmcc-home','GMCC / Midea Group','GMCC官方产品能力说明','GMCC简介及Products目录：rotary/reciprocating/scroll compressors、electronic expansion valves；空调、制冷和热泵用途。')
source('gmcc-contact','GMCC / Midea Group','GMCC Contact us','Contact Information China；页脚企业归属。')
source('jingda-fin-press','JDM Jingda Machine (Ningbo) Co., Ltd.','GC Fin press line','官方HTML引用的Body.js，Short Description及APPLICATION：空调冷凝器/蒸发器用翅片、铜铝翅片换热器。',['jingda-fin-press-body'])
source('jingda-expander','JDM Jingda Machine (Ningbo) Co., Ltd.','Four-station Vertical Expander','官方HTML引用的Body.js，Short Description：换热盘管进料、扩管、翻边、出料。',['jingda-expander-body'])
source('jingda-home','JDM Jingda Machine (Ningbo) Co., Ltd.','JDM官方设备与咨询入口','官方HTML引用的Body.js：HVAC HEAT EXCHANGE EQUIPMENT、TUBE PROCESSING EQUIPMENT、CONTACT US。',['jingda-home-body'])
source('snowman-ice','Fujian Snowman Group Co., Ltd.','Snowkey Ice machines','产品目录：Flake/Tube/Plate/DX Block Ice Machine、Water Chiller；Ice Plant & Ice Systems。')
source('snowman-evaporative','Fujian Snowman Group Co., Ltd.','Evaporative Condenser','产品面包屑：Products > Heat Exchangers > Evaporative Condenser；仅支持公开提供的产品类别，不支持材料规格或具体客户。')
source('snowman-contact','Fujian Snowman Group Co., Ltd.','Contact Us','Contact & Support官方机构入口，页面另列Sales network及售后服务。')
source('gree-home','珠海格力电器股份有限公司','格力官方业务与渠道导航','消费领域：家用空调、暖通设备等；格力董明珠店导航；服务中心。')
source('gree-store','珠海格力电器股份有限公司','格力董明珠店官方商城','HTML标题及格力主站导航互证；商品由脚本加载，本批不提取价格、库存或参数。')
doe=json.loads(Path('data/raw/home-ac-research/manifest.json').read_text(encoding='utf-8'));d=next(x for x in doe if x.get('file')=='doe-room-ac-manufacturing.pdf')
sources.append({'id':'doe-1997-manufacturing','publisher':'U.S. Department of Energy','name':'Room Air Conditioner Rulemaking, Volume 2','url':d['url'],'publishedAt':'1997','retrievedAt':d['retrievedAt'],'license':'美国政府公开技术资料；原始文件沿用既有研究归档。','scope':'历史房间空调制造技术参考，不证明2026中国任一工厂采用该流程。','locator':'制造成本/制造流程说明及process flow：copper tube、aluminum fins、tube expansion、return-bend brazing、leak testing；详见既有home-air-conditioner研究稿。','rawFile':'data/raw/home-ac-research/doe-room-ac-manufacturing.pdf','sha256':d['sha256'],'httpStatus':200,'period':H,'unit':'not_applicable','method':'manual_curation_of_historical_technical_process','datasetVersion':V,'status':'validated'})
T=[]
def topic(id,label,kind,description,sourceIds,historical=False):T.append({'id':id,'label':label,'kind':kind,'description':description,'sourceIds':sourceIds,'period':H if historical else P,'unit':'not_applicable','method':'manual_topic_index','datasetVersion':V,'status':'validated'})
topic('copper-material','铜与铜合金材料','material','作为铜管上游材料类别索引；本批未核验矿山、冶炼厂或任何铜管厂的直接原料供应商。',['jintian-copper-tube'])
topic('copper-tube','空调与制冷用铜管','intermediate','内螺纹管、复绕盘管与空调直管可用于换热器和管路连接；规格与用途以官方产品说明为准。',['jintian-copper-tube'])
topic('aluminium-fin','铝翅片与铝卷材','material','历史房间空调制造参考中的换热器材料；当代中国铝材企业待核验。',['doe-1997-manufacturing'],True)
topic('heat-exchanger','铜管铝翅片换热器','component','铜管和铝翅片构成的代表性换热器路线；不泛化为所有蒸发冷设备的材料配方。',['doe-1997-manufacturing','jingda-fin-press'])
topic('tube-manufacturing','铜管制造与成型','process','金田官网展示连铸、铣面、轧制、拉伸、内螺纹成型等设备名称；不据此推断设备供应商或每一种产品的完整工艺。',['jintian-copper-tube'])
topic('fin-forming','换热器翅片冲压','process','将卷材加工成换热器翅片的设备应用。',['jingda-fin-press'])
topic('coil-expansion','换热盘管扩管与翻边','process','换热盘管扩管工序及进出料、翻边的设备应用。',['jingda-expander'])
topic('brazing','回弯管钎焊','process','DOE历史工艺中的回弯管连接步骤；当代设备厂商待核验。',['doe-1997-manufacturing'],True)
topic('leak-testing','换热器与整机检漏','process','DOE历史工艺中的泄漏检查；不据此宣称中国企业提供某一种氦检漏设备。',['doe-1997-manufacturing'],True)
topic('fin-press-equipment','翅片冲压生产线','equipment','精达GC官方产品页说明其用于铜铝翅片换热器翅片生产。',['jingda-fin-press'])
topic('expander-equipment','多工位胀管设备','equipment','精达四工位立式胀管机官方产品页，属于HVAC换热盘管设备。',['jingda-expander'])
topic('compressor','空调与制冷压缩机','component','美芝官网公开列出往复、转子和涡旋压缩机及空调、制冷、热泵应用。',['gmcc-home'])
topic('control-valve','电子膨胀阀','component','美芝官方简介列明其研发生产销售电子膨胀阀；未列入三花等未完成原文归档的企业。',['gmcc-home'])
topic('evaporative-condenser','蒸发式冷凝器','equipment','雪人官网将其列为Heat Exchangers产品类别；本批不推断其盘管材料和客户。',['snowman-evaporative'])
topic('ice-machine','制冰机与制冰系统','product','雪人官网列明片冰、管冰、板冰、直蒸块冰等类别及制冰系统。',['snowman-ice'])
topic('water-chiller','冷水机组','product','雪人Ice machines目录包含Water Chiller产品；本批不推断其与其他企业的部件配套关系。',['snowman-ice'])
topic('room-air-conditioner','家用房间空调','product','格力官方消费业务含家用空调；与铜管、压缩机的连线为技术用途索引，非指定品牌的BOM。',['gree-home','doe-1997-manufacturing'])
topic('b2b-official-contact','企业产品与业务咨询入口','channel','面向工业产品研究的官方产品和机构联系页面；未发送询问，未取得报价。',['jintian-contact','gmcc-contact','jingda-home','snowman-contact'])
topic('consumer-official-store','品牌官方零售入口','channel','格力官方商城，仅供用户一键访问；不保存动态价格、库存，不代为下单。',['gree-home','gree-store'])
E=[]
def edge(a,b,kind,description,ss,historical=False):E.append({'fromTopicId':a,'toTopicId':b,'kind':kind,'description':description,'sourceIds':ss,'period':H if historical else P,'unit':'not_applicable','method':'manual_technical_adjacency_not_customer_supply','datasetVersion':V,'status':'validated'})
edge('copper-material','tube-manufacturing','process_input','铜材料→铜管制造为材料类别索引；官网铜管制造设备支持加工能力，不证明任何上游供货企业。',['jintian-copper-tube'])
edge('copper-tube','heat-exchanger','process_input','金田明确说明内螺纹管、复绕盘管和空调直管用于空调制冷换热器；不指向某一家客户。',['jintian-copper-tube'])
edge('aluminium-fin','heat-exchanger','process_input','DOE历史铜管铝翅片结构的技术投入关系。',['doe-1997-manufacturing'],True)
edge('fin-press-equipment','fin-forming','equipment_for','GC产品页说明翅片冲压生产用途。',['jingda-fin-press'])
edge('fin-forming','heat-exchanger','used_in','精达将GC设备应用明确为铜铝翅片换热器的翅片生产。',['jingda-fin-press'])
edge('expander-equipment','coil-expansion','equipment_for','四工位胀管机用于换热盘管扩管、翻边。',['jingda-expander'])
edge('coil-expansion','heat-exchanger','used_in','扩管应用来自精达官方产品说明，不表示精达向本批其他企业供货。',['jingda-expander'])
edge('brazing','heat-exchanger','used_in','DOE历史回弯管钎焊步骤用于该换热器制造路线。',['doe-1997-manufacturing'],True)
edge('leak-testing','heat-exchanger','used_in','DOE历史换热器制造路线的检漏步骤。',['doe-1997-manufacturing'],True)
edge('heat-exchanger','room-air-conditioner','used_in','DOE历史房间空调部件关系；不证明任何具体格力型号采用该结构。',['doe-1997-manufacturing'],True)
edge('compressor','room-air-conditioner','used_in','美芝明确公开空调用压缩机类别；该连线不是美芝→格力的供货证明。',['gmcc-home'])
for a,ss in [('copper-tube',['jintian-contact']),('compressor',['gmcc-contact']),('control-valve',['gmcc-home','gmcc-contact']),('fin-press-equipment',['jingda-home']),('expander-equipment',['jingda-home']),('evaporative-condenser',['snowman-contact']),('ice-machine',['snowman-contact']),('water-chiller',['snowman-contact'])]:edge(a,'b2b-official-contact','sold_through','官网提供产品查询与企业联系入口；不是报价、代理授权或交易保证。',ss)
edge('room-air-conditioner','consumer-official-store','sold_through','格力官方主站列出品牌商城入口；不推广任何未核验的第三方店铺。',['gree-home','gree-store'])
O=[]
def org(id,name,ts,product,contact,ss,desc):O.append({'id':id,'name':name,'topicIds':ts,'productUrl':product,'contactUrl':contact,'sourceIds':ss,'description':desc,'period':P,'unit':'not_applicable','method':'manual_review_of_official_public_material','datasetVersion':V,'status':'validated'})
org('org-jintian','宁波金田铜管有限公司',['copper-tube','tube-manufacturing'],meta['jintian-copper-tube']['url'],meta['jintian-contact']['url'],['jintian-copper-tube','jintian-contact'],'官网公开提供内螺纹铜管、复绕盘管、空调直管等，并展示制造设备。设备展示不是设备对外销售能力，也不构成任何客户关系审核。')
org('org-gmcc','美芝 GMCC',['compressor','control-valve'], 'https://www.gmcc-welling.com/en/product',meta['gmcc-contact']['url'],['gmcc-home','gmcc-contact'],'官网公开列明研发、生产和销售压缩机与电子膨胀阀，并列家用/商用空调压缩机产品入口。')
org('org-jingda','宁波精达 / JDM Jingda Machine (Ningbo) Co., Ltd.',['fin-press-equipment','expander-equipment'],meta['jingda-fin-press']['url'],meta['jingda-home']['url'],['jingda-fin-press','jingda-expander','jingda-home'],'提供翅片冲压线、立式胀管机等换热器制造设备；主站有CONTACT US咨询入口。正文保存在官方HTML直接引用的CDN脚本中。')
org('org-snowman','福建雪人集团 / Fujian Snowman Group Co., Ltd.',['evaporative-condenser','ice-machine','water-chiller'],meta['snowman-ice']['url'],meta['snowman-contact']['url'],['snowman-ice','snowman-evaporative','snowman-contact'],'官方目录提供蒸发式冷凝器、多个制冰机类别和冷水机。产品类别之间不自动意味着同一客户、同一机组或同一材料路线。')
org('org-gree','珠海格力电器股份有限公司',['room-air-conditioner','consumer-official-store'],meta['gree-home']['url'],None,['gree-home','gree-store'],'官方消费业务覆盖家用空调，主站列品牌商城及服务导航。未核验单款机型用料，不推断与本批其他企业的供货关系。')
obj={'schemaVersion':'china-hvac-research.v1','id':'china-hvac-participants','label':'中国空调与制冷产业参与者研究首批','reviewedAt':'2026-10-21','period':P,'datasetVersion':V,'method':'manual_review_of_official_public_material_and_historical_process_reference','status':'validated','scope':'官方公开产品能力、技术邻接与销售入口导航；不是企业间已证实的供货网络。','limitations':['首批5家企业；铜铝材料、阀件、钎焊及检漏设备供应商覆盖仍不完整。','未审核实际客户、合同、工厂BOM、产能、份额、报价、库存、价格、成本或利润。','DOE技术来源为1997年历史资料，必须逐条保留期间；不能冒充2026年中国工厂现状。','蒸发式冷凝器不是所有设备中的蒸发器或家用空调室外换热器的同义词；本批不将其盘管用料硬连到铜铝路线。','企业自述只证明官网公开能力声明；不代表第三方认证或产品表现背书。'],'sources':sources,'topics':T,'relations':E,'organizations':O,'continuationCandidates':[{'name':'海亮 / 格朗吉斯 / 三花','status':'unknown','reason':'已发现官方入口，但直接获取遇403；未绕过，未纳入已核验组织。'},{'name':'华峰铝业 / 华北铝业 / 盾安机电','status':'unknown','reason':'官方页面连接中断或TLS证书错误；本批未降低证书校验。'},{'name':'新锐钎焊 / 皖仪检漏','status':'unknown','reason':'官方页直接获取403；能力需继续核验，暂仅使用DOE历史工艺节点。'}]}
Path('content/industry').mkdir(parents=True,exist_ok=True);out=Path('content/industry/china-hvac-reviewed-2026-10.json');out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sids={s['id'] for s in sources};tids={t['id'] for t in T}
assert len(sids)==len(sources) and len(tids)==len(T)
for item in T+E+O:
 assert set(item['sourceIds'])<=sids
for e in E:assert e['fromTopicId'] in tids and e['toTopicId'] in tids and e['kind'] in ['process_input','equipment_for','used_in','sold_through']
for o in O:assert set(o['topicIds'])<=tids
for m in meta.values():
 if m['httpStatus']==200:assert hashlib.sha256((R/m['file']).read_bytes()).hexdigest()==m['sha256']
for s in sources:
 assert hashlib.sha256(Path(s['rawFile']).read_bytes()).hexdigest()==s['sha256']
print('Validated',len(sources),'sources',len(T),'topics',len(E),'relations',len(O),'organizations; all raw hashes and source/topic references pass.')
