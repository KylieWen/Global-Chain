# 家用空调研究原始快照

获取日期：2026-10-21（UTC）。`manifest.json` 记录每个请求的 URL、HTTP 状态、字节数和 SHA-256。只有 HTTP 200 且存在本地字节的项目可作为候选发布的可复现输入；IEA 页面 403 和 UN 国家字典 404 仅保留获取失败记录，不能当作原始输入。

本批离线转换应只读取以下文件：

1. `un-comtrade-china-hs8415-2024.json`：筛选 `reporterCode=156`、`flowCode=X`、`partnerCode in (276,842)`、`cmdCode in (841510,841582)`，只接受 `isReported=true`、`isAggregate=false` 的行作为中国报告的双边观察。
2. `un-hs2022-h6.json`：在 `results` 中查代码 `841510`、`841582`，保留其完整官方品名和 `standardUnitAbbr`。
3. `un-quantity-units.json`：将贸易行 `qtyUnitCode=5` 标准化为 `u`（Number of items），不以 `qtyUnitAbbr=null` 推测其他单位。
4. `iea-future-cooling-china.pdf`：仅支持 2017 年中国在室内空调生产和安装规模中的历史国家角色；不把该比例写成当前年份或某条双边发运。
5. `doe-room-ac-manufacturing.pdf`：仅支持房间空调的历史工艺投入输出。其出版年代较早，工艺链必须带 1997 年技术来源期间，不能声称描述当代中国工厂。

不从世界总计、`legacyEstimationFlag=4` 或 `isReported=false` 的行推导双边量、市场份额、单机物料用量或利润。两条 HS 子目不等于所有家用空调的完整市场。
