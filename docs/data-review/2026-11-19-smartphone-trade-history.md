# 2023–2025 年智能手机双边贸易

`globe-chain-smartphone-2026.7` 已在本地激活。基于不可变的 `2026.6`，补充 12 条成品手机双边记录。该版本共 36 条成品贸易记录，其中 20 条是具体伙伴记录。

| 报告方和伙伴 | 年份 | 系列 |
| --- | --- | --- |
| 美国统计区（842）报告与中国（156）的贸易 | 2023–2025 | 自中国进口、对中国出口 |
| 德国（276）报告与中国（156）的贸易 | 2023–2025 | 自中国进口、对中国出口 |
| 中国（156）报告与美国统计区（842）、德国（276）的贸易 | 2023–2024 | 分伙伴进口和出口 |

2025 年中国作为报告方的两份本地响应为空，保留缺年。842 使用 UN Comtrade 的统计区编码，覆盖美国、波多黎各和美属维尔京群岛。每个报告方的序列分别保留进口 CIF 和出口 FOB。金额取来源的 `primaryValue`，单位为当期 USD。数量代码 5 转为件，德国来源估算数量保持 `estimated`。2023 年德国数量沿用当前发布口径，显示原始来源估算值和状态。

## 来源和核对

- 来源为 UN Comtrade Public Preview API。2023 年批次获取于 2026-08-25，2024 和 2025 年批次获取于 2026-09-16。授权条款沿用快照记录的 UN Comtrade 使用及再传播政策。
- 构建脚本核对文件及响应哈希、成功响应、唯一进出口记录、报告方和具体伙伴、期间、HS 2022/851713、海关及运输口径、金额估价和数量字段。每次请求的网址、获取时间、原始快照及哈希见 [随版本保存的审计](../../data/published/releases/generic-smartphone/globe-chain-smartphone-2026.7/review-audit.json)。
- 回归测试核对完整 fixture、地图查询、实际金额与观测状态，确认原 24 条成品贸易记录仅重绑版本引用。五个本地 active 商品均通过发布校验。fixture SHA-256 为 `98c67bcbd25dfc5fa31cc813a2c35b91a1984295821e30334335cd2b08ef951c`。

```bash
node scripts/build-smartphone-trade-history.mjs
node scripts/build-smartphone-trade-history.mjs --publish
pnpm exec vitest run tests/smartphone-trade-history-release.test.ts
node scripts/manage-published-release.mjs activate globe-chain-smartphone-2026.7 --product generic-smartphone
node scripts/manage-published-release.mjs verify
```
