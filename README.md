# GlobeChain

GlobeChain 是一个被动式全球商品供应链与贸易数据可视化平台。本仓库已完成工程骨架、通用数据契约、mock 商品 fixture、只读领域查询和首个无地图 Web 探索路径。

## 当前工程边界

- 使用 pnpm workspace 和模块化单体结构。
- `apps/web` 是最小 Next.js App Router + TypeScript Web 应用。
- `packages/contracts` 提供 Zod 数据契约；`packages/domain` 提供只读仓储接口和领域查询；`packages/db` 提供 fixture 文件加载适配器。
- `pipelines` 只提供未来 Python 数据管线的目录和配置占位。
- `apps/web` 已提供商品目录、商品拆解、供应链路径、节点详情、国家账本和来源版本页面；当前仍不包含地图、PostgreSQL 查询、外部 API、AI/LLM、聊天、问答或运行时文本生成。
- 当前不接入外部业务数据，不安装 Polars、DuckDB 等数据处理依赖。

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

`pnpm run dev` 使用 published 数据边界；当前样例是 draft，因此要查看联调页面请使用显式预览命令：

```bash
pnpm run dev:preview
```

默认 Web 应用位于 `apps/web`，启动后可访问根页面；健康检查路由为 `/api/health`。预览横幅会明确提示当前数据不是正式发布事实。

## 质量检查

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

这些命令都应从仓库根目录执行。当前测试覆盖契约、fixture 完整性、loader 状态边界和领域查询；仍不代表已经接入官方业务数据。

## 数据管线方向

未来管线按以下方向流转：

```text
pipelines/data/raw
  → pipelines/data/staging
  → pipelines/data/normalized
  → pipelines/data/validated
  → pipelines/data/published
```

每个发布事实或关系最终都需要可追溯到来源、`method`、`datasetVersion`、年份/期间、单位和数据状态。

## 当前阶段不包含

- 官方统计数据、真实贸易数字或外汇储备数据（页面仅展示明确标记的 mock/unknown fixture）
- 地图和实时物流
- 数据库 schema、迁移执行或 PostgreSQL 查询
- 外部数据接入
- AI、LLM、聊天、问答或运行时生成文本
- 品牌/型号、工厂、批次、成本或利润模型
