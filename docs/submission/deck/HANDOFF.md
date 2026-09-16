# 演示素材与打印交接

## 交付与版本

- index.html：10 页本地 HTML 演示，连同 assets 目录复制即可使用，无 CDN、构建步骤或运行时外网请求。
- deck.pdf：10 页 A4 横版。屏幕画布为 1920×1080；打印按比例置于 A4 横版，保留留白、不裁切。
- deck-script.md：约 2 分 58 秒逐页旁白与录屏操作。
- ../one-page-intro.html / .pdf：A4 单页简介。
- assets/capture-manifest.json：每张图的 URL、区域、获取时间、SHA-256 与数据版本。

所有产品图来自本地 production published 页面。数据版本 globe-chain-smartphone-2023.16，统计期间 2023。7 个直接组件与 9 个国家/地区记录已从快照核实；任务书的 8 个组件与实际不符，未采用。示意图只概括生产环节，不新增数据或双边事实。当前查询服务暴露 17 个方法，未采用任务书中未经核实的“20+ 查询”数字。

## 自动截图（已走通）

在仓库根目录完成六条质量命令，等 build 成功后启动：

```powershell
pnpm run start
```

保持服务运行，另开终端在根目录执行：

```powershell
node scripts/capture-deck-screenshots.mjs
node scripts/verify-product-demo.mjs
node scripts/verify-deck.mjs
```

默认使用本机 Chrome；如未安装或启动异常，可以使用 Edge：

```powershell
$env:DECK_BROWSER_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/capture-deck-screenshots.mjs
node scripts/verify-deck.mjs
```

Playwright 仅开发期依赖。浏览器若不存在，可先安装本机 Chrome/Edge，或 pnpm exec playwright install chromium 后把 DECK_BROWSER_PATH 设为其可执行文件路径。无需改变运行时依赖。

## 手动截图备用步骤

打开 http://localhost:3000，浏览器缩放 100%；开发者工具设备模式设视口 1920×1080、DPR=2（输出 2 倍像素）。等待页面无加载提示、字体稳定、无 draft 横幅。地图等待国家轮廓与贸易连线显示；默认缩放 1，选择国家后仍保持世界范围，无需拖动。只截页面，不录入个人桌面、登录账户或凭据。

| 文件 | 本地 URL | 区域与等待条件 |
| --- | --- | --- |
| home.png | / | 新定位首页首屏，平台入口出现 |
| map-hero.png | /map?product=generic-smartphone | 地图本体 .map-viewport；不选国家，灰色为无当前记录；国家轮廓与连线全部出现 |
| map-interaction.png | /map?product=generic-smartphone&country=country-us | .country-map-workspace，包含高亮、图例、连线与选中摘要；仅一国为当前选中 |
| breakdown-tree.png | /products/generic-smartphone | 商品拆解树区域（包含 7 个直接组件）；可用开发者工具 Capture node screenshot |
| supply-chain-route.png | /products/generic-smartphone/supply-chain?focus=battery | .route-graph-shell；等待节点、代表性连接与图注出现 |
| country-ledger.png | /products/generic-smartphone/ledger/country-au | 展开 HS 851713 观察，截宏观快照与商品观察，保留年份、单位、来源与状态 |
| trade-guide.png | /trade-guide?product=generic-smartphone&jurisdiction=country-us&direction=import | 指南结果顶部与税费核验；保留官方入口、未收录状态及适用条件 |

自动脚本为了可读性，仅临时隐藏导航、非目标章节和说明区；不会修改事实。账本/指南为 x=320、y=0、1280×1000 的局部截图，输出 2560×2000；其余按目标 DOM 区域截图。完整限制仍在产品与每页 Deck 图注中。手动操作可在 Elements 中暂时隐藏非目标区域，或分别截图后保持原比例放置，禁止改数字、状态或来源。

## 演示与一键打印

双击 index.html，左右键翻页，Home/End 到首尾，F 全屏。需要看到所有页面时打开 index.html?print；打印也可直接 Ctrl+P。

自动导出两份 PDF：

```powershell
node scripts/verify-deck.mjs
```

手动打印 Deck：Chrome/Edge 打开 index.html → Ctrl+P → 另存为 PDF → A4、横向、边距无、背景图形开启、页眉页脚关闭；应为 10 页。一页简介打开 ../one-page-intro.html，使用 A4 纵向、CSS 默认边距、背景图形开启、关闭页眉页脚，应为 1 页。不要选择“每张纸多页”。

## 后续交接

所有者确认仓库真实拼写、Public 状态和推送后，替换封底与简介占位地址，再重新执行 verify-deck 导出。视频必须按新主线重录。飞书 Slides/PPTX 由豆包按本目录 1:1 搬运，素材不得再次缩成整页长缩略图。
