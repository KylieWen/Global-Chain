# Contabo 自托管准备与当前阻塞

日期：2026-10-23（Asia/Singapore）。用户本轮明确要求检查已购买服务器并先将网站搭载到服务器；此授权覆盖此前“暂缓部署”的历史决定。

## 已完成

- 检查了本地连接配置，只有此前其他项目的局域网SSH主机，没有本次Contabo公网主机信息。没有连接或修改那些无关主机。
- 浏览器工具两次清单读取及直接绑定邮箱均返回`transport closed before response`。未能读取Contabo控制台或用户指定邮箱，不能据此判断订单的开通状态。邮箱链接与其中的会话参数不写入代码或记录。
- 用户提供的附件为18页Contabo通用服务条款，未发现服务器IP或开通登录资料；没有据附件自动接受条款或进行账号操作。
- 按官方资料确认开通邮件标题为“Your login data!”；用户后续提供开通邮件，确认公网IP 62.171.148.193、root用户；密码为下单时用户设置，不需要发送在聊天中。官方说明：<https://help.contabo.com/en/support/solutions/articles/103000253457-where-can-i-find-my-server-login-details->。
- 新增`node scripts/package-self-host.mjs`：只取已提交应用、包清单、内容配置与published manifest/历史release，排除下载原件、个人附件、购买截图、凭据、依赖、Windows构建和全部output。先检查应用区域没有未提交变化，再生成源代码部署包。
- 已生成`output/deploy/globechain-b7f2f4201dcd-source.tar.gz`：源版本`b7f2f4201dcd23cfa2694e99c24f50062099b8ff`，1469387字节，274条tar记录，SHA256 `cd999d5e2836fbd60b52c48a2d7a97cdd55c02c68a6803a609e557f25e6c4537`；状态明确为`prepared_not_uploaded`。
- Node打包器与独立Python tar读取均验证30组manifest/fixture引用和哈希，当前根manifest五商品齐全。原始Git归档曾使一个2023.3旧手机fixture的CRLF变为LF；现只在打包副本中按原manifest哈希恢复准确字节，旧release和哈希不改。下载原件目录不属于运行必需内容，因此不打包其中LFS文件。
- `ops/self-host/`提供待适配的systemd、nginx模板与检查/部署/回滚顺序。需要先检查真实服务器Node路径、现有站点、端口和服务，模板尚未安装或应用。网站使用文件读取与动态服务，不能当成纯静态HTML部署，也不上传Windows node_modules。

## 尚未完成

开通邮件确认IP为62.171.148.193、用户root；两次SSH探测均正常到达认证阶段，返回Permission denied (publickey,password)。机器已启动且SSH网络可达，但尚未认证登录，内部系统、资源及现有服务未知。未上传程序、安装软件、修改防火墙、发布HTTP/HTTPS或配置域名，没有可报告的公网网页地址。

已在被忽略的.local/deploy准备专用临时密钥与connect-once.ps1，私钥ACL仅当前用户可读写，未安装到服务器。正在询问用户是否打开可见本地窗口，输入一次密码并添加这把临时密钥；只有用户确认后才打开、由用户输入。密码不写入命令、结果文件或日志。部署完成后移除这把临时密钥，不能把私钥或邮箱会话链接提交到Git。主机ED25519指纹首次见到为SHA256:WdAmvT6rNevDjk+1A4ZavijMJ9x4PN5x8ZW19LKiHCM；只验证两次网络探测一致，并未通过服务商控制台独立核验。

下一步收到IP/用户名后，先核对SSH连通及系统资源/现有服务，再按模板在Linux构建并验证候选版本，最后切换服务并做公网浏览器验收。若需要本地密码输入或首次改密，由用户自行完成，不把密码放进命令参数、日志或仓库。

本批只是部署准备，不重复运行此前已通过的应用全量测试；运行了部署包实际构建、独立归档内容/五商品/历史数据哈希校验及diff检查。原应用检查点仍为`b7f2f42`，其它聊天的工作流修改与用户资料保留。
