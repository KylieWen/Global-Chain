# 无人机四旋翼剪影：Qoder CN 只读审查（2026-11-26）

## 1. 结论

**Qoder 未完成本次审查。** Qoder CLI 已被实际调用，但在模型选择阶段即被账号侧 403 阻断，没有产生任何 Qoder 评审意见；本次 checkpoint 不把任何其他工具或豆包/子代理工作记为 Qoder 结论。

- 本机 Qoder CN CLI 1.1.85 入口可执行，`status` 为已登录；网络、登录态刷新、附件上传均返回 200。
- 账号当前**没有任何可用模型**：`--list-models` 提示 "no models available for your account"；每次推理尝试在首轮前失败，`num_turns=0`、无文本结果、消耗额度 0。错误为 `[ModelNotFoundError]: main model "auto" is unavailable. code: 403`。
- 本次没有让 Qoder 修改任何文件：全部会话以 `--tools ""` 禁用内置工具，未使用任何权限绕过参数，未触发 `login`。
- 下文第 5 节「Qoder 原建议」为**空**；第 6 节起的代码定位与选项，均为本子代理的只读自查，**不是 Qoder 结论**，供主模型取舍时区分。

## 2. 审查任务与范围

- 审查对象（附件清单与哈希见 `output/qa/overnight-2026-11-26/drone-quad-silhouette/qoder-review/04-target-manifest.json`）：
  - `docs/visual-specs/2026-11-26-drone-quad-silhouette.md`（本轮视觉规格与回归护栏）；
  - `apps/web/components/exploded-three-viewer.tsx`：`addRotorDecoration`（115–135 行）、`drone-arm` 分支（448–450 行）、`drone-body` 装饰段（469–499 行）、取景/标签段（501–586 行）；
  - `content/exploded-appearance.json`：`viewer` 全局段（4–16 行）、`products.generic-camera-drone` 段（177–206 行）；
  - 生产截图 `output/qa/overnight-2026-11-26/drone-prod/drone-1440-dark.png`（1440×960 深色默认态）、`drone-390-light.png`（390×844 浅色默认态）。
- 已确认的三条根因：四个桨毂位于机身矩形轮廓内部；双叶被画成垂直十字；云台吊舱与标签可读性不足。
- 边界：只评估 `generic-camera-drone` 的通用外观角色几何与取景；不改 fixture、release、领域查询、其他商品或全站导航；不引入外部模型、新依赖或新 BOM 节点；公开站不发布。

## 3. 实际执行记录

CLI 入口：`D:\Global Chain\tmp\qoder-setup-2026-11-08\native\qoderclicn.exe`（1.1.85，Windows，CN 默认网关，`vpc_endpoint` 未设置）。

| 序号 | 目的 | 关键参数 | 会话记录 | 结果 | 回执 |
|---|---|---|---|---|---|
| 0 | 登录状态快照 | `status --output json` | — | `logged_in=true`，`user_type=personal_professional_trial`，`auth_source=local`，浏览器登录 | `00-status-before.json` |
| 1 | 完整只读审查（5 个附件，含两张截图） | `-w "D:\Global Chain" -p -o json --tools ""`，5 个 `--attachment`，提示词见 `01-prompt.md` | 见原始回执 | `is_error=true`，`error_code=500`，`num_turns=0`，`total_credits=0`；附件截图已上传（`image/upload` 200 两次）后失败 | `01-qoder-receipt.json`、`01-stderr.log`、`01-run-meta.json` |
| 2 | 显式模型探针 `Qwen3.7-Plus` | `-p -o json --tools "" --model Qwen3.7-Plus` | 见原始回执 | 模型不可用，回落 `auto`，同样 403 | `02-probe-Qwen3.7-Plus.json` / `.stderr.log` |
| 3 | 显式模型探针 `DeepSeek-V4-Flash` | `-p -o json --tools "" --model DeepSeek-V4-Flash` | 见原始回执 | 模型不可用，回落 `auto`，同样 403 | `02-probe-DeepSeek-V4-Flash.json` / `.stderr.log` |
| 4 | 无工具最小探针 | `-p -o json --tools ""`，单句 trivial 提示 | 见原始回执 | 同样 403，`num_turns=0`，额度 0 | `03-minimal-probe.json` / `.stderr.log` |

补充只读排查：`--list-models` 输出 `Warning: no models available for your account.`（`00-list-models.txt`）。CLI 运行日志的决定性摘录见 `05-cli-log-excerpt.txt`，汇总记录见 `06-run-record.json`。

会话参数说明：`--tools ""` 禁用全部内置工具，因此 Qoder 既不能读写文件也不能执行命令；未使用 `--yolo`、`bypass_permissions`、`--dangerously-skip-permissions` 或任何等价绕过参数；未运行 `login`、`update` 或写配置命令。

## 4. 阻塞归属与证据

**归属判断：账号模型授权 / 登录凭据 checkpoint，不是本地文件问题，也不是权限绕过问题。**

