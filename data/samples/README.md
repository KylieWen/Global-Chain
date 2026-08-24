# GlobeChain 样例 fixture

本目录保存用于契约、查询和界面联调的最小商品样例。它们不是官方统计数据，也不代表任何品牌、型号、企业、工厂或唯一真实供应链路线。

## 当前样例

- `smartphone/fixture.json`：`generic-smartphone`，包含手机拆解树和电池代表性路径。
- `coffee/fixture.json`：咖啡的较小商品树，用于验证新增商品可以复用同一套 fixture schema。

两个 fixture 都使用：

- `method: "mock"`
- `dataStatus: "unknown"`
- 合成数据集版本和合成来源记录
- 2023 年作为契约联调期间，不作为 MVP 最终官方统计年份

正式数据接入前，不能把这些样例中的国家关系、路线顺序、数量、金额或贸易方向解释为现实世界事实。替换样例时，应保留来源、提取时间、转换步骤、验证结果和发布版本信息。
