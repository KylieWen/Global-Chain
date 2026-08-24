import type { ReactNode } from "react";
import type {
  DatasetVersion,
  Evidence,
  FactStatus,
  Source
} from "@globe-chain/contracts";
import type { ProvenanceView } from "@globe-chain/domain";

/**
 * The published-data query layer may expose a resolved indicator definition
 * alongside the raw observations.  Keeping this view structural and optional
 * lets the shared component remain compatible with older fixtures and with
 * pages that only have the original ProvenanceView fields.
 */
type IndicatorDefinitionLike = {
  readonly key?: string;
  readonly indicator?: string;
  readonly label?: string | null;
  readonly shortLabel?: string | null;
  readonly description?: string | null;
  readonly category?: string | null;
  readonly displayOrder?: number | null;
  readonly displayUnit?: string | null;
  readonly displayCurrency?: string | null;
  readonly valueMeaning?: string | null;
  readonly sourceIndicatorCode?: string | null;
  readonly statisticalConcept?: string | null;
  readonly formula?: string | null;
  readonly method?: string | null;
  readonly dataStatus?: FactStatus | null;
  readonly datasetVersionId?: string | null;
  readonly source?: Source | null;
  readonly sourceIds?: readonly string[];
};

type ProvenancePanelView = Pick<
  ProvenanceView,
  "datasetVersion" | "sources" | "evidence" | "warnings"
> & {
  readonly indicatorDefinitions?: readonly IndicatorDefinitionLike[];
  readonly missingDataNotes?: readonly string[];
};

const statusLabels: Record<FactStatus, string> = {
  observed: "已观测",
  estimated: "估算",
  unknown: "未知",
  withheld: "未披露",
  invalid: "无效"
};

const statusDescriptions: Record<FactStatus, string> = {
  observed: "来源中有可用观测值",
  estimated: "数值经过估算或来源标记为估算",
  unknown: "当前数据没有可用观察，不能解释为零",
  withheld: "来源明确未披露数值",
  invalid: "数值未通过数据质量校验，不应作为事实使用"
};

export function StatusBadge({
  status,
  method
}: {
  status: FactStatus;
  method?: string;
}) {
  return (
    <span
      className={`status-badge status-${status}`}
      title={statusDescriptions[status]}
      aria-label={`数据状态：${statusLabels[status]}`}
    >
      {statusLabels[status]}
      {method === "mock" ? " · mock" : method ? ` · ${method}` : ""}
    </span>
  );
}

/** A compact, reusable explanation of the status vocabulary used by facts. */
export function StatusLegend() {
  return (
    <div className="status-legend" aria-label="数据状态说明">
      {(Object.keys(statusLabels) as FactStatus[]).map((status) => (
        <span className="status-legend-item" key={status}>
          <StatusBadge status={status} />
          <small>{statusDescriptions[status]}</small>
        </span>
      ))}
    </div>
  );
}

export function PublicationBadge({ status }: { status: DatasetVersion["status"] }) {
  const labels: Record<DatasetVersion["status"], string> = {
    draft: "draft",
    validated: "validated",
    published: "published",
    deprecated: "deprecated"
  };
  return <span className={`publication-badge publication-${status}`}>{labels[status]}</span>;
}

export function PeriodLabel({
  period
}: {
  period: { label: string; granularity: string; start: string; end: string };
}) {
  return (
    <span className="period-label" title={`${period.start} → ${period.end}`}>
      {period.label} · {period.granularity}
    </span>
  );
}

export function UnknownValue({
  label = "未知",
  title = "当前没有可用观察；不等于真实为零"
}: {
  label?: string;
  title?: string;
}) {
  return <span className="unknown-value" title={title}>{label}</span>;
}

