# 阶段 5：Web 首条可用路径

## 目标

把第 4 阶段的只读 `ProductQueryService` 接入 Next.js App Router，形成一条不依赖地图、数据库或外部 API 的可用探索路径。页面只负责展示查询结果，不在运行时生成经济结论。

## 数据边界

`apps/web/lib/data.ts` 是服务端组合入口：

```text
manifest.json
  → @globe-chain/db fixture loader
  → @globe-chain/domain ProductQueryService
  → Next.js server pages
  → 纯展示组件
```

`node:fs` 和 fixture 路径只出现在服务端组合层。组件不直接读取 JSON，也不接受任意文件路径。`apps/web/lib/runtime.ts` 只负责解析数据发布模式：

- 所有环境默认只允许 `published`；
- 本地联调必须显式运行 `pnpm run dev:preview`（设置 `GLOBECHAIN_DATA_MODE=preview`），页面显示预览横幅；
- 若要在生产构建中预览 draft，必须显式设置 `GLOBECHAIN_DATA_MODE=preview` 与 `GLOBECHAIN_ALLOW_DRAFT=true`。

首页和商品目录声明为 `force-dynamic`，避免在构建期间把某个发布模式的结果固化到静态 HTML。动态商品、节点和国家 ID 通过 `apps/web/lib/paths.ts` 统一编码后再生成链接。

## 页面路径

| 路径 | 查询入口 | 用途 |
| --- | --- | --- |
| `/products` | `listProducts()` | 商品目录 |
| `/products/[productId]` | `getProductOverview()`、`getProductBreakdown()` | 商品概览与拆解树 |
| `/products/[productId]/supply-chain` | `getSupplyChainStory()` | 代表性供应链路径 |
| `/products/[productId]/nodes/[nodeId]` | `getSupplyChainNode()` | 国家/市场节点详情 |
| `/products/[productId]/ledger/[entityId]` | `getCountryLedger()` | 国家贸易账本上下文 |
| `/products/[productId]/provenance` | `getProvenance()` | 来源、证据与版本 |

页面之间只通过稳定的商品、节点和实体 ID 跳转；显示名称始终来自查询结果。找不到商品、节点或国家时使用 Next.js `notFound()`，不向用户暴露文件路径或 loader 堆栈。

## 当前展示语义

- 代表性供应链流是内容关系，不是订单、实时物流或唯一真实路线。
- 贸易观察与路线事实分开呈现；贸易金额不等于企业利润。
- `unknown`、`null`、真实数值 `0`、`estimated` 和 `withheld` 不互相转换。
- 每个页面保留期间、数据集版本、发布状态、方法、来源和警告。
- 当前手机和咖啡均是合成 fixture，仅用于验证通用结构；不应当作现实统计事实。

## 本阶段验收

从商品目录可完成：

```text
商品目录
 → 商品概览
 → 拆解树
 → 供应链路径
 → 节点详情
 → 国家账本
 → 来源与版本
```

并确认同一套页面可以打开 `coffee`。发布前运行：

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

本阶段仍不引入地图、PostgreSQL、外部数据源或 AI/LLM。下一阶段应先确定官方统计口径和许可证，再替换或新增 published 数据集。

手工验收时，预览服务器应至少返回以下结果：

```text
/                                                            200
/products                                                    200
/products/generic-smartphone                                 200
/products/generic-smartphone/supply-chain?focus=battery     200
/products/generic-smartphone/nodes/node-cn-assembly          200
/products/generic-smartphone/ledger/country-cn              200
/products/generic-smartphone/provenance                     200
/products/coffee                                             200
/products/does-not-exist                                     404
```
