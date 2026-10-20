# 2026-10-21 智能手机双边证据缺口复核

已发布并激活 `globe-chain-smartphone-2026.2`，基于未改写的 `globe-chain-smartphone-2026.1`。
本批次使用本地已有原始快照，不访问外部接口，不新增商品，不更新 2024/2025 年统计值。

## 问题与修正

两条 2023 年成品手机贸易缺口仍显示 open，陈述缺少具体伙伴观察和镜像差异说明。
仓库的 2023 年双边原始快照及四条逐记录证据已包含中国出口和伙伴进口报告。
复核只关闭“2023 年 HS 2022/851713 的具体报告方、伙伴、方向存在海关观察，且双方镜像
金额与差异已独立说明”这一主张；缺口文字、证据范围和状态同步更新。

| 2023 年，HS 2022/851713；USD | 中国报告出口，FOB | 对方报告自中国进口，CIF | 进口报告减出口报告 |
| --- | ---: | ---: | ---: |
| 美国统计区，Comtrade 842 | 38,369,590,318 | 45,203,156,861 | 6,833,566,543 |
| 德国，276 | 1,112,346,811 | 8,652,969,331.273 | 7,540,622,520.273 |

双方报告金额没有调和、平均或相互替代。差异不据此归因于某个原因，更不解释成利润。
842 是来源使用的美国、波多黎各及美属维尔京群岛统计区，不改写为 ISO/M49 840。
表中差值按来源金额的可用小数位显示；机器审计保留 JavaScript 数值计算结果，
德国差值可能表示为 `7540622520.273001`，末尾来自二进制浮点表示，不表示新增统计精度。

相关组装至市场边继续是代表性连接；中国组装地点、德国最终消费、品牌、具体企业、
工厂、电池或材料连续物料谱系均不属于已关闭主张。供应链 13 条边的证据等级、金额、
数量没有改变；尚不可公开观测的 6 条谱系缺口原样保留。

## 来源、提取与处理

- 原始来源：UN Comtrade Public Preview API，2023 年、HS 2022/851713、具体伙伴代码。
- 原始快照获取时间：`2026-08-25T05:09:37.034Z`；本次复核日期：2026-10-21。
- 原始文件：`data/published/raw/un-comtrade-hs2022-851713-bilateral-2023.json`。
- 原始文件 SHA-256：`f9803ecf46184e946f6b8c2412bbacfc4ca8f97d298e97a533e91d5025164517`。
- 核验原始文件哈希、每个响应的 canonicalDataSha256、整批 payloadSha256、请求和行的
  年份/HS/报告方/伙伴/方向/海关制度/运输口径，以及既有证据引用中的原始与规范哈希。
- 保留 2024/2025 当前统计，2023 年闭环证据通过证据说明与附带审计呈现，不混入当前统计。
- 新增独立内容版本 `smartphone-bilateral-gap-review-2026.1`，只关联两条修正的缺口；
  原路线内容版本继续是 `smartphone-route-2023.3`。

## 可重复执行

复核输入位于 `content/reviews/smartphone-bilateral-gaps-2026-10-21.json`，构建脚本校验
输入哈希后生成候选与审计。输出以排他的新文件写入；已存在且字节相同则视为幂等，
不同则报错，不能覆盖既有 release。

```bash
node scripts/build-phone-gap-review.mjs
pnpm exec vitest run tests/phone-bilateral-gap-review.test.ts
node scripts/build-phone-gap-review.mjs --publish
node scripts/manage-published-release.mjs activate globe-chain-smartphone-2026.2 --product generic-smartphone
node scripts/manage-published-release.mjs verify
```

测试覆盖完整 Zod 契约、published loader、重复构建字节一致、两条闭环证据、独立镜像值、
当前统计与路线不变，并拒绝世界总计替代、其他期间、证据端点错误和原始快照损坏。
历史 2026.1 刷新回归固定到不可变 2026.1，不再假定 active 永远等于历史刷新版本。

本批次结果：closed 8→10、open 8→6、partial 20、not_publicly_observable 6，仍为 42 条。
24 条手机贸易、62 条材料贸易、36 条宏观指标保留原值/期间/状态。

发布 fixture SHA-256：`616302fd02aa233cfc7de7e62f9f6669d709fc2e7c0ebcfbdc9d4d32835f74d0`。
完整逐请求审计随 release 保存为 `review-audit.json`，其哈希记录于该 release manifest。
