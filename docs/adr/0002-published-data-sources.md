# ADR 0002：首份 published 数据集的数据源、年份与分类口径

- 状态：Accepted
- 日期：2026-08-25
- 决策范围：首份 `generic-smartphone` published 数据集
- 关联文档：`docs/mvp-scope.md`、`docs/data-policy.md`、`docs/domain-model.md`、`docs/adr/0001-smartphone-mvp.md`

## 背景

第一个 MVP 需要一份可以复现、引用和审计的真实统计数据集。当前的
`data/samples/` 仅用于 schema、查询和界面联调，不能直接当作现实世界的
供应链或贸易事实发布。首份正式数据集暂不接入数据库、地图或运行时外部 API，
而是把审核过的来源快照转换为带版本和出处的 `published` fixture。

本 ADR 只决定数据口径和发布边界，不决定页面视觉设计，也不把代表性供应链
路线解释为某个品牌、型号、企业或批次的唯一真实路线。

## 决策摘要

| 事项 | 决策 |
| --- | --- |
| 统计期间 | 2023 年完整自然年（`2023-01-01` 至 `2023-12-31`） |
| 宏观贸易与储备 | World Bank World Development Indicators（WDI） |
| 单品贸易 | UN Comtrade，HS 2022、6 位码，智能手机 `851713` |
| 国家/地区维度 | GlobeChain 内部稳定 ID + ISO 3166-1 alpha-3；保留 UN M49 数字代码和实体类型 |
| GlobeChain 门类 | 农产品、食品、矿物能源、化工品、工业品、机械设备、电子产品、交通设备、纺织品、其他消费品 |
| 首个商品门类 | `generic-smartphone` 归入“电子产品” |
| 发布方式 | 不可变原始快照 → 标准化/映射 → 校验 → 人工复核 → `published` fixture |
| 运行时边界 | Web 只读本地 `published` 数据，不在运行时请求 World Bank、Comtrade 或其他外部 API |

## 1. 统计年份与期间规则

1. 首份数据集统一使用 **2023 完整自然年**。所有年度观察都必须将
   `period.granularity` 设为 `annual`，并明确起止日期；不得把财年、季度或
   滚动年度静默并入 2023。
2. 选择 2023 是因为 WDI 和 UN Comtrade 均可取得该年数据，且现有 MVP
   导航和样例已以 2023 作为期间上下文。样例中的 2023 仍然是 `draft`，
   不因年份相同而获得官方事实含义。
3. 某个国家、商品或指标在 2023 没有可发布观察时，写入显式的
   `unknown`/`withheld` 状态（或不创建观察并在发布清单中记录缺口），不得
   用 0、其他年份的值或页面默认值补齐。
4. 后续增加年份必须创建新的 dataset version；不得在同一版本中混用年度口径。

## 2. 宏观指标：World Bank WDI

### 2.1 采用的指标

首批国家账本使用 WDI 的以下指标，原始值保持当前美元（名义美元）：

| GlobeChain indicator | WDI 指标代码 | 统计含义 | WDI 页面 |
| --- | --- | --- | --- |
| `merchandise_exports_current_usd` | `TX.VAL.MRCH.CD.WT` | 商品出口总额，current US$ | <https://data.worldbank.org/indicator/TX.VAL.MRCH.CD.WT> |
| `merchandise_imports_current_usd` | `TM.VAL.MRCH.CD.WT` | 商品进口总额，current US$ | <https://data.worldbank.org/indicator/TM.VAL.MRCH.CD.WT> |
| `official_reserves_including_gold_current_usd` | `FI.RES.TOTL.CD` | WDI 原文 “Total reserves (includes gold, current US$)”；项目显示为官方储备总额（含黄金） | <https://data.worldbank.org/indicator/FI.RES.TOTL.CD> |

WDI 页面标注的底层来源分别包括 WTO（商品进出口）和 IMF
International Financial Statistics（储备）。页面显示的 WDI 版本、更新时间、
查询参数和获取时间必须保存到原始快照及 source/provenance 记录中。

