from pathlib import Path
import json,hashlib
R=Path('data/raw/china-hvac-equipment-2026-10-22');V='china-hvac-equipment-research-2026.10.1';P={'granularity':'snapshot','start':'2026-10-22','end':'2026-10-22','label':'2026-10-22制造设备与官方售后导航复核'}
prior=[json.loads(Path(p).read_text(encoding='utf-8')) for p in ['content/industry/china-hvac-reviewed-2026-10.json','content/industry/china-hvac-supplement-2026-10-22.json','content/industry/china-hvac-core-supplement-2026-10-22.json']]
M={x['id']:x for f in R.glob('manifest*.json') for x in json.loads(f.read_text(encoding='utf-8'))['entries']}
def fact(ids,method='manual_topic_index'):return {'sourceIds':ids,'period':P,'unit':'not_applicable','method':method,'datasetVersion':V,'status':'validated'}
S=[]
def src(id,publisher,name,locator,linked=None):
 m=M[id];assert m['httpStatus']==200;S.append({'id':id,'publisher':publisher,'name':name,'url':m['url'],'publishedAt':None,'retrievedAt':m['retrievedAt'],'license':'官网未声明开放复用许可；仅发布有限人工摘要和官方入口，原件供复核。','scope':'企业官网公开设备能力或官方服务导航。','locator':locator,'rawFile':m['rawFile'],'sha256':m['sha256'],'httpStatus':200,'linkedRawIds':linked or [],**fact([id],'manual_review_of_official_public_material')})
