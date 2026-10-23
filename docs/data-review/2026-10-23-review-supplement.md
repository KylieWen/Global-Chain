# 2026-10-23 评审数据补充

## 来源与转换

- 原始提取目录：data/raw/review-supplement-2026-10-23/；抓取时间、URL、HTTP 状态、SHA256 与浏览器捕获方法写入各自 metadata/JSON。没有覆盖历史原始数据或已发布 fixture。
- [World Bank 商品出口](https://data.worldbank.org/indicator/TX.VAL.MRCH.CD.WT)、商品进口 TM.VAL.MRCH.CD.WT、[含黄金储备](https://data.worldbank.org/indicator/FI.RES.TOTL.CD)：2024–2025 API 查询，选择可用最新数值，本批新增实际均为2025年。出口、进口与储备以当年美元记录；差额仅由同国同年出口减进口派生，保留 derived 方法。储备包含黄金，未改名为纯外汇储备。
- 48 条指标覆盖手机越南/印度、T恤巴西/印度/孟加拉、大豆油美国、电动车中国/德国/新加坡、空调中国/德国/美国。仅填原宏观为空的组合；不替换现有贸易、路线或旧宏观事实。台湾没有可匹配 WDI 数值，保留未知。
- [海关查询](https://online.customs.gov.cn/ocportal/mySearch/)及[税务机关出口代码库查询说明](https://tianjin.chinatax.gov.cn/nsrxt/11200000000/0500/050011/20250603142736825.shtml)作为四份部分出口核验导航的官方查询入口。准备商品描述、规格与用途只是推荐的核验准备，不冒充强制报关材料；税率、许可、办理时间没有证据的字段仍为 unknown/null。不是四份完整合规手册。
- [EVAPCO LSC-E 官方结构说明](https://www.evapco.com/products/condensers-evaporative/lsc-e-evaporative-condenser?page=0)：盘管、离心风机、水泵与水循环，304/316不锈钢盘管选项。[Automatic ICE Systems 官方集成说明](https://automaticice.com/b-a-c-evaporative-condensers/)：蒸发式冷凝器用于制冰系统。后者命令行403，正常浏览器可读，保存可访问文本并如实注明捕获方法，不伪称 HTTP200 HTML。Snowman 两份 PDF 返回404，未用作新增事实。
- 上述国外厂商资料证明代表性结构和用途，不证明中国某企业的实际客户、供应商关系。新增4主题与5技术关系，空调产业网络现为45主题/67关系/18企业；商业渠道关系独立分类。
- 地图补充来源为已安装 world-atlas 2.0.2 / Natural Earth 4.1.0 的50m数据，仅补原110m缺少的有效M49实体，61个轮廓；脚本固定输入哈希，无运行时网络依赖。

## 可重复构建与版本

fetch-review-supplement.mjs 固定查询及只读复用原始捕获；build-review-supplement.mjs 校验基线与原始哈希、保留旧事实，生成不可变 fixture/manifest/review-audit。先运行默认宏观配置，再运行空调产业配置；测试验证重建字节相同、全部契约及来源/年份/单位/unknown 区分。

本轮版本：手机2026.5、T恤2026.2、大豆油2026.2、电动自行车2026.2、空调2026.4及其产业增补2026.5。当前本地活动空调版本是2026.5；其余版本见 data/published/manifest.json。旧发布文件未改写。原始资料、转换配置与每份发布审计均可追溯；本轮未扩大双边贸易国家对覆盖，未引入运行时 API。
