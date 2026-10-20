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

### 多商品发布（2026-10）

目录和版本发现按 `releases/{productId}/{datasetVersion}` 扫描所有商品。原来的
`activate VERSION` 与单商品 `rollback` 保持可用；增加第二个正式商品后，可明确指定：

```bash
pnpm run data:release:list -- --product PRODUCT_ID
pnpm run data:release:activate -- VERSION --product PRODUCT_ID
pnpm run data:release:rollback -- --product PRODUCT_ID
pnpm run data:release:rollback -- VERSION --product PRODUCT_ID
```

激活仅替换目标商品的条目，其他商品保持在 active 清单中；新增商品追加条目。
每条 active fixture 分别记录 `datasetVersion` 和 `fixtureSha256`。旧清单中顶层的
`activeDatasetVersion`、`fixtureSha256`、`release` 继续表示最近选择的单个商品版本，
不表示所有商品具有相同版本。完整清单的版本与校验结果应读取 `fixtures` / `products`。

`verify` 总是核对全部 active 商品，不因 `--product` 缩小校验范围。它逐条核对目录、
商品与版本标识、immutable manifest、原始 fixture SHA-256、发布状态，以及不存在
`method: mock` 的记录。完整 Zod 契约、引用和事实语义仍由既有发布/契约测试验证；
该命令不取代 `pnpm run test`。任何商品损坏时，激活在写 active 指针前失败。

相同版本名出现在多个商品时，必须使用 `--product`；未指定版本的回滚只选择同一商品
中按数字自然排序较早的最近版本，不能把更高版本当作回滚。多商品清单的无参数回滚
要求选择商品，避免隐式改动另一个商品。

Web 的 `listPublishedReleaseEntries(productId?)` 返回商品、版本和 manifest 路径；
`listPublishedDatasetVersions(productId?)` 可按商品过滤，
`getPublishedReleaseManifestPath(version?, productId?)` 在版本名不唯一时要求商品范围。
路径选择拒绝绝对路径、目录穿越和指向根目录外的符号链接。这里只修改读取和管理机制，
没有新增或激活商品，也没有改写既有 immutable release。

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
