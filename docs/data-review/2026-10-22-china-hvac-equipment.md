# 中国空调制造设备与官方服务候选（2026-10-22）

候选版本：`globe-chain-home-air-conditioner-2026.3`。本批在额度保护线前完成研究输入，触线后只固定哈希、构建和验证；没有修改active或旧release。

- 新增5主题、7技术/服务关系、3设备企业、8研究来源；格力沿用已有企业记录，受控扩展官方售后/网点入口，不重复计算企业。
- 合并后41环节、62关系、18企业、39官方入口、41研究来源条目。
- 新企业为海天塑机集团、宁波NIDE及常州罗塞塔石；原件支持注塑、定子绕线设备及其应用。企业能力与实际供货关系分开。
- 服务仅描述已核实的官方售后与服务网点，不宣称已经完成预约、安装或维修。
- 候选目录：`data/candidates/china-hvac-2026-3/`。
- fixture SHA256：`6eeae623d9b686fbec7085fb1d1a590cf9103e57400aa3430fa88b8bee039377`。

## 输入与转换

离线构建器：`scripts/build-china-hvac-equipment.mjs`。固定2026.2基线SHA256 `78028e78b4e2293ae59af289968afa7471867405d428666abefc6bb496eb1a33`；固定研究文件`content/industry/china-hvac-equipment-supplement-2026-10-22.json`，SHA256 `e4cce3382176de24c2e19ab443ea557184f4558b8a1a362fb43b50b4261b5aca`。研究原件URL、UTC获取时间、HTTP状态和哈希保留在`data/raw/china-hvac-equipment-2026-10-22/`及研究说明中，原件和直接正文资源共9份成功响应。

构建逐原文校验SHA256，兼容直接正文清单，不执行保存的网页JS。仅将旧datasetVersionId递归重映到2026.3，原22商品条目、27节点/26供应链连接、9工序/12设备类别、4条2024贸易和旧36产业主题/55关系保持。新关系如与旧from/to/kind重复会被拒绝，不以重复卡片充实规模。

格力使用`organizationExtensions`追加主题、来源及支持入口，旧名称、简介、产品和商城链接保留。`review-audit.json.organizationExtensions`保存before/addition/after，日期显示两次官网观察范围，旧记录与新增资料原期间分别可追溯。没有把官网观察当作全年统计，也没有改变1997工艺资料的年份或材料配方。

## 验证与交接

执行`node node_modules/vitest/vitest.mjs run tests/china-hvac-equipment-release.test.ts`，6项通过。覆盖完整契约、旧事实与企业原有能力保留、现代设备到用途和官方企业入口、无企业重复、完整来源与确定性重建、真实immutable loader、导出、无效来源/危险链接和输入篡改拒绝。旧工艺仍为1997。

`node scripts/build-china-hvac-equipment.mjs`重建候选；`--prepare-release`先执行本批6项测试，再按拒绝覆盖不同字节的方式准备新不可变release，仍不激活。主任务负责决定安全激活、完整检查和网页验收；本批数据测试不能代替页面验收。阈值已触发，不再扩展开发。


## 主任务收束与激活补记

新2026.3已准备并单商品激活，另外四商品保留，五商品verify通过。包含本批数据与工艺导航修复的最终完整检查为42文件226测试通过、生产build（含lint/type）通过。实际绕线设备企业、格力服务网点、工序材料到产业导航及手机排版复验见docs/continuation/QA-2026-10-22.md。旧候选说明中的“未改active”仅描述离线构建器行为，不代表发布后的当前指针。
