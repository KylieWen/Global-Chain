# 中国空调核心部件与材料追加研究（2026-10-22）

本批在第一批中国空调参与者与换热器补充包之外，增加5家企业、7个环节、13条技术或入口关系、11个来源，补上电机、电控、制冷剂与壳体材料。全部11份成功原始响应已保存SHA256、UTC获取时间和URL。当前文件为研究输入，实际商品发布版本由产业网络构建器指定。

| 企业 | 公开能力 | 官方入口 |
| --- | --- | --- |
| 卧龙电气驱动集团股份有限公司 | BLDC与AC系列空调电机；AC系列用于室内、室外及窗机风机 | [产品](https://www.wolong.com.cn/products-solutions/motors-drives/daily-motors/air-conditioning-motors) · [联系](https://www.wolong.com.cn/contact-us/online-message) |
| 广东威灵电机制造有限公司 | HTML产品导航列家用/商用空调电机、空调新风机 | [产品分类](https://www.wellingmotor.com/cn/product/product-detail?categoryId=100074) · [联系](https://www.wellingmotor.com/cn/join-us) |
| 深圳拓邦股份有限公司 | 家用/商用空调、热泵与压缩机变频化的驱动和控制方案 | [暖通方案](https://www.topband.com/cn/solution/hvac/) · [联系](https://www.topband.com/cn/contact-us/) |
| 山东东岳制冷剂有限公司 | R32产品与国内销售机构入口 | [产品与销售](https://www.dongyuechem.com/en/product/show-1566.html) · [集团联系](https://www.dongyuechem.com/en/contact.html) |
| 金发科技股份有限公司 | 空调壳体应用目录中的PBT改性塑料与牌号 | [材料](https://www.kingfa.com.cn/index.php/goods/details/index/id/95/cid/92.html) · [联系](https://www.kingfa.com.cn/index.php/portal/list/index/id/53.html) |

R32的空调用途采用[大金氟化工（中国）官方产品技术目录](https://www.daikinchem.com.cn/index/product/index.html?id=12)中HFC-32用途表。东岳资料支持其R32产品公开能力，大金资料支持类别用途，两者不连成企业供货关系。

技术路径包括电机→送风风机→家用空调、控制器→家用/商用空调、变频驱动→压缩机、R32→空调、PBT→壳体应用→空调。没有把厂商并列展示转化为某一品牌或工厂的实际BOM。

威灵分类详情主体动态加载，本批只取原始HTML已经包含的电机分类目录与机构联系信息，不采集不可复核的规格。金发页面只证明PBT在壳体部件中的应用，没有推断整机全部外壳均用PBT。动态价格、库存、产能、份额等不在本批提取范围。

## 获取与重建

原始批次：`data/raw/china-hvac-core-2026-10-22/`。`manifest.json`、`manifest-additional.json`、`manifest-contacts.json`均采用`{schemaVersion,batchId,entries:[...]}`，记录每次获取结果。source中的`rawFile`是仓库相对路径，HTML原字节是哈希输入，txt只是阅读派生物。

Python标准证书验证获取东岳两页时出现证书链无法构建。失败记录保留。随后使用Windows系统`curl.exe`的默认TLS证书校验成功获取HTTP200原件；调用没有`--insecure`、`-k`、自定义不安全CA或关闭校验设置。两种客户端结果和获取时间分别保存，没有用失败内容替代真实原文。

- `acquire.py NEW_BATCH_DIRECTORY`记录获取方法，只接受工作区内的新目录，拒绝覆盖已有批次，所有客户端保持默认证书验证。
- `build-reviewed.py`离线读取本批原件、昨日研究与第一补充包，重建`content/industry/china-hvac-core-supplement-2026-10-22.json`；校验所有成功原文SHA256、source/topic引用和组织主题。
- 已执行离线验证：11来源、7环节、13关系、5企业，11份HTTP200原件哈希和全部引用通过。
- 本研究input SHA256：`ca804a75e29886097f7a9d8617b65b66732b53d7def35765f395359f7b5415c8`。

未向任何企业发送消息、提交表单、询价或下单。官方联系或采购功能仅是用户自行打开网页后沟通。官网未声明开放复用许可，公开页面使用有限人工摘要和官网链接；原件用于复核。