src('hvaceq22-haitian-appliance','海天塑机集团有限公司 / Haitian International','家电行业注塑成型解决方案','白色家电明确含空调；列液压三板机、两板机、电动机及家电面板、薄壁件、高光外观件应用。')
src('hvaceq22-haitian-contact','海天塑机集团有限公司 / Haitian International','海天官方销售与服务联系','列宁波海天塑机集团机构、内贸/外贸联络与销售服务查询。')
src('hvaceq22-nide-equipment','Ningbo NIDE Tech Co., Ltd.','电机制造与定子绕线设备目录','定子线圈绕线、嵌线、整形、绑线、测试等设备；提供安装、调试、技术培训与售后支持。')
src('hvaceq22-nide-contact','Ningbo NIDE Tech Co., Ltd.','NIDE官方联系信息','宁波及江苏设备业务的机构地址和机构销售邮箱；只链接页面，不抄录个人手机。')
src('hvaceq22-rosetta-winder','常州罗塞塔石进出口有限公司','空调BLDC直条分叉绕线设备','明确用于空调塑封BLDC电机直条铁芯定子绕线。保留公司进出口贸易身份，不把产品目录转为自有工厂证明。')
src('hvaceq22-rosetta-contact','常州罗塞塔石进出口有限公司','罗塞塔石官方联系','公司机构地址、电话、邮箱与联系入口。')
src('hvaceq22-gree-service','珠海格力电器股份有限公司','格力官方服务中心','服务预约、品类服务标准、营销网络、线下门店与售后服务网点。')
src('hvaceq22-gree-self-service','珠海格力电器股份有限公司','格力自助服务网页','HTML标题格力服务；其直接引用公开index脚本含服务大厅、服务进度与服务网点路由。',['hvaceq22-gree-self-service-app'])
T=[]
def topic(id,label,kind,description,ss):T.append({'id':id,'label':label,'kind':kind,'description':description,**fact(ss)})
topic('hvaceq22-injection-equipment','家电注塑成型设备','equipment','面向空调等家电塑料部件的两板、三板与电动注塑设备。',['hvaceq22-haitian-appliance'])
topic('hvaceq22-plastic-forming','空调塑料部件注塑成型','process','面板、薄壁件和外观件等家电塑料部件的注塑加工方向。',['hvaceq22-haitian-appliance'])
topic('hvaceq22-stator-winding-equipment','电机定子绕线设备','equipment','包括定子线圈绕线和空调BLDC直条铁芯定子绕线设备，可查看不同企业的产品范围。',['hvaceq22-nide-equipment','hvaceq22-rosetta-winder'])
topic('hvaceq22-stator-winding','空调电机定子绕线','process','对空调塑封BLDC电机的直条铁芯定子进行绕线。',['hvaceq22-rosetta-winder'])
topic('hvaceq22-official-after-sales','空调售后与服务网点','service','通过品牌官方服务中心查看服务预约、服务标准和售后网点。',['hvaceq22-gree-service','hvaceq22-gree-self-service'])
E=[]
def edge(a,b,k,d,ss):E.append({'fromTopicId':a,'toTopicId':b,'kind':k,'description':d,'displayDescription':d,**fact(ss,'manual_technical_adjacency_not_customer_supply')})
edge('hvaceq22-injection-equipment','hvaceq22-plastic-forming','equipment_for','注塑设备支持空调等家电塑料部件成型。',['hvaceq22-haitian-appliance'])
edge('hvaceq22-plastic-forming','room-air-conditioner','used_in','注塑成型用于空调等白色家电的塑料部件加工。',['hvaceq22-haitian-appliance'])
edge('hvaceq22-stator-winding-equipment','hvaceq22-stator-winding','equipment_for','直条绕线设备用于空调BLDC电机定子绕线。',['hvaceq22-rosetta-winder'])
edge('hvaceq22-stator-winding','hvaccore22-aircon-motor','used_in','定子绕线是该类空调BLDC电机的加工环节。',['hvaceq22-rosetta-winder'])
edge('hvaceq22-official-after-sales','room-air-conditioner','used_in','官方售后服务支持家用空调的服务预约与网点查询。',['hvaceq22-gree-service'])
edge('hvaceq22-injection-equipment','b2b-official-contact','sold_through','打开海天官方销售与服务联系入口。',['hvaceq22-haitian-contact'])
edge('hvaceq22-stator-winding-equipment','b2b-official-contact','sold_through','打开设备企业官方产品与机构联系入口。',['hvaceq22-nide-contact','hvaceq22-rosetta-contact'])
O=[]
def org(id,name,ts,desc,ss,links):O.append({'id':id,'name':name,'topicIds':ts,'description':desc,'productUrl':links[0]['url'],'contactUrl':next((x['url'] for x in links if x['kind']=='contact'),None),'links':links,**fact(ss,'manual_review_of_official_public_material')})
org('hvaceq22-org-haitian','海天塑机集团有限公司',['hvaceq22-injection-equipment'],'为家电塑料部件提供注塑设备与工艺方案，含两板、三板及电动机型。',['hvaceq22-haitian-appliance','hvaceq22-haitian-contact'],[{'label':'家电注塑方案','kind':'product','url':M['hvaceq22-haitian-appliance']['url']},{'label':'官方销售与服务','kind':'contact','url':M['hvaceq22-haitian-contact']['url']}])
org('hvaceq22-org-nide','宁波 NIDE / Ningbo NIDE Tech Co., Ltd.',['hvaceq22-stator-winding-equipment'],'提供电机定子绕线、嵌线和测试设备，以及设备安装、调试、培训与售后支持。',['hvaceq22-nide-equipment','hvaceq22-nide-contact'],[{'label':'电机制造设备','kind':'product','url':M['hvaceq22-nide-equipment']['url']},{'label':'官方联系','kind':'contact','url':M['hvaceq22-nide-contact']['url']}])
org('hvaceq22-org-rosetta','常州罗塞塔石进出口有限公司',['hvaceq22-stator-winding-equipment'],'官网目录提供空调BLDC电机直条定子绕线设备及机构联系入口。',['hvaceq22-rosetta-winder','hvaceq22-rosetta-contact'],[{'label':'空调电机绕线设备','kind':'product','url':M['hvaceq22-rosetta-winder']['url']},{'label':'官方联系','kind':'contact','url':M['hvaceq22-rosetta-contact']['url']}])
extensions=[{'id':'org-gree','topicIds':['hvaceq22-official-after-sales'],'links':[{'label':'官方服务中心与网点','kind':'support','url':M['hvaceq22-gree-service']['url']},{'label':'官方自助服务','kind':'support','url':M['hvaceq22-gree-self-service']['url']}],**fact(['hvaceq22-gree-service','hvaceq22-gree-self-service'],'manual_review_of_official_public_material')}]
obj={'schemaVersion':'china-hvac-research.v1','id':'china-hvac-equipment-supplement-2026-10-22','label':'中国空调制造设备与官方售后导航补充','reviewedAt':'2026-10-22','period':P,'datasetVersion':V,'method':'manual_review_of_official_public_material','status':'validated','scope':'现代制造设备公开能力与品牌官方售后、服务网点导航。','limitations':['NIDE公开的是电机制造设备范围，空调BLDC绕线用途由罗塞塔石具体产品页支持；不把二者转成实际客户供货关系。','海天资料支持家电注塑与空调塑料部件方向，不指定金发某PBT牌号、某品牌机型或具体工厂。','罗塞塔石保留进出口公司法定名称，只陈述其官方产品目录，不推断其自有制造厂。','格力服务中心和自助网页为用户自行打开的官方入口，没有代预约、提交表单或登录；本批未提取安装施工说明。','本批只追加新主题、关系和三家新企业，通过organizationExtensions给既有格力追加服务主题和链接，不重复计数。'],'sources':S,'topics':T,'relations':E,'organizations':O,'organizationExtensions':extensions}
sids={s['id'] for d in prior for s in d['sources']}|{s['id'] for s in S};tids={t['id'] for d in prior for t in d['topics']}|{t['id'] for t in T};oids={o['id'] for d in prior for o in d['organizations']}
for x in T+E+O+extensions:assert set(x['sourceIds'])<=sids
for e in E:assert e['fromTopicId'] in tids and e['toTopicId'] in tids
for o in O+extensions:assert set(o['topicIds'])<=tids
assert all(x['id'] in oids for x in extensions)
oldedges={(x['fromTopicId'],x['toTopicId'],x['kind']) for d in prior for x in d['relations']};assert not any((x['fromTopicId'],x['toTopicId'],x['kind']) in oldedges for x in E)
for m in M.values():
 if m.get('httpStatus')==200:assert hashlib.sha256(Path(m['rawFile']).read_bytes()).hexdigest()==m['sha256']
for s in S:
 assert hashlib.sha256(Path(s['rawFile']).read_bytes()).hexdigest()==s['sha256']
 for lid in s['linkedRawIds']:assert M[lid]['httpStatus']==200
out=Path('content/industry/china-hvac-equipment-supplement-2026-10-22.json');out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Validated',len(S),'sources',len(T),'topics',len(E),'relations',len(O),'new enterprises',len(extensions),'existing organization extensions; raw HTTP200',sum(m.get('httpStatus')==200 for m in M.values()));print('SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
