/**
 * 零依赖静态服务：把 build-qoder-preview.mjs 产出的独立静态壳跑在本地独立端口，
 * 供公开验收探针在不启动 Next 服务、不影响 4320 生产实例的情况下复验。
 *
 * Usage:
 *   node scripts/serve-qoder-preview.mjs            # 默认 127.0.0.1:4322
 *   PREVIEW_PORT=4323 node scripts/serve-qoder-preview.mjs
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "tmp", "qoder-competition-web");
const port = Number(process.env.PREVIEW_PORT ?? 4322);
const host = process.env.PREVIEW_HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    let filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      // SPA 回退：无扩展名的客户端路由交给 index 壳，由前端路由渲染。
      filePath = join(root, "index.html");
    }
    response.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500).end(String(error?.message ?? error));
  }
});

server.listen(port, host, () => {
  console.log(`Qoder preview static shell: http://${host}:${port}/ (root ${root})`);
});
