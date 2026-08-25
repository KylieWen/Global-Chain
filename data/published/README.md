# GlobeChain published 数据集

本目录保存已经通过 schema、来源引用、期间/单位、缺失值和发布审核的可读数据。
首份数据集是 2023 年 `generic-smartphone`；数字观察来自不可变 raw 快照，供应链
拓扑、证据绑定和方法说明来自单独版本化的 reviewed route content。

## 目录约定

```text
published/
├─ raw/                 # 来源快照或受控归档索引，不由 Web 运行时读取
├─ smartphone/
│  └─ fixture.json      # 标准化、校验、批准后的 fixture
├─ manifest.json        # published loader 的入口清单
└─ README.md            # 许可、归属、重建和缺口说明

content/routes/
└─ generic-smartphone-2023.json  # 审核后的路线拓扑、证据绑定和内容版本
```

`data/samples/` 是独立的 `draft`/`mock` 联调数据，不能因为年份或商品名称相同而
与本目录混用。构建脚本可以继续读取 sample 中的通用 catalog 形状，但不得从
sample 的 `storyGraph` 或 `productionActivities` 提升 published 路线。Web 默认只
读取 `published` manifest；构建过程不在运行时请求外部 API。

## 首份数据集口径

- 期间：2023 完整自然年；不混用财年、季度或其他年份。
- 国家/地区：使用 GlobeChain 稳定 ID，保留 ISO 3166-1 alpha-3、UN M49 和实体类型。
- 单品贸易：UN Comtrade，HS 2022 六位码 `851713`（Smartphones）。当前 fixture 同时
  保存两类彼此独立的观察：`partnerCode=0` 的世界总计进口/出口观察，以及
  `partnerCode` 为具体统计伙伴代码的中美、中德双边观察。二者不能互相替代或拼接。
- 宏观账本：World Bank World Development Indicators（WDI）商品进出口和官方
  储备（含黄金）指标；贸易差额由同一版本的出口减进口确定性计算。
- 内部门类：农产品、食品、矿物能源、化工品、工业品、机械设备、电子产品、
  交通设备、纺织品、其他消费品；通用智能手机归入电子产品。

完整决策、代码和语义见 [`docs/adr/0002-published-data-sources.md`](../../docs/adr/0002-published-data-sources.md)。

当前发布清单（`data/published/manifest.json`）的数字版本为
`globe-chain-smartphone-2023.3`；路线拓扑和策展说明的内容版本为
`smartphone-route-2023.2`（本阶段重建后的当前路线内容版本）。两种版本分别演进，页面或导出必须同时显示它们，不能
把内容版本当成统计数据版本。

## 来源、许可与归属

### World Bank WDI

WDI 指标页面和数据目录通常以 **CC BY 4.0** 提供，发布时必须保留 World Bank
及 World Development Indicators 归属，并链接到具体指标页面和当前许可页。首批
指标及链接：

- 商品出口：`TX.VAL.MRCH.CD.WT`，<https://data.worldbank.org/indicator/TX.VAL.MRCH.CD.WT>
- 商品进口：`TM.VAL.MRCH.CD.WT`，<https://data.worldbank.org/indicator/TM.VAL.MRCH.CD.WT>
- 官方储备总额（含黄金；WDI 原文 “Total reserves (includes gold, current US$)”）：
  `FI.RES.TOTL.CD`，<https://data.worldbank.org/indicator/FI.RES.TOTL.CD>
- World Bank 数据许可：<https://datacatalog.worldbank.org/public-licenses>

本首份数据集只发布“官方储备总额（含黄金）”，不发布或推算“不含黄金的外汇储备”。
如未来新增不含黄金指标，必须使用独立 indicator ID、定义、来源和 dataset version，
并在页面和导出中保留含黄金/不含黄金限定语。

WDI 页面列出的底层来源包括 WTO（商品贸易）和 IMF International Financial
Statistics（储备）。如果具体指标或下载版本出现不同的附加条款，以该条款为准，
不得只依据 CC BY 标签发布。

### UN Comtrade

UN Comtrade 的数据和 API **不得标记为 CC BY 或 GlobeChain 自有许可**。公开发布
前必须遵守当前版本的：

- License Agreement：<https://comtradeplus.un.org/LicenseAgreement>
- Policy on Use and Re-dissemination：<https://comtradeplus.un.org/PolicyOnUseAndRedissemination>
- United Nations Terms of Use：<https://www.un.org/en/about-us/terms-of-use>

每个衍生观察应保留 UN Comtrade 归属、原始查询 URL/参数摘要、提取日期、HS
版本/代码和质量标记处理说明。公开仓库是否能包含完整 API 原始响应，取决于
当前再传播条款：若条款不明确或不允许，原始响应放在受控归档，只在本目录保留
许可允许的标准化聚合值、哈希和重建元数据。

