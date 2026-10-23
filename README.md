# Global Chain

展示首页：[Global Chain](http://62.171.148.193/)。首页可选择公众探索、产业参与者或高校研究者，页头可随时切换浏览重点。

免费分享入口：[Global Chain 世界地图](https://da.gd/GCmap)。这是跳转短链接；新链接目前先显示目标确认页，最终进入现有 IP/HTTP 网站。

Global Chain 是一个全球商品供应链与贸易数据可视化平台：以智能手机为例，把商品拆解、代表性供应链路线、各国贸易账本和可交互世界地图串起来，看清一件商品如何连接世界；进出口贸易指南是延伸查询方向之一。

## 当前版本（2026-10-24）

当前已收录手机、棉质T恤、大豆食用油、电动自行车和家用空调五个正式商品。各商品复用拆解、供应链、地图、账本及来源入口；[产业上下游](http://127.0.0.1:3000/industry)可从有资料的商品进入材料、设备、应用和企业官方入口。信息对接由用户自行沟通，不提供站内询价或交易。实际发布版本以`data/published/manifest.json`为准，当前验证与后续工作见[恢复入口](docs/continuation/RECOVERY.md)。

本轮已补充48条宏观指标、四份中国出口核验导航及空调技术链；中国地图区域资料2026.10.2覆盖五商品18个产业节点/12条代表性连接。历史资料保留原年份，未核实的金额与供货保持未知。详见[评审实施记录](docs/reviews/2026-10-23-independent-review-implementation.md)和[中国地图数据核验](docs/data-review/2026-10-23-regional-review.md)。

两轮展示前收口已实现三身份推荐/导航、历史下载与指南版本一致性、筛选条件同步、键盘步骤焦点和触屏说明。身份为浏览偏好，尚未开放企业注册审核。见[两轮收口记录](docs/reviews/2026-10-24-final-two-rounds.md)。

运行 `pnpm run test:browser` 可独立启动生产预览并验收五商品地图选择、全部城市节点点击、指南、版本导出、三身份矩阵与键盘/触屏导航；结束仅停止它自己启动的预览。CI已加入同一走查及失败证据保留；托管CI运行结果以平台实际记录为准。

以下带日期的更新记录与首期2023手机快照说明保留为历史，不能替代当前覆盖。

## 历史浏览体验与地图升级（2026-09-16）

首页现提供三步探索路径，商品拆解与账本数字提前展示，世界地图采用细弧线和联动贸易列表，手机端保留主导航。重复说明已收进详情。两条2023年统计经官方接口复查仍无同口径更新。详见 [视觉审计与验证](docs/visual-audit/report.md)。

## 历史数据更新（2026-09-16）

当前版本 `globe-chain-smartphone-2026.1`：120/122条统计更新至2024或2025年，16项组件类别补充官方来源，6项基础税费补充数值与条件。历史供应链路线保留原期间；未披露货流与未核验附加税没有改成已知。详见 [数据更新报告](docs/data-refresh/report.md)。

## 当前工程边界

- 使用 pnpm workspace 和模块化单体结构。
- `apps/web` 是最小 Next.js App Router + TypeScript Web 应用。
- `packages/contracts` 提供 Zod 数据契约；`packages/domain` 提供只读仓储接口和领域查询；`packages/db` 提供 fixture 文件加载适配器。
- `pipelines` 是未来管线的目录占位；当前通过 `scripts/fetch-*.mjs`、构建与发布校验脚本处理快照，详见 `pipelines/README.md`。
- `apps/web` 已提供贸易指南、商品拆解、供应链路径、节点详情、国家目录/账本、世界地图、来源版本页面和带 provenance 的研究快照下载；地图与贸易流线是国家级示意展示，仍不包含 PostgreSQL 查询、运行时外部政策 API、AI/LLM、聊天、问答或运行时文本生成。
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
pnpm install --frozen-lockfile
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
  pnpm run data:release:activate -- globe-chain-smartphone-2023.16
pnpm run data:release:rollback
```

结项验收、评审演示路径和运行卡见 [`docs/submission/final-acceptance.md`](docs/submission/final-acceptance.md) 与 [`docs/submission/demo-runbook.md`](docs/submission/demo-runbook.md)。

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
UN Comtrade。原料到组装的路线仍是带来源的代表性策展内容，不是唯一真实路线。贸易指南是静态、部分覆盖的查询起点；税率、许可和产品要求未收录时显示“待核验”。

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

## 生产部署与环境配置

应用使用 RSC 和服务端 node:fs 读取 fixture，不能静态导出。2026-10-23 已将应用版本 99b95fe（品牌名称更正为 Global Chain）部署到 Contabo：[世界地图](http://62.171.148.193/map)、[中国供应链](http://62.171.148.193/map/china)。当前使用公网 IP/HTTP，尚未配置域名和 HTTPS。运行状态、更新与回滚见 [自托管维护说明](ops/self-host/README.md) 和 [首次部署验收](docs/reviews/2026-10-23-contabo-deployment.md)；CI 仍没有自动部署 job。

1. 用 node scripts/package-self-host.mjs 生成公开源码白名单部署包，传到受支持的 Node.js LTS、pnpm 11.19.0 主机，核对 SHA 后解压；保留 apps、packages、content、data/published（含历史 releases 和 active-manifest）及锁文件。不要只复制 .next，也不要上传下载原件、私人物料或凭据。本次主机使用 Node v24.22.1。
2. 从仓库根目录执行 pnpm install --frozen-lockfile 和上述全部质量命令；构建完成后执行 pnpm run start。
3. 访问 /api/health 和 /map 验证，再由主机进程管理器保持服务运行；公网访问由主机反向代理配置 HTTPS。仓库不含自动部署配置。
4. 正式运行无需 API Key 或数据库凭据。默认 published；可设置 GLOBECHAIN_DATA_MODE=published。GLOBECHAIN_DATA_MANIFEST 如需覆盖请使用主机上的绝对路径。GLOBECHAIN_ALLOW_DRAFT 只用于显式本地预览，不用于正式演示。

.env 与 .env.* 已被忽略（.env.example 例外）；不要在仓库、日志或录屏中放凭据。

## 本轮演示材料

- [HTML Deck](docs/submission/deck/index.html)、[逐页脚本](docs/submission/deck/deck-script.md)、[素材与打印交接](docs/submission/deck/HANDOFF.md)
- [一页简介](docs/submission/one-page-intro.html)、[表单文案](docs/submission/hackathon-form-content.md)
- [验收报告](docs/submission/review-fix-report.md)

当前为五商品研究快照；每项资料保留其实际期间与覆盖范围，贸易指南仅部分覆盖。

截图工具仅开发期使用：保持生产服务运行后执行 node scripts/capture-deck-screenshots.mjs。默认使用本机 Chrome；无 Chrome 时将 DECK_BROWSER_PATH 设为 Edge/Chromium 路径。
