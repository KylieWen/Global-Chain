import Link from "next/link";
import type { MapCountry, MapRecord } from "../lib/map-view-model";
import type { PageContext } from "../lib/context";
import { ledgerPath, materialObservationPath, nodePath, supplyChainPath } from "../lib/paths";

export function mapStatusLabel(status: string) {
  return ({ observed: "观测值", estimated: "估算", unknown: "未收录", withheld: "未披露", invalid: "不可用" } as Record<string, string>)[status] ?? status;
}

export function mapValue(value: number | null, status: string, unit: string | null, compact = false) {
  if (value === null || status === "unknown" || status === "withheld" || status === "invalid") return mapStatusLabel(status === "observed" ? "unknown" : status);
  return `${status === "estimated" ? "约 " : ""}${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: compact ? 1 : 8, ...(compact ? { notation: "compact" as const } : {}) }).format(value)}${unit ? ` ${unit}` : ""}`;
}

export function mapRecordTitle(record: MapRecord, countries: readonly MapCountry[]) {
  if (record.partnerScope === "world_total") return `${record.reporterName} · 世界${record.direction === "export" ? "出口" : "进口"}`;
  const countryName = (id: string | null) => countries.find(country => country.id === id)?.name ?? "未定位地区";
  return `${countryName(record.fromCountryId)} → ${countryName(record.toCountryId)}`;
}

export function mapEvidenceLabel(code: string | null) {
  return ({ representative: "代表性连接", role_supported: "国家角色", bilateral_supported: "双边证据", none: "待补证" } as Record<string, string>)[code ?? ""] ?? "路线连接";
}

export function mapMappingLabel(type: string | null) {
  return ({ exact: "", aggregate: "汇总分类", approximate: "近似分类", curated: "整理映射" } as Record<string, string>)[type ?? ""] ?? "";
}

export function MapRecordDetails({ record, countries, productId, context }: { record: MapRecord; countries: readonly MapCountry[]; productId: string; context: PageContext }) {
  const recordContext = { ...context, datasetVersion: record.datasetVersion ?? context.datasetVersion, contentVersion: record.contentVersion ?? context.contentVersion, period: record.periodLabel, label: record.periodLabel };
  const method = ({ official: "官方发布", curated: "人工整理", derived: "确定性计算", estimated: "估算", mock: "合成样例", inference: "有依据推断", scenario: "情景" } as Record<string, string>)[record.method] ?? record.method;
  const quantityAvailable = record.quantity !== null && record.unit && record.quantityDataStatus !== "unknown" && record.quantityDataStatus !== "withheld";
  const valueAvailable = record.value !== null && record.valueDataStatus !== "unknown" && record.valueDataStatus !== "withheld";
  return <section className="atlas-record-details" aria-labelledby="map-record-title" aria-live="polite">
    <div className="atlas-detail-heading"><h2 id="map-record-title">{mapRecordTitle(record, countries)}</h2><p>{record.itemName}{record.stageLabel ? ` · ${record.stageLabel}` : ""}</p></div>
    <div className="atlas-record-meta"><span>{record.periodLabel}</span>{record.kind === "supply-chain" ? <span>{mapEvidenceLabel(record.evidenceCode)}</span> : record.reporterName && record.partnerScope === "entity" ? <span>{record.reporterName}{record.direction === "export" ? "出口" : "进口"}报告</span> : null}</div>
    {record.classification && <p className="atlas-record-classification">{record.classification}{mapMappingLabel(record.classificationMappingType) ? ` · ${mapMappingLabel(record.classificationMappingType)}` : ""}</p>}
    {record.classificationLabel && <p className="atlas-classification-name">{record.classificationLabel}</p>}
    {(record.kind === "trade" || valueAvailable || quantityAvailable) && <dl className="atlas-values">
      {(record.kind === "trade" || valueAvailable) && <div><dt>贸易金额{record.valueDataStatus === "estimated" ? " · 估算" : ""}</dt><dd>{mapValue(record.value, record.valueDataStatus, record.currency)}</dd></div>}
      {quantityAvailable && <div><dt>数量{record.quantityDataStatus === "estimated" ? " · 估算" : ""}</dt><dd>{mapValue(record.quantity, record.quantityDataStatus, record.unit)}</dd></div>}
      {record.quantityDataStatus === "withheld" && <div><dt>数量</dt><dd>未披露</dd></div>}
    </dl>}
    {record.sources[0] && <p className="atlas-near-source">来源：{record.sources[0].url ? <a href={record.sources[0].url} target="_blank" rel="noreferrer">{record.sources[0].publisher} ↗</a> : record.sources[0].publisher}{record.sources.length > 1 ? ` 等 ${record.sources.length} 个` : ""}</p>}
    <details className="atlas-sources"><summary>资料与方法</summary>
      {record.sources.length > 0 && <ul>{record.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> : <strong>{source.name}</strong>}{source.publishedAt && <span>发布 {source.publishedAt}</span>}{source.retrievedAt && <span>获取 {source.retrievedAt}</span>}{source.license && <small>{source.license}</small>}</li>)}</ul>}
      <dl className="atlas-provenance"><div><dt>方法</dt><dd>{method}</dd></div>{record.datasetVersion && <div><dt>数据版本</dt><dd>{record.datasetVersion}</dd></div>}{record.contentVersion && <div><dt>路线版本</dt><dd>{record.contentVersion}</dd></div>}</dl>
      {record.kind === "supply-chain" && !valueAvailable && !quantityAvailable && <p>此连接未收录金额与数量。</p>}
      {record.notes && <p>{record.notes}</p>}
    </details>
    <div className="atlas-detail-actions">
      {record.recordKind === "material_trade" ? <Link className="text-link" href={materialObservationPath(productId, record.observationId, recordContext)}>材料统计详情 →</Link>
        : record.kind === "trade" && record.reporterId ? <Link className="text-link" href={ledgerPath(productId, record.reporterId, recordContext)}>报告国账本 →</Link> : <>
          {record.fromNodeId && <Link className="text-link" href={nodePath(productId, record.fromNodeId, recordContext)}>起点环节 →</Link>}
          {record.toNodeId && <Link className="text-link" href={nodePath(productId, record.toNodeId, recordContext)}>终点环节 →</Link>}
          <Link className="text-link" href={supplyChainPath(productId, record.itemId ?? undefined, recordContext)}>展开供应链 →</Link>
        </>}
    </div>
  </section>;
}
