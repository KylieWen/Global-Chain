# GlobeChain 领域模型

## 建模原则

- 所有可展示事实或关系都要有年份/期间、单位（不适用时显式标记）、来源、`method`、`datasetVersion` 和数据状态。
- 名称不是主键；跨模块关联使用稳定 ID。
- 官方统计事实和代表性供应链内容是不同事实类型，分开建模、分开存储。
- 缺失值使用显式状态表达；`unknown` 不能转换成 `0`。
- 商品类型由分类数据决定，不由代码中的特殊枚举决定。
- 贸易指南是面向查询任务的独立事实类型，不是交易、报价或订单模型。

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

路线内节点 ID、国家 ID、货物/中间品商品 ID（可选）、生产环节、节点类型、适用期间、说明、`datasetVersion`、`contentVersion`、来源和逐条证据引用。节点不代表唯一工厂或单一批次。

节点的 `evidenceLevel` 与数值状态是两个不同维度：

- `role_supported`：来源支持该国家在相关材料或环节中的角色，但不证明与相邻国家的双边流向。
- `bilateral_supported`：证据直接支持起点、终点和方向；是否有金额或数量仍由独立数据状态决定。
- `representative`：用于解释典型结构的策展节点或连接，不是观察到的双边事实。
- `none`：当前内容版本没有直接证据支持该具体主张。

### SupplyChainFlow

有向边 ID、起点节点、终点节点、货物名称或商品 ID、流向说明、关系类型、路线性质、适用期间、单位（如适用）、来源、证据、`method`、`datasetVersion`、`contentVersion` 和数据状态。金额状态、数量状态和证据等级分开保存。数量未知时不得填 0；可只展示方向而不展示数量。

国家角色证据不能被自动提升为双边流向证据。若两个端点分别有产业角色资料，但没有来源直接支持两者之间的流动，边必须保持 `representative`，且金额/数量为 `unknown`。

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

## 贸易指南模型（查询资料）

### TradeGuide

`TradeGuide` 以商品、国家/地区、进口或出口方向和期间为范围，保存一组经过审核的查询资料。国家在进口指南中表示目的地/适用管辖区，在出口指南中表示起运地/适用管辖区。指南包含覆盖状态、最近复核时间、关税核验项、手续、文件、办理步骤、政策文档、官方来源、证据和限制。

### TariffMeasure / TradeRequirement / TradeProcedure

- `TariffMeasure` 只表达应当去哪里、按什么条件核验税费；`rateValue` 为 `null` 且状态为 `unknown` 时，页面必须显示“待核验”，不能显示 0%。
- `TradeRequirement` 表达海关申报、产品合规、标签、原产地等核验项及适用条件。
- `TradeProcedure` 与 `TradeProcedureStep` 表达办理顺序、参与方、渠道和文件关联；未知时限保持未知。
- `TradeDocumentRequirement` 表达建议准备或视情况准备的资料，不自动声称法律强制。
- `PolicyDocument` 保存官方法律、指引、门户或公告的链接和有效期信息。

贸易指南可以与商品、国家账本和供应链背景通过稳定 ID 跳转，但不从供应链角色自动生成政策结论，也不表示已发生交易。

### TradePartnerShare（可选预计算）

当需要展示伙伴排名或占比时，保存计算输入版本、分母定义、舍入规则和结果版本；不要只保存无来源的最终百分比。

## 制造工艺、设备与企业能力模型

- `ManufacturingProcessChain`：某个商品或部件的代表性工艺链及适用范围。
- `ManufacturingRouteVariant`：同一工艺链内可选择的技术路线及其适用工序，例如线焊或倒装；路线不是特定工厂的实际生产记录。
- `ManufacturingProcessStep`：有顺序的具体工序；不同技术路线可以跳过或替换步骤。
- `ProcessRequirement`：工序所需设备、材料、耗材、软件或服务。
- `EquipmentCategory`：通用设备类别，不等同于某个厂商型号。
- `Organization` / `Facility`：企业及其有证据支持的地点；没有工厂证据时不得按总部推断生产地点。
- `OrganizationCapability`：企业公开提供某类设备的能力记录。

能力证据分为 `manufacturer_supported`、`commercial_relationship_supported`、`representative` 和 `none`。`manufacturer_supported` 不得显示成客户供货；商业关系必须明确保存客户组织和直接证据。

## Provenance 与发布模型

### Source

来源名称、发布机构、URL/文档标识、许可证或使用条件、发布日期、获取时间、适用口径、method 说明和备注。

### IngestionBatch

原始快照位置/哈希、获取时间、处理程序版本、参数、操作者/作业身份和运行结果。原始快照应不可变。

### TransformationStep

清洗、标准化、分类映射、单位换算、聚合或估算步骤；记录输入批次、输出批次、规则版本和日志链接。

### DatasetVersion / ContentVersion

版本号（`datasetVersion` 或 `contentVersion`）、状态（draft/validated/published/deprecated）、创建与发布时间、审批人、变更说明和上一个版本。Web 默认只读 `published`。

供应链节点、边、生产活动和步骤必须引用可解析的 `ContentVersion` 记录，不能只保存无法校验的版本字符串。页面查询返回已经解析的版本、来源和 evidence，不要求页面自行连接 ID。

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
