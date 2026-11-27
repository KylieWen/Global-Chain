# 直线脉冲流（M 方案落地，2026-11-27 批次 7）

## 选择

用户在 `/lab/particles` 的 14 个变体中选 M（脉冲串），并要求「粒子数量与速度要和金额有函数关系」。

## 实现

- 新增 `apps/web/components/straight-flow-layer.tsx`：Canvas2D 直线脉冲层，替代地图上的 WebGL 叠加层。
  - 几何：`world-country-map.tsx` 的 `arcControl` 改为「控制点落在弦上」，即正投影平面上的直线；同一起止点的多条流向按 lane 做 6px 级横向错位。
  - 宽度：`laneWidthFor(factor) = (0.45 + 1.5 * factor) * zoomDamp`。
  - 数量：`pulseCountFor(factor) = 1 + 5 * factor^1.5`，每 3 个脉冲成一串（M 的簇）。
  - 速度：`flowEncoding.particleSpeed(factor) = 0.5 + 1.35 * factor`，WebGL / Canvas2D 旧路径同步改为该函数，不再用随机。
  - 两端 6% 区间渐隐，避免 60+ 条线在同一枢纽处堆成白斑。
- 缩放抑制：束宽按 `1 / scale^0.55` 衰减，聚焦放大不再爆亮。
- 筛选面板选中国家后默认展开。
- 金额标签改为落在目的地端（`t = 0.84 + index * 0.015`），因为直线全部汇聚在出发国。

## 保留

- `beam-flow-layer.tsx` / `beam-webgl-layer.tsx` / `beam-canvas2d-layer.tsx` 保留（旧弧线束流实现），当前地图不再挂载，作为回退参考。
- 同一次提交还给 WebGL 旧路径加了端点度数阻尼 `damp = 1/sqrt(degree/6)`，回退时也不会爆白。

## 已知不足

- 聚焦态下所有线从中国一点发散，脉冲在枢纽附近仍然偏密，靠两端渐隐压到可接受范围。
- 流向金额标签在目的地端会与本国的国家标签轻微重叠（韩国/日本一带可见）。
- 静态截图看不出速度差异，需要实际播放（`/map` 打开即播放）。