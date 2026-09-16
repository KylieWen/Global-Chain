# 技术方案：数据怎样变成可读的地图与路径

本地不可变 JSON → manifest 索引 → Zod 契约校验 → 深度冻结内存仓储 → 只读领域查询 → 服务端页面与本地地图。

1. 本地脚本整理来源快照和人工路线配置，构建新的 release。当前没有自动调度管线。
2. packages/db 读取 manifest 与 fixture，校验引用、版本和状态，只允许 published 进入普通页面，深度冻结后交给领域层。这是只读快照数据层，并非真实数据库。
3. packages/domain 提供商品、拆解、供应链、国家账本、贸易网络、指南与研究快照查询。页面消费解析后的来源与状态。
4. Next.js 服务端读取本地数据；地图在 Web 内使用本地 TopoJSON 与 d3-geo Equal Earth 投影绘制国家和贸易观察。packages/map 尚为占位。
5. active-manifest 指针选择版本，发布与回滚不覆盖旧 release。CI 执行安装、发布校验、lint、类型检查、测试和构建；无自动部署 job。

代表性路线和官方贸易观察分开保存与校验，国家角色不能推断成客户供货。unknown、estimated、withheld、observed 和真实零值分别呈现。研究快照保留来源、年份、单位、method、datasetVersion 和状态。

依赖准备完成后，本地服务与地图无需外部网络请求或 API 密钥；打开官方来源需要网络。应用使用服务端文件读取，不能作为静态站点导出。自托管步骤见根 README。
