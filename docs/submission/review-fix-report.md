# GlobeChain 评审改进验收报告

> 本报告记录定位与材料改进轮次。随后完成的数据刷新、当前版本及新验收结果见 [近期数据更新报告](../data-refresh/report.md)；本报告中的2023数据与截图按当时版本保留。

> 后续视觉改进与本轮GitHub上传说明见 [视觉审计](../visual-audit/report.md)。本报告中的未提交、未推送描述保留为当时记录。

日期：2026-09-16（Asia/Shanghai）。依据 docs/submission/codex-review-fix-prompt.md 与所有者续办要求完成本轮工作。模型保持当前配置，未切换模型。

工程与材料已完成本地验收；公开仓库、凭据吊销、视频重录、飞书搬运、线上部署及提交表单仍由所有者完成。修改保留在工作区，未提交、未 push、未改远程设置。原有 .lark-slides、.preview、.video_vo 等用户文件保留；本轮检查产物集中在 .preview/review-fix。

## 1. 改动摘要（A–H）

| 交付物 | 文件与改动 | 原因/结果 |
| --- | --- | --- |
| A · 网站 | apps/web/components/site-shell.tsx：品牌、主导航、页脚；apps/web/app/page.tsx：平台总览与六个入口；app/demo/page.tsx：地图、拆解、路线、账本、延伸指南；app/help/page.tsx：阅读顺序与来自查询的期间/覆盖；app/products/[productId]/page.tsx：供应链按钮优先、研究导航重排、通用商品用语 | 平台为主体，进出口指南为延伸。商品、国家、统计数继续来自查询；没有新增商品特判、路由或数据模型 |
| A · 视觉缺陷修复 | apps/web/components/world-country-map.tsx：选中状态要求存在对应国家记录 | 原逻辑在未选国家时将 undefined 与 undefined 判为相等，使无数据国家误高亮。现验证无选择时 0 个选中，键盘选择后仅 1 个选中 |
| B · HTML Deck | [deck/index.html](deck/index.html)、[deck/deck.pdf](deck/deck.pdf) | 10 页本地演示；1920×1080；键盘、全屏与打印；大地图、三栏问题、拆解、流程、账本特写与架构图等版式，未连续重复同构布局 |
| C · 真实素材 | [deck/assets](deck/assets)、scripts/capture-deck-screenshots.mjs | 7 张真实生产页面截图，视口 1920×1080、DPR=2；保留原比例与事实，放大地图本体和账本/指南局部；manifest 记录来源、裁切与哈希 |
| D · 旁白 | [deck/deck-script.md](deck/deck-script.md)、demo-video-script.md、demo-voiceover.md、demo-runbook.md | 逐页画面与可照读旁白，总长约 2:58；贸易指南不再主导视频叙事；视频文件须所有者重录 |
| E · 一页简介 | [one-page-intro.html](one-page-intro.html)、[one-page-intro.pdf](one-page-intro.pdf) | 保留蓝色 A4 版式，重排功能、技术实现、来源和边界；PDF 为 1 页，无溢出 |
| F · 表单文案 | [hackathon-form-content.md](hackathon-form-content.md) | 重写作品名、赛道、介绍、背景、问题、功能、技术、来源、创新、价值、使用与边界；可复制到表单，未代提交 |
| G · 复现与安全 | 根 README.md；package.json/pnpm-lock.yaml；scripts/check-submission-security.mjs、verify-product-demo.mjs、verify-deck.mjs | 完整安装/构建/自托管说明；只新增 Playwright 开发依赖；形成可复现截图、页面、PDF 与密钥模式检查 |
| H · 配套文档 | AGENTS.md、docs/product-brief.md、architecture.md、ux-flow.md、roadmap.md、mvp-scope.md、hackathon-submission.md；adr/0005-visualization-platform.md、旧 ADR 0004 历史标注；submission/technical-solution.md、final-acceptance.md、phase-report.md；packages/map/README.md、pipelines/README.md；[deck/HANDOFF.md](deck/HANDOFF.md) | 更新定位、保留工程约束；如实说明只读快照数据层、Web 内置地图、脚本式处理、无自动部署；提供逐屏手动截图和打印备用步骤 |

数据未变更：没有抓取外部数据，没有删除或覆盖 data/published 的不可变 release，也没有更改 data/samples。当前 release 为 globe-chain-smartphone-2023.16，fixture SHA-256：

`4cc68813535566840d6af6857e6580090a24f018dd4fdfdfb6d7ffd0e90708fc`。

本轮素材提取时间见 [capture-manifest.json](deck/assets/capture-manifest.json)。转换仅为生产页面渲染、临时隐藏非目标章节、局部截图与等比放置；没有改动数字、来源或数据状态，因此不创建新的数据发布版本。

两处任务书数字按实际纠正：当前直接组件为 **7**，不是 8；查询服务公开方法为 **17**，未使用未经核实的“20+”数字。第 2 页国家/地区角色箭头标为阅读顺序，不表示连续双边流向；中国台湾角色不冒充当前地图覆盖。任务书每页 30–60 秒与总长约 3 分钟冲突，旁白优先满足总长。

