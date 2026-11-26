# 无人机外观参考实现 · 只读核对笔记（2026-11-26）

本轮只做源码/许可证层面的小步审阅，为后续 `generic-camera-drone` 外观实现提供约束。**未克隆、未复制任何代码或模型**；不引入 glb/gltf 导入、JSON 工程编辑等额外功能。

## 0. 访问情况与证据边界

- 直连 `github.com` / `api.github.com` / `raw.githubusercontent.com` 在本机超时；短链服务 `shturl.cc` 返回 502。
- 可读证据：通过 raw 镜像取到两个仓库的 `README.md`、FPV-Viewver 的 `package.json`、mechanism 的 `THIRD_PARTY.md`；仓库源码未通读，许可证判断以可读文件为准。
- 本项目无人机保持**通用四旋翼**：两个参考都不是 DJI Mini 5 Pro，不硬仿品牌型号、标识、涂装或标称参数。

## 1. FPV-Viewver（Aaa2122/FPV-Viewver，"FPV Studio"）

- 入口：http://www.shturl.cc/b1ae926a4af5c047d06ec133102cd1e0
- 仓库：https://github.com/Aaa2122/FPV-Viewver
- 技术栈（package.json / README）：React 18.3、Vite 5、Three.js 0.160、React Three Fiber 8.15、Drei 9.92、Tailwind 3.4。

### 许可证结论：未确认，按保留所有权利处理

- `main` / `master` 分支均未取到 LICENSE 文件；`package.json` 为 `"private": true`，**无 `license` 字段**；README 无许可证章节。
- 按 GitHub 默认条款，未声明开源许可即默认保留所有权利。**在许可证确认前，不复制其代码、场景组织方式以外的实现细节或内置模型；内置 2.25 MiB 模型的来源与许可在 README 中未披露，同样不可复用。**
- 任务附记：Sketchfab "DroneCore 2 Exploded" 为 CC BY-ND，仅可观看，禁止改作，不纳入本项目实现。

### 可借鉴的交互 / 架构规律（只取规律，不取代码）

1. **查看 / 编辑双模式分离**：View 模式只做检视（轨道、缩放、复位、聚焦动画），Edit 模式才允许打点、改名、改位置与规格；编辑快捷键在 View 模式禁用，防止误改。本项目只读展示，可沿用"检视态不可写"的边界思路。
2. **九部件分组对应装配角色**：爆炸动画按内置模型的具名分组展开；README 明确写出——爆炸视图是为内置模型的命名分组定制的，**导入的自定义模型不会自动获得爆炸分组**。对应到本项目：爆炸分组必须来自既有 BOM 角色映射，不能指望通用几何自动分件。
3. **部件清单 + 检视器**：可搜索的场景清单配合上下文部件检视卡（名称、描述、位置、规格），与本项目右栏节点列表 + 详情卡的既有结构一致。
4. **三维工作区懒加载**：可见加载态与错误态；按需渲染（demand-based rendering）、固定 devicePixelRatio，控制空闲 GPU 开销；生产模型从 29 MiB 压到 2.25 MiB。
5. **工程数据带校验**：浏览器内自动持久化；JSON 工程导入前先做 schema 校验，再导出。

### 明确不采用

- 本地 `.glb` / `.gltf` 文件导入（"Open model"）。
- JSON 工程编辑器、导入导出、浏览器工程持久化。
- 部件打点（pin）、3D 变换 gizmo、编辑快捷键（V/A/H/Delete/复制粘贴）。
- 自定义模型适配与为外部模型自动布局的任何预留。

## 2. mechanism（DiegoLopez0208/mechanism）

- 入口：http://www.shturl.cc/f04c83d8854e5c9ef884c2482aa82b94
- 仓库：https://github.com/DiegoLopez0208/mechanism
- 性质：面向编码代理的技能（Claude Code skill），Three.js 0.186、Node ≥22；流程为调研真实物体 → 写"每个数字都注明来源"的规格 → 闸门校验 → 输出影片 / 查看器 / 3D 文件 / 比例 SVG。

