// Read-only extraction for the DJI Mini spare-parts price page snapshot.
// No external dependencies; parses the server-rendered <table> grids and
// preserves original wording verbatim. Does not modify any other file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const rawPath = resolve(root, "data/research/drone-2026-11-26/raw/dji-support-zh-cn03400007809.html");
const outDir = resolve(root, "data/research/drone-2026-11-26/extracts");

const html = await readFile(rawPath, "utf8");
const sha256 = createHash("sha256").update(html).digest("hex");

const stripTags = (s) =>
  s.replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

// --- title / meta -----------------------------------------------------------
const title = (html.match(/<title>(.*?)<\/title>/) || [, ""])[1].trim();

// Split rendered tables (the window.__NUXT__ blob is unicode-escaped, so its
// angle brackets do not match this regex).
const tableRe = /<table[\s\S]*?<\/table>/g;
const tables = [...html.matchAll(tableRe)];

const modelRe = /(DJI Mini 5 Pro|DJI Mini 4K|DJI Mini 4 Pro|DJI Mini 3 Pro|DJI Mini 3|DJI Mini 2 SE|DJI Mini 2|DJI Mini SE|御 Mavic Mini)/g;

function modelBefore(offset) {
  const slice = html.slice(Math.max(0, offset - 1200), offset);
  const plain = stripTags(slice);
  const ms = [...plain.matchAll(modelRe)];
  return ms.length ? ms[ms.length - 1][1] : null;
}

function parseTable(tableHtml) {
  const rowRe = /<tr[\s\S]*?<\/tr>/g;
  const rows = [...tableHtml.matchAll(rowRe)].map((rm) => {
    const cellRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g;
    const cells = [...rm[0].matchAll(cellRe)].map((cm) => {
      const attrs = cm[1] || "";
      const rs = /rowspan="(\d+)"/.test(attrs) ? Number(/rowspan="(\d+)"/.exec(attrs)[1]) : 1;
      const cs = /colspan="(\d+)"/.test(attrs) ? Number(/colspan="(\d+)"/.exec(attrs)[1]) : 1;
      return { text: stripTags(cm[2]), rowspan: rs, colspan: cs };
    });
    return cells;
  });

  // Fill a grid respecting rowspan/colspan.
  const grid = [];
  const pending = new Map(); // col -> {text, rowsLeft}
  let maxCols = 0;
  for (const cells of rows) {
    const row = [];
    let col = 0;
    let ci = 0;
    while (ci < cells.length || pending.has(col)) {
      if (pending.has(col)) {
        const p = pending.get(col);
        row.push(p.text);
        p.rowsLeft -= 1;
        if (p.rowsLeft <= 0) pending.delete(col);
        col += 1;
        continue;
      }
      const cell = cells[ci];
      ci += 1;
      for (let c = 0; c < cell.colspan; c += 1) {
        row.push(cell.text);
        if (cell.rowspan > 1) pending.set(col + c, { text: cell.text, rowsLeft: cell.rowspan - 1 });
      }
      col += cell.colspan;
    }
    maxCols = Math.max(maxCols, row.length);
    grid.push(row);
  }
  return { grid, maxCols };
}

const result = {
  source: {
    url: "https://support.dji.com/help/content?customId=zh-cn03400007809&spaceId=34&re=CN&lang=zh-CN",
    pageTitle: title,
    rawSnapshot: "raw/dji-support-zh-cn03400007809.html",
    rawSha256: sha256,
    note: "Structures below are parsed from the server-rendered HTML tables; prices are DJI repair/quote prices in CNY for the named models, not generic drone facts.",
  },
  tables: [],
};

for (const tm of tables) {
  const model = modelBefore(tm.index);
  const { grid, maxCols } = parseTable(tm[0]);
  const header = grid[0] || [];
  const rows = [];
  let carriedCategory = null;
  for (const row of grid.slice(1)) {
    if (maxCols >= 3) {
      const [category, part, price] = row;
      if (category) carriedCategory = category;
      rows.push({ category: category || carriedCategory || null, partName: part || null, priceCNY: price || null });
    } else {
      const [part, price] = row;
      rows.push({ category: carriedCategory, partName: part || null, priceCNY: price || null });
    }
  }
  result.tables.push({ model, header, columnCount: maxCols, rowCount: rows.length, rows });
}

// Full plain text of the main article (before the footer product nav).
const bodyEnd = tables.length ? tables[tables.length - 1].index + tables[tables.length - 1][0].length : html.length;
const articleText = stripTags(html.slice(0, bodyEnd));

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "parts-tables.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
await writeFile(resolve(outDir, "article-text.txt"), articleText + "\n", "utf8");

// Console summary
let partCount = 0;
for (const t of result.tables) {
  const named = t.rows.filter((r) => r.partName);
  partCount += named.length;
  console.log(`${t.model || "(unknown)"} | cols=${t.columnCount} | rows=${named.length}`);
  for (const r of named) console.log(`  - [${r.category || "-"}] ${r.partName} | ${r.priceCNY || "-"}`);
}
console.log(`\nTOTAL named part rows: ${partCount}`);
console.log(`rawSha256=${sha256}`);
