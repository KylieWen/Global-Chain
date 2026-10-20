# 智能手机完成度：研究入口与基线

本清单基于 `globe-chain-smartphone-2026.1`，fixture SHA-256 为
`5e768c6d1022214cd3005f90cfdd087a5f0b378923d4478bd238599251ace7f9`。
这是仓库内数据审计，不是新的外部来源核验；此文件不修改已发布事实或缺口状态。
先补完现有智能手机的组件、上下游和可解释路径，暂不新增咖啡。

后续本地复核已生成并激活 `globe-chain-smartphone-2026.2`，仅把下述两条成品手机
双边观察的过时缺口关闭；基线计数仍按 2026.1 保留。实际结果与复现命令见
[双边缺口复核记录](data-review/2026-10-21-bilateral-gap-review.md)。

## 不能混淆的完成度

| 层次 | 当前状态 | 如何补完 |
| --- | --- | --- |
| 独立商品 | 1 个；34 个根商品/组件/材料记录，7 个一级组件 | 让各组件有可阅读的组成、阶段、角色、上下游入口 |
| 证据缺口登记 | 42 条：closed 8、partial 20、open 8、not_publicly_observable 6 | 逐条核对缺口是否仍有效，新增来源后再调整状态 |
| 国家节点 | 27 个：14 个 role_supported、13 个 representative；6 个数值状态 observed、21 个 unknown | 有国家角色证据不等于产量已知；分别补证据与数值 |
| 路线连接 | 13 条，全部 representative，金额/数量全部 unknown | 可以补齐明确标注的代表阶段连接；只有直接双边证据才能提升相应证据等级 |
| 生产活动 | 14 条：6 observed、8 unknown | 优先核验下列 8 类角色/阶段，不把国家统计当成具体工厂供货 |
| 手机贸易 | 24 条金额 observed；数量 14 observed、8 estimated、2 unknown | 缺少数量单位或数值时仍保留 unknown，估算保留来源标识 |
| 材料贸易 | 62 条金额 observed；数量 41 observed、21 estimated | 用于分类贸易观察；不能直接串成同批材料谱系 |
| 封装设备能力 | 18 类设备、9 类已有厂商能力记录、6 家厂商；9 条能力均 manufacturer_supported | 补设备类别能力；客户供货需要单独直接证据 |
| 税费 | 7 项：6 observed、1 unknown | 未核验的美国附加税按具体条件研究，不补默认税率 |

8 条 unknown 生产活动是：中国正极、中国负极、韩国电芯、韩国模组、日本组件、
中国组装、美国分销、德国消费。记录 ID 位于 published fixture 的 `productionActivities`。

## 先核对已有数据与缺口登记是否同步

`gap-flow-assembly-us-bilateral`、`gap-flow-assembly-germany-bilateral` 仍陈述缺少
2023 年具体伙伴数据；仓库已有 `un-comtrade-hs2022-851713-bilateral-2023.json`，
当前手机统计又已更新至 2024/2025。先核对原始响应、双方镜像、分类、方向、期间和
该缺口确切主张；不能因为新年度存在记录，就静默关闭原来 2023 年的缺口。

其余材料缺口中多处描述“已补充 2023 年观察”，而当前材料统计大多为 2024 年。
研究完成后需同时保存统计期间与路线期间，避免用最新贸易额充当旧路线证据。

## 按用户路径安排研究

1. **摄像头、PCB/连接器、外壳结构件、传感器/音频。**
   当前各有 open 角色缺口。先为每类提供有出处的功能、构成、生产阶段与国家角色，
   再连接到组装阶段；缺少双边来源时明确保持代表连接。
2. **显示与处理器/存储器。**
   已有组件类别和部分角色资料，但不等于已有完整生产路线。补晶圆、封装、显示面板、
   模组与最终组装间的可解释阶段；保留 DRAM/NAND、手机用途与 HS 聚合类别差异。
3. **电池上下游。**
   先核对现有材料观察和来源，区分矿石、化合物、箔材、正负极材料、电芯、模组。
   不把电动车电池报告直接改写为手机电池路线；未公开的批次谱系保留不可公开观测状态。
4. **工艺与设备。**
   已有 18 工序，优先补没有厂商能力记录的设备类别，而非重复增加相同工序说明。
   当前未覆盖：来料/晶圆检测、贴膜装框、凸点加工、清洗干燥、底部填充点胶、固化、
   电镀标记、老化筛选、器件包装。厂商总部不能代替设备制造地或客户工厂地点。

## 仓库已有的关键来源入口

以下为已记录来源，链接和适用期间仍需在研究时重新核验；本轮审计没有访问这些网页。

| 研究任务 | 已有来源与适用边界 |
| --- | --- |
| 贸易与具体伙伴 | UN Comtrade raw 快照与 [Comtrade](https://comtradeplus.un.org/)；验证分类、统计方、伙伴、方向、期间和镜像差异 |
| 矿物国家角色 | [USGS MCS 2024](https://pubs.usgs.gov/periodicals/mcs2024/mcs2024.pdf)；支持矿产角色，不支持手机最终用途 |
| 电池阶段 | [IEA 电池供应链报告](https://www.iea.org/reports/global-supply-chains-of-ev-batteries)、[Batteries and Secure Energy Transitions](https://www.iea.org/reports/batteries-and-secure-energy-transitions)；注意 EV 与手机范围差异 |
| 中国组装背景 | [2023 年国家统计公报](https://www.stats.gov.cn/sj/zxfb/202402/t20240228_1947915.html)；移动通信手持机口径不等于严格智能手机 |
| 显示及电子组件 | [JEITA 2023 生产统计](https://www.jeita.or.jp/english/stat/electronic/2023/product_12.html)、[Samsung Display 模组解释](https://global.samsungdisplay.com/29778)；类别/国家角色与指定双边路线分开 |
| 摄像头 | [Samsung Electro-Mechanics 摄像头模组](https://sem.samsung.com/global/product/module/camera-module.do)；核验模块构成与产品能力，不自动认定客户或出口目的地 |
| 存储与晶圆 | [Samsung Memory](https://semiconductor.samsung.com/about-us/business-area/memory/)、[SK hynix 年报入口](https://www.skhynix.com/ir/irReport/annualReport.do)、[TSMC 年报](https://investor.tsmc.com/english/annual-reports)、[SIA Factbook](https://www.semiconductors.org/wp-content/uploads/2024/05/SIA-2024-Factbook.pdf) |
| 封装材料 | [Henkel 半导体封装](https://next.henkel-adhesives.com/us/en/industries/semiconductor/semiconductor-packaging.html)、[Heraeus 键合线](https://www.heraeus-electronics.com/en/products-and-solutions/bonding-wires/) |
| 封装设备 | 现有 DISCO、ASMPT、Kulicke & Soffa、TOWA、Advantest、Onto 产品/年报来源；逐设备类别复核，能力与商业供货分开 |

每次补数据都记录来源版本、获取时间与哈希、原文位置、支持主张、不能推断的内容、
转换步骤及校验结果；在新的候选 release 中验证后再发布，不改写现有 immutable fixture。
