# GlobeChain

GlobeChain 是一个被动式全球商品供应链与贸易数据可视化平台。本仓库当前处于第 1 阶段：最小工程骨架初始化。

## 当前工程边界

- 使用 pnpm workspace 和模块化单体结构。
- `apps/web` 是最小 Next.js App Router + TypeScript Web 应用。
- `packages/*` 只提供共享边界占位入口，暂不实现业务逻辑。
- `pipelines` 只提供未来 Python 数据管线的目录和配置占位。
- 当前不包含商品页面、地图、数据库查询、外部 API、AI/LLM、聊天、问答或运行时文本生成。
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

默认 Web 应用位于 `apps/web`，启动后可访问根页面；健康检查路由为 `/api/health`。

## 质量检查

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

这些命令都应从仓库根目录执行。当前测试只有工程配置 smoke test，不代表业务功能已经实现。

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

- 智能手机商品拆解页面或电池供应链页面
- 国家贸易账本、贸易数字或外汇储备数据
- 地图和实时物流
- 数据库 schema、迁移执行或数据库查询
- 外部数据接入
- AI、LLM、聊天、问答或运行时生成文本
- 品牌/型号、工厂、批次、成本或利润模型
