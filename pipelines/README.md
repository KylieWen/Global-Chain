# 当前数据处理与未来管线

本目录是自动化管线占位，当前以脚本 + 不可变 release 替代自动化管线；没有调度服务、Polars 或 DuckDB。

| 阶段 | 当前实现 |
| --- | --- |
| raw | scripts/fetch-published-sources.mjs、fetch-material-*.mjs；fetch-all-published-sources.mjs 统一入口，保存本地来源快照 |
| staging | 构建脚本内读取与筛选；没有独立持久化 staging 作业 |
| normalized | scripts/build-published-smartphone.mjs 标准化国家、分类、期间、单位，并结合 content 配置 |
| validated | 同一构建脚本与 contracts / tests 执行契约、引用、状态与证据校验 |
| published | 构建生成新 release；manage-published-release.mjs 校验与指针切换，旧 release 保留 |

实际发布位于 data/published/releases，active-manifest.json 指向当前版本。pipelines/data 下的目录是规划结构，不是已运行的生产流水线。原始来源、获取时间、转换步骤、校验结果和版本保留在快照与清单中。本轮未抓新数据或更改任何发布快照。
