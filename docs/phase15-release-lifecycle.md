# 第 15 阶段：发布管线与版本生命周期

## 发布目录

Published fixture 不再只存在于一个会被覆盖的固定路径。每个发布版本保存在：

```text
data/published/releases/{productId}/{datasetVersion}/
  fixture.json
  manifest.json
```

`data/published/active-manifest.json` 是当前 active 指针；兼容性的
`data/published/manifest.json` 与 active 指针保持一致。Web 默认读取 active manifest，
历史 release 仍可直接交给 fixture loader 审计。

## 命令

```bash
pnpm run data:fetch:all
pnpm run data:build:smartphone
pnpm run data:release:list
pnpm run data:release:verify
pnpm run data:release:activate -- globe-chain-smartphone-2023.4
pnpm run data:release:rollback
```

`data:rebuild:smartphone` 统一执行主数据和三类材料快照抓取，再构建发布版本。
raw 快照和 release fixture 默认不可覆盖；来源批次变化必须显式使用 `--replace`，并应
配合新的数据集版本发布。构建脚本发现同一版本已有不同 fixture 字节时直接失败。

## CI

`.github/workflows/ci.yml` 在 push 和 pull request 上执行 frozen install、active release
校验、lint、typecheck、test 和 production build。CI 不抓取外部 API，也不改变 active 指针。

## 回滚边界

回滚只切换 active manifest，不删除或覆盖任何历史 release。回滚后的页面和研究导出会
完整使用目标 release 的数据集版本；路线内容版本仍由该 release 自身记录。真正的数据
修订必须创建新版本，不能通过回滚命令覆盖历史文件。
