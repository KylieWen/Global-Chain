# 五商品产业内容服务器同步（2026-10-24）

用户要求“恢复，同步到服务端”。先实读额度：五小时剩97%、周剩69%、普通使用允许；遵循12%/3%保护。接续既有已验证本地成果，没有重新生成release、增加商品或改动界面。

## 实际上线

- 公网：http://62.171.148.193/，仍为IP/HTTP，无新域名、HTTPS或采购。
- 应用提交：e7c09af2de182905ac9808385b81689a3515d833。
- 切换时间：2026-10-24 12:37:13 Asia/Singapore（04:37:13.086Z）。
- current：/opt/globechain/releases/e7c09af2de18；BUILD_ID：G3KDrXs4UNzmhCVTZA_l4。
- 直接回退：/opt/globechain/releases/39ee82f4775b；旧版本均保留。
- globechain、nginx均active；NRestarts=0、ExecMainStatus=0。仅重启应用，不改SSH、nginx、数据库或操作系统。

五商品合计259个产业环节、292条关系、24家企业，比前版本新增214个环节、225条关系，接入6家已有来源的设备企业。手机/空调2026.6，棉T/大豆油/电自2026.3；数据方法见本批data-review。通用工艺资料仍为跨地区技术范围，没有新增中国城市或实际企业供货关系。

## 发布与验证

复用预先生成源码包output/deploy/globechain-e7c09af2de18-source.tar.gz，1,987,237字节，SHA256 42c52f3be58abd3e0f8c45ebf1db01654b6ed89f399cb8f19ff86f3b8fecc0c7。41个fixture校验在打包时已通过，本轮本地和上传后哈希一致。Linux冻结依赖安装及生产构建成功；未重跑没有变化的本地测试批次。

候选通过27项基础检查（产品、世界/中国地图、当前及历史快照、无效版本拒绝、指南与来源）及真实浏览器五商品上下游连接/手机中国入口检查。候选截图已目视。

第一次切换的发布记录脚本多写一个括号，错误触发自动回退到39ee82f；修正脚本后重新切换成功。该中断没有作为成功上线报告，最终以落盘发布记录和公网验收为准。

公网独立检查结果：

- scripts/verify-industry-content-expansion.mjs：12:37:46，五商品产业页面、上下游关系、中国地图到产业页手机入口通过，无横向溢出。
- scripts/verify-booth-onboarding.mjs：12:38:36，1440/390首次个性化引导、跳过/Escape、键盘焦点、完成/跳过记忆、重开、受限存储、减动、三角色目的地、/demo重定向通过。
- scripts/verify-self-host.mjs：12:39:04，五商品各5页/5导出、历史2026.2、世界→中国→企业、1024/390菜单通过。
- 三组pageErrors均为空；公网产业手机页面和新手手机截图已目视。既有二维码地址未变，继续有效，不重复生成。

证据：output/qa/2026-10-24-industry-{candidate,public,public-self-host,public-onboarding}/。服务器记录与构建日志安全取回到output/deploy/e7c09af-evidence/，压缩包SHA256 9c4a086c9dc27a8b8afbc7b7b397c029b57bcafbb7ce2f1bc5dfa14c203c9889，归档仅包含部署JSON、候选检查JSON和构建日志三文件。候选服务已停止，全部本轮SSH/SCP/转发已关闭。未创建自动化、未开展Claude反馈包、未提交用户无关物料。
