# 航拍无人机（generic-camera-drone）研究摘要 · 2026-11-26

## 1. 批次身份与版本

- 商品：`generic-camera-drone`（航拍无人机），品类归为「交通设备」。
- 数据集版本：`dataset-camera-drone-2026-1` / `globe-chain-camera-drone-2026.1`，状态 `published`，发布时间 2026-11-25T15:21:40.000Z。
- 内容版本：`content-camera-drone-2026-1` / `camera-drone-structure-2026.1`，状态 `published`。
- 期间：2026-11-01 至 2026-11-30，月度粒度，标签「2026-11（官方备件表快照）」。
- 本批性质：结构参照批次。只整理官方维修部件表支持的部件层级；产地、材料、供应商、制造工序、产能与贸易流向均未观测，相关维度保持空态并登记证据缺口。

## 2. 来源与快照哈希

| 来源 | 用途 | 路径 / URL | SHA-256 |
| --- | --- | --- | --- |
| DJI 支持：DJI Mini 系列配件价格查询 | 唯一部件结构与维修报价事实来源 | 原始快照 `data/research/drone-2026-11-26/raw/dji-support-zh-cn03400007809.html`；URL `https://support.dji.com/help/content?customId=zh-cn03400007809&spaceId=34&re=CN&lang=zh-CN` | `FA9A97C31B3F6DF5E1875A9F20A81D680A49A31809CC564474D546D1726AB73D` |
| UN Comtrade HS2022 商品分类字典（H6） | 仅作 HS 分类参考，不构成贸易观测 | 本地共享快照 `data/raw/ebike-research/un-comtrade-H6.json`；URL `https://comtradeapi.un.org/files/v1/app/reference/H6.json` | `e266823e1299d1307c5d7986eb738b83aa5e5bd9af675bf19bf372220660be15` |
| GlobeChain 通用部件层级整理 | 内部策展记录；结构映射依据官方备件表，不引入外部产地、材料或供应商结论 | 无外部 URL；输入 `data/research/drone-2026-11-26/research-input.json` | 输入文件 SHA-256 `44854192e2c6e07360b386cddd618ba063d696fddbc97b562b2a47011366596a` |

- DJI 快照元数据：HTTP 200，`text/html; charset=utf-8`，取回时间 2026-11-25T15:21:40Z，记录于 `raw/dji-support-zh-cn03400007809.html.meta.json`，元数据哈希与原始快照一致。
- 抽取产物 `extracts/parts-tables.json` 的 SHA-256：`28cb7eed8537a0f818974ea24716ce2db6069e9dcd274f0952ad05aac963fd33`。
- 已知抽取异常：DJI Mini 4K 表中「核心板组件」单价字符串以 U+200E（LEFT-TO-RIGHT MARK）开头，原始抽取保留该字符；归一化后数值仍为 639.00 CNY。

## 3. 86 行官方部件覆盖情况

官方备件表覆盖 9 个 DJI Mini 系列型号、3 个官方分类（飞行器部件、云台部件、遥控器部件），结构化后共 **86 条具名部件行**，其中 **35 个互不相同的官方配件名**。逐型号行数如下：

- DJI Mini 5 Pro：11 行
- DJI Mini 4K：11 行
- DJI Mini 4 Pro：11 行
- DJI Mini 3 Pro：12 行
- DJI Mini 3：11 行
- DJI Mini 2：8 行
- DJI Mini 2 SE：9 行
- DJI Mini SE：6 行
- 御 Mavic Mini：7 行

逐条审计记录见正式发布目录 `review-audit.json` 的 `partsAudit`（`audit-drone-part-001` 至 `audit-drone-part-086`）。每行保留：型号、官方分类、官方配件名原文、维修备件单价（CNY，含归一化数值）、映射到的通用节点 ID、来源 ID、快照路径、快照 SHA-256、行级原文哈希（`rawRowSha256`，对 `{category, partName, priceCNY}` 原文序列化值计算）与原始措辞 `original`。审计核对结果：86 行全部映射到策展节点，未映射 0 行；35 个官方名全部出现在表中，无悬空策展映射；86 行配件名均可在抽取正文 `extracts/article-text.txt` 中回溯；86 行价格均为可解析的 CNY 两位小数字符串。

**价格口径**：表内单价是 DJI 维修/备件 CNY 报价，仅作为备件事实留存于审计记录，不进入物料成本、企业利润或整机零售价结论；fixture 正文不携带任何备件单价数值。

