from pathlib import Path
import json,hashlib
R=Path('data/raw/china-hvac-core-2026-10-22');V='china-hvac-core-research-2026.10.1'
P={'granularity':'snapshot','start':'2026-10-22','end':'2026-10-22','label':'2026-10-22空调核心部件与材料官方能力复核'}
prior=[json.loads(Path(p).read_text(encoding='utf-8')) for p in ['content/industry/china-hvac-reviewed-2026-10.json','content/industry/china-hvac-supplement-2026-10-22.json']]
meta={x['id']:x for path in R.glob('manifest*.json') for x in json.loads(path.read_text(encoding='utf-8'))['entries']}
def fact(ss,method='manual_topic_index'):return {'sourceIds':ss,'period':P,'unit':'not_applicable','method':method,'datasetVersion':V,'status':'validated'}
S=[]
def source(id,publisher,name,locator):
 m=meta[id];assert m['httpStatus']==200 and m['rawFile'];S.append({'id':id,'publisher':publisher,'name':name,'url':m['url'],'publishedAt':None,'retrievedAt':m['retrievedAt'],'license':'官网未声明开放复用许可，仅发布有限人工摘要和官方入口，原件用于复核。','scope':'官网公开产品能力、用途与机构入口。','locator':locator,'rawFile':m['rawFile'],'sha256':m['sha256'],'httpStatus':200,'linkedRawIds':[],**fact([id],'manual_review_of_official_public_material')})
