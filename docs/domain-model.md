# GlobeChain 领域模型

## 建模原则

- 所有可展示事实或关系都要有年份/期间、单位（不适用时显式标记）、来源、`method`、`datasetVersion` 和数据状态。
- 名称不是主键；跨模块关联使用稳定 ID。
- 官方统计事实和代表性供应链内容是不同事实类型，分开建模、分开存储。
- 缺失值使用显式状态表达；`unknown` 不能转换成 `0`。
- 商品类型由分类数据决定，不由代码中的特殊枚举决定。

## 共享维度

### Country（国家/地区）

`country_id`、ISO 代码、标准名称、别名、有效期和显示状态。必要时区分国家、地区、关税区或统计区域，并保留来源映射。

### Product（商品）

`product_id`、规范名称、门类、描述、别名、单位偏好和生命周期状态。一个商品可以有多个外部分类映射和不同粒度的展示名称。

长期门类建议：农产品、食品、矿物能源、化工品、工业品、机械设备、电子产品、交通设备、纺织品、其他消费品。

### ClassificationCode（分类编码）

记录体系（如 HS）、版本、代码、层级、标签和有效期。`ProductClassification` 作为多对多映射，带映射类型（精确、聚合、近似、人工解释）和备注；不能无提示地把不同版本代码当成相同代码。

### Year / Period（统计期间）

首版以自然年为主，至少记录 `year` 和期间粒度；如来源使用财年或滚动年度，必须显式标注。

### Unit（单位）

记录数量/金额单位、维度、换算规则和精度。金额还要记录币种、价格口径（名义/实际）和汇率或换算版本。

## 供应链模型（代表性内容）

### SupplyChainRoute

路线 ID、商品 ID、标题、覆盖年份/期间、内容版本、路线状态（draft/validated/published/deprecated）、代表性声明、范围说明、method 和来源集合。

### SupplyChainNode

路线内节点 ID、国家 ID、货物/中间品商品 ID（可选）、生产环节、节点类型、顺序/位置提示、说明和证据引用。节点不代表唯一工厂或单一批次。

### SupplyChainFlow

有向边 ID、起点节点、终点节点、货物名称或商品 ID、流向说明、是否为推断/整理、适用期间、单位（如适用）、来源、method、datasetVersion 和数据状态。数量未知时不得填 0；可只展示方向而不展示数量。

## 贸易账本模型（官方统计事实）

### TradeFact

建议字段：

```text
fact_id
country_id              # 报告国
partner_country_id      # 可为空，表示世界总计或不适用
product_id              # 可为空，表示总额或宏观指标
classification_system
classification_code
year
period_granularity
flow_type                # import/export/balance/reserve/other
value
quantity                 # 可为空
unit_id
currency                 # 金额事实时必填
statistical_concept      # customs/BoP/official_reserve 等
data_status              # observed/estimated/unknown/withheld/invalid
source_id
dataset_version
method
quality_note
```

贸易顺差/逆差优先由同一口径的进口和出口确定性计算并保存计算定义；若来源直接发布余额，也要保留原始事实与计算方式。外汇储备属于宏观指标，不能与商品贸易额混为同一概念。

### TradePartnerShare（可选预计算）

当需要展示伙伴排名或占比时，保存计算输入版本、分母定义、舍入规则和结果版本；不要只保存无来源的最终百分比。

## Provenance 与发布模型

### Source

来源名称、发布机构、URL/文档标识、许可证或使用条件、发布日期、获取时间、适用口径、method 说明和备注。

### IngestionBatch

原始快照位置/哈希、获取时间、处理程序版本、参数、操作者/作业身份和运行结果。原始快照应不可变。

### TransformationStep

清洗、标准化、分类映射、单位换算、聚合或估算步骤；记录输入批次、输出批次、规则版本和日志链接。

### DatasetVersion / ContentVersion

版本号（`datasetVersion` 或 `contentVersion`）、状态（draft/validated/published/deprecated）、创建与发布时间、审批人、变更说明和上一个版本。Web 默认只读 `published`。

## 关系概览

```text
Product 1---N ProductClassification N---1 ClassificationCode
Country 1---N TradeFact N---0..1 PartnerCountry
Product 1---N TradeFact
SupplyChainRoute N---1 Product
SupplyChainRoute 1---N SupplyChainNode 1---N SupplyChainFlow
TradeFact / SupplyChain* N---1 Source
TradeFact / SupplyChain* N---1 DatasetVersion/ContentVersion
```

## 状态与空值语义

- `0`：来源明确报告为零，或在同口径下经验证确实为零。
- `unknown`：来源未提供、尚未匹配、无法判断或不适用；UI 显示“未知/未提供”，不参与需要数值的汇总。
- `withheld`：来源因保密等原因隐去；不要改写为未知或零。
- `estimated`：来源或人工方法明确为估算，需展示估算说明。
- `invalid`：校验失败，不得进入发布版本。

## 标识与版本规则

内部 ID 应稳定、不可复用；显示名称可随本地化或标准变更而改变。分类编码、统计口径和数据源版本变化时，创建新映射或数据集版本，不静默覆盖历史事实。