- 网络与鉴权正常：`userinfo`、`user/status`、`model/list`、`ping`、`image/upload` 在 CLI 日志中均为 HTTP 200；`status` 显示登录态有效。
- 模型目录为空：`model/list` 虽 200，但解析器拿不到当前账号可调用的模型；`--list-models` 明确告警无可用模型。
- 失败点固定在选模型之后、首轮推理之前：`[ModelNotFoundError]: main model "auto" is unavailable. code: 403`；显式指定两个 CN 模型名时，日志告警 `Model "..." is not available right now; using "auto" instead. Use /model to choose another model.`，随后仍走 `auto` 并 403。
- 凭据疑点：CLI 与桌面应用的登录凭据可能不同，本次未切换；trial 是否过期或额度耗尽需要人工在账号页核实。账号登录状态与学生 Pro 权益归属由主模型后续另行处理，本批次不执行登录、兑换或权益操作。
- 四次失败会话消耗额度均为 0，未产生写入。

### 恢复步骤（需人工，本会话未执行）

1. 浏览器打开 Qoder CN 账号页，核对 Pro Trial 有效期与 credits 余额；若 CLI 凭据属于旧的/第二个账号，人工执行 `qoderclicn login` 切换到有授权的账号。
2. 可另行核对 CLI 是否需要升级；该项属于安装变更，不在本次只读范围内，未执行。
3. 授权恢复后，按 `01-prompt.md` 中的提示词与 `04-target-manifest.json` 中的五个附件原样重跑审查，回执仍写入本目录。

## 5. Qoder 原建议

**无。** 所有会话在模型阶段失败，`num_turns=0`，`result` 为空字符串；不存在可引用的 Qoder 文本、代码建议或测试项。任何把本评审、豆包或主模型自查写成 Qoder 结论的做法都不成立。

## 6. 子代理只读自查（非 Qoder 结论，供主模型取舍）

以下定位来自子代理直接阅读源码与两张生产截图；未运行构建、未改代码，几何数值判断需主模型在恢复 Qoder 审查或本地复看时复核。

### 6.1 代码位置与现有语义

- 桨毂落点（`exploded-three-viewer.tsx` 480–489 行，`drone-body` 装饰段）：
  - 481 行 `hubX = sx * (bodyW / 2 - 0.06)`；482 行 `hubY = sy * (bodyH / 2 - 0.08)`——桨毂取在机身半宽/半高**向内**收缩 0.06/0.08 的位置，仍在机身矩形投影轮廓内。
  - 483–487 行机臂梁长度 `beamLen = hypot(hubX, hubY) - min(bodyW, bodyH) * 0.16`，梁中点在 `hub/2`，臂端止于内收的桨毂，没有伸出轮廓。
  - 488 行桨叶装饰挂在该内收坐标上，z 取 `bodyD/2`。
- 双叶十字（`addRotorDecoration` 115–135 行）：
  - 128 行叶片几何体 `BoxGeometry(0.4·s, 0.055·s, 0.025)`；129–130 行 `bladeOne` 沿 X 轴；131–133 行 `bladeTwo` 用同几何体并 `rotation.z = Math.PI / 2`，与 `bladeOne` **垂直交叉**，俯视即成四叶十字观感。
  - 函数注释写的是 "one crossed blade pair"，几何实现与「桨毂 + 一对相对伸出叶片」的规格目标不一致。
- 云台吊舱（490–498 行）：`podY = -bodyH/2 - 0.05`，吊舱仅向下悬出 0.05，尺寸 0.26×0.2×0.18；镜头圆柱半径 0.08。默认视角下吊舱偏小、贴近机身下沿，与机身轮廓分离不足；标签按 566–576 行的 anchor/flank 规则布置，390 窄幅下容易贴近主体。
- 配置侧（`exploded-appearance.json`）：
  - 179 行 `bodySize [1.7, 1.15, 0.36]`；180 行无人机 `viewer.fitZoom = 1.16` 覆盖全局；全局 `viewer` 在 4–16 行（`fov 35`、`yaw 44.7`、`pitch 21.8`、`fitZoom 0.72`、`fitBodyHeightRatio 0.65`、`fitMargin 0.97`）。
  - 195 行 `drone-arm` 角色 `drone-arm`；196–200 行云台相关角色 `module/lens/sheet/motor`。
- 取景与标签（501–586 行）：包围盒投影八角取景（521–538 行），机身占高锚定 `fitBodyHeightRatio`（544–552 行），再乘商品 `fitZoom` 覆盖（556 行）；标签只挂 `depth<=1` 非 material 节点（565 行），侧别由 flank/anchor 决定。

### 6.2 截图目视核对（子代理观察）

- 1440 深色与 390 浅色两张默认态中，四个桨组都落在中央矩形板的角部内沿，机臂没有清晰外伸；俯视投影下桨组呈十字，叠上机身/模块矩形后接近板件堆叠。
- 390 浅色态「云台影像系统」标签贴近机身下沿与吊舱区域，窄幅下间隙偏小；1440 深色态吊舱镜头偏小、偏暗，与机身区分度有限。
- 两张截图主体未触底、未明显右裁，但本批只做目视，未重跑量测脚本。