页首购买提示仅提及而未列入维修报价表的 6 个项目——电池、充电器、桨叶、遥控器、遥控器摇杆、遥控器转接线——本批不据此建立 BOM 节点。

## 4. 通用 BOM 树（16 个节点，depth 0–2）

策展树以官方分类为依据，把同一类不同型号、版本后缀（CE/FCC）的配件名合并为通用组件节点，官方原文措辞保留在审计记录中。全树共 **16 个节点**：depth 0 整机 1 个，depth 1 模块 3 个，depth 2 组件 12 个。（任务简报早期记录的「14 节点」为旧口径，以当前策展树 16 节点为准。）

- depth 0 · 整机：`generic-camera-drone` 航拍无人机。
- depth 1 · 飞行器主体与飞控结构（官方分类：飞行器部件）
  - `drone-core-board` 核心板组件（飞控板）：飞行器核心板组件、核心板组件、核心板组件（CE）、核心板组件（FCC）
  - `drone-vision` 视觉组件（下视/前后视/红外 TOF）：下视视觉组件、下视视觉模组、前视&后视视觉组件、前后视觉组件、下视红外 TOF 组件
  - `drone-positioning-imu` 定位与惯性测量组件：飞行器 IMU 组件、GPS&IMU 组件
  - `drone-esc` 电调板组件：飞行器电调板组件、电调板组件
  - `drone-arm` 机臂组件：飞行器前机臂组件、飞行器后机臂组件、前机臂组件、后机臂组件、左前机臂组件
- depth 1 · 云台影像系统（官方分类：云台部件）
  - `drone-gimbal-assembly` 云台总成：飞行器云台组件
  - `drone-gimbal-camera` 云台相机组件：云台相机组件、相机组件
  - `drone-gimbal-axis-arm` 云台轴臂组件：云台 P 轴臂组件、云台 Y 轴臂组件、云台 P 轴臂、云台轴臂组件、云台 Y 轴轴臂组件
  - `drone-gimbal-motor` 云台轴电机组件：云台 Y 轴臂& Y 轴电机组件、云台 P 轴电机组件、云台 R 轴电机组件
- depth 1 · 配套遥控器系统（官方分类：遥控器部件）
  - `drone-remote-core-board` 遥控器核心板（主板）：RC-N1C 遥控器核心板、RC-N1 遥控器核心板、遥控器主板
  - `drone-remote-antenna` 遥控器拉伸件与天线组件：RC-N1C 遥控器拉伸件&天线组件、RC-N1 遥控器拉伸件&天线组件
  - `drone-remote-battery` 遥控器电池：RC-N1C 遥控器电池

每个条目（item）带 `sourceIds`、`method: curated`、`dataStatus`、`datasetVersionId` 与有效期间；故事节点（story node）另带 `evidenceIds`、`contentVersionId`、`period` 与官方分类备注。部件结构类节点的 `dataStatus` 为 `unknown`：层级本身是官方表支持的结构参照，但部件的材料、产地等属性未经观测，`unknown` 不等于 `0`。

## 5. 分类参照

- HS2022 品目 **8806**（Unmanned aircraft，aggrlevel 4），映射类型 `aggregate`（品目层宽口径）。
- 具体六位子目取决于最大起飞重量与操控方式；本批无重量与操控观测，分类停留在品目层。分类不证明最终用途、指定供应链关系或双边贸易。
- 本地库存盘点（`extracts/trade-snapshot-inventory.json`，只读扫描、未联网采集）中 `droneRelated` 为空，已收录的商品代码清单不含 8806/8802/8801；不存在任何 8806 贸易观测快照。

## 6. 叙事：一架无人机如何连接世界

本批故事图只走通「从整机到三类官方部件」这一步：官方维修表把部件分为飞行器、云台与遥控器三类，本步仅呈现部件层级，不含产地、材料、工序或贸易连线。故事图共 1 个步骤、0 条流向连线、0 个国家/市场节点。

代表性陈述：依据 DJI Mini 系列官方维修部件表，整理通用航拍无人机的飞行器、云台与遥控器部件层级；产地、材料、供应商、制造工序与贸易流向本批均未观测。

