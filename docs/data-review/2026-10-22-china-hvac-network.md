# 中国空调产业网络候选复核（2026-10-22）

目标版本：`globe-chain-home-air-conditioner-2026.2`。本批将已有空调商品深化为面向产业参与者的环节、企业公开能力和官方信息入口；本文件记录离线候选，激活与网页验收由主任务记录。

## 候选结果

- 36个产业环节，55条去重后的主题关系，15家企业，31个企业内去重的官方入口。
- 33个研究来源条目：昨日13条、材料/设备追加9条、核心部件追加11条。包含DOE1997历史技术和同一网页在不同日期的复核记录，不应称为33家独立机构。
- 16项主题与已有商品条目的分类对照，支持从铜管、翅片、换热器、压缩机、电机、电控、制冷剂和壳体等环节继续进入商品与制造工艺。
- 原有22个商品/材料条目、27节点/26连接、9工序/12设备类别、4条2024年贸易观察及全部旧来源和证据，除新数据集ID引用外保持一致。
- 新候选fixture SHA256：`78028e78b4e2293ae59af289968afa7471867405d428666abefc6bb496eb1a33`。
- 基线2026.1 SHA256仍为`19a3b48b7cb086fb399af3fbb6a8bc21420b9141c8db31fd6be2f7fea0352b39`；没有修改旧不可变release或active manifest。

## 来源、获取和转换

构建器：`scripts/build-china-hvac-network.mjs`。它固定基线fixture及三个研究JSON的SHA256，逐一校验研究引用的原文、直接正文资源及其哈希；运行时不抓取网页。输入URL、UTC获取时间、HTTP状态、原文字节和方法保留在各研究包及raw manifest中。

- `content/industry/china-hvac-reviewed-2026-10.json`：`9c3a46c05691ed644ee9e3c707d806a1d9a8f826e424042c4a03fdc69673937e`。
- `content/industry/china-hvac-supplement-2026-10-22.json`：`8d974eaf9a8b174216893694d0b10fe7d624b5f0131b73b5cb3102688987a0f1`。
- `content/industry/china-hvac-core-supplement-2026-10-22.json`：`ca804a75e29886097f7a9d8617b65b66732b53d7def35765f395359f7b5415c8`。

转换将研究的`intermediate`归为部件，工序保留`process`。官网快照在现有期间契约中用`monthly`承载，但起止日仍是实际观察同一天，并保留明确快照标签，没有扩展为整月或全年产销。DOE1997、2017生产背景、2024贸易与2026官网能力各自保留期间。

短用途摘要供首层浏览，原研究全文说明保留在输入和`review-audit.json.originalRecords`。同一from/to/kind重复主题关系选择最近有来源的记录：换热器检漏使用皖仪2026资料，原DOE1997记录完整保留在审计，不将两个期间合成一次观察。精达两类设备、雪人制冰与蒸发式冷凝器等不同官方产品链接均保留；同一页面同时含产品和联系时显示“产品与联系”。

分类对照保存在`review-audit.json.topicItemCrosswalk`，每条带期间、来源、方法、状态、数据集版本和范围。R32只链接通用制冷剂类别，不将历史工艺的工质指定为R32。PBT材料不强绑旧塑料格栅配方；壳体应用主题链接机壳类别。扩管关联穿管半成品是工序投入，钎焊后换热器是产出。没有把微通道或蒸发式冷凝器强行绑定铜管铝翅片BOM。

## 关系和信息入口范围

主题关系描述技术投入、制造设备、用途和销售入口，不建立企业间实际供货关系。企业公开能力目录包括金田、美芝、精达、雪人、格力、华峰铝业、力华、皖仪、捷阳、新金宸、卧龙、威灵、拓邦、东岳及金发。金田展示的自有制造设备没有被发布为对外销售设备能力。

“一键对接”按用户明确选择实现为打开官方产品、联系或采购/销售入口，由用户自行沟通。没有提交表单、发送消息、询价、交易或采集动态报价/库存。未用设备网页上的0.00占位标价充当价格事实。

## 已执行验证

`node node_modules/vitest/vitest.mjs run tests/china-hvac-release.test.ts tests/industry-query.test.ts tests/industry-network.test.ts`：3文件、12测试通过，其中本批数据测试8项。

数据测试覆盖完整ProductFixtureSchema、旧事实逐字段保留、原文和候选哈希、确定性重建、真实只读loader、无效来源/版本/条目/不安全URL拒绝、原件篡改拒绝，以及铜材料到制管/铜管/换热器/整机/官方零售的连通性。实际查询任务覆盖铜管、冲压设备、检漏设备、制冰机、蒸发冷及电机/电控/制冷剂/壳体；相关工艺仍保留1997年份。企业名搜索可以返回相应环节。网页、完整项目检查与激活结果由主任务补记，不能仅据本测试称网页已验收。

## 重建与准备发布

```text
node scripts/build-china-hvac-network.mjs
node scripts/build-china-hvac-network.mjs --prepare-release
```

第一条生成`data/candidates/china-hvac-2026-2/`，不改active。第二条先执行本批8项测试，通过后用拒绝覆盖不同字节的方式准备新不可变release，仍不激活。其后使用项目原有发布工具切换单个商品，保持其他四商品active；主任务在验收后执行。


## 主任务发布与网页验收补记

2026-10-22已执行prepare-release与单商品activate，空调2026.2已进入本机active，另外四商品保留。五商品manifest verify通过，旧2026.1未改。最终40文件218测试、typecheck、lint、生产build通过；实际桌面和手机任务见docs/continuation/QA-2026-10-22.md。最终生产服务127.0.0.1:3000，session57165。以上候选阶段activeManifestChanged:false描述的是构建器行为，不表示发布后的active仍为旧版本。
