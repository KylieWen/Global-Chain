# Contabo 首次公网部署验收

## 最新发布（2026-10-24 00:28，Asia/Singapore）

- 已发布应用b021953e105bf386bf3e688b83966eb9c16f8d9f：三身份浏览、历史导出与指南一致性、导航收口。current=/opt/globechain/releases/b021953e105b；前版6fe4a31dbaf5保留回退。Linux构建ID TbG26JLpMTncgSPCqFdU1，源码包SHA256 8059d67e182d37681f5bd6038b8a251af7cd4014664644181930dbb3e5f2ce0e，1,755,614字节、36fixture校验通过。
- Linux构建及27候选检查通过，服务实际启动00:20:32；五商品各5页与完整/历史导出、钻取/窄屏00:23:09通过，导航与严格指南00:21:45通过，三身份三宽度及键盘/跨标签/受限存储00:27:16通过，页面错误为空，截图已目视。
- 服务/nginx active/enabled、NRestarts=0、ExecMainStatus=0；应用仅监听127.0.0.1:3000，候选停止、SSH全部退出。首页 http://62.171.148.193/ 提供身份选择；IP/HTTP保持，没有新增账号/数据库/企业审核后台。
- 证据 output/deploy/b021953-evidence/ 及 output/qa/2026-10-24-*-public/；完整范围和局限见2026-10-24-final-two-rounds.md。下文为历史，不能替代最新状态。

## 最终发布（2026-10-23 19:12，Asia/Singapore）

- 当前线上应用6fe4a31dbaf5515ebe34337fe098f318de2864cf，current=/opt/globechain/releases/6fe4a31dbaf5；Linux构建ID eozKMEAIfju-qY5xN0Nbv。源码包1,751,293字节，SHA256 d17ea2a8c44618bb19cb629b4408b185912bbfa8bcdb4dd164ce28155e0ce4f8，36组fixture校验通过，远端校验一致。
- 新候选21项检查通过：五商品页面、世界/中国地图、五份精确版本导出与历史页面；中国地图每商品节点数与新区域文件一致，区域版本2026.10.2、点击区域已渲染。随后原子切换；globechain与nginx active/enabled，NRestarts=0、ExecMainStatus=0。候选已停止，SSH已退出。
- 公网浏览器最终验收在2026-10-23 19:11:52通过，五个新增节点的来源/年份、2019历史提示、无虚构天津国产供货链接、深圳/东莞和无锡/苏州真实点击及390px五商品无横向溢出均通过；pageErrors=[]。截图已目视。证据 output/qa/2026-10-23-regional-review-public/，远端构建/候选/服务记录 output/deploy/6fe4a31-evidence/。
- 保留16d96c3a6b1a、99b95fe6eb5b及最初版本回退。公网仍IP/HTTP，未购域名、未配置HTTPS；没有新自动化、数据库、账号后台或运行时外部API。此次是已授权优化的两个完整批次，不代表全部长期数据待办已完成。

日期：2026-10-23（Asia/Singapore）。用户明确授权将本地已验证版本先搭载到已购买的服务器；本报告覆盖部署，不扩展企业申请、审核或账号功能。

## 部署结果

- 公网入口：[世界地图](http://62.171.148.193/map)、[中国供应链](http://62.171.148.193/map/china)。当前为 IP/HTTP；域名和 HTTPS 尚未配置。
- 应用源码提交：`b7f2f4201dcd23cfa2694e99c24f50062099b8ff`。后续维护文档提交不改变线上应用版本。
- 源码包：`output/deploy/globechain-b7f2f4201dcd-source.tar.gz`，1,469,387 字节；SHA256 `cd999d5e2836fbd60b52c48a2d7a97cdd55c02c68a6803a609e557f25e6c4537`。本机与服务器分别核对；30 组 manifest/fixture 校验通过。
- 白名单仅包含已提交应用、内容、公开发布数据和依赖清单；未上传下载原件、私人物料、购买截图、凭据、Windows 依赖或构建。历史手机 2023.3 仅在包副本按既有校验值恢复 CRLF，原发布数据及校验值未改。
- 服务器 Ubuntu 24.04；官方 Node v24.22.1 Linux x64 压缩包按官方 SHASUMS 校验后安装，pnpm 使用仓库固定的 11.19.0。没有新增数据库或运行时外部 API。
- 以独立非特权用户 `globechain` 执行锁文件安装及 Linux 生产构建，均成功。Next.js 15.5.23，构建 ID `5vxBC4f6IyetYd1RoEz0N`。构建保留已有 CSS `align-content: start` 兼容性警告，无构建错误。

## 持久服务与网络

- 发布目录 `/opt/globechain/releases/b7f2f4201dcd`；`/opt/globechain/current` 指向该目录。
- `/etc/systemd/system/globechain.service` 使用非特权用户运行，并设为开机启动；实际 `active/running`、`ExecMainStatus=0`、`NRestarts=0`。
- Next.js 仅监听 `127.0.0.1:3000`；nginx 公网监听 80 并反向代理。候选服务 3001 已停止。
- 新增独立 nginx site；`nginx -t` 通过，nginx 已启用并运行。保留原默认 site 和 SSH 22 访问；原 ufw 未启用，未改变防火墙状态。没有安装新 SSH 密钥，凭据未写入文件、脚本或 Git。
- 已检查 systemd 状态与应用日志。尚未重启整台 VPS，因此“开机启动已启用”不等于已经做过服务器重启演练。

## 验证证据

- 在候选服务上线切换前，五商品各验证详情、路线、来源、世界地图、中国地图，共 25 页返回 200；五份研究导出包含对应版本；历史手机 2026.2 页面正常。
- 公网验收脚本：`scripts/verify-self-host.mjs`；截图与最终结果位于 `output/deploy/live-verification/`。脚本覆盖五商品各五页面、导出版本、世界到中国钻取、宁波铜管材料与金田企业联动、历史版本链接、1024/390 菜单及横向溢出检查，并收集页面运行错误。
- 最终公网验收于 2026-10-23 06:25:40（Asia/Singapore）通过，`pageErrors=[]`；1024 与 390 视口文档宽度分别等于滚动宽度。已目视检查公网世界地图、选中宁波材料的中国地图与手机展开菜单截图。
- 首次公网验收使用了与实际菜单可访问名称不符的精确文本选择器；已按主导航范围修正验收脚本。没有为该测试定位问题修改应用代码。
- 切换 nginx 后首次立即请求碰到旧 worker 的 404，随后新配置实际返回 200；以最终公网结果为准，不把刚重载时的单次请求视为验收结论。
- 远端安装/构建日志、实际服务及 nginx 配置、候选检查、部署元数据已按明确文件列表打包，保存在 `output/deploy/deployment-evidence.tar.gz`，解压副本在 `output/deploy/evidence/`。不包含认证材料。

维护、候选切换及回滚步骤见 [ops/self-host/README.md](../../ops/self-host/README.md)。初次部署没有更早的线上版本；之后更新保留上一发布目录。原本机预览保持运行。
