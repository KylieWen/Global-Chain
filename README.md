# GlobeChain

GlobeChain 是一个被动式全球商品供应链与贸易数据可视化平台。本仓库已完成工程骨架、通用数据契约、mock 商品 fixture、只读领域查询、首个无地图 Web 探索路径，以及首份 2023 年智能手机 `published` 数据快照。

## 当前工程边界

- 使用 pnpm workspace 和模块化单体结构。
- `apps/web` 是最小 Next.js App Router + TypeScript Web 应用。
- `packages/contracts` 提供 Zod 数据契约；`packages/domain` 提供只读仓储接口和领域查询；`packages/db` 提供 fixture 文件加载适配器。
- `pipelines` 只提供未来 Python 数据管线的目录和配置占位。
- `apps/web` 已提供四入口首页、商品门类、商品拆解、供应链路径、节点详情、国家目录/账本、世界节点图、来源版本页面和带 provenance 的研究快照下载；地图与贸易流线是国家级示意展示，仍不包含 PostgreSQL 查询、运行时外部 API、AI/LLM、聊天、问答或运行时文本生成。
- 外部数据只在显式的本地快照脚本中抓取，不在 Web 请求期间访问；当前不安装 Polars、DuckDB 等数据处理依赖。

## 前置工具

已检查的工具：

- Node.js：`v24.19.0`
- pnpm：`11.19.0`
- Git：`2.53.0.windows.3`
- Python 和 uv：当前环境未安装

项目声明使用 pnpm；不要静默改用 npm、yarn 或 bun。

## 安装依赖

```bash
pnpm install
```

## 启动开发服务器

```bash
pnpm run dev
```

`pnpm run dev` 使用 published 数据边界；查看当前 Demo 可直接访问首页、国家目录、商品门类和世界地图：

```text
http://localhost:3000/
http://localhost:3000/countries
http://localhost:3000/categories
http://localhost:3000/map
```

默认 Web 应用位于 `apps/web`，启动后可访问根页面；健康检查路由为 `/api/health`。预览横幅会明确提示当前数据不是正式发布事实。

Published 商品的确定性研究快照可从以下通用路径下载：

```text
/api/products/{productId}/research-export
```

快照同时携带统计数据集版本和路线内容版本，并保留来源、证据缺口以及 `unknown`、估算、保密和真实零值的原始语义。

Published release 管理命令：

```bash
pnpm run data:release:list
pnpm run data:release:verify
pnpm run data:release:activate -- globe-chain-smartphone-2023.4
pnpm run data:release:rollback
```

数据重建使用统一入口 `pnpm run data:rebuild:smartphone`；它先准备主数据和全部材料 raw 快照，再生成新的 release。raw 快照默认不可覆盖，只有显式传入 `--replace` 才允许更新来源批次。

## 质量检查

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

这些命令都应从仓库根目录执行。当前测试覆盖契约、published fixture 完整性、loader 状态边界和领域查询。

## Published 数据快照

首份 `generic-smartphone` 数据集固定为 2023 自然年：宏观商品进出口和官方储备
来自 World Bank WDI，智能手机 HS 2022 六位码 `851713` 的世界总计贸易观察来自
UN Comtrade。原料到组装的路线仍是带来源的代表性策展内容，不是唯一真实路线。

重建本地快照（会访问外部 API，仅用于显式数据更新）：

```bash
pnpm run data:fetch
pnpm run data:build:smartphone
```

`pnpm run dev` 默认读取 `data/published/manifest.json`；查看仍为 draft 的样例时，
使用 `pnpm run dev:preview`。来源、许可证和缺口说明见
[`data/published/README.md`](data/published/README.md) 和
[`docs/adr/0002-published-data-sources.md`](docs/adr/0002-published-data-sources.md)。

## 数据管线方向

数据管线按以下方向流转：

```text
pipelines/data/raw
  → pipelines/data/staging
  → pipelines/data/normalized
  → pipelines/data/validated
  → pipelines/data/published
```

每个发布事实或关系最终都需要可追溯到来源、`method`、`datasetVersion`、年份/期间、单位和数据状态。

## 当前阶段不包含

- 实时物流（地图当前只提供国家级示意和已发布具体伙伴连线）
- 数据库 schema、迁移执行或 PostgreSQL 查询
- 数据库运行时查询和实时外部数据接入
- AI、LLM、聊天、问答或运行时生成文本
- 品牌/型号、工厂、批次、成本或利润模型