方法论三条：以官方备件表快照为唯一部件结构来源，同类别不同型号、版本后缀的配件名合并为通用组件节点，原文措辞保留在审计记录；HS2022 品目 8806 仅作分类参考，未采集任何 8806 贸易观察，贸易账本保持空态；官方报价为维修备件 CNY 报价，仅作备件事实留存审计，不进入成本、利润或零售价结论。

## 7. 证据缺口（4 项，全部 `open`）

1. `gap-drone-trade-8806`：缺少 HS2022 8806 贸易观测。本地无分报告方/伙伴/方向/年度的金额与数量快照；缺失快照不记作零贸易，不臆测出口国、进口国或双边供货关系，不把品目宽口径金额摊到本通用机型。候选证据：UN Comtrade Preview API（cmdCode=8806）一次性采集并逐条审计，缺返回或空结果按未知处理。
2. `gap-drone-materials`：缺少部件材质、牌号与材料配比证据；不标注部件材质，不把常见电子、塑料或金属材料默认套用为本机型用料。
3. `gap-drone-origins`：缺少产地国家/地区与供应商证据；不标注产地或具体供应商，企业能力记录不写作供货关系。
4. `gap-drone-process`：缺少制造工序、产线设备、节拍与产能证据；不编造工序、设备或产能，通用部件层级不替代装配工艺记录。

## 8. 产物、哈希与复跑验证

- 候选目录：`data/candidates/camera-drone-structure-2026-1/`（fixture.json / manifest.json / review-audit.json）。
- 正式发布目录：`data/published/releases/generic-camera-drone/globe-chain-camera-drone-2026.1/`。
- 正式 fixture SHA-256：`f3771c971d3cd9c28625cb85c830efd9ee43fe65628d025376625db846873ea7`；正式审计 SHA-256：`e70a4d97cd07d1978be9b8d5bf8406a08ae966ffe4576a1bfcca54493a212402`；active manifest 的 `contentSha256` 与当前 `research-input.json` 一致。
- 构建脚本 `scripts/build-drone.mjs` 离线运行：无网络调用、不读当前时钟、不写 active manifest；输入快照哈希在构建时逐条校验，被篡改的已审源文件会拒绝通过。连续两次在内存中重建产物字节完全一致；以当前输入重建的 fixture 与审计与 active 2026.1 发布目录字节相同，active 版本可由当前输入完整复现，无需新增版本。
- 候选目录内现存文件为更早一次构建的留存（审计行级 `original` 留痕字段与哈希序列化大小写与当前构建不同），与正式发布之间无事实分歧；按发布纪律不以哈希差异覆盖不可变 release。
- 官方发布校验：`node scripts/manage-published-release.mjs verify` 状态 `ok`，active 数据集版本 `globe-chain-camera-drone-2026.1`。
- 测试：无人机专项与相关 4 个测试文件 24 例通过；全量回归 66 个测试文件 378 例全部通过。
- 参赛静态包：`node scripts/build-qoder-preview.mjs` 打入 6 个已发布快照，`generic-camera-drone@globe-chain-camera-drone-2026.1` 包含在 `tmp/qoder-competition-web/fixtures.json`，打包产物可检索到 `camera-drone`。

## 9. 外观参考约束（只读核对，未复制代码或模型）

`reference-implementations.md` 记录了两个 Three.js 参考项目的源码/许可证层面审阅：FPV-Viewver 未取得 LICENSE、package.json 为 private 且无 license 字段，按保留所有权利处理，许可证确认前不复制其代码、场景组织细节或内置模型；mechanism 据 README 标注 MIT，本轮只提炼「数字必须带来源、对不上的规格不渲染」的建模纪律，不移植其脚本、零件库或闸门实现。Sketchfab「DroneCore 2 Exploded」为 CC BY-ND，仅可观看、禁止改作，不纳入实现。本项目无人机保持通用四旋翼，不硬仿品牌型号、标识、涂装或标称参数；模型资产程序化生成，不打包外部 glb/gltf。

## 10. 本批未覆盖与未执行事项

- 未联网采集新贸易、产地、材料、供应商或工序数据；未核验部件材质、牌号、重量占比、产能。
- 未做 web 生产构建、未启停服务、未截图、未执行 git 提交或打 tag、未发布公开站或参赛版。
- 五级框架中的材料层、国家角色与双边连线本批空缺；后续补证须逐条挂接来源、期间、method、datasetVersion 与数据状态后再登记。
