# 演示运行卡

## 启动

在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm run data:release:verify
pnpm run build
pnpm run start
```

访问 http://localhost:3000/。必须等构建成功后启动。普通模式只读 published，勿在录制前重建数据。

## 演示顺序

首页 → /map（点击国家）→ /products/generic-smartphone（拆解树）→ 电池供应链 → 国家账本 → 来源与版本 → /trade-guide（延伸方向）。/demo 提供可点击入口。

幻灯片打开 deck/index.html，左右键翻页，F 全屏；旁白见 deck/deck-script.md。安装依赖与构建后可断开外网演示，官方来源链接需网络。视频必须由所有者重新录制并上传。

## 重新生成素材

保持生产服务运行，另一个终端在根目录执行：

```sh
node scripts/capture-deck-screenshots.mjs
node scripts/verify-deck.mjs
```

默认使用本机 Chrome；可用 DECK_BROWSER_PATH 指定 Chrome/Edge 完整路径。输出目录、截图来源和打印步骤见 deck/HANDOFF.md。
