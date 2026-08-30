# GlobeChain 演示运行卡

## 启动

```bash
cd "D:\\Global Chain"
pnpm install
pnpm run dev
```

浏览器打开：<http://localhost:3000/>

## 重点 URL

| 场景 | URL |
| --- | --- |
| 首页 | `/` |
| 贸易指南目录 | `/trade-guide` |
| 美国进口智能手机 | `/trade-guide?jurisdiction=country-us&direction=import` |
| 德国/欧盟进口智能手机 | `/trade-guide?jurisdiction=country-de&direction=import` |
| 中国出口智能手机 | `/trade-guide?jurisdiction=country-cn&direction=export` |
| 智能手机背景 | `/products/generic-smartphone` |
| 供应链路径 | `/products/generic-smartphone/supply-chain` |
| 世界地图 | `/map` |
| 3 分钟演示 | `/demo` |

## 演示重点

- 先展示“查询任务”，再展示供应链背景。
- 税率显示“待核验”是有意设计，不是缺陷：系统不猜测税率。
- 代表性路线、贸易统计和政策指南是三类不同证据，不能互相替代。
- 演示使用本地 published release，不依赖现场网络或运行时外部 API。