## 2. 定位统一核对表

| 载体 | 核对结果 |
| --- | --- |
| 网站 | [x] 首页、导航、商品页、数据依据与 /demo 以可视化平台为主体；进出口指南为延伸 |
| Deck | [x] 10 页按旅程、问题、地图、拆解、路线、账本、可信实现、延伸与现状展开 |
| 视频脚本 | [x] 新旁白与操作路径同步；未声称已重录视频 |
| 表单 | [x] 第一项核心功能为商品拆解与供应链可视化 |
| 一页简介 | [x] 主次、来源、单商品与时效边界统一 |
| README | [x] 平台定位、可复现运行与部署状态一致 |
| 配套文档 | [x] 产品、架构、UX、路线图、MVP 与提交材料同步；工程规则继续有效 |

面向评审的现行文件已清理旧定位。旧措辞仅保留在明确标注已被 ADR 0005 替代的 ADR 0004，以及原始任务书中；未篡改历史指令记录。进出口指南页面仍可保留其模块名称。

## 3. Deck 自检结果

| 页 | 内容/版式 | 结果 |
| --- | --- | --- |
| 1 | 看懂一件商品，怎么来、怎么走 | 通过：图像已加载，无页面边界溢出 |
| 2 | 你手里的手机，连接着全世界 | 通过：图像已加载，无页面边界溢出 |
| 3 | 信息很多，但很难把一件商品讲清楚 | 通过：图像已加载，无页面边界溢出 |
| 4 | 把全球供应链，画成看得懂的地图 | 通过：图像已加载，无页面边界溢出 |
| 5 | 拆开一件商品，才看得清它的上游 | 通过：图像已加载，无页面边界溢出 |
| 6 | 用电池这条路线，理解生产环节 | 通过：图像已加载，无页面边界溢出 |
| 7 | 看国家贸易账本，别把贸易额当成利润 | 通过：图像已加载，无页面边界溢出 |
| 8 | 来源与不确定性，一起进入页面 | 通过：图像已加载，无页面边界溢出 |
| 9 | 进出口贸易指南，是延伸方向之一 | 通过：图像已加载，无页面边界溢出 |
| 10 | 先把一件商品讲清楚 | 通过：图像已加载，无页面边界溢出 |

- Chrome 实际打开并逐页截图检查；地图放大为本体图，账本显示宏观快照与 HS 851713 原始观察，指南局部显示未收录税率与官方入口。没有合成 UI、虚构统计图或捏造金额。
- 所有产品画面来自最终生产构建，7 张素材与 SHA-256 见 capture-manifest；默认地图缩放为 1，交互素材保留选中国家与图例。
- 断网浏览器上下文验证：外部请求 **0**，页面脚本错误 **0**；无 CDN、远程字体或运行时接口依赖。
- 左/右翻页、Home 首屏、?print 十页展示通过。F/按钮提供全屏功能。
- PDF 重新导出并实际渲染全部页面：Deck **10 页 A4 横版**（约 841.92×594.96 pt），简介 **1 页 A4 纵版**（约 594.96×841.92 pt）。屏幕为 16:9，A4 打印保留比例与留白。
- 无 emoji；低饱和蓝配色；真实图注标明 UN Comtrade / World Bank / Natural Earth 等来源与时间口径。
- [HANDOFF](deck/HANDOFF.md) 已提供自动生成、逐屏手动备用和一键打印说明；Playwright 流程已经走通，不以手动说明替代实际验收。
- 结构化记录：[Deck 验证](validation/deck.json)、[PDF 验证](validation/pdf.json)。实际渲染图在 .preview/review-fix。

## 4. 验证结果：第 7 节六条命令与页面

所有命令从 D:\Global Chain 根目录逐条运行；最终轮次为 2026-09-16 06:59（+08:00）。Node v24.19.0，pnpm 11.19.0，Next.js 15.5.23。

| 命令 | 最终结果 | 说明 |
| --- | --- | --- |
| pnpm install --frozen-lockfile | 通过，退出码 0 | 锁文件一致；未更换包管理器 |
| pnpm run data:release:verify | 通过，退出码 0 | active release 与 fixture SHA-256 校验一致 |
| pnpm run lint | 通过，退出码 0 | ESLint max-warnings=0 |
| pnpm run typecheck | 通过，退出码 0 | Web / contracts / domain / db 均通过 |
| pnpm run test | 通过，退出码 0 | **25 个测试文件、115 项测试**；未删除或减少测试 |
| pnpm run build | 通过，退出码 0 | 生产构建成功，随后 pnpm run start 启动验证 |

测试有现有 Vite CJS API 弃用提示，不影响通过。初轮曾出现现有 CSS autoprefixer 提示；最终构建成功，未为消除提示扩大 CSS 修改范围。

最终页面检查覆盖首页、/demo、/map、商品总览、电池路线、美国国家账本、国家目录、数据依据、指南目录和中国出口指南；截图另覆盖澳大利亚账本与美国进口指南。主导航顺序、地图无选择/单选、键盘 Enter 选国、缩放/重置、税率未收录与官方入口均验证通过。页面错误 0、运行期外部请求 0。官方来源链接可见，未在线核验其政策内容。

