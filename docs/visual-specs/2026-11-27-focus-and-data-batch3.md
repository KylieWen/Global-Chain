# 国家聚焦、悬停信息与双边数据扩充（批次 3，进行中）

日期：2026-11-27
范围：交互层（国家聚焦动效、地图悬停提示、图例避让）与本轮新增的双边贸易原始快照；不改已发布 release 内容。

## 1. 国家聚焦

- 选中一个国家后，镜头用 520ms ease-out 缓动推到该国轮廓：目标缩放按国界包围盒计算（下限 1.35、上限 3.2，约为舞台宽 34% / 高 42%），并夹在既有 `clampMapTransform` 允许范围内。用户随时拖动/滚轮仍可打断。
- 其余内容淡化：非选中陆块 `opacity .22`、经纬网 `.3`、端点 `.35`、与该国无关的流向 `opacity .18 + blur(.7px)`；与该国相连的线保持全亮（`.is-focus`）。全部带 `.35s` 过渡。
- 修复：缩放后 `.map-ocean` 只覆盖 1000×540，会在视口内露出矩形边；改为向外扩 1 个画布尺寸的三倍覆盖。
- 修复：选中国家后底部国家上下文条与右下浮动图例叠在一起，用 `:has(.atlas-country-context)` 把图例抬到 5.4rem。

## 2. 悬停信息

- 鼠标在国界上移动时出现跟随光标的浮层：国家名、收录状态、与该国相关的两条最大流向（含金额/数量与数据状态）、以及「点击聚焦该国」提示。样式 `atlas-hover-tip`，`pointer-events: none`，不挡点击。

## 3. 双边数据扩充（本轮完成取数，尚未并入 release）

- 脚本：`scripts/fetch-bilateral-expansion.mjs`。按商品 HS 编码，向 UN Comtrade Preview API 取 2023 年中国 ↔ 24 个主要伙伴的双向年度记录（`reporterCode=156, partnerCode=24国` 与反向各一次），每次请求留存 `retrievedAt` 与 `responseSha256`，可重放校验。
- 已落地快照：`data/published/raw/expansion-2026-11-27/`，智能手机 78 行、棉质T恤、大豆食用油、电动自行车、家用空调；无人机（HS 880610）未取回。
- 尚未做：把这些行转成 `tradeObservations`（含实体、`dataStatus`/`quality` 标记、审计文件），生成新 release 并更新 manifest。当前站点显示仍是旧数据。

## 证据

- `output/qa/focus-2026-11-27/map-country-focus.png`（中国聚焦态）、`map-hover-tip.png`。
- 四包 typecheck 0 错、web lint 0 warning。