source('hvaccore22-wolong-motors','卧龙电气驱动集团股份有限公司','空调电机产品分类','列BLDC S51/S70/S90/S110与AC单相异步交流电机；AC系列用于空调室内、室外和窗机风机。')
source('hvaccore22-wolong-contact','卧龙电气驱动集团股份有限公司','官方联系与在线留言入口','销售电话、机构邮箱、联系入口及用户自行填写的留言表单。')
source('hvaccore22-welling-motors','广东威灵电机制造有限公司','家用空调电机分类入口','原始HTML页脚产品导航明确列家用空调电机、商用空调电机、空调新风机；未提取动态规格或下载占位。')
source('hvaccore22-welling-contact','广东威灵电机制造有限公司','威灵联系我们','HTML公开机构联系入口；沿用官方公开机构邮箱；不抄录个人联系方式。')
source('hvaccore22-topband-hvac','深圳拓邦股份有限公司','暖通燃热解决方案','为暖通空调、热泵与各类压缩机变频化提供驱动和控制方案；覆盖家用与商用空调。')
source('hvaccore22-topband-contact','深圳拓邦股份有限公司','拓邦联系我们','机构地址、电话、机构邮箱，含供应商自荐官方导航；未提交任何表单。')
source('hvaccore22-kingfa-housing','金发科技股份有限公司','空调壳体PBT材料','面包屑为家电行业/空调/壳体；表格列PBT与PBT-G30/G20。未推断特定机型外壳或品牌。')
source('hvaccore22-kingfa-contact','金发科技股份有限公司','联系金发','官方机构联络与销售导航。')
source('hvaccore22-dongyue-r32-windows','山东东岳制冷剂有限公司 / 东岳氟硅科技集团有限公司','R32产品与国内销售','官网R32产品页、山东东岳制冷剂机构名称、Domestic Sales Office和销售机构邮箱。')
source('hvaccore22-dongyue-contact-windows','东岳氟硅科技集团有限公司','东岳官方联系入口','集团联系页面与产品机构导航。')
source('hvaccore22-daikin-refrigerants','大金氟化工（中国）有限公司','制冷剂产品与用途技术参考','牌号用途表将HFC-32列为空调用途；仅作为R32类别用途依据，不建立其与东岳的企业关系。')
T=[]
def topic(id,label,kind,description,ss):T.append({'id':id,'label':label,'kind':kind,'description':description,**fact(ss)})
topic('hvaccore22-aircon-motor','空调风机电机','component','驱动室内、室外及窗机送风的电机，可选择交流或无刷直流等产品系列。',['hvaccore22-wolong-motors','hvaccore22-welling-motors'])
topic('hvaccore22-aircon-fan','空调送风风机','component','室内、室外与窗机送风部件，电机为其提供驱动。',['hvaccore22-wolong-motors'])
topic('hvaccore22-ac-controller','空调智能控制器','component','面向家用、商用空调的驱动与控制方案，可查看官方方案与机构联系入口。',['hvaccore22-topband-hvac'])
topic('hvaccore22-compressor-drive','压缩机变频驱动控制','component','针对压缩机变频化的驱动和控制方案。',['hvaccore22-topband-hvac'])
topic('hvaccore22-r32','R32制冷剂','material','空调用制冷工质类别，官方产品页可查看产品与国内销售机构入口。',['hvaccore22-dongyue-r32-windows','hvaccore22-daikin-refrigerants'])
topic('hvaccore22-pbt','PBT改性塑料','material','金发空调壳体应用页面列出的PBT材料，可查看牌号与技术资料。',['hvaccore22-kingfa-housing'])
topic('hvaccore22-housing','空调壳体材料应用','component','PBT在空调壳体部件中的材料应用方向。',['hvaccore22-kingfa-housing'])
E=[]
def edge(a,b,k,d,ss):E.append({'fromTopicId':a,'toTopicId':b,'kind':k,'description':d,**fact(ss,'manual_technical_adjacency_not_customer_supply')})
edge('hvaccore22-aircon-motor','hvaccore22-aircon-fan','used_in','空调电机驱动室内、室外或窗机风机。',['hvaccore22-wolong-motors'])
edge('hvaccore22-aircon-fan','room-air-conditioner','used_in','室内、室外及窗机风机承担空调送风。',['hvaccore22-wolong-motors'])
edge('hvaccore22-ac-controller','room-air-conditioner','used_in','控制方案覆盖家用空调。',['hvaccore22-topband-hvac'])
edge('hvaccore22-ac-controller','hvac22-commercial-ac','used_in','控制方案覆盖商用空调。',['hvaccore22-topband-hvac'])
edge('hvaccore22-compressor-drive','compressor','used_in','驱动控制方案服务压缩机变频化。',['hvaccore22-topband-hvac'])
edge('hvaccore22-r32','room-air-conditioner','process_input','HFC-32是空调使用的制冷剂类别之一。',['hvaccore22-daikin-refrigerants'])
edge('hvaccore22-pbt','hvaccore22-housing','process_input','PBT材料用于空调壳体部件。',['hvaccore22-kingfa-housing'])
edge('hvaccore22-housing','room-air-conditioner','used_in','壳体部件属于官网空调材料应用目录。',['hvaccore22-kingfa-housing'])
for a,ss in [('hvaccore22-aircon-motor',['hvaccore22-wolong-contact','hvaccore22-welling-contact']),('hvaccore22-ac-controller',['hvaccore22-topband-contact']),('hvaccore22-compressor-drive',['hvaccore22-topband-contact']),('hvaccore22-r32',['hvaccore22-dongyue-r32-windows','hvaccore22-dongyue-contact-windows']),('hvaccore22-pbt',['hvaccore22-kingfa-contact'])]:edge(a,'b2b-official-contact','sold_through','打开对应企业的官方产品或机构联系入口。',ss)
O=[]
def org(id,name,ts,product,contact,ss,description):O.append({'id':id,'name':name,'topicIds':ts,'productUrl':product,'contactUrl':contact,'description':description,**fact(ss,'manual_review_of_official_public_material')})
org('hvaccore22-org-wolong','卧龙电气驱动集团股份有限公司',['hvaccore22-aircon-motor'],meta['hvaccore22-wolong-motors']['url'],meta['hvaccore22-wolong-contact']['url'],['hvaccore22-wolong-motors','hvaccore22-wolong-contact'],'提供BLDC与交流空调电机系列，适用室内、室外及窗机风机等送风设备。')
org('hvaccore22-org-welling','广东威灵电机制造有限公司',['hvaccore22-aircon-motor'],meta['hvaccore22-welling-motors']['url'],meta['hvaccore22-welling-contact']['url'],['hvaccore22-welling-motors','hvaccore22-welling-contact'],'官方产品目录列家用与商用空调电机，并提供机构联系入口。')
org('hvaccore22-org-topband','深圳拓邦股份有限公司',['hvaccore22-ac-controller','hvaccore22-compressor-drive'],meta['hvaccore22-topband-hvac']['url'],meta['hvaccore22-topband-contact']['url'],['hvaccore22-topband-hvac','hvaccore22-topband-contact'],'提供家用及商用空调、热泵和压缩机变频化的驱动与控制方案。')
org('hvaccore22-org-dongyue','山东东岳制冷剂有限公司',['hvaccore22-r32'],meta['hvaccore22-dongyue-r32-windows']['url'],meta['hvaccore22-dongyue-contact-windows']['url'],['hvaccore22-dongyue-r32-windows','hvaccore22-dongyue-contact-windows'],'官方目录列R32产品与国内销售机构入口。')
org('hvaccore22-org-kingfa','金发科技股份有限公司',['hvaccore22-pbt'],meta['hvaccore22-kingfa-housing']['url'],meta['hvaccore22-kingfa-contact']['url'],['hvaccore22-kingfa-housing','hvaccore22-kingfa-contact'],'空调壳体应用目录提供PBT改性材料及牌号，配有官方机构联络入口。')
obj={'schemaVersion':'china-hvac-research.v1','id':'china-hvac-core-supplement-2026-10-22','label':'中国空调电机、电控、制冷剂与壳体材料','reviewedAt':'2026-10-22','period':P,'datasetVersion':V,'method':'manual_review_of_official_public_material','status':'validated','scope':'空调核心部件及材料的公开能力、技术用途与官方信息入口。','limitations':['只建立主题的技术用途关系；不把厂商产品能力当作某品牌或某工厂的客户供货记录。','PBT页面只支持其壳体应用，不证明整机全部外壳均用该材料。','威灵分类页主体产品数据动态加载，本批只使用HTML已有的家用/商用空调电机目录，不采集动态规格。','R32产品能力来自东岳官网，空调用途来自大金中国技术目录；两者不构成企业供货关系。','东岳Python获取的证书链错误保留原记录，Windows curl采用系统默认TLS校验成功；没有关闭校验、使用不安全参数或绕过访问限制。'],'sources':S,'topics':T,'relations':E,'organizations':O}
sids={s['id'] for d in prior for s in d['sources']}|{s['id'] for s in S};tids={t['id'] for d in prior for t in d['topics']}|{t['id'] for t in T}
assert len({x['id'] for x in S})==len(S) and len({x['id'] for x in T})==len(T)
for x in T+E+O:assert set(x['sourceIds'])<=sids
for e in E:assert e['fromTopicId'] in tids and e['toTopicId'] in tids
for o in O:assert set(o['topicIds'])<=tids
for m in meta.values():
 if m.get('httpStatus')==200:assert hashlib.sha256(Path(m['rawFile']).read_bytes()).hexdigest()==m['sha256']
for s in S:assert hashlib.sha256(Path(s['rawFile']).read_bytes()).hexdigest()==s['sha256']
out=Path('content/industry/china-hvac-core-supplement-2026-10-22.json');out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Validated core supplemental sources:',len(S),'topics:',len(T),'relations:',len(E),'organizations:',len(O),'raw HTTP200:',sum(m.get('httpStatus')==200 for m in meta.values()))
print('SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
