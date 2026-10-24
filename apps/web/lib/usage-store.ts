import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { UsageEntry } from "./usage-events";

type Day = { schemaVersion: 1; day: string; counts: Record<string, number> };
let queue = Promise.resolve();
export function saveUsage(directory: string, events: UsageEntry[], now = new Date()): Promise<void> {
  const task = queue.then(async () => {
    const root = resolve(directory);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const day = now.toISOString().slice(0, 10);
    const file = resolve(root, day + ".json");
    let summary: Day = { schemaVersion: 1, day, counts: {} };
    try { summary = JSON.parse(await readFile(file, "utf8")) as Day; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    for (const row of events) {
      const key = `${row.page}|${row.device}|${row.event}`;
      summary.counts[key] = Math.min(Number.MAX_SAFE_INTEGER, (summary.counts[key] ?? 0) + 1);
    }
    const temp = file + ".tmp";
    await writeFile(temp, JSON.stringify(summary) + "\n", { mode: 0o600 });
    await rename(temp, file);
    const cutoff = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    for (const name of await readdir(root)) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) < cutoff) await unlink(resolve(root, name));
    }
  });
  queue = task.catch(() => undefined);
  return task;
}