#### 伙伴与双边观察语义

- `partnerCode=0` 只表示来源统计体系中的 **World total**；它不是具体国家，也
  不是“未知伙伴”。此时 `partnerScope` 为 `world_total`，`partnerEntityId` 保持
  `null`。缺少该行不能创建金额为 0 的观察。
- `partnerCode>0` 表示请求中指定的来源伙伴；fixture 将其作为
  `partnerScope: "entity"` 保存，并保留 `reporterCode`、`partnerCode`、
  `partner2Code`、`flowCode`、HS 版本/代码、期间、币种、金额、数量状态和质量标记。
  `partner2Code=0` 是次级伙伴维度的世界/未细分值，不会把主伙伴改成世界总计。
- 当前双边快照包含四个 reporter/partner 查询（中国↔美国统计区、中国↔德国），
  共八条进口/出口观察。美国来源代码 `842` 是 UN Comtrade 的 USA 统计区，包含
  波多黎各和美属维尔京群岛；它不等同于 ISO/M49 `840`，镜像报告也不合并、平均或
  互相替代。
- 每条双边观察只证明“该 reporter 在该期间、以该 flow、向该 partner 报告了
  HS 2022/851713 海关贸易”。它不证明手机由某国组装、进入某工厂或某条代表性
  路线，也不证明最终消费、成本、利润或品牌/型号。`CIF`/`FOB` 估值和报告制度差异
  使镜像金额不可直接相加。

双边 raw 快照位于
`data/published/raw/un-comtrade-hs2022-851713-bilateral-2023.json`。快照保留每个
请求的 URL、完整参数、获取时间、HTTP/发布元数据、原始响应哈希和规范化数据哈希；
`data/published/raw/manifest.json` 是批次、来源版本和许可链接的索引。原始响应是否
可继续公开，仍以当前 UN Comtrade License Agreement、Policy on Use and
Re-dissemination 及 UN Terms of Use 为准；仓库中的文件不代表项目取得了更宽的再
许可权。

### 分类和地理代码

HS 2022、UN M49 和 ISO 3166 代码是外部参考体系。发布文件应记录体系名称、版本、
代码、标签来源和原始链接；不要把完整外部代码表重新许可为 GlobeChain 内容。
完整代码表的再传播须分别核对相应条款：

- UN M49：<https://unstats.un.org/unsd/methodology/m49/>
- ISO 3166：<https://www.iso.org/iso-3166-country-codes.html>

### 代表性供应链路线

电池材料、精炼、正负极、电芯、模组、组装和市场节点属于人工策展的
`representative_supply` 内容，通常使用 `method: "curated"`。每条节点/边必须
有证据 URL、章节/表格定位、发布日期及许可或使用条件。公开内容只复制必要的
事实摘要，不复制未获许可的报告全文。代表性路线不是某一品牌、型号、工厂、批次
或唯一真实路线，也不提供企业利润或成本分配。

当前路线采用以下两条互不替代的状态轴：

- `dataStatus` 描述该记录所表达的数据是否 observed、estimated 或 unknown；
- `evidenceLevel` 描述证据支持的是国家角色、直接双边流向还是代表性连接。

当前版本使用的 evidence level 为：

- `role_supported`：来源支持某国在某材料上的生产角色，不支持它流向某个目的国；
- `bilateral_supported`：来源直接支持起点、终点、商品、方向和期间；当前仅用于
  四条独立的 HS 851713 双边证据记录，不会自动升级路线中的相邻边；
- `representative`：项目依据角色资料和一般阶段资料建立的策展连接；
- `none`：没有可发布的支持关系，不应用来呈现事实路线。

所有现有供应链边仍为 `representative`，其 `value` 与 `quantity` 为 `null`，
`valueDataStatus` 与 `quantityDataStatus` 均为 `unknown`。这里的 `unknown` 绝不表示
真实零值。当前的双边 HS 851713 观察也不改变这一点：它们是独立的贸易账本事实，
不是“中国组装 → 美国/德国消费”路线边的数量。只有来源明确报告 0 时才可使用真实
零值；未返回、未披露、无法匹配或被估算的值必须保留为 `null` 并标注状态。

USGS 的六条拆分证据支持澳大利亚锂、刚果民主共和国钴、印度尼西亚镍、中国石墨、
智利铜和澳大利亚铝的国家/地区上游角色，但不证明这些角色之间存在双边运输。中国
国家统计局的“移动通信手持机”产量支持较宽的中国生产角色；IEA 资料支持韩国在
一般电池（尤其 EV 电池）供应链中的背景角色，不是手机特定产量；JEITA/METI 的
初步统计支持日本电子组件/LCD 的宽泛生产角色。美国和德国的世界总计
`851713` 进口观察支持进口市场角色，但不识别来源伙伴或最终消费。上述角色证据的
`supportsBilateralFlow` 均为 `false`，相邻路线边因此继续是 `representative`。

