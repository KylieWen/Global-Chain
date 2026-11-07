# 多选贸易流查询：第一批交付

已实现 `selectTradeFlows(repository, productId, { itemIds, year, currency })`，从现有商品及材料查询生成可供地图消费的结果。支持成品与多个上下游物品同时选择，重复选择或子树覆盖不会重复收集同一观察。年度按实际期间日期筛选，币种单独约束。

出口以报告国为起点，进口以伙伴为起点；世界总计独立返回，缺少有效双边端点的记录不进入流线。按分类体系、版本、编码及同向国家对分组，每组只有一个 `isPreferredRecord=true` 的记录；优先有可用数值的记录，同等情况下优先出口，最后按 ID 稳定选择。替代报告保留原值、标记不可相加。HS父子分类重叠同样标记不可相加。来源、方法、版本、状态保留，结果冻结。

## 验证

- `pnpm run typecheck`：Web、contracts、domain、db 全部通过。
- `pnpm exec vitest run tests/trade-flow-selection.test.ts tests/map-exploration.test.ts tests/phase29-trade-network.test.ts`：3 文件44测试通过，其中新增查询30项。
- 实际 published 大豆油验证：成品 + 大豆 + 粗豆油在2024 USD下都有双边记录；手机跨年、镜像、总计等测试通过。
- 首轮测试有一条父子选择断言错误：将成品和电池一起选择误认为应与仅成品相等。修正为成品保留、材料新增且观察不重复，并补充分类版本、重复出口报告、端点缺失和日期筛选回归。

## 开发记录

Qoder CN 1.1.85 实际参与实现，会话 `8c9c2e70-f9fa-4635-a329-9aa0c5114c97`，结果副本 `tmp/qoder-setup-2026-11-08/selection-implementation.json`。主智能体审查后修正分类版本去重、实际日期筛选、多报告首选、无效地理端点等问题并独立完成验证。

本批新增查询与测试，未修改页面、正式数据或服务器。下一批把此查询接入地图多选面板、稳定颜色、错开曲线、金额线宽和 URL 状态；地图完整交互尚未交付。
