# 双边贸易扩充与地图密度（批次 4）

日期：2026-11-27

## 数据

- 新增 `scripts/build-bilateral-expansion.mjs`：把 `data/published/raw/expansion-2026-11-27/*.json` 里**中国口径**（reporterCode 156）的 2023 年双边行转成 `tradeObservations`，每条保留请求 URL、抓取时间、响应哈希、申报口径（进口 CIF / 出口 FOB）与数量标记。
- 只提升中国申报行，镜像国申报的同一笔贸易保留在原始快照里不重复入图，避免同一条航线被记两次。
- 新增国家实体按 M49 → ISO2 生成，与既有 `country-xx` 命名一致；已存在的实体复用并把缺失的 M49 补上。
- 缺失数量或单位不在 `{5: items, 8: kg}` 内的行，数量写 `unknown` 而非 0。

六商品新增观察条数：智能手机 33、棉质T恤 44、大豆食用油 20、电动自行车 35、家用空调 39、航拍无人机 28，合计 199 条；新增国家实体 113 个。发布版本：

| 商品 | 新版本 | 双边观察 |
| --- | --- | --- |
| 智能手机 | globe-chain-smartphone-2026.8 | 33 |
| 棉质T恤 | globe-chain-cotton-tshirt-2026.4 | 44 |
| 大豆食用油 | globe-chain-soybean-oil-2026.4 | 20 |
| 电动自行车 | globe-chain-electric-bicycle-2026.4 | 35 |
| 家用空调 | globe-chain-home-air-conditioner-2026.7 | 39 |
| 航拍无人机 | globe-chain-camera-drone-2026.2 | 28 |

无人机此前没有任何国家实体和双边观察，这次补齐中国 + 23 个伙伴，地图首次有内容。

## 界面

- `map-view-model.ts`：默认年份改为「记录最多的年份」，否则手机开屏落在只有世界总计的 2025，地图仍只有 4 条线。现在六个商品默认落在 2023，连线数 37 / 44 / 20 / 33 / 39 / 27。
- `map-flow.css`：手机（≤759px）地图浮动控件从三行折行改为单行横向滚动，高度 163px → 64px，不再压住产品子导航。
- 测试 `tests/ledger-empty-state.test.ts` 从「无人机没有账本」改为「无人机已有 2023 中国口径账本」，保留保留实体 id 不进入任何账本的检查。

## 验证

- 六商品 fixture 全部通过 `ProductFixtureSchema` 校验；四包 typecheck 0 错、web lint 0 warning；单测 68 文件 383 用例全绿。
- 1440 六商品实际渲染连线 37/44/20/33/39/27，控制台 0 错误；390 横溢 0。
- 证据 `output/qa/focus-2026-11-27/`：`phone-default.png`、`drone23.png`、`tee23.png`、`map390-density.png`。
