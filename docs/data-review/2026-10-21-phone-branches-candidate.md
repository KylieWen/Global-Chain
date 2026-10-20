# 智能手机组件补全候选（未发布）

2026-10-21 保存 `globe-chain-smartphone-2026.3` 候选。当前 active 继续为 `globe-chain-smartphone-2026.2`；没有新建 .3 immutable release，也没有激活。旧 release 均未修改。

## 可重建入口与验收

- 输入：`content/routes/smartphone-branches-2026-10.json`。
- 原始文件、提取文本、文件 SHA256 与提取文本 SHA256：`data/published/raw/phone-branches-2026-10-21/`。屏幕模组复用既存 `raw/refresh-2026-09-16/catalog/display.json`。
- 重建：`node scripts/build-phone-branches.mjs`。输出目录携带 fixture 哈希前缀，避免覆盖先前候选。当前通过契约的输出为 `data/candidates/smartphone-branches-2026-10-21-9aaf3325fd56/`；fixture SHA256 以其 manifest 为准。候选输出可不提交，干净 checkout 从已提交输入重建。
- 验收：`pnpm exec vitest run tests/phone-branches.test.ts --maxWorkers=1 --minWorkers=1`：**6 项通过**。测试直接调用 Node 构建模块，在临时目录保存并加载输出，不依赖本机 `data/candidates`；覆盖确定性字节、完整契约、七类组件有向连通、事实期间、工艺输入输出、统计不变和 .2 哈希。
- 本批次未运行整站 build、完整测试和实际页面验收，因此暂不发布。后续先通过完整检查，再用 `node scripts/build-phone-branches.mjs --publish` 创建不可变版本，最后显式激活 .3。激活前应将旧版本基线测试固定到不可变 .2，并另验收多期资料页面。

## 本批内容

新增 33 条代表性结构连接，新增 4 条制造工艺链、14 道工序；逐步列出输入和输出。芯片/晶圆/封装、相机、电路板、机身、声学触觉、电池与屏幕均有到中国整机组装的图路径。新增台湾地区晶圆制造、越南与印度组装分支，使用实际来源期间。七类一级组件改为功能和材料说明，商品显示名改为“智能手机”，节点名称和故事步骤去除反复的辩护性主文案。

原有 8 条 unknown 生产活动中，7 条获得范围明确的国家制造或市场供给证据；韩国电池模组封装仍保留 unknown。美国、德国原有笼统下游活动改为来源可支持的零售上市/供给，不能据此推断销量或最终消费。日本笼统“组件”活动收窄为 LCD，处理器/相机另走各自分支。

17 条来源索引包括 Samsung Electro-Mechanics 2023 审计报告及当前摄像头技术页面、鹏鼎/AAC/当升/德赛 2023 年报、Sony 2023 长崎 CMOS 扩产公告、Eurocircuits PCB 工艺、AAC 精密结构、Samsung SDI 网络、贝特瑞负极业务、Samsung 越南 2024 公告、印度 PIB 2023 简报、Apple 2023 上市安排、Samsung Display 已存模组页面和台积电 2025 年报选摘。具体 URL、检索时间、定位与哈希均在 raw 元数据、内容及重建 audit 中。

台积电保存的是明确标注的官方页面有限选摘，直接下载曾返回 HTTP 403，不冒充完整原文快照。Samsung Electro-Mechanics 报告的昆山 PCB 业务已在 2019 年停运，未用于本候选的当前 PCB 角色。PCB 裸板步骤引用 Eurocircuits，后续装联同时引用鹏鼎模组装配业务，避免把裸板工艺文档当作完整装联证据。

## 保留的边界与待做

所有新增连接均为代表性工艺/用途结构，货量和金额保持 null/unknown；不把国家角色变成企业供货事实。24 条手机贸易、62 条材料贸易、36 条宏观记录和证据缺口保持原内容，仅更新 release 引用。跨期结构不表示同一年度完整物料谱系。印度产能与越南累计里程碑没有改为年度产量。

福建省工信厅转载的工信部统计明确分列“智能手机产量11.4亿台”，是 2023 年规模以上企业口径。此数量已保存到 `review-audit.json.reviewedUnpublishedIndicators`（quantity=1,140,000,000、unit=items、来源/期间/method/status/version 齐全），**尚未加入 fixture 统计**：现有 macro 契约要求 observed 提供 value，同时要求有 value 时提供 currency，尚不能正确容纳数量型产量。不应给台数伪造币种；下轮需先扩通用数量型指标契约与查询展示，再纳入。

下一轮先完成 .3 页面与全套回归，收紧历史测试版本，然后审查真实来源支持范围并发布；再按商品通用模型推进纯棉 T 恤、食用大豆油、电动自行车、家用空调。每个商品最小输入为：稳定商品及一级组件 ID、官方分类/HS 映射、至少一条真实贸易观察、可复核国家角色与连通的代表路线、输入输出明确的工序、带实际期间的来源快照、缺口与单位状态说明，以及独立 immutable manifest。禁止把现有 mock 商品直接发布。
