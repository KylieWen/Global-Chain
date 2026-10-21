# 数量型产业指标与智能手机产量发布

日期：2026-10-21。版本 globe-chain-smartphone-2026.4，基于不可变2026.3，不改旧release。新增1条数量型指标；保留全部旧贸易、材料、宏观与路线。

## 来源与转换

工信部2023年规模以上电子信息制造业运行统计，福建省工业和信息化厅2024-01-31转载，明确单列智能手机产量11.4亿台。原始HTML、获取时间、SHA256与定位已在phone-branches-2026-10-21来源包中保存，17份来源索引与对应.3审查audit可追溯。这里只转入已审查未发布的该条数量，不重新抓取或估算。

转换：11.4×100000000=1,140,000,000台，保持来源精度和规模以上企业口径。period=2023、method=official、status=observed、quantity=1140000000、unit=items、value/currency均null。显示单位“台”为同尺度标签，不触发缩放；浏览器紧凑数值显示11.4亿台。数量不是出口、销量或最终消费。

## 通用实现

MacroIndicatorObservation允许以quantity+unit保存实物数量；有金额仍必须有币种。observed至少有一项数值，unknown/withheld的金额和数量均为空。查询返回measurement区分金额/数量，兼容旧币种指标缺失值；Web不按商品硬编码产量。账本关键数据按配置排序，保留各项自己的年份，详细定义与来源在展开区。

构建：node scripts/build-reviewed-indicators.mjs content/indicators/smartphone-production-2026-10.json。--publish只创建新不可变目录，默认只写带哈希candidate，不改active。输入明确固定.3 fixture及audit哈希，仅允许提升audit中已审查的数量。

## 检查

- 数量契约、真实零、缺单位/币种、unknown/withheld、负数、来源与查询字段：3项专项测试。
- 确定性重建、完整schema、临时目录loader、保留旧事实及.3字节、正式.4字节：3项专项测试。
- active .4 release verify通过；完整测试在激活.3及数量模型后曾32文件162通过、1环境跳过；随后.4相关9项回归通过。后续整站与多商品检查在恢复入口与QA文件记录，不复用旧结论。
- 桌面与390×844手机已实际查看：11.4亿台标2023，其他国家贸易指标各标2025，手机文档宽375px且无横向溢出。截图位于output/qa/2026-10-21-1108/。