推荐的 API 查询模板（实际请求还应记录响应中的版本/更新时间）为：

```text
https://api.worldbank.org/v2/country/{ISO3}/indicator/TX.VAL.MRCH.CD.WT?date=2023&format=json
https://api.worldbank.org/v2/country/{ISO3}/indicator/TM.VAL.MRCH.CD.WT?date=2023&format=json
https://api.worldbank.org/v2/country/{ISO3}/indicator/FI.RES.TOTL.CD?date=2023&format=json
```

### 2.2 贸易差额的计算

`merchandise_trade_balance_current_usd` 不是从不同口径拼接的第三方数字，而是
在相同国家、期间、币种和 WDI 版本下确定性计算：

```text
trade balance = merchandise exports - merchandise imports
```

该记录使用 `method: "derived"`，在 `notes` 中保存公式、两个输入观察的 ID、
输入数据集版本和舍入规则。正值表示顺差，负值表示逆差；它仍是贸易统计
差额，不是企业利润、国民收入或国内增加值。

### 2.3 储备指标的显示语义

`FI.RES.TOTL.CD` 在 WDI 中的原文是 “Total reserves (includes gold, current US$)”。
项目规范展示名称应为“官方储备总额（含黄金）”或等价明确文案，
不能在没有注释的情况下简称为狭义“外汇储备”。黄金部分可能与外汇资产的
估值和统计时点不同，因此：

- 不从该值中自行扣除黄金；
- 不把它与商品出口收入或贸易余额相加减来生成经济结论；
- 若未来采用不含黄金的官方指标，必须使用新的 indicator ID、来源说明和
  dataset version，不能覆盖或重命名现有观察。

本首份数据集**不选择不含黄金的储备指标**，也不尝试从总储备中估算或扣除黄金。
“不含黄金的外汇储备”只能在来源明确给出定义、估值时点、币种和许可条件时作为
另一个独立宏观指标接入；它不能与 `official_reserves_including_gold_current_usd`
互换、拼接或在页面上使用同一个短标签。届时应同时显示“含黄金/不含黄金”的
限定语，并保留两者各自的来源和版本。

World Bank 数据许可说明见：
<https://datacatalog.worldbank.org/public-licenses>。发布时至少保留
“World Bank, World Development Indicators”归属、指标 URL、底层来源说明和
当前许可链接；若某个指标附带单独限制，以该限制为准。

## 3. 单品贸易：UN Comtrade 与 HS 2022

### 3.1 查询范围

手机单品贸易观察来自 UN Comtrade Public API 的年度海关贸易数据：

- 分类体系：Harmonized System（HS）2022；使用 6 位码；
- 首个代码：`851713`（Smartphones）；
- 报告国：首批配置的国家/地区；
- 伙伴：`partnerCode=0`，表示世界总计；
- 流向：`flowCode=X` 出口、`flowCode=M` 进口；
- 海关范围：`customsCode=C00`；
- 金额：优先使用 API 的 `primaryValue`，货币为 USD；
- 数量：只有来源标记允许且单位明确时才发布，否则保持 `null` 并保留原因。

`851713` 是外部统计分类映射，不表示某个品牌或型号的全部零件，也不等于
手机销量、产量、销售额或利润。手机电池等节点可另有 HS 映射；例如
`850760` 只能在证据和范围说明充分时作为“锂离子蓄电池”聚合/近似映射，
不能宣称它精确代表手机电池。

### 3.2 估算和质量标记

Comtrade 返回的 `legacyEstimationFlag`、`isQtyEstimated` 等原始字段必须写入
`qualityNote` 或等价 provenance。转换规则如下：

- 来源明确标记为估算的金额或数量使用 `dataStatus: "estimated"`，不得静默
  标为 `observed`；
- 未标记估算且通过数值/单位校验的观察可标为 `observed`；
- 估算数量不作为精确数量发布；金额与数量状态可以不同；
- API 没有返回某国家/代码的记录时，不创建值为 0 的观察，保持“未发布/未知”。

UN Comtrade 不被视为 CC BY 数据。必须遵守当前的使用和再传播条款，并在
公开页面和导出中提供来源归属、查询范围、提取日期和原始链接：

