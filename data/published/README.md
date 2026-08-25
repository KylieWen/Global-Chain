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
- 单品贸易：UN Comtrade，HS 2022 六位码 `851713`（Smartphones），世界总计伙伴，
  进口/出口海关观察。
- 宏观账本：World Bank World Development Indicators（WDI）商品进出口和官方
  储备（含黄金）指标；贸易差额由同一版本的出口减进口确定性计算。
- 内部门类：农产品、食品、矿物能源、化工品、工业品、机械设备、电子产品、
  交通设备、纺织品、其他消费品；通用智能手机归入电子产品。

完整决策、代码和语义见 [`docs/adr/0002-published-data-sources.md`](../../docs/adr/0002-published-data-sources.md)。

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

首个版本使用的 evidence level 为：

- `role_supported`：来源支持某国在某材料上的生产角色，不支持它流向某个目的国；
- `bilateral_supported`：来源直接支持起点、终点、商品和期间。当前数据集中没有此类边；
- `representative`：项目依据角色资料和一般阶段资料建立的策展连接；
- `none`：没有可发布的支持关系，不应用来呈现事实路线。

所有现有供应链边均为 `representative`，其 `value` 与 `quantity` 为 `null`，
`valueDataStatus` 与 `quantityDataStatus` 均为 `unknown`。这里的 `unknown` 绝不表示
真实零值。USGS 的六条拆分证据只支持澳大利亚锂、刚果民主共和国钴、印度尼西亚
镍、中国石墨、智利铜和澳大利亚铝相关上游角色；它们不证明这些角色之间存在
双边运输。

IEA 的 *Global supply chains of EV batteries* 只用作一般电池材料、电芯和模组
阶段背景。它讨论电动汽车电池，不能证明手机电池的国家路线。项目自有的路线方法
source/evidence 说明如何形成代表性连接，但它本身不是外部事实证据。

中国、美国和德国的 UN Comtrade 证据均为 `partnerCode=0` 世界总计观察：

- 中国对世界的出口不能证明流向美国或德国；
- 美国从世界的进口不能证明来源于中国，也不能证明具体分销活动；
- 德国从世界的进口不能证明来源于中国，且进口额不等于最终消费。

因此，日本电子组件、中国手机组装、美国分销和德国消费节点在当前版本保持
`representative + unknown`。铜和铝作为简化的电芯相关材料输入，中间冶炼、铜箔/
铝箔和集流体制造阶段尚未发布；尤其不得把铝描述为负极活性材料。

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

## 缺口记录

没有返回记录的国家/商品组合表示“未发布/未知”，不是零。估算值、保密值、不可
匹配值和真实零值必须使用不同的数据状态。数据集生成器应在 manifest 或发布说明
中列出这些缺口及其原因，方便后续补充而不改变历史版本的含义。

当前已知路线缺口还包括：13 条边均无直接双边证据；日本组件、中国组装、美国
分销和德国消费角色没有直接来源；IEA 是 EV 电池而非手机电池来源；铜、铝的
中间材料加工阶段被明确省略。这些缺口只能通过新增审核来源和新内容版本补充，
不得通过把世界总计贸易观察拼接成双边流向来填补。
