#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const directory = resolve(root, "data/published/raw/phone-branches-2026-10-21");
const sources = [
  ["sem-audit-2023", "https://samsungsem.com/resources/file/cn/ir/archive/2023_Audit_Report.pdf", "pdf"],
  ["sem-camera-core", "https://samsungsem.com/global/product/module/camera-module/main-core-technology.do", "html"],
  ["zdt-manufacturing-2023", "https://www.zdtco.com/upload/2023_04_112/20230411173743hgo8215lb2.pdf", "pdf"],
  ["zdt-fpc", "https://www.zdtco.com/public/index.php/en/product/FPC", "html"],
  ["aac-annual-2023", "https://sitecms.aactechnologies.com/wp-content/uploads/2024/04/annual_report_2023_en.pdf", "pdf"],
  ["aac-sustainability-2024", "https://sitecms.aactechnologies.com/wp-content/uploads/2025/04/9-2024-Sustainability-Report.pdf", "pdf"],
  ["aac-precision", "https://www.aactechnologies.com/en/product/precisionProduct", "html"],
  ["sony-nagasaki-2023", "https://www.sony-semicon.com/ja/info/2023/2023122201.html", "html"],
  ["tsmc-annual-2025", "https://investor.tsmc.com/static/annualReports/2025/english/index.html", "html"],
  ["china-smartphone-2023", "https://gxt.fujian.gov.cn/zwgk/xw/hydt/xydt/202401/t20240131_6389540.htm", "html"],
  ["sdi-electrode-process-2024", "https://news.samsungsdi.com/global/click?seq=196", "html"],
  ["sdi-production-network", "https://samsungsdi.com/about-sdi/global-network.html", "html"],
  ["btr-anode", "https://www.btrchina.com/Negativebusiness2/index.aspx", "html"],
  ["easpring-cathode", "https://www.easpring.com.cn/gywm/index.htm", "html"],
  ["desay-annual-2023", "https://static.cninfo.com.cn/finalpage/2024-03-26/1219405449.PDF", "pdf"],
  ["apple-market-2023", "https://www.apple.com/newsroom/2023/09/apple-debuts-iphone-15-and-iphone-15-plus/", "html"],
  ["vietnam-assembly-2024", "https://news.samsung.com/vn/nha-may-samsung-electronics-viet-nam-thai-nguyen-can-moc-1-ty-san-pham-dien-thoai", "html"],
  ["india-manufacturing-2023", "https://static.pib.gov.in/WriteReadData/specificdocs/documents/2023/apr/doc2023428189611.pdf", "pdf"],
  ["aac-annual-2023-hkex", "https://www.hkexnews.hk/listedco/listconews/sehk/2024/0425/2024042500820.pdf", "pdf"],
  ["easpring-annual-2023", "https://static.cninfo.com.cn/finalpage/2024-03-30/1219468325.PDF", "pdf"],
  ["eurocircuits-pcb-process", "https://www.eurocircuits.com/technical-guidelines/pcb-manufacturing-technology/making-a-pcb-pcb-manufacture-step-by-step/", "html"],
  ["avary-annual-2023", "https://www.avaryholding.com/upload/file/2024-04-02/2024051.pdf", "pdf"]
];

await mkdir(directory, { recursive: true });
async function capture([key, url, extension]) {
  const path = resolve(directory, `${key}.${extension}`);
  const metadataPath = resolve(directory, `${key}.json`);
  try {
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const bytes = await readFile(path);
    if (metadata.sha256 !== createHash("sha256").update(bytes).digest("hex")) throw new Error(`Existing snapshot hash mismatch: ${key}`);
    return { key, status: "retained", bytes: bytes.length };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { "User-Agent": "GlobeChain-research/0.1 (public-source snapshot; local review)" } });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${key}`);
  if (extension === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Not a PDF: ${key}`);
  if (bytes.length < 500 || bytes.length > 30000000) throw new Error(`Unexpected source size: ${key}`);
  const metadata = { schemaVersion: "public-source-file-snapshot.v1", key, url, finalUrl: response.url, retrievedAt: new Date().toISOString(), httpStatus: response.status, contentType: response.headers.get("content-type"), sha256: createHash("sha256").update(bytes).digest("hex"), file: `${key}.${extension}`, license: "Publisher terms apply; preserved for local evidence review, link and limited summaries in public product." };
  await writeFile(path, bytes, { flag: "wx" });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
  return { key, status: "captured", bytes: bytes.length, sha256: metadata.sha256 };
}

const onlyArgument = process.argv.slice(2).find((arg) => arg.startsWith("--only="));
const only = onlyArgument ? new Set(onlyArgument.slice(7).split(",")) : null;
if (only && [...only].some((key) => !sources.some((source) => source[0] === key))) throw new Error("Unknown source key in --only");
const selectedSources = only ? sources.filter((source) => only.has(source[0])) : sources;
const results = [];
for (let index = 0; index < selectedSources.length; index += 3) {
  const batch = await Promise.allSettled(selectedSources.slice(index, index + 3).map(capture));
  for (let offset = 0; offset < batch.length; offset++) {
    const result = batch[offset];
    const entry = result.status === "fulfilled" ? result.value : { key: selectedSources[index + offset][0], status: "unfilled", error: result.reason.message };
    results.push(entry);
    console.log(JSON.stringify(entry));
  }
}
if (results.some((result) => result.status === "unfilled")) process.exitCode = 1;