export function ValueDisplay({
  value,
  status,
  currency,
  unit
}: {
  value?: number | null;
  status: FactStatus;
  currency?: string | null;
  unit?: string | null;
}) {
  if (status === "unknown") return <UnknownValue />;
  if (status === "withheld") return <UnknownValue label="未披露" />;
  if (status === "invalid") {
    const suffix = [currency, unit].filter(
      (part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index
    ).join(" · ");
    return value === null || value === undefined ? (
      <UnknownValue label="无效" />
    ) : (
      <span className="invalid-value" title={statusDescriptions.invalid}>
        {value.toLocaleString("zh-CN")}{suffix ? ` ${suffix}` : ""} · 无效
      </span>
    );
  }
  if (status === "estimated" && (value === null || value === undefined)) {
    return (
      <UnknownValue
        label="估算值未作为精确值发布"
        title="来源标记为估算，当前不发布精确数值"
      />
    );
  }
  if (value === null || value === undefined) return <UnknownValue />;
  const suffix = [currency, unit].filter(
    (part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index
  ).join(" · ");
  const isObservedZero = status === "observed" && value === 0;
  return (
    <span
      className={[
        status === "estimated" ? "estimated-value" : "",
        isObservedZero ? "zero-value" : ""
      ].filter(Boolean).join(" ") || undefined}
      title={isObservedZero ? "来源明确观测为零；这不是缺失数据" : undefined}
    >
      {value.toLocaleString("zh-CN")}{suffix ? ` ${suffix}` : ""}
      {status === "estimated" ? " · 估算" : ""}
      {isObservedZero ? " · 真实为零" : ""}
    </span>
  );
}

export function MetadataItem({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="metadata-item">
      <span className="metadata-label">{label}</span>
      <span className="metadata-value">{value}</span>
    </span>
  );
}

/**
 * Renders all source metadata in one place so provenance pages do not need to
 * duplicate URL, licence, retrieval, and source-version formatting.
 */
export function SourceMetadata({
  source
}: {
  source: Source;
}) {
  return (
    <dl className="source-metadata">
      <div>
        <dt>URL</dt>
        <dd>
          {source.url ? (
            <a
              className="source-url"
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.url}
            >
              {source.url}
            </a>
          ) : <UnknownValue label="未提供" />}
        </dd>
      </div>
      <div>
        <dt>许可证</dt>
        <dd>{source.license ?? <UnknownValue label="未提供" />}</dd>
      </div>
      <div>
        <dt>获取时间</dt>
        <dd>{source.retrievedAt ?? <UnknownValue label="未提供" />}</dd>
      </div>
      <div>
        <dt>来源数据版本</dt>
        <dd>{source.datasetVersion ?? <UnknownValue label="未提供" />}</dd>
      </div>
      {source.publishedAt ? (
        <div>
          <dt>来源发布日期</dt>
          <dd>{source.publishedAt}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function WarningList({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  return (
    <aside className="warning-panel" aria-label="数据限制说明">
      <strong>阅读提示</strong>
      <ul>
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </aside>
  );
}

export function ProvenancePanel({ provenance }: { provenance: ProvenancePanelView }) {
  const indicatorDefinitions = [...(provenance.indicatorDefinitions ?? [])].sort(
    (left, right) => {
      return (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.displayOrder ?? Number.MAX_SAFE_INTEGER);
    }
  );
  const missingDataNotes = provenance.missingDataNotes ?? [];
  return (
    <section className="provenance-panel" aria-labelledby="provenance-title">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">可追溯性</p>
          <h2 id="provenance-title">来源与版本</h2>
        </div>
        <PublicationBadge status={provenance.datasetVersion.status} />
      </div>
      <div className="provenance-meta">
        <span>数据集：{provenance.datasetVersion.name}</span>
        <span>版本：{provenance.datasetVersion.version}</span>
        <span>来源：{provenance.sources.length} 个</span>
        <span>证据：{provenance.evidence.length} 条</span>
      </div>
      <div className="provenance-grid">
        <SourceList sources={provenance.sources} />
        <EvidenceList evidence={provenance.evidence} />
      </div>
      {indicatorDefinitions.length > 0 ? (
        <IndicatorDefinitionList definitions={indicatorDefinitions} sources={provenance.sources} />
      ) : null}
      {missingDataNotes.length > 0 ? <MissingDataNotes notes={missingDataNotes} /> : null}
      <div className="provenance-status-section">
        <h3>数据状态说明</h3>
        <StatusLegend />
      </div>
    </section>
  );
}

export function SourceList({
  sources
}: {
  sources: readonly Source[];
}) {
  return (
    <div>
      <h3>数据源</h3>
      {sources.length === 0 ? <UnknownValue label="暂无来源" /> : (
        <ul className="plain-list">
          {sources.map((source) => (
            <li key={source.id}>
              <strong>{source.name}</strong>
              <span>{source.publisher}</span>
              <SourceMetadata source={source} />
              {source.notes ? <small>{source.notes}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IndicatorDefinitionList({
  definitions,
  sources
}: {
  definitions: readonly IndicatorDefinitionLike[];
  sources: readonly Source[];
}) {
  return (
    <section className="provenance-subsection" aria-labelledby="indicator-definitions-title">
      <h3 id="indicator-definitions-title">指标定义</h3>
      <ul className="plain-list">
        {definitions.map((definition) => {
          const key = definition.key ?? definition.indicator ?? definition.label ?? "indicator";
          const source = definition.source;
          const sourceLabel = source?.name ?? definition.sourceIds
            ?.map((sourceId) => sources.find((candidate) => candidate.id === sourceId)?.name ?? sourceId)
            .join("、") ?? null;
          return (
            <li key={key}>
              <strong>{definition.label ?? definition.shortLabel ?? key}</strong>
              {definition.description ? <span>{definition.description}</span> : null}
              <div className="definition-meta">
                {definition.sourceIndicatorCode ? (
                  <MetadataItem label="来源指标代码" value={definition.sourceIndicatorCode} />
                ) : null}
                {definition.statisticalConcept ? (
                  <MetadataItem label="统计概念" value={definition.statisticalConcept} />
                ) : null}
                {definition.displayCurrency || definition.displayUnit ? (
                  <MetadataItem
                    label="展示单位"
                    value={[definition.displayCurrency, definition.displayUnit]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
                {definition.valueMeaning ? (
                  <MetadataItem label="数值含义" value={definition.valueMeaning} />
                ) : null}
                {definition.formula ? (
                  <MetadataItem label="计算公式" value={definition.formula} />
                ) : null}
                {definition.method ? <MetadataItem label="method" value={definition.method} /> : null}
                {definition.dataStatus ? (
                  <MetadataItem
                    label="dataStatus"
                    value={<StatusBadge status={definition.dataStatus} />}
                  />
                ) : null}
                {definition.datasetVersionId ? (
                  <MetadataItem label="datasetVersion" value={definition.datasetVersionId} />
                ) : null}
                {sourceLabel ? <MetadataItem label="来源" value={sourceLabel} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MissingDataNotes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <aside className="missing-data-panel" aria-label="缺失数据说明">
      <strong>缺失数据说明</strong>
      <ul>
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </aside>
  );
}

export function EvidenceList({ evidence }: { evidence: readonly Evidence[] }) {
  return (
    <div>
      <h3>证据定位</h3>
      {evidence.length === 0 ? <UnknownValue label="暂无证据" /> : (
        <ul className="plain-list">
          {evidence.map((record) => (
            <li key={record.id}>
              <strong>{record.locator}</strong>
              {record.excerpt ? <span>{record.excerpt}</span> : null}
              {record.notes ? <small>{record.notes}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {detail ? <span className="stat-detail">{detail}</span> : null}
    </div>
  );
}
