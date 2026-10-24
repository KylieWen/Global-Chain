import { parseUsageBatch } from "../../../lib/usage-events";
import { saveUsage } from "../../../lib/usage-store";
export const runtime = "nodejs";
let windowStart = 0;
let windowEvents = 0;
const empty = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const directory = process.env.GLOBECHAIN_USAGE_DIR;
  if (!directory) return empty(204);
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== request.headers.get("host")) return empty(403); }
  catch { return empty(403); }
  if (request.headers.get("sec-fetch-site") === "cross-site") return empty(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return empty(415);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return empty(413);
  const reader = request.body?.getReader();
  if (!reader) return empty(400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); return empty(413); }
      chunks.push(value);
    }
    let json: unknown;
    try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return empty(400); }
    const events = parseUsageBatch(json);
    if (!events) return empty(400);
    const now = Date.now();
    if (now - windowStart >= 60000) { windowStart = now; windowEvents = 0; }
    if (windowEvents + events.length > 600) return empty(429);
    windowEvents += events.length;
    await saveUsage(directory, events);
    return empty(204);
  } catch { return empty(503); }
}
