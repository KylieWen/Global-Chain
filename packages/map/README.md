# 地图包现状

本包目前仅为占位，不提供地图实现。当前真实地图在 `apps/web/components/world-country-map.tsx`：本地 world-atlas TopoJSON、topojson-client、d3-geo Equal Earth、质心贸易连线、缩放与拖拽。

本轮只调整定位和演示，不抽取交互逻辑以避免回归。赛后可先为投影、几何与缩放边界补齐测试，再提取纯函数；Web 仍负责交互状态与路由。
