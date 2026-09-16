# 本轮验收范围

GlobeChain 以商品供应链与贸易数据可视化为主体，进出口指南是延伸方向之一。

## 质量命令

```sh
pnpm install --frozen-lockfile
pnpm run data:release:verify
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## 页面与材料验收

- 首页突出商品拆解、供应链、国家账本与地图；导航入口可达。
- /demo 先地图旅程，再拆解、路线、账本、延伸指南。
- published 模式无 draft 横幅；税率待核验、统计单位与状态保留。
- Deck 10 页；本地截图；键盘翻页；无外部请求；PDF 10 页横版。
- 一页简介 PDF 为 A4 单页。
- 未修改 data/published 或 data/samples 数据。

本轮实际验证结果、安全扫描范围和尚需人工处理事项见 [review-fix-report.md](review-fix-report.md)，不沿用旧轮次的通过声明。