### 许可证结论：MIT（依据 README）

- README 许可证徽章与 "License: MIT" 章节均标明 MIT；`THIRD_PARTY.md` 列明 three.js / three-gpu-pathtracer / three-mesh-bvh（MIT）、Inter / Cormorant Garamond（SIL OFL 1.1）、音效采样（CC0）。
- 备注：本会话未能取回根目录 LICENSE 文本文件，MIT 判断以 README 声明为准；即便 MIT，本轮也只提炼建模纪律，不移植其脚本、零件库或闸门实现。

### 可借鉴的建模纪律（与本项目数据政策对齐）

1. **数字必须带来源与类别**。每个量按证据等级标注：
   - `SPEC`：可公开打开的来源（规格书、图纸、CAD）；
   - `USER`：请求方给定，照录不核验；
   - `MEASURED`：图/照片读数，写明方法与不确定度（是不确定度，不是公差）；
   - `DERIVED`：由其他数字算出，需第二来源交叉核对；
   - `ESTIMATED`：无人发布，虚线呈现并明说为估计。
2. **对不上的规格不渲染**：缺来源的数字、未交叉核对的派生值、未给不确定度的测量值、未说明理由的估计值，闸门拒绝通过；装配关系（齿轮中心距、传动比、点火顺序、密码测试向量等）与发布值不符即 `DOES NOT PASS`。
3. **核验结论分级**：`VERIFIED`（发布值全部对上，且至少一项检查独立于输入来源）、`CONSISTENT`（对上但无独立检查）、`NOTHING CHECKED`、`INCOMPLETE`、`DOES NOT PASS`；不把"一致"说成"已验证"。
4. **缺内部来源就估计并虚线**：没有图纸/照片的内部结构按估计处理；单张照片没有毫米量纲，需要发布尺寸、标尺或规格书。
5. **品牌只作识别**：标识用规则图形/文字绘制，不引入 logo 文件；未在公开来源出现的涂装按估计处理。产物明确标注"非制造图纸"：不含公差、配合、表面处理与材料规格。

### 明确不采用

- 代理技能打包、影片/MP4 渲染管线、STL/GLB 导出、工程比例 SVG 导出器。
- 其闸门脚本、运动学零件库（齿轮/密码机/曲柄滑块/魔方）、路径追踪渲染与视觉回归测试。
- 不为无人机复刻其任意一套示例物体（Enigma、魔方、K20A、RPi4 等）。

## 3. 对本项目后续无人机外观实现的约束（汇总）

- 沿用本项目既有口径：每个事实/关系带年份/期间、单位、来源、method、datasetVersion、状态；`unknown` 不等于 `0`；未披露/估算/真实为零必须可区分。mechanism 的证据类别标签可作为内部策展记录的分类参照，不引入其代码。
- 外观分件以本地 BOM（`data/research/drone-2026-11-26/` 既有备件表快照）为准；缺尺寸/材料/工序的件按估计或未知处理，不补默认值、不猜品牌型号。
- 界面保持只读检视：轨道/缩放/复位/选中详情即可，不做打点、编辑、工程文件导入导出。
- 模型资产全部程序化生成；不打包外部 glb/gltf，不引用 Sketchfab 等受限素材。
- 待真实 BOM 树与外观需求到位后再动工；本轮不改动源码、配置与 fixture。

## 来源 URL

- https://github.com/Aaa2122/FPV-Viewver （短链 http://www.shturl.cc/b1ae926a4af5c047d06ec133102cd1e0 ）
- https://raw.githubusercontent.com/Aaa2122/FPV-Viewver/main/README.md
- https://raw.githubusercontent.com/Aaa2122/FPV-Viewver/main/package.json
- https://github.com/DiegoLopez0208/mechanism （短链 http://www.shturl.cc/f04c83d8854e5c9ef884c2482aa82b94 ）
- https://raw.githubusercontent.com/DiegoLopez0208/mechanism/main/README.md
- https://raw.githubusercontent.com/DiegoLopez0208/mechanism/main/THIRD_PARTY.md
