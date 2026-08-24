# 第 4 阶段：只读 fixture loader 与领域查询层

## 目标

本阶段建立页面与数据文件之间的稳定边界：

```text
data/samples/*.json
        |
        v
packages/db  fixture loader（文件、JSON、Zod、版本/状态边界）
        |
        v
packages/domain  FixtureRepository + 纯查询服务
        |
        v
apps/web  页面、路由和交互
```

loader 不写文件、不访问网络、不转换事实；领域查询只做稳定 ID 关联、过滤、排序和确定性的树/图组装。

## 样例 manifest

样例入口是 [data/samples/manifest.json](../data/samples/manifest.json)。manifest 只保存商品 ID 与相对 fixture 路径，商品名称、国家、路线和统计事实仍来自 fixture 内容。

当前支持的 schema 版本：

- `fixture-manifest.v1`
- `product-fixture.v1`

未知版本会在 loader 边界失败，不会静默按旧 schema 解析。

## 发布状态边界

`loadFixtureRepositoryFromManifest` 默认只加载 `published` 数据集。当前手机和咖啡样例是 `draft`，因此开发预览必须显式声明：

```ts
const repository = await loadFixtureRepositoryFromManifest(manifestPath, {
  allowedStatuses: ["draft", "published"]
});
```

这样页面不会把 draft 样例误当成正式发布数据。生产组合代码应只使用默认的 published 行为，或明确记录经过批准的状态策略。

manifest 条目默认限制在 manifest 所在目录内，绝对路径和目录穿越路径会被拒绝。

## 领域查询入口

```ts
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService } from "@globe-chain/domain";

const repository = await loadFixtureRepositoryFromManifest(manifestPath, {
  allowedStatuses: ["draft", "published"] // 仅开发预览
});
const queries = createProductQueryService(repository);

const products = queries.listProducts();
const overview = queries.getProductOverview("generic-smartphone");
const tree = queries.getProductBreakdown("generic-smartphone");
const batteryStory = queries.getSupplyChainStory("generic-smartphone", {
  focusItemId: "battery",
  granularity: "annual",
  label: "2023"
});
const node = queries.getSupplyChainNode("generic-smartphone", "node-cn-assembly");
const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
  granularity: "annual",
  label: "2023"
});
const provenance = queries.getProvenance("generic-smartphone");
```

所有返回对象和底层 fixture 都是深度冻结的只读快照。查询结果保留 `method`、`dataStatus`、`sourceIds`、`datasetVersionId`、期间、来源和警告；不会把 `unknown` 转成 `0`，也不会计算利润、成本或地缘政治结论。

`SupplyFlow.fromEntityId/toEntityId` 在现有故事数据中可能保存故事节点 ID，也可能保存实体 ID。查询层优先按故事节点 ID 解析，并同时返回解析后的节点和国家实体，避免页面自行猜测。

## 为后续 PostgreSQL 做的边界

页面只应依赖 `ProductQueryService`。文件系统代码只存在于 `packages/db`；未来接入 PostgreSQL 时，可以在数据访问层替换 repository 实现，保持商品树、供应链故事、节点详情、国家账本和 provenance 查询的返回契约不变。

本阶段不创建数据库迁移、不接入外部数据、不实现地图或页面。
