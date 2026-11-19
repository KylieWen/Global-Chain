import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
// Use the installed bundler from this workspace's Vite toolchain.
const viteRequire = createRequire(createRequire(require.resolve("vitest/package.json")).resolve("vite/package.json"));
const { build } = viteRequire("esbuild");
const output = resolve(root, "tmp/qoder-competition-web");
const published = resolve(root, "data/published");
const manifest = JSON.parse(await readFile(resolve(published, "manifest.json"), "utf8"));
const fixtures = await Promise.all(manifest.fixtures.map(async entry => {
  const path = resolve(published, entry.path);
  if (!path.startsWith(published + sep) || !entry.fixtureSha256) throw new Error("Invalid published fixture entry");
  const bytes = await readFile(path);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.fixtureSha256) throw new Error("Fixture checksum mismatch: " + entry.productId);
  const fixture = JSON.parse(bytes.toString("utf8"));
  if (fixture.productId !== entry.productId || fixture.datasetVersion.version !== entry.datasetVersion || fixture.datasetVersion.status !== "published") throw new Error("Fixture identity mismatch: " + entry.productId);
  return fixture;
}));

await mkdir(output, { recursive: true });
const navigation = resolve(root, "apps/web/competition/navigation.tsx");
await build({
  absWorkingDir: root,
  entryPoints: ["apps/web/competition/main.tsx"],
  outfile: resolve(output, "preview.js"),
  bundle: true,
  minify: true,
  jsx: "automatic",
  platform: "browser",
  alias: { "next/link": navigation, "next/navigation": navigation },
  define: { "process.env.NODE_ENV": '"production"' }
});
await writeFile(resolve(output, "fixtures.json"), JSON.stringify(fixtures));
await writeFile(resolve(output, "index.html"), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="在地图上比较商品与上下游贸易流，查看统计金额、数量与来源">
<title>Global Chain · 全球贸易地图</title><link rel="stylesheet" href="/preview.css"></head>
<body><div id="root"><main class="competition-card"><h1>Global Chain</h1><p>正在加载贸易地图…</p></main></div><script src="/preview.js" defer></script></body></html>
`);
console.log(`Built ${fixtures.length} published snapshots to ${output}`);