- License Agreement：<https://comtradeplus.un.org/LicenseAgreement>
- Policy on Use and Re-dissemination：<https://comtradeplus.un.org/PolicyOnUseAndRedissemination>
- 联合国通用条款：<https://www.un.org/en/about-us/terms-of-use>

项目不得根据“公开可访问”推断“可任意再许可”。若当前条款不允许把完整原始
响应放入公开仓库，原始响应只保存在受控的内部归档中；公开 `published` 数据
仅包含条款允许的标准化聚合观察、必要的查询元数据、哈希和归属。每次发布前
由维护者重新核对上述条款。

## 4. 国家/地区与代码维度

国家/地区不是页面中的自由文本。每个实体使用 GlobeChain 自有稳定 ID，并保留：

- ISO 3166-1 alpha-3（如适用）作为跨来源常用代码；
- UN M49 数字代码作为联合国统计维度；
- `GeoEntity.kind`（国家、地区、统计区域或关税区）和有效期间；
- 来源映射、名称和别名。

ISO 与 M49 代码只是维度标识，不应被解释为政治立场或边界裁决。统计来源
可能使用“世界总计”、关税区或地区聚合，必须保留来源原始实体和实体类型，
不能强行拆分为主权国家。

参考：

- UN M49：<https://unstats.un.org/unsd/methodology/m49/>
- ISO 3166 country codes：<https://www.iso.org/iso-3166-country-codes.html>

首个数据切片可覆盖澳大利亚、刚果民主共和国、智利、中国、德国、印度尼西亚、
日本、韩国和美国（ISO alpha-3：`AUS`、`COD`、`CHL`、`CHN`、`DEU`、`IDN`、
`JPN`、`KOR`、`USA`）。该集合用于覆盖材料、加工、制造、组装和消费市场角色，
不是“所有国家”的完整统计；缺失的单品观察必须保持未知。

## 5. GlobeChain 内部门类体系

外部统计仍保留原始 HS/WDI 口径；GlobeChain 另设一个稳定、配置驱动的十类
导航门类，用于跨商品浏览：

| slug（建议） | 中文显示名 |
| --- | --- |
| `agricultural-products` | 农产品 |
| `food` | 食品 |
| `minerals-energy` | 矿物能源 |
| `chemicals` | 化工品 |
| `industrial-goods` | 工业品 |
| `machinery-equipment` | 机械设备 |
| `electronics` | 电子产品 |
| `transport-equipment` | 交通设备 |
| `textiles` | 纺织品 |
| `other-consumer-goods` | 其他消费品 |

`generic-smartphone` 映射到 `electronics`。任何内部门类映射都必须是有来源、
有版本的 `ClassificationCrosswalk` 或内容配置；不能由页面按名称猜测，也不能
把十类门类当作 HS 官方层级。一个商品可以映射到多个外部代码或内部门类，
映射类型必须标记为 exact、aggregate、approximate 或 curated，并写明范围。

## 6. 代表性供应链内容的来源边界

电池开采、精炼、材料、电芯、模组、组装和消费市场路线属于
`flowKind: "representative_supply"` 的策展内容，使用 `method: "curated"`，
不冒充 WDI 或 Comtrade 的官方路线事实。每个节点/边必须附 evidence，定位到
公开报告的章节、表格或页面；可使用 USGS Mineral Commodity Summaries、IEA、
政府/国际组织报告等，但每个来源的许可证或再传播条件要单独记录。

若来源只能支持“某国具有某材料产能/角色”，而不能支持一条国家到国家的确定
流向，则只发布角色节点或 `unknown` 方向，不补写确定路线、数量或企业利润。

## 7. 版本、快照与发布边界

首份版本采用以下命名约定（若实现选择等价名称，必须在 manifest 中明确映射）：