记录：[六条命令退出码和时间](validation/quality-results.json)、[关键页面检查](validation/product.json)；详细终端日志在 .preview/review-fix/quality-*.log。git diff --check 通过；git diff --name-only -- data/published data/samples 无输出。

## 5. 安全检查结果

使用 scripts/check-submission-security.mjs 对工作区文本、本地 Git 配置、所有本地 refs 可达提交消息与历史文件对象进行模式扫描。最终扫描 338 个工作区文件、**59 个提交、652 个历史 blob**，常见密钥模式命中 **0**。非浅克隆（is-shallow-repository=false）。规则包含 GitHub token、私钥块、OpenAI Key、AWS Key、带密码 URL 与高疑似凭据赋值；报告不输出秘密内容。

任务书提示 Git 可能不在 PATH；实际本轮 Codex 执行环境可调用随运行时提供的 Git 2.53.0.windows.3，且复扫显式指定完整可执行文件路径。路径为：

`%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`

所有 Git 操作均为只读检查；工作区基准 HEAD 为 6adab40c32f43a9e0f7be04531345bd82867cad3。没有伪造提交、推送、远程修改或线上 Public 验证。

.gitignore 已忽略 .env 与 .env.*，仅 .env.example 例外。未在本轮引入 API Key。详见 [安全检查记录](validation/security.json)。

**范围限制：**模式扫描不能证明不存在所有类型秘密；跳过依赖/构建目录及二进制内容，不对图片/PDF 做 OCR。检查覆盖本地可达 refs，未抓取远端、未审计不可达/已删除对象，也没有验证账号审计日志。任务书所述此前在对话中泄露的 ghp_ token 是否仍有效、是否被滥用，必须由所有者吊销并核查；本地未命中不等于凭据已安全。

## 6. 部署结论

采用完整仓库自托管说明，尚未部署线上 Demo。应用依赖 RSC 与服务端 node:fs 读取 fixture，不能静态导出；README 明确保留 apps、packages、content、data/published、历史 releases、active manifest 与锁文件，依次安装、校验、构建后运行 pnpm start，并用 /api/health 与 /map 验证。

未添加未经实测的 Vercel/Render 半成品配置；CI 无 deploy job。真实数据库、运行时外部 API 或 API 密钥都不是当前运行前提。公网主机、HTTPS 和部署授权由所有者决定；依赖准备完成后，本地数据与地图可断网演示，访问官方来源仍需网络。

## 7. 第 8 节人工待办（原文集中保留）

以下六项从任务书第 8 节原样摘录；本轮不声称已完成。

1. **立即吊销**此前在对话中泄露的 GitHub `ghp_` token 并重新生成；确认旧 token 未被滥用、未进入 git 历史。
2. 裁定 GitHub 仓库**真实地址拼写**（`wen-FUCK-NVDIA` 还是 `wen-FUCK-NVIDIA`），设为 **Public** 并推送最新代码；用无痕窗口验证评委无需登录即可访问。
3. 网站口径改完、Deck 与 `deck-script.md` 定稿后，**按新主线重新录屏演示视频（必交项）**（或至少重新配音/剪辑），让视频主体是供应链可视化、进出口指南作为其中一段；视频体积大，提前上传避开网络拥堵。
4. 若仍需飞书 Slides / PPTX 版本：让豆包以 `docs/submission/deck/`（HTML + assets + deck-script）为准 1:1 搬运；Codex 不操作飞书。
5. 把重写后的 `hackathon-form-content.md` 粘贴进提交表单、逐项消除标红；上传视频与一页简介 PDF。
6. 如需线上 Demo，自行授权部署 Vercel 等并填链接；三项材料尽早提交留冗余。

根据所有者本轮补充：第 3 项视频按新主线重录为**约 3 分钟**，可直接使用 2:58 的逐页脚本；第 6 项线上 Demo 仍需所有者授权。仓库真实地址保持占位，待裁定 wen-FUCK-NVDIA / wen-FUCK-NVIDIA 后再替换并重新导出 PDF。

## 8. 赛后迭代建议

1. **数据更新与用户验证优先**：选定近年完整统计期间，保存原始来源与获取时间，审核后发布新的不可变 release；邀请公众、学生、记者和外贸/采购调研者验证探索路径。
2. **按证据扩展商品/国家**：先补齐具体组件和国家的证据缺口，再新增第二种商品，继续通过配置扩展，不新增商品特判。
3. **地图包抽取**：先为投影、质心、贸易线与缩放边界建立测试，再把纯逻辑从 Web 提取到 packages/map；交互与路由留在 Web。
4. **自动化管线**：将已有抓取、标准化、验证与发布脚本逐步编排成可审计任务，明确 staging 和 normalized 产物；不要先安装大框架。
5. **真实数据库按容量触发**：只有快照规模、查询延迟或协作编辑需求证明必要时才引入 PostgreSQL 与迁移；保留只读查询接口和不可变发布审计。
6. **线上部署与复核维护**：所有者授权后部署完整 Node 应用并验证 fixture 打包、历史版本和回滚；建立静态政策资料的复核周期，不临时猜测税率。
