# 棉质针织 T 恤独立商品包复核

根代理发布状态（2026-10-21）：已创建不可变release、完成manifest校验并顺序激活，与手机2026.4及另一新商品同时保留。最终整站180测试通过、1环境跳过，typecheck/lint/build通过；实际网页核验见docs/continuation/QA-2026-10-21.md。下文候选阶段说明保留为过程记录。

复核日期：2026-10-21。商品 `generic-cotton-tshirt`，数据版本 `globe-chain-cotton-tshirt-2026.1`，内容版本 `cotton-tshirt-route-2026.1`。候选与不可变 release 已准备，交给根代理统一激活；本构建器不修改 active manifest、旧 release 或页面代码。

## 可用范围

| 内容 | 已准备 |
| --- | --- |
| 商品拆解 | 成衣及 16 个衣片、纱线、面料、农业原料和副产项；没有重量、配比或单件用量 |
| 国家与路线 | 中国、巴西、印度、孟加拉、美国；14 个节点、12 条连接、3 组代表性分支 |
| 证据区别 | 巴西皮棉→孟加拉、印度棉纱→孟加拉是报告直接支持的定性材料关系；其余工序衔接保持代表性，所有路线金额/数量为 null |
| 官方成品统计 | 中国报告的 2025 年 HS2022/610910 共 4 条：2 条世界总计、2 条美国伙伴；没有其他国家零值占位 |
| 工艺输入输出 | 12 道工序、环锭/转杯 2 个可选变体、11 类设备；没有厂商或商业供货关系 |
| 国家宏观背景 | 中国、美国 2024/2025 年共 12 条 WDI 通用指标，沿用 2026-07-13 的原始来源版本与获取时间 |
| 政策指南 | 未发布税率、许可、文件或办理程序，保持空数组 |

“完整第二商品”在此指拆解、代表路线、地图、国家、贸易、工艺和来源能通过通用查询连通，并不表示覆盖全球所有棉制衣物贸易。巴西和印度分支有实际资料支持的不同投入起点，不是为扩大国家数而增加的目录。

## 原文与提取

此前研究原文继续使用 `data/research/cotton-tshirt-2026-10-21/raw/` 中的 USDA 中国/孟加拉/印度报告、CottonWorks 轧花/针织资料和中国 Comtrade 响应。旧研究记录见 [研究报告](cotton-tshirt-2026-10-21.md)。

本轮新原文在 `data/raw/cotton-tshirt-2026-10-21/`。逐源地址、获取时间、HTTP 状态、字节数和 SHA-256 保存在相邻 meta 与 manifest 中；构建时信任已审核的 `content/reviews/cotton-tshirt-2026-10-21.json` 固定哈希，不根据当次读取的原文重新接受哈希。

- 联合国 H6 分类字典：`classCode=H6`、`className=HS2022`。610910 描述同时包括 T 恤、汗衫及其他背心；对本商品采用 `aggregate` 映射，不能解释为单一款式销量。
- 联合国 QuantityUnits 字典：`qtyCode=5` 是 `u / Number of items`，规范化为 `items`。原始 `qtyUnitAbbr=null` 保留在审计中；`netWgt` 与净重估算标志独立保留，没有覆盖件数。
- 联合国 M49 原表：核对五国 ISO2、ISO3 和数值代码。美国地理 M49 为 840，而本批 Comtrade 伙伴代码为 842，两者分别保留。
- Cotton Incorporated 的纺前准备、纺纱、染色、机械整理、服装构造网页：本轮仅发布自行整理的短述与出处，不把原文全文装进产品 fixture。网页未统一注明发布日期，工艺期间标为“2026 年编目”，不是生产统计年份。
- 孟加拉 2025 和印度 2024 本轮请求均为 HTTP200、零条匹配；作为空响应审计，不生成观察。没有继续重试、换报告方或用镜像绕过限制。

国家角色主要定位：中国报告第 2 页；孟加拉报告第 7/9 页（棉纺、针织、染整与成衣行业）、第 15 页（巴西原棉）、第 17 页（印度棉纱）；印度报告第 8 页提供独立的部分市场年背景。保留市场年 MY2024/25（2024-08-01 至 2025-07-31），不将报告中的未来预测数量作为 observed 数据。

## 确定性转换与验证

`scripts/build-cotton-tshirt.mjs` 默认离线读取审核内容和固定原文快照，核对国家、分类、单位、响应维度、预览上限与重复主键。成品统计直接取 `primaryValue` 与 `qty`，分别保留世界总计与具体伙伴，不汇总两者。`isReported`、`isAggregate`、`legacyEstimationFlag`、件数/净重估算标志原样保存；世界记录的汇总标志不被删除。

WDI 只读取既有通用 raw 包中的中国、美国两国 2024/2025 记录；校验外层文件与内层 body 两级哈希，再按源指标构造国家背景。没有读取或复制手机贸易、手机部件或其代表路线；新数据集版本不替换来源自身的 WDI 发布版本。

构建结果：

- 候选目录：`data/candidates/cotton-tshirt-2026-10-21/`。
- 不可变目录：`data/published/releases/generic-cotton-tshirt/globe-chain-cotton-tshirt-2026.1/`。
- 两个目录都含 `fixture.json`、`manifest.json`、`review-audit.json`，相同输入输出逐字节一致。
- fixture SHA-256：`00f9236c410da5fe15dc7459233b7fcc386849cf42b9921dd34851f971109f13`。
- 通过 `tests/cotton-tshirt-release.test.ts`：published 契约/外键、通用拆解与三分支、四条原文统计与单位/质量标志、证据层级、工艺变体及输入输出、地图/世界与双边区分、国家账本未知语义、确定性哈希、真实只读 adapter 与篡改输入阻断。
- `--prepare-release` 会先运行这组回归，再以仅新建或验证相同字节的方式准备 release，不执行激活。

复现：`node scripts/build-cotton-tshirt.mjs`；验证并准备新 release：`node scripts/build-cotton-tshirt.mjs --prepare-release`。独立验证：`node node_modules/vitest/vitest.mjs run tests/cotton-tshirt-release.test.ts`。原文补充抓取器需要显式 `--source`，成功原文按哈希复用，遇 429 即停止。

## 交接与限制

本代理未启动服务、运行整站 build、改 Web/domain/contracts、激活 manifest 或执行 Git。实际网页视觉与跨商品导航由根代理接入后检查。

待补的是更多报告国、更多期间及材料的官方统计，不是把现有定性关系转换成推测量。当前没有单件 BOM、订单谱系、厂商设备能力、物料损耗、利润或政策内容；这不阻止已有代表分支与真实贸易继续探索。

提交前需对新 raw、内容审核 JSON、候选及新 release 设置 `-text`，避免 Windows Git 换行转换破坏已记录哈希。旧研究目录已设置此规则。新增原文、构建器和测试都属于棉 T 恤独立包。