### 6.3 可供主模型取舍的选项（均为小规格、通用角色内改动）

> 以下为自查建议，不是 Qoder 意见；最终是否采纳、采纳哪一档，由主模型结合规格与回归复核决定。

**必须改（识别度硬伤，对应规格第 2 节）**

1. **桨毂外伸**：把 481–482 行的桨毂坐标从 `bodyW/2 − 0.06`、`bodyH/2 − 0.08` 改为取机身轮廓**之外**的悬臂端点（外伸量按机身尺寸比例，可用角色参数或外观配置承载，不在组件里写 productId 分支）；机臂梁 483–487 行同步延伸到外伸桨毂，形成「机身—臂—桨毂」连续连接。
2. **双叶共轴**：把 129–133 行的两片垂直长条改为同一轴线上相对伸出的一对叶片（一根贯穿桨毂的横杠，或两瓣共线反向），去掉 `bladeTwo.rotation.z = π/2`；叶片可用简洁 taper/圆角，不引外部模型或新依赖。

**建议改（可读性/取景）**

3. **吊舱分离**：加大 492 行吊舱与机身的下置间隙，复核 493–497 行吊舱/镜头尺寸在默认视角下的可辨度；保证前置/下置吊舱与深色镜头不被机身矩形遮住。
4. **标签间隙**：复核云台标签侧别与引线在 390 窄幅下的落点，标签与主体轮廓保留明确间隙；空间不足时沿用既有标签上限与选中/详情兜底，不能隐藏当前选中项。
5. **取景联动**：桨毂外伸、吊舱下移后重跑包围盒取景（521–558 行），确认 1440×960 与 390×844 深浅两态四边留白 ≥8%、主体占高约 58–72%，不触底、不右裁、无横向溢出；无人机 `fitZoom=1.16` 是商品覆盖，不得改动全局默认机位、手机 `fitZoom=0.72` 或 round-7 透视参数。

**不建议本轮做（超出规格边界）**

- 不改 fixture/release/领域查询，不新增 BOM 节点，不暗示新的官方部件、材质或供应关系；
- 不做全站视觉改造，不动其他商品的角色几何；
- 不引入外部 3D 模型、新依赖或外部 AI；
- 不在核心组件加 productId/itemId 分支。

### 6.4 应测项（自查清单，非 Qoder 输出）

- 契约/单元：角色几何只由外观配置驱动；`drone-arm`、`drone-body`、`lens`/`module` 角色在改动后仍回退到既有默认；不产生新节点 ID。
- 截图复核：1440×960 深色/浅色默认态、390×844 深色/浅色默认态；云台相机选中深链与高亮；与上一批手机 1440/390 对照。
- 回归：WebGL 回退、减少动态、既有节点语义不回归；390 爆炸滑杆、重置、节点列表可操作；跑受影响的渲染/主线回归与静态包构建，全量浏览器回归留到总收尾。
- 量测：四边留白、主体占高、标签叠字/压主体、横向溢出，需复采生产版本截图复核，不能只看 dev 或量测数字。

## 7. 回执与产物路径（绝对路径）

- 审查文档：`D:\Global Chain\docs\reviews\2026-11-26-drone-quad-qoder-review.md`
- 回执目录：`D:\Global Chain\output\qa\overnight-2026-11-26\drone-quad-silhouette\qoder-review\`
  - `00-status-before.json` — 运行前登录状态快照
  - `00-list-models.txt` — 无可用模型告警原文
  - `01-prompt.md` — 提交给 Qoder 的完整只读审查提示词
  - `01-qoder-receipt.json` — 完整审查调用原始 JSON 回执（原始回执中的会话标识保留原样，正文不引用）
  - `01-stderr.log`、`01-run-meta.json` — 首次调用 stderr 与退出码/时间元数据
  - `02-probe-Qwen3.7-Plus.json` / `.stderr.log` — 显式模型探针回执
  - `02-probe-DeepSeek-V4-Flash.json` / `.stderr.log` — 显式模型探针回执
  - `03-minimal-probe.json` / `.stderr.log` — 无工具最小探针回执
  - `04-target-manifest.json` — 五个审查附件的相对路径、SHA256 与字节数
  - `05-cli-log-excerpt.txt` — 本机 CLI 日志中鉴权/模型/上传/失败的决定性摘录
  - `06-run-record.json` — 各次调用参数、会话、错误与恢复步骤汇总

## 8. 待主模型接续

- 本批 Qoder 审查停在账号授权 checkpoint；未对源码做任何修改。
- 账号登录状态与学生 Pro 权益归属由主模型后续另行处理，本批次不执行登录、兑换或权益操作。
- 授权恢复后重跑第 4 节步骤 3 的审查，把 Qoder 原建议补入本文第 5 节，并在取舍记录中区分 Qoder 建议、子代理自查与主模型决定。
- 规格落地、截图复采与验收停在主模型亲自看图；不覆盖公开 Qoder 站。