- `datasetVersion`: `globe-chain-smartphone-2023.1`；
- WDI 原始批次：`world-bank-wdi-2023`；
- Comtrade 原始批次：`un-comtrade-hs2022-851713-2023`；
- 代表性路线 `contentVersion`：`smartphone-route-2023.1`；
- 获取批次日期：以 `data/published/raw/manifest.json` 的 `retrievedAt` 为准，并记录
  具体 UTC 时间；ADR 日期（2026-08-25）不应被当作 API 获取时间。重新抓取或来源
  修订时必须创建新的批次和 dataset version。

推荐目录边界：

```text
data/published/
├─ raw/                 # 来源响应/快照；不可变，不由 Web 直接读取
├─ smartphone/
│  └─ fixture.json      # 标准化并通过 schema 的 published 输出
├─ manifest.json        # 只列出可发布 fixture
└─ README.md            # 许可、归属、重建与缺口说明
```

原始快照必须记录 URL、查询参数、获取时间、来源版本/更新时间、SHA-256、转换
脚本版本和校验结果。生成的 fixture 只读取已审核快照，不在启动或页面请求时
访问外部 API。受许可证限制不能公开的原始响应应移入受控归档；公开仓库至少
保留可复核的来源 URL、查询参数摘要、哈希、转换规则和发布说明。

`published` 只接受通过 schema、引用完整性、期间/单位/币种、重复键、估算标记、
余额计算和缺失值语义检查的批次。`data/samples/` 永远保持 draft/mock，不能由
本 ADR 或生成脚本静默替换。

## 8. 许可与归属清单

发布清单和页面来源页至少列出以下信息：

1. **World Bank WDI**：World Bank、指标名称和代码、WDI 页面/API URL、
   `CC BY 4.0`（以数据目录当前条款及指标例外为准）、底层 WTO/IMF 来源、
   获取时间和数据集版本。
2. **UN Comtrade**：UN Comtrade、API 查询 URL/参数、提取日期、HS 2022 代码、
   `primaryValue`/质量标记处理方式，以及 License Agreement、Policy on Use and
   Re-dissemination 和 UN Terms of Use 链接；不得标记为 CC BY 或项目自有许可。
3. **HS 2022、UN M49、ISO 3166**：保留分类/代码体系名称、版本、原始链接和
   必要归属；不把外部代码表重新包装成 GlobeChain 独占内容。若要公开完整代码表，
   先检查相应版权/再传播条件。
4. **路线证据**：逐条记录发布机构、文档标题/章节、URL、发布日期和许可/使用
   条件；没有明确条件时只保留必要的事实摘要和链接，不复制受限全文。

## 后果

### 正面

- 所有首版数字共享一个完整自然年，能在页面上清楚解释“同年、同币种、同口径”。
- WDI 适合国家总额和储备，Comtrade 适合 HS 单品，二者职责分离且可追溯。
- 十类内部导航不破坏外部统计分类，后续商品只需新增映射和数据。
- 原始快照、发布 fixture 与运行时读取边界清晰，便于重建、审计和回滚。

### 代价与限制

- 2023 是单年截面，不能用于趋势或因果结论。
- WDI 商品总额与 Comtrade 手机代码的统计覆盖、修订周期和估算标记不同，不能
  直接相加或声称完全一致。
- “官方储备总额（含黄金）”不是狭义外汇储备；页面必须持续显示限定语。
- Comtrade 和部分代码体系的再传播条件可能限制公开原始快照，需要受控归档或
  仅发布许可允许的衍生观察。
- 代表性路线仍是策展内容，不等于企业级供应链、订单、产能或利润分配。

## 验收条件

首份 published fixture 发布前必须证明：

1. 每条 WDI/Comtrade 观察可追溯到来源 URL、查询参数、原始批次和哈希；
2. 所有年度观察为 2023，缺失不被写成 0；
3. HS 2022/6 位映射和十类内部门类均有版本、类型和说明；
4. 储备指标在数据、页面和导出中明确标注“含黄金”；
5. Comtrade 估算/质量标记被保留并正确映射到状态；
6. 许可证、归属和再传播限制出现在 `data/published/README.md` 与来源详情；
7. 生成流程不访问运行时外部 API，且 `published` 与 `draft` fixture 不互相覆盖。