IEA 的 *Global supply chains of EV batteries* 只用作一般电池材料、电芯和模组
阶段背景。它讨论电动汽车电池，不能证明手机电池的国家路线。项目自有的路线方法
source/evidence 说明如何形成代表性连接，但它本身不是外部事实证据。

世界总计与具体伙伴必须分开解读：例如中国对世界的出口不能替代中国对美国或德国
的报告；美国/德国从世界的进口也不能替代其从中国的报告。当前虽有中美、中德的
具体伙伴观察，但它们只支持狭义的双边 HS 海关主张，不足以关闭组装、分销或消费
节点的路线缺口。因此，日本电子组件、中国手机组装、美国分销和德国消费节点的
路线连接仍保持 `representative + unknown`。铜和铝作为简化的电芯相关材料输入，
中间冶炼、铜箔/铝箔和集流体制造阶段尚未发布；尤其不得把铝描述为负极活性材料。

材料分类的贸易观察只能证明相应 HS 分类商品发生贸易。当前登记册将铜、铝、锂、钴、
镍和石墨按矿石/化合物/精炼品/箔材等候选阶段拆分，并把宽泛代码标记为
`aggregate` 或 `approximate`；这些分类不能证明材料进入手机、电池或指定工厂。
没有材料双边证据时，不能为了形成连续路线而补写起点、终点或数量。

第 9 阶段新增的 `materialTradeObservations` 是独立于智能手机 `851713` 的通用材料贸易层，
覆盖中国报告方对世界总计与 Comtrade 统计区 842 的 2023 观察。每条记录保留具体 HS
代码、伙伴范围、金额/数量状态、质量标记和限制说明；aggregate 分类不能被解释为手机用途。
原始快照为 `raw/un-comtrade-hs2022-materials-2023.json`，仍受 UN Comtrade 当前许可与
再传播政策约束。

Web 的 `/products/{productId}/materials` 通过领域查询读取这一层，可按材料、伙伴范围、
进口/出口和分类映射精度筛选；观察详情页同时解析来源、证据等级和匹配的证据缺口。
页面只做只读解释，不会把材料观察写回路线，也不会把 `bilateral_supported` 自动传播到
任何代表性供应链边。

## 原始快照与重建

原始快照应记录：来源 URL、完整查询参数、获取时间（含时区；以 raw manifest 的
`retrievedAt` 为准）、来源版本/更新时间、
SHA-256、转换脚本和规则版本、校验结果及异常。快照不可变；修订来源时创建新的
批次和 dataset version，不覆盖旧文件。

推荐的处理链：

```text
官方 API/下载 → raw 快照或受控归档索引 ─┐
                                                ├→ 标准化、引用校验 → published fixture
审核后的 route content → content version ─────┘
```

运行时不抓取数据，不把 `unknown` 转成 `0`，不把海关金额解释为收入、成本或利润。
任何导出都应携带 dataset version、来源归属、统计口径和生成时间。

`manifest.json` 同时记录 fixture hash、route content version、route content hash 和
content source 路径。修改路线时必须创建或更新 content version，重新运行
`pnpm data:build:smartphone`，不得手工只改生成后的 fixture。

第 11 阶段额外发布了六组国家角色配对快照：澳大利亚—中国锂、澳大利亚—中国铝、
刚果民主共和国—中国钴、印度尼西亚—中国镍、智利—中国铜以及中国—韩国石墨。
这些记录是独立的分类商品贸易观察；某个方向未返回记录时保持缺失，不补写为零，且不代表
相应国家角色之间已经形成手机电池的连续供应链。

## 缺口记录

没有返回记录的国家/商品组合表示“未发布/未知”，不是零。估算值、保密值、不可
匹配值和真实零值必须使用不同的数据状态。数据集生成器应在 manifest 或发布说明
中列出这些缺口及其原因，方便后续补充而不改变历史版本的含义。

当前逐节点、逐边登记册位于
`content/evidence-gaps/generic-smartphone-2023.json`，记录 33 条缺口（覆盖当前
14 个节点和 13 条边），状态为 `open`、`partial`、`closed` 或
`not_publicly_observable`，并为每条记录保存当前主张、缺失证据、可接受证据类型、
候选来源/许可和不可推断内容。登记册是策展内容，不是运行时推断器；其
`contentVersionId` 必须与路线内容版本一致。

当前已知路线缺口包括：13 条边没有足以支持完整阶段起点/终点/商品/方向/期间的
直接双边证据；日本组件、中国组装、美国分销和德国消费的手机特定角色仍有限；IEA
主要是 EV 电池背景而非手机电池来源；铜、铝的中间材料加工阶段被明确省略。这些
缺口只能通过新增审核来源、原始快照和新 dataset/content version 补充，不得通过把
世界总计观察拼接成双边流向来填补。
