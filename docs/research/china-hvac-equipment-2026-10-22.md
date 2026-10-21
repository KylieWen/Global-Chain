# 空调制造设备与官方售后补充（2026-10-22）

本批固定额度保护线前已取得的原件：8个研究来源、5个环节、7条关系、3家新增企业，以及对已有格力企业卡的受控服务入口扩展。9份成功原始响应均记录UTC时间、URL、HTTP状态、字节数和SHA256。没有修改旧研究文件或已发布空调2026.2。

| 企业 | 本批原文支持 | 官方入口 |
| --- | --- | --- |
| 海天塑机集团有限公司 | 空调等家电塑料部件注塑成型方案，两板/三板/电动注塑设备 | [家电方案](https://haitianinter.com/cn/solutions/industries/home-appliance/) · [销售与服务](https://haitianinter.com/cn/contact-overview/) |
| 宁波 NIDE / Ningbo NIDE Tech Co., Ltd. | 定子绕线、嵌线、测试等电机制造设备及安装调试、培训支持 | [设备目录](https://www.nidegroup.com/products.html) · [机构联系](https://www.nidegroup.com/contact.html?scrollTo=c1) |
| 常州罗塞塔石进出口有限公司 | 空调塑封BLDC电机直条铁芯定子绕线设备；保留进出口公司身份，不推断自有工厂 | [设备](https://www.czrosettastone.com/cn/Straight-Winding-Machine/99.html) · [机构联系](https://www.czrosettastone.com/cn/Contact-us/) |
| 珠海格力电器股份有限公司（已有企业） | 服务预约、服务标准、售后网点与官方自助服务导航 | [服务中心](https://www.gree.com/zh/zh-CN/serviceCenter/) · [官方自助服务](https://sms.gree.com/default-front-greeshzzbx) |

新技术路径为注塑设备→塑料部件成型→空调、定子绕线设备→空调电机定子绕线→已有风机电机环节。NIDE支持设备大类，空调BLDC用途由罗塞塔石具体产品页支持；不建立实际企业供货关系。海天资料不指定金发某PBT牌号、某品牌或工厂。

格力通过`organizationExtensions`只追加服务topic、来源和两个support链接，不重复企业，不覆盖旧名称/简介/产品及商城入口。服务中心公开支持预约与网点导航；本批没有取得安装施工细节，不发布安装技术指引。自助网页原HTML仅有标题，已保存其直接引用的公开JS原件；静态读取验证服务大厅、服务进度与服务网点路由，没有执行脚本、登录或提交表单。

`data/raw/china-hvac-equipment-2026-10-22/manifest.json`与`manifest-additional.json`为`{schemaVersion,batchId,entries:[...]}`；原始字节是哈希输入。`acquire.py NEW_BATCH_DIRECTORY`记录相同官方URL的获取方法，仅允许新目录，保持标准TLS验证，拒绝覆盖已有批次。`build-reviewed.py`离线重建补充JSON，检查全部原件哈希、旧/新来源和环节引用，并检查新增关系不与前三批重复。

已执行离线验证：8来源、5环节、7关系、3新增企业、1既有企业扩展、9份HTTP200原件，哈希与引用全部通过。输入SHA256：`e4cce3382176de24c2e19ab443ea557184f4558b8a1a362fb43b50b4261b5aca`。

额度到15%后停止扩展与抓取，只保存现有结果和交接。伊之密资料与NIDE具体家电用途子页未纳入已核验来源（后者404）；钣金及制管设备留作后续任务。官网未声明开放复用许可，对外仅发布有限摘要和官方链接；没有联系企业、代预约、询价或交易。
