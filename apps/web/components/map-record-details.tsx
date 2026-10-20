import Link from "next/link";
import type { MapCountry, MapLine } from "../lib/map-view-model";
import type { PageContext } from "../lib/context";
import { ledgerPath, nodePath, supplyChainPath } from "../lib/paths";

export function mapStatusLabel(status: string) {
  return ({ observed: "已观测", estimated: "估算", unknown: "未知 / 未提供", withheld: "未披露", invalid: "不可用" } as Record<string, string>)[status] ?? status;
}

export function mapValue(value: number | null, status: string, unit: string | null, compact = false) {
  if (value === null || status === "unknown" || status === "withheld" || status === "invalid") return mapStatusLabel(status === "observed" ? "unknown" : status);
  return `${status === "estimated" ? "约 " : ""}${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: compact ? 1 : 8, ...(compact ? { notation: "compact" as const } : {}) }).format(value)}${unit ? ` ${unit}` : ""}`;
}

export function MapRecordDetails({ line, countries, productId, context }: { line: MapLine; countries: readonly MapCountry[]; productId: string; context: PageContext }) {
  const from = countries.find(country => country.id === line.fromCountryId);
  const to = countries.find(country => country.id === line.toCountryId);
  const recordContext = { ...context, datasetVersion: line.datasetVersion, contentVersion: line.contentVersion ?? context.contentVersion, period: line.periodLabel, label: line.periodLabel };
  const method = ({ official: "官方发布", curated: "人工整理", derived: "确定性计算", estimated: "估算", mock: "合成样例" } as Record<string, string>)[line.method] ?? line.method;
  return <section className="atlas-record-details" aria-labelledby="map-record-title" aria-live="polite">
    <div className="atlas-detail-heading"><div><span className="eyebrow">{line.kind === "trade" ? "单条统计观察" : "单条路线连接"}</span><h2 id="map-record-title">{from?.name} → {to?.name}</h2><p>{line.itemName}{line.stageLabel ? ` · ${line.stageLabel}` : ""}</p></div><span className={`atlas-evidence-tag atlas-evidence-${line.kind}`}>{line.evidenceLabel}</span></div>
    <p className="atlas-evidence-description">{line.evidenceDescription}</p>
    {line.notes && <p className="atlas-record-notes">{line.notes}</p>}
    <dl className="atlas-detail-grid">
      <div><dt>期间</dt><dd>{line.periodLabel}</dd></div>
      {line.reporterName && <div><dt>报告方与方向</dt><dd>{line.reporterName} · {line.direction === "export" ? "出口" : "进口"}报告</dd></div>}
      {line.classification && <div><dt>商品分类</dt><dd>{line.classification}</dd></div>}
      <div><dt>金额 · {mapStatusLabel(line.valueDataStatus)}</dt><dd>{mapValue(line.value, line.valueDataStatus, line.currency)}</dd></div>
      <div><dt>数量 · {mapStatusLabel(line.quantityDataStatus)}</dt><dd>{mapValue(line.quantity, line.quantityDataStatus, line.unit)}</dd></div>
      <div><dt>方法</dt><dd>{method} <small>({line.method})</small></dd></div>
      <div><dt>数据集版本</dt><dd>{line.datasetVersion}</dd></div>
      {line.kind === "supply-chain" && <div><dt>内容版本</dt><dd>{line.contentVersion ?? "未提供"}</dd></div>}
    </dl>
    <details className="atlas-sources" open><summary>来源与获取时间 · {line.sources.length}</summary>{line.sources.length ? <ul>{line.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> : <strong>{source.name}</strong>}<span>{source.publisher} · 发布 {source.publishedAt ?? "未提供"} · 获取 {source.retrievedAt ?? "未提供"}</span><small>{source.license ?? "许可信息未提供"}</small></li>)}</ul> : <p>当前记录没有可解析的来源，请查看证据缺口。</p>}</details>
    <div className="atlas-detail-actions">
      {line.kind === "trade" && line.reporterId ? <Link className="button button-secondary" href={ledgerPath(productId, line.reporterId, recordContext)}>报告国账本 →</Link> : <>
        {line.fromNodeId && <Link className="button button-secondary" href={nodePath(productId, line.fromNodeId, recordContext)}>起点节点与证据 →</Link>}
        {line.toNodeId && <Link className="button button-secondary" href={nodePath(productId, line.toNodeId, recordContext)}>终点节点与证据 →</Link>}
        <Link className="text-link" href={supplyChainPath(productId, undefined, recordContext)}>完整供应链 →</Link>
      </>}
    </div>
  </section>;
}
