import { useState } from "react";
import type { CountryLedgerView, MaterialTradeObservationView } from "@globe-chain/domain";
import { dataMethodLabel } from "../components/data-display";
import { mapValue } from "../components/map-record-details";
import { itemLabel } from "../lib/item-label";
import { ledgerPath, mapPath } from "../lib/paths";
import Link from "./navigation";
import "./country-ledger.css";

type LedgerRow = {
  id: string;
  observation: CountryLedgerView["tradeObservations"][number] | MaterialTradeObservationView["observation"];
  item: MaterialTradeObservationView["item"];
  partner: MaterialTradeObservationView["partner"];
  partnerScope: CountryLedgerView["resolvedTradeObservations"][number]["partnerScope"] | MaterialTradeObservationView["partnerScope"];
  direction: "import" | "export";
  valueDataStatus: CountryLedgerView["resolvedTradeObservations"][number]["valueDataStatus"];
  source: MaterialTradeObservationView["source"];
  requestUrl?: unknown;
};

function requestUrlFromNotes(notes?: string | null): unknown {
  if (!notes) return undefined;
  try {
    return JSON.parse(notes)?.requestUrl;
  } catch {
    return undefined;
  }
}

function externalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return undefined;
  }
}

function ledgerRows(ledger: CountryLedgerView, materials: readonly MaterialTradeObservationView[]) {
  const productRows = ledger.resolvedTradeObservations.map(({ observation, item, partner, partnerScope, source, valueDataStatus }): LedgerRow => ({
    id: `trade:${observation.id}`, observation, item, partner, partnerScope, source, valueDataStatus,
    direction: observation.direction, requestUrl: requestUrlFromNotes(observation.qualityNote)
  }));
  const materialRows = materials.map(({ observation, item, partner, partnerScope, source }): LedgerRow => ({
    id: `material:${observation.observationId}`, observation, item, partner, partnerScope, source,
    direction: observation.flow, valueDataStatus: observation.valueDataStatus, requestUrl: observation.quality.requestUrl
  }));

  const seen = new Set<string>();
  return [...productRows, ...materialRows].filter(row => {
    const { observation: record, partnerScope, direction, source, valueDataStatus } = row;
    // Preserve different reports and classifications. Remove only repetitions of the same published fact.
    const fingerprint = JSON.stringify([
      row.item?.id, record.reporterEntityId, record.reporterCode, record.partnerEntityId, record.partnerCode, partnerScope,
      record.period.start, record.period.end, record.period.granularity, direction,
      record.classificationSystem, record.classificationVersion, record.classificationCode,
      record.currency, record.value, valueDataStatus, record.quantity, record.unit, record.quantityDataStatus,
      record.method, record.datasetVersionId, source?.id, row.requestUrl
    ]);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  }).sort((a, b) => b.observation.period.end.localeCompare(a.observation.period.end) ||
    Number(b.item?.id === ledger.product.id) - Number(a.item?.id === ledger.product.id) ||
    itemLabel(a.item).localeCompare(itemLabel(b.item), "zh-CN") ||
    (a.partner?.name ?? "").localeCompare(b.partner?.name ?? "", "zh-CN") ||
    a.direction.localeCompare(b.direction) ||
    a.observation.classificationCode.localeCompare(b.observation.classificationCode));
}

