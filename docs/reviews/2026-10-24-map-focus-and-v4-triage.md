# 手机地图大图/横屏与Claude V4核对

## 公网完成补记

13:53:44 Asia/Singapore已切换6de7227f987a577db4f2b2a41f68137c8deeedcc，current=/opt/globechain/releases/6de7227f987a，BUILD_ID n7QHPGGzQUapTvTFMLPfz；旧cedbf651871d保留回退。源包1,995,316字节，SHA256 c6346bfc0ca4ea89952840ae3dea2688cb499cf056028d520206f98a01fdca64，本地41fixture校验/上传哈希/Linux冻结安装与构建/27候选基础检查通过。

本地最终13:47:59、候选13:52:00、公网13:54:31两地图大图/竖横屏/双指缩放/保留缩放与URL/筛选详情/退出焦点与滚动/换商品卸载/全屏API拒绝降级均通过，pageErrors=[]；真实Chrome原生全屏进入退出通过，方向锁成功分支另为模拟，未验证物理手机旋转。首次候选末页30秒导航超时未算成功，增加远程等待时限后完整补验通过；产品未因这次超时再改。

公网五商品各5页/5导出、历史版本、世界→中国→企业、390/1024菜单也通过，截图已目视。脚本接入run-browser-smoke运行器并支持CI的Chromium选择，但未声称托管CI已实际运行。globechain/nginx/统计清理timer均active，NRestarts=0/ExecMainStatus=0；原统计目录保留、实际POST通过，没有修改统计/代理/账号配置。候选已停，全部本轮SSH/SCP/转发已关闭。

证据output/qa/2026-10-24-map-focus-{candidate,public,self-host-public}/及output/deploy/6de7227-evidence/；证据包SHA256 b519e7be546c284d291f44a533cc6755b40dd82442a72a53a44761daf41bd008。下文“公网仍cedbf”为初始本地阶段。产业数据/release/V4评审包未修改；下述网络断点仅核实并登记，尚未修复。

用户新增“手机可以考虑放大地图进入横屏”，同时回传CLAUDE-REVIEW-V4.md。本轮重点实现两地图共用的大图浏览；附带报告作为评审材料读取，不把其中建议当作自动执行全部修改的指令。

## 已实现并本地验证

- 世界/中国地图原缩放控件旁新增“大图”，保持同一SVG和状态，不复制地图或重置筛选；展开后地图占主要空间，筛选与详情按需打开。横屏下详情为侧栏，竖屏为底部抽屉。
- 原生Fullscreen API允许时进入全屏并尝试锁定landscape；不支持/拒绝时保留网页内大图，提示用户转动手机。只在用户点击后请求；不承诺所有手机都能强制横屏。退出或原生全屏结束会解除本次方向锁。
- 背景inert/滚动锁、Tab圈定、Escape、退出后焦点与滚动位置恢复；展开中切换商品/卸载也释放锁。保留缩放状态与URL。实际SVG投影矩阵用于文字/触控尺寸，横屏受限高度不再按容器宽度误算。
- 新增scripts/verify-map-focus.mjs：13:42:15真实Chrome两地图竖屏/844×390横屏、API拒绝降级、缩放/筛选/详情、退出/Escape、切商品清理通过，pageErrors=[]；支持分支模拟锁定/解锁通过，另一次真实Chrome native fullscreen进入/退出通过。物理手机自动旋转未验证，不称为真机全覆盖。
- 类型检查、最终生产构建含lint/type通过；地图/点击区/标注/统计4文件24测试通过，未重跑没有变化的全量271测试。五商品既有浏览/导出回归结果另附收尾记录。截图已目视并修正一次横屏世界地图高度超出。
- 证据output/qa/2026-10-24-map-focus-{local,self-host-local}/；首次本地实现时公网仍cedbf651871d，实际服务器切换另在恢复入口补记。

技术依据：[MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)、[MDN orientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock)。全屏需用户激活，方向锁兼容性有限，故网页大图与手动旋转为完整兜底。

## 原报告保留与核实

逐字节保存docs/reviews/2026-10-24-claude-v4-original.md，33,415字节，SHA256 2c69376bac1cfd46c361b66e789fbc54951d7e4a11f6b883942d6fd8557fb5c3；用户桌面原件未改。

报告分析的是e7c09af/a8a0c16，未实际访问公网、未跑产品构建/测试；其静态UI结论不能替代现cedbf65或本次新版本验收。产业数据自e7未改，因此本次独立重算其核心发现：手机69节点63边为19个弱连通分量（28/6/3及16个2节点块），默认入口入2出0；空调86/107为45+41两子网；其余三商品分别单一40/37/27节点分量，0企业。统计证据output/qa/2026-10-24-claude-v4-triage/current-network-check.json。

这些数据断点没有因大图功能而修好，本轮不为满足连通数字虚构商业关系、不改既有不可变release。后续独立批次优先：核查手机工序顺序及状态节点投影/默认入口→空调同义概念显式映射及证据范围→无企业商品文案与来源原件缺口→其余三身份/分类工作流。每项需验证来源与语义后新release，不能用简单连边或改数字代替。

Claude建议的手机环节按kind分组，当前industry页已有optgroup；应标为已有，非照单重复实现。其余来源缺口、双向2环、统计措辞、三身份差异须逐条核实，不把所有旧意见统称已完成。
