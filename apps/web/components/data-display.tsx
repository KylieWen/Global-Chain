import type { ReactNode } from "react";
import type {
  DatasetVersion,
  Evidence,
  FactStatus,
  Source
} from "@globe-chain/contracts";
import type { ProvenanceView } from "@globe-chain/domain";

export function StatusBadge({
  status,
  method
}: {
  status: FactStatus;
  method?: string;
}) {
  const labels: Record<FactStatus, string> = {
    observed: "已观测",
    estimated: "估算",
    unknown: "未知",
    withheld: "未披露",
    invalid: "无效"
  };
  return (
    <span className={`status-badge status-${status}`}>
      {labels[status]}
      {method === "mock" ? " · mock" : method ? ` · ${method}` : ""}
    </span>
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

export function UnknownValue({ label = "未知" }: { label?: string }) {
  return <span className="unknown-value">{label}</span>;
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
  if (value === null || value === undefined) return <UnknownValue />;
  const suffix = currency ?? unit;
  return (
    <span className={status === "estimated" ? "estimated-value" : undefined}>
      {value.toLocaleString("zh-CN")}{suffix ? ` ${suffix}` : ""}
      {status === "estimated" ? " · 估算" : ""}
    </span>
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

export function ProvenancePanel({ provenance }: { provenance: ProvenanceView }) {
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
    </section>
  );
}

export function SourceList({ sources }: { sources: readonly Source[] }) {
  return (
    <div>
      <h3>数据源</h3>
      {sources.length === 0 ? <UnknownValue label="暂无来源" /> : (
        <ul className="plain-list">
          {sources.map((source) => (
            <li key={source.id}>
              <strong>{source.name}</strong>
              <span>{source.publisher}</span>
              {source.notes ? <small>{source.notes}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
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