function LedgerEntry({ row, ledger }: { row: LedgerRow; ledger: CountryLedgerView }) {
  const { observation: record, item, partner, partnerScope, direction, valueDataStatus, source } = row;
  const directionLabel = direction === "export" ? "出口" : "进口";
  const scope = partnerScope === "world_total" ? "world" : partnerScope === "entity" && partner ? "bilateral" : undefined;
  const mapHref = item && scope ? mapPath({
    product: ledger.product.id, items: item.id, country: ledger.entity.id, layer: "trade",
    year: record.period.label, direction, scope, currency: record.currency ?? undefined
  }) : undefined;
  const sourceUrl = externalUrl(row.requestUrl) ?? externalUrl(source?.url);
  const sourceName = source?.name ?? "来源未收录";

  return <li className="competition-ledger-row">
    <div><strong>{itemLabel(item)}</strong><span>{record.classificationSystem} {record.classificationVersion} · {record.classificationCode}</span></div>
    <div>
      <strong>{scope === "world" ? "世界总计" : partner?.name ?? "未指定贸易伙伴"}</strong>
      <span>{directionLabel} · {record.period.label}</span>
    </div>
    <div className="competition-ledger-amount">
      <strong>{mapValue(record.value ?? null, valueDataStatus, record.currency ?? null)}</strong>
      <span>{dataMethodLabel(record.method)}</span>
    </div>
    <div className="competition-ledger-links">
      {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName} ↗</a> : <span>{sourceName}</span>}
      {mapHref && <Link href={mapHref}>在地图中查看 →</Link>}
    </div>
  </li>;
}

export function CountryLedger({ ledger, materials, initialItem, initialYear }: {
  ledger: CountryLedgerView;
  materials: readonly MaterialTradeObservationView[];
  initialItem?: string;
  initialYear?: string;
}) {
  const rows = ledgerRows(ledger, materials);
  const items = new Map(rows.flatMap(row => row.item ? [[row.item.id, itemLabel(row.item)] as const] : []));
  const years = [...new Set(rows.map(row => row.observation.period.label))];
  const [item, setItem] = useState(initialItem && items.has(initialItem) ? initialItem : "");
  const [year, setYear] = useState(initialYear && years.includes(initialYear) ? initialYear : "");
  const visibleRows = rows.filter(row => (!item || item === row.item?.id) && (!year || year === row.observation.period.label));
  const groups = [
    { title: "双边贸易", rows: visibleRows.filter(row => row.partnerScope === "entity" && row.partner) },
    { title: "世界总计", rows: visibleRows.filter(row => row.partnerScope === "world_total") },
    { title: "未指定贸易伙伴", rows: visibleRows.filter(row => row.partnerScope !== "world_total" && (row.partnerScope !== "entity" || !row.partner)) }
  ];

  return <section className="competition-card competition-ledger" aria-labelledby="competition-ledger-heading">
    <header className="competition-ledger-heading">
      <div><h2 id="competition-ledger-heading">报告国账本</h2><p>{ledger.entity.name} · {itemLabel(ledger.product)}</p></div>
      <small>数据版本 {ledger.datasetVersion.version}</small>
    </header>
    {rows.length > 0 ? <>
      <div className="competition-ledger-filters">
        <label>统计物品<select value={item} onChange={event => setItem(event.target.value)}>
          <option value="">全部物品</option>
          {[...items].map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select></label>
        <label>报告年份<select value={year} onChange={event => setYear(event.target.value)}>
          <option value="">全部年份</option>
          {years.map(label => <option value={label} key={label}>{label}</option>)}
        </select></label>
        <span aria-live="polite">{visibleRows.length} 条记录</span>
      </div>
      {groups.filter(group => group.rows.length).map(group => <section key={group.title} className="competition-ledger-group">
        <h3>{group.title}</h3>
        <ul>{group.rows.map(row => <LedgerEntry key={row.id} row={row} ledger={ledger} />)}</ul>
      </section>)}
      {!visibleRows.length && <p>当前物品和年份组合未收录贸易记录。</p>}
    </> : <p>当前快照未收录{ledger.entity.name}报告的贸易记录。</p>}
  </section>;
}

export function MaterialLedgerLink({ product, material }: { product: string; material: MaterialTradeObservationView }) {
  if (!material.reporter) return null;
  const context = { focus: material.item?.id, label: material.observation.period.label };
  return <Link href={ledgerPath(product, material.reporter.id, context)}>{material.reporter.name}报告国账本 →</Link>;
}
