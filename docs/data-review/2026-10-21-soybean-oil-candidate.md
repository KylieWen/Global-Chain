# 大豆食用油独立候选

根代理发布状态（2026-10-21）：已创建不可变release、完成manifest校验并顺序激活，与手机2026.4及另一新商品同时保留。最终整站180测试通过、1环境跳过，typecheck/lint/build通过；实际网页核验见docs/continuation/QA-2026-10-21.md。下文候选阶段说明保留为过程记录。

2026-10-21 完成独立商品 `generic-soybean-oil`，版本候选 `globe-chain-soybean-oil-2026.1`。本代理没有写 active/兼容 manifest，没有发布到 immutable release；主线程审阅后统一发布、激活与实际页面验收。没有修改手机、Web、通用契约或领域查询，没有运行服务、整站构建或 Git 提交。

## 重建与当前验证

- 内容：`content/products/soybean-oil-2026-10.json`。
- 官方原件、元数据、文本和哈希：`data/raw/soybean-oil-2026-10-21/`。主线程应为此整个目录加 `-text`，防止 Git 改原文或提取文本字节。
- 重建：`node scripts/build-soybean-oil.mjs`。当前候选：`data/candidates/soybean-oil-2026-10-21-3ae8cbf93dc7/`；SHA256：`3ae8cbf93dc75ec312316f4a8d2da5fb3daa83dd7186b6cd29d40ef0277edd05`。
- 原始抓取：`scripts/capture-soybean-oil-sources.py`，`--source trade/china/brazil/usa/refining/process` 可逐个选择。请求串行、成功快照不重抓、首个 HTTP429立即停止；本批六个网络请求全部200，无429，没有重试限流或改用其他端点。
- 提取及字典复用：`scripts/extract-soybean-oil-sources.py`。PDF按页提取，HTML移除脚本/样式后提取文本；原文和文本分别验证 SHA256。UN HS2022与单位字典直接复用此前已下载官方原始字节，并保存原元数据，没有重新请求字典。
- `node --check scripts/build-soybean-oil.mjs` 静态语法检查通过。`pnpm exec vitest run tests/soybean-oil.test.ts --maxWorkers=1 --minWorkers=1`：**8项通过**。覆盖完整 ProductFixtureSchema、临时目录 published loader、两次相同字节、17行逐条匹配、图路径、9步输入输出/8类设备、通用商品/国家/贸易地图/工艺查询、期间和估计状态、错误双边提升与unknown零值拒绝、无继承手机/mock。
- 候选输出不必提交，可从已提交原文与配置重建。审阅通过后，`node scripts/build-soybean-oil.mjs --publish` 只会创建全新 `data/published/releases/generic-soybean-oil/globe-chain-soybean-oil-2026.1/`，包括fixture、manifest、review-audit。已有同名输出若字节不同会拒绝覆盖。正式激活由主线程执行。

## 可交付范围

21条商品/原料/中间品/副产物记录；3个国家；13节点、13条代表连接；3条工艺链、9道工序、8类设备。巴西、美国与中国原料都可沿有向路径到中国食品用油，另有巴西与美国本地压榨、美国精炼及中国豆粕分支。国产大豆只表示其中部分可进入压榨，不把全部国产食品豆画成油料豆。9道工序逐条列出输入和输出，含溶剂回收、豆粕脱溶、磷脂和皂脚分离，不只铺国家名称。

没有核实设备厂商供货，不创建厂商或客户关系；没有税费/许可证资料，不生成虚假指南。包装为公开可理解的功能结构，未指定材质、供应商、法规合格证或具体工厂。

## 来源与事实

1. [UN Comtrade 原始查询](https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=156&partnerCode=0%2C76%2C842&cmdCode=150710%2C150790%2C120190%2C230400&flowCode=M%2CX&period=2024&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500)：中国报告方156、世界0/巴西76/美国统计区842，2024自然年，HS2022，17行。原件哈希 `cd19d0517f15987ac53805afe1eea0783cc5bd8eb7c3fa4de6b55de94f146472`。qtyUnitCode8由UN数量单位字典核验为kg；保留isQtyEstimated、isNetWgtEstimated、isReported、isAggregate和legacyEstimationFlag。842与本地美国M49 840明确分开保存。
2. [USDA中国CH2025-0055](https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Oilseeds+and+Products+Annual_Beijing_China+-+People%27s+Republic+of_CH2025-0055.pdf)：2025-03-19，已有种植、原料来源、压榨及食品用途，使用相关历史事实支持节点。p.33 Table21的2023/24 **USDA Official**豆油产量18810千吨，换为18,810,000,000kg，标estimated；没有用另一列New Post17452或预测替代。市场年度2023-10至2024-09。
3. [USDA巴西BR2025-0017](https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Oilseeds+and+Products+Update_Brasilia_Brazil_BR2025-0017.pdf)：2025-07-01，pp.15-17历史PSD支持种植、压榨和油粕产品。豆油历史产量11341千吨，换为11,341,000,000kg，标estimated；当地2023/24市场年度从2024-01开始，不能与中国年度直接视为同一期间。
4. [USDA ERS美国加工](https://www.ers.usda.gov/data-products/charts-of-note/112861)：2025-07-01，支持美国既有大豆种植、出口和油粕压榨；文中未来压榨预测未转成observed数据。
5. [USDA ERS食用油精炼与零售方法](https://www.ers.usda.gov/data-products/price-spreads-from-farm-to-consumer/documentation)：2025-05-20版本，说明毛豆油需精炼才能用于人食用、油粕皮为不同产物。没有将美国零售价格或示例出油率用于中国。
6. [US EPA植物油加工参考](https://www.epa.gov/sites/production/files/2020-10/documents/b9s11-1.pdf)：**1995-11历史技术文档**，Section2.2.1解释一条溶剂浸出、化学精炼及豆粕处理路线。相关工艺链/步骤/设备记录period为1995；没有伪称当前中国工厂实况或现行法规。2026-10代表图只是本批结构整理期间，来源真实年份可查。
7. [UN HS2022字典](https://comtradeapi.un.org/files/v1/app/reference/H6.json)与[数量单位字典](https://comtradeapi.un.org/files/v1/app/reference/QuantityUnits.json)：验证分类原文与kg编码。精确字节复制于先前下载，不使用手工改标签冒称官方原文。

## 贸易层分工与局限

17行恰好各使用一次：**4条成品观察（HS150790非毛油及分离品）+13条材料观察**（毛油150710四条、大豆120190五条、豆粕230400四条）。毛油放材料层，使“毛豆油”组件可直接查贸易；不将毛油当成已经灌装的食用油。商品根的1507映射为aggregate，150790的短分类标“含其他用途”，完整范围保留在资料中。

HS150710可含已脱胶的毛油；150790并不只含瓶装食用油；120190不是专为榨油进口的大豆；230400包括提油后的固体残余物。没有仅凭编码认定最终食用、饲料客户或同一批次。世界总计不能与伙伴记录相加；空缺的巴西/美国油品流向未补零，极小金额也未删除或放大解释。主报告国只有中国，不冒称巴西、美国完整国家贸易账本。

所有代表图连接货量/金额保持null、unknown，没有根据海关年度额反推出出油率、工厂利润或每瓶原料份额。两条USDA物量是历史市场年度估计，各有期间/单位/来源/method/version/status，不伪造货币。

后续先由主线程统一发布/激活、运行完整检查、桌面和手机浏览器验收。实际界面应优先显示商品、路径与简短分类；上述方法和范围在资料详情保留。后续如扩贸易覆盖，应独立抓取各报告方、年份和分类，不把中国镜像行改名为巴西或美国自己的报告。
