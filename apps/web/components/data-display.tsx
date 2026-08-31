import type { ReactNode } from "react";
import type {
  DatasetVersion,
  EvidenceSupportType,
  FactStatus
} from "@globe-chain/contracts";
import type {
  EvidenceLevelView,
  ProvenanceView,
  ResolvedEvidenceGapView,
  ResolvedEvidenceView,
  SupplyChainRouteProvenanceView
} from "@globe-chain/domain";

type ReadonlyEvidence = ResolvedEvidenceView["evidence"];
type ReadonlySource = NonNullable<ResolvedEvidenceView["source"]>;
type ReadonlyContentVersion = ProvenanceView["contentVersions"][number];
type EvidenceScopeView = NonNullable<ReadonlyEvidence["scope"]>;

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
  readonly source?: ReadonlySource | null;
  readonly sourceIds?: readonly string[];
};

type ProvenancePanelView = Pick<ProvenanceView, "datasetVersion" | "sources" | "warnings"> & {
  readonly evidence: readonly ReadonlyEvidence[];
  readonly resolvedEvidence?: readonly ResolvedEvidenceView[];
  readonly contentVersions?: readonly ReadonlyContentVersion[];
  readonly route?: SupplyChainRouteProvenanceView;
  readonly indicatorDefinitions?: readonly IndicatorDefinitionLike[];
  readonly missingDataNotes?: readonly string[];
  readonly evidenceGaps?: readonly ResolvedEvidenceGapView[];
};

const evidenceSupportLabels: Record<EvidenceSupportType, string> = {
  country_role: "国家角色",
  bilateral_flow: "双边流向",
  process_context: "生产阶段背景",
  trade_observation: "贸易观察",
  classification: "分类与维度",
  curation_method: "策展方法",
  manufacturer_capability: "厂商设备能力",
  commercial_relationship: "公开商业关系",
  policy_guidance: "政策/手续指引"
};

const evidenceGapStatusLabels: Record<ResolvedEvidenceGapView["gap"]["status"], string> = {
  open: "待补充",
  partial: "部分支持",
  closed: "已闭合",
  not_publicly_observable: "公开资料不可观测"
};

const evidenceGapStatusDescriptions: Record<
  ResolvedEvidenceGapView["gap"]["status"],
  string
> = {
  open: "当前没有足够证据支持这项有限主张。",
  partial: "已有部分证据，但尚不足以支持完整主张或整条连接。",
  closed: "这项有限主张所要求的证据已经匹配；不代表相邻主张同时成立。",
  not_publicly_observable: "公开统计通常无法识别特定批次、工厂、订单或终端用途。"
};

const evidenceLevelCodeLabels: Record<
  ResolvedEvidenceGapView["gap"]["currentEvidenceLevel"],
  string
> = {
  role_supported: "国家角色有支持",
  bilateral_supported: "双边流向有支持",
  representative: "代表性策展连接",
  none: "暂无支持"
};

const mappingTypeLabels: Record<
  EvidenceScopeView["classificationCodes"][number]["mappingType"],
  string
> = {
  exact: "精确",
  aggregate: "聚合",
  approximate: "近似",
  curated: "策展映射"
};

const statusLabels: Record<FactStatus, string> = {
  observed: "已观测",
  estimated: "估算",
  unknown: "未知",
  withheld: "未披露",
  invalid: "无效"
};

const statusDescriptions: Record<FactStatus, string> = {
  observed: "来源中有可用观察或明确报告的事实",
  estimated: "数值经过估算或来源标记为估算",
  unknown: "当前数据没有可用观察，不能解释为零",
  withheld: "来源明确未披露数值",
  invalid: "数值未通过数据质量校验，不应作为事实使用"
};

const methodLabels: Record<string, string> = {
  official: "官方来源",
  derived: "确定性计算",
  curated: "公开资料整理",
  mock: "演示样例"
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
      {method ? ` · ${methodLabels[method] ?? method}` : ""}
    </span>
  );
}

export function EvidenceLevelBadge({
  level
}: {
  level: EvidenceLevelView;
}) {
  return (
    <span
      className={`evidence-level-badge evidence-level-${level.code}`}
      title={level.description}
      aria-label={`证据等级：${level.label}`}
    >
      {level.label}
    </span>
  );
}

export function EvidenceLevelLegend({
  levels
}: {
  levels: readonly EvidenceLevelView[];
}) {
  const uniqueLevels = [...new Map(levels.map((level) => [level.code, level])).values()];
  if (uniqueLevels.length === 0) return null;
  return (
    <div className="evidence-level-legend" aria-label="供应链证据等级说明">
      {uniqueLevels.map((level) => (
        <div className="evidence-level-legend-item" key={level.code}>
          <EvidenceLevelBadge level={level} />
          <small>{level.description}</small>
        </div>
      ))}
    </div>
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
    draft: "编辑中",
    validated: "已核验",
    published: "已发布",
    deprecated: "历史版本"
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
  unit,
  unknownLabel = "未知"
}: {
  value?: number | null;
  status: FactStatus;
  currency?: string | null;
  unit?: string | null;
  unknownLabel?: string;
}) {
  if (status === "unknown") return <UnknownValue label={unknownLabel} />;
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
  if (value === null || value === undefined) return <UnknownValue label={unknownLabel} />;
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

function ScopeValueList({
  label,
  values,
  emptyLabel = "未指定"
}: {
  label: string;
  values: readonly string[];
  emptyLabel?: string;
}) {
  return (
    <div className="evidence-scope-field">
      <span className="metadata-label">{label}</span>
      {values.length > 0 ? (
        <div className="evidence-scope-values">
          {values.map((value) => <code key={value}>{value}</code>)}
        </div>
      ) : <UnknownValue label={emptyLabel} />}
    </div>
  );
}

/**
 * Displays the exact claim boundary of a source.  IDs are intentionally kept
 * visible: the query layer owns entity/item resolution and the page must not
 * infer a name or an end use from a classification code.
 */
export function EvidenceScopeDetails({
  scope,
  compact = false
}: {
  scope: EvidenceScopeView | null | undefined;
  compact?: boolean;
}) {
  if (!scope) return null;
  return (
    <div className={compact ? "evidence-scope compact-evidence-scope" : "evidence-scope"}>
      <div className="evidence-scope-heading">
        <strong>证据支持范围</strong>
        <span>{scope.scopeDescription}</span>
      </div>
      <div className="evidence-scope-grid">
        <ScopeValueList label="支持国家/地区" values={scope.entityIds} />
        <div className="evidence-scope-field">
          <span className="metadata-label">起点 → 终点</span>
          <span>
            {scope.fromEntityId ?? <UnknownValue label="未指定" />}
            <span aria-hidden="true"> → </span>
            {scope.toEntityId ?? <UnknownValue label="未指定" />}
          </span>
        </div>
        <ScopeValueList label="商品/部件 ID" values={scope.itemIds} />
        <ScopeValueList label="生产阶段 ID" values={scope.processStageIds} />
        <div className="evidence-scope-field">
          <span className="metadata-label">方向</span>
          <span>{scope.direction === "export" ? "出口" : scope.direction === "import" ? "进口" : <UnknownValue label="未指定" />}</span>
        </div>
        <div className="evidence-scope-field">
          <span className="metadata-label">期间</span>
          {scope.period ? <PeriodLabel period={scope.period} /> : <UnknownValue label="未指定" />}
        </div>
        <div className="evidence-scope-field">
          <span className="metadata-label">支持类型</span>
          <span className="scope-support-flags">
            <span className={scope.supportsCountryRole ? "scope-flag scope-flag-yes" : "scope-flag"}>国家角色：{scope.supportsCountryRole ? "是" : "否"}</span>
            <span className={scope.supportsBilateralFlow ? "scope-flag scope-flag-yes" : "scope-flag"}>双边流向：{scope.supportsBilateralFlow ? "是" : "否"}</span>
            <span className={scope.supportsProcessContext ? "scope-flag scope-flag-yes" : "scope-flag"}>阶段背景：{scope.supportsProcessContext ? "是" : "否"}</span>
          </span>
        </div>
      </div>
      {scope.classificationCodes.length > 0 ? (
        <div className="evidence-scope-subsection">
          <span className="metadata-label">分类代码</span>
          <ul className="scope-classification-list">
            {scope.classificationCodes.map((classification) => (
              <li key={`${classification.system}-${classification.version}-${classification.code}`}>
                <code>{classification.system} {classification.version} · {classification.code}</code>
                <span className={`classification-mapping mapping-${classification.mappingType}`}>
                  {mappingTypeLabels[classification.mappingType]}
                </span>
                <small>{classification.description}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {scope.limitations.length > 0 ? (
        <div className="evidence-scope-subsection">
          <span className="metadata-label">范围限制</span>
          <ul className="scope-limitations">
            {scope.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function evidenceGapTarget(
  view: ResolvedEvidenceGapView,
  options: { fallbackToId?: boolean } = {}
): ReactNode {
  const { gap, node, flow } = view;
  if (node) {
    return <>{node.node.label}{node.entity ? ` · ${node.entity.name}` : ""}</>;
  }
  if (flow) {
    const endpointLabel = (endpoint: typeof flow.from) =>
      endpoint.node?.node.label ?? endpoint.entity?.name ??
      (options.fallbackToId === false ? "未解析节点" : endpoint.referenceId);
    return <>{endpointLabel(flow.from)} → {endpointLabel(flow.to)}</>;
  }
  return options.fallbackToId === false
    ? "未解析的登记目标"
    : gap.nodeId ?? gap.flowId ?? "未解析目标";
}

export function EvidenceGapStatusBadge({
  status
}: {
  status: ResolvedEvidenceGapView["gap"]["status"];
}) {
  return (
    <span
      className={`evidence-gap-status evidence-gap-status-${status}`}
      title={evidenceGapStatusDescriptions[status]}
      aria-label={`证据缺口状态：${evidenceGapStatusLabels[status]}`}
    >
      {evidenceGapStatusLabels[status]}
    </span>
  );
}

export function EvidenceGapSummary({
  gaps
}: {
  gaps: readonly ResolvedEvidenceGapView[];
}) {
  const statuses = Object.keys(evidenceGapStatusLabels) as Array<ResolvedEvidenceGapView["gap"]["status"]>;
  return (
    <div className="evidence-gap-summary" aria-label="证据缺口状态摘要">
      {statuses.map((status) => (
        <span className="evidence-gap-summary-item" key={status}>
          <EvidenceGapStatusBadge status={status} />
          <strong>{gaps.filter((view) => view.gap.status === status).length}</strong>
        </span>
      ))}
    </div>
  );
}

type EvidenceGapRegistryProps = {
  gaps: readonly ResolvedEvidenceGapView[];
  compact?: boolean;
  /**
   * Use the human-facing progressive disclosure treatment on the standalone
   * registry page. Existing compact/provenance usages retain the complete
   * audit-oriented rendering by default.
   */
  progressiveDisclosure?: boolean;
  /** Number of priority items shown before the remaining registry is folded. */
  visibleCount?: number;
};

function evidenceGapPriority(status: ResolvedEvidenceGapView["gap"]["status"]): number {
  // Unresolved claims are the most useful starting point for a reader. Closed
  // role claims remain available, but should not displace open/partial gaps.
  return {
    open: 0,
    partial: 1,
    not_publicly_observable: 2,
    closed: 3
  }[status];
}

function sortEvidenceGapsForReading(
  gaps: readonly ResolvedEvidenceGapView[]
): readonly ResolvedEvidenceGapView[] {
  return [...gaps].sort((left, right) => {
    const priority = evidenceGapPriority(left.gap.status) - evidenceGapPriority(right.gap.status);
    if (priority !== 0) return priority;
    return left.gap.gapId.localeCompare(right.gap.gapId);
  });
}

function renderEvidenceGapAudit(view: ResolvedEvidenceGapView) {
  const { gap } = view;
  return (
    <details className="evidence-gap-audit">
      <summary>查看来源与审计详情</summary>
      <div className="evidence-gap-audit-body">
        <div className="evidence-gap-meta">
          <MetadataItem label="当前主张" value={gap.currentClaim} />
          <MetadataItem label="当前证据等级" value={evidenceLevelCodeLabels[gap.currentEvidenceLevel]} />
          <MetadataItem label="期间" value={<PeriodLabel period={gap.period} />} />
          <MetadataItem label="method" value={gap.method} />
          <MetadataItem label="登记项 ID" value={<code>{gap.gapId}</code>} />
          <MetadataItem label="datasetVersion" value={<code>{gap.datasetVersionId}</code>} />
          <MetadataItem label="contentVersion" value={<code>{gap.contentVersionId}</code>} />
        </div>
        <div className="evidence-gap-copy">
          <div><strong>缺少的证据</strong><p>{gap.missingEvidence}</p></div>
          <div><strong>不可推断内容</strong><ul>{gap.nonInferences.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
        <div className="evidence-gap-detail-grid">
          <div>
            <strong>可接受的证据类型</strong>
            <div className="evidence-scope-values">
              {gap.acceptableEvidenceTypes.map((type) => <span className="evidence-support" key={type}>{evidenceSupportLabels[type]}</span>)}
            </div>
          </div>
          <div>
            <strong>候选来源</strong>
            <ul className="gap-candidate-list">
              {gap.candidateSources.map((candidate) => (
                <li key={`${candidate.publisher}-${candidate.name}`}>
                  <span><strong>{candidate.name}</strong> · {candidate.publisher}</span>
                  <span>许可证：{candidate.license}</span>
                  {candidate.url ? <a className="text-link" href={candidate.url} target="_blank" rel="noreferrer">打开来源</a> : null}
                  <small>{candidate.notes}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {gap.classificationCandidates.length > 0 ? (
          <div className="evidence-gap-subsection">
            <strong>分类候选与限制</strong>
            <ul className="gap-classification-list">
              {gap.classificationCandidates.map((candidate) => (
                <li key={`${candidate.system}-${candidate.version}-${candidate.code}`}>
                  <code>{candidate.system} {candidate.version} · {candidate.code}</code>
                  <span className={`classification-mapping mapping-${candidate.mappingType}`}>{mappingTypeLabels[candidate.mappingType]}</span>
                  <span>{candidate.label}</span>
                  <small>{candidate.limitation}{candidate.supportsEndUse ? " · 明确支持终端用途" : " · 不支持终端用途推断"}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="evidence-gap-subsection">
          <strong>关联证据</strong>
          <ResolvedEvidenceList evidence={view.evidence} compact />
        </div>
      </div>
    </details>
  );
}

function renderEvidenceGapCard(
  view: ResolvedEvidenceGapView,
  options: { humanMode?: boolean } = {}
) {
  const { gap, node, flow } = view;
  const humanMode = options.humanMode === true;
  const targetKind = node ? "节点主张" : flow ? "连接主张" : "登记项";
  if (humanMode) {
    return (
      <article className="evidence-gap-card evidence-gap-card-human" key={gap.gapId}>
        <div className="evidence-gap-card-heading">
          <div>
            <span className="evidence-gap-kind">{targetKind}</span>
            <h3>{evidenceGapTarget(view, { fallbackToId: false })}</h3>
          </div>
          <EvidenceGapStatusBadge status={gap.status} />
        </div>
        <div className="evidence-gap-human-summary">
          <div><strong>目前能确认</strong><p>{gap.currentClaim}</p></div>
          <div><strong>还需要核验</strong><p>{gap.missingEvidence}</p></div>
          <div className="evidence-gap-human-meta">
            <MetadataItem label="证据范围" value={evidenceLevelCodeLabels[gap.currentEvidenceLevel]} />
            <MetadataItem label="期间" value={<PeriodLabel period={gap.period} />} />
          </div>
        </div>
        {renderEvidenceGapAudit(view)}
      </article>
    );
  }

  return (
    <article className="evidence-gap-card" key={gap.gapId}>
      <div className="evidence-gap-card-heading">
        <div>
          <span className="eyebrow">{gap.gapId}</span>
          <h3>{evidenceGapTarget(view)}</h3>
        </div>
        <EvidenceGapStatusBadge status={gap.status} />
      </div>
      <div className="evidence-gap-meta">
        <MetadataItem label="当前主张" value={gap.currentClaim} />
        <MetadataItem label="当前证据等级" value={evidenceLevelCodeLabels[gap.currentEvidenceLevel]} />
        <MetadataItem label="期间" value={<PeriodLabel period={gap.period} />} />
        <MetadataItem label="method" value={gap.method} />
        <MetadataItem label="datasetVersion" value={gap.datasetVersionId} />
        <MetadataItem label="contentVersion" value={gap.contentVersionId} />
      </div>
      <div className="evidence-gap-copy">
        <div><strong>缺少的证据</strong><p>{gap.missingEvidence}</p></div>
        <div><strong>不可推断内容</strong><ul>{gap.nonInferences.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <div className="evidence-gap-detail-grid">
        <div>
          <strong>可接受的证据类型</strong>
          <div className="evidence-scope-values">
            {gap.acceptableEvidenceTypes.map((type) => <span className="evidence-support" key={type}>{evidenceSupportLabels[type]}</span>)}
          </div>
        </div>
        <div>
          <strong>候选来源</strong>
          <ul className="gap-candidate-list">
            {gap.candidateSources.map((candidate) => (
              <li key={`${candidate.publisher}-${candidate.name}`}>
                <span><strong>{candidate.name}</strong> · {candidate.publisher}</span>
                <span>许可证：{candidate.license}</span>
                {candidate.url ? <a className="text-link" href={candidate.url} target="_blank" rel="noreferrer">打开来源</a> : null}
                <small>{candidate.notes}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {gap.classificationCandidates.length > 0 ? (
        <div className="evidence-gap-subsection">
          <strong>分类候选与限制</strong>
          <ul className="gap-classification-list">
            {gap.classificationCandidates.map((candidate) => (
              <li key={`${candidate.system}-${candidate.version}-${candidate.code}`}>
                <code>{candidate.system} {candidate.version} · {candidate.code}</code>
                <span className={`classification-mapping mapping-${candidate.mappingType}`}>{mappingTypeLabels[candidate.mappingType]}</span>
                <span>{candidate.label}</span>
                <small>{candidate.limitation}{candidate.supportsEndUse ? " · 明确支持终端用途" : " · 不支持终端用途推断"}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="evidence-gap-subsection">
        <strong>关联证据</strong>
        <ResolvedEvidenceList evidence={view.evidence} compact />
      </div>
    </article>
  );
}

/** Renders the reusable, data-driven evidence-gap registry. */
export function EvidenceGapRegistry({
  gaps,
  compact = false,
  progressiveDisclosure = false,
  visibleCount = 5
}: EvidenceGapRegistryProps) {
  if (gaps.length === 0) {
    return <div className="empty-state">当前期间没有登记的证据缺口。</div>;
  }
  const orderedGaps = progressiveDisclosure ? sortEvidenceGapsForReading(gaps) : gaps;
  const priorityCount = Math.max(1, Math.min(visibleCount, orderedGaps.length));
  const visibleGaps = progressiveDisclosure ? orderedGaps.slice(0, priorityCount) : orderedGaps;
  const remainingGaps = progressiveDisclosure ? orderedGaps.slice(priorityCount) : [];
  const registryClassName = [
    compact ? "evidence-gap-registry evidence-gap-registry-compact" : "evidence-gap-registry",
    progressiveDisclosure ? "evidence-gap-registry-progressive" : ""
  ].filter(Boolean).join(" ");
  return (
    <div className={registryClassName}>
      <EvidenceGapSummary gaps={gaps} />
      {progressiveDisclosure ? (
        <p className="evidence-gap-reading-note">
          优先显示仍待补充或仅部分支持的主张；已闭合项和较少影响当前阅读的登记项收在“其余登记项”中。每张卡片都可以展开查看完整审计信息。
        </p>
      ) : null}
      <div className="evidence-gap-list">
        {visibleGaps.map((view) => renderEvidenceGapCard(view, { humanMode: progressiveDisclosure }))}
      </div>
      {remainingGaps.length > 0 ? (
        <details className="evidence-gap-all">
          <summary className="evidence-gap-all-summary">
            <strong>查看其余 {remainingGaps.length} 条登记项</strong>
            <span>包括已闭合、部分可观测和其他补充记录</span>
          </summary>
          <div className="evidence-gap-list evidence-gap-list-secondary">
            {remainingGaps.map((view) => renderEvidenceGapCard(view, { humanMode: true }))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Renders all source metadata in one place so provenance pages do not need to
 * duplicate URL, licence, retrieval, and source-version formatting.
 */
export function SourceMetadata({
  source
}: {
  source: ReadonlySource;
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
  const contentVersions = provenance.contentVersions ?? [];
  const resolvedEvidence = provenance.resolvedEvidence ?? provenance.evidence.map((evidence) => ({
    evidence,
    source: provenance.sources.find((source) => source.id === evidence.sourceId) ?? null
  }));
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
        {contentVersions.map((version) => (
          <span key={version.id}>内容版本：{version.version}</span>
        ))}
        <span>来源：{provenance.sources.length} 个</span>
        <span>证据：{resolvedEvidence.length} 条</span>
      </div>
      {provenance.route ? <RouteMethodology route={provenance.route} /> : null}
      <div className="provenance-grid">
        <SourceList sources={provenance.sources} />
        <ResolvedEvidenceList evidence={resolvedEvidence} />
      </div>
      {indicatorDefinitions.length > 0 ? (
        <IndicatorDefinitionList definitions={indicatorDefinitions} sources={provenance.sources} />
      ) : null}
      {missingDataNotes.length > 0 ? <MissingDataNotes notes={missingDataNotes} /> : null}
      {provenance.evidenceGaps ? (
        <section className="provenance-subsection" aria-labelledby="provenance-gaps-title">
          <h3 id="provenance-gaps-title">证据缺口</h3>
          <EvidenceGapRegistry gaps={provenance.evidenceGaps} compact />
        </section>
      ) : null}
      <div className="provenance-status-section">
        <h3>数据状态说明</h3>
        <StatusLegend />
      </div>
    </section>
  );
}

export function RouteMethodology({
  route
}: {
  route: SupplyChainRouteProvenanceView;
}) {
  return (
    <section className="route-methodology" aria-labelledby="route-methodology-title">
      <div className="route-methodology-heading">
        <div>
          <p className="eyebrow">Route interpretation</p>
          <h3 id="route-methodology-title">路线性质与整理方法</h3>
        </div>
        <div className="route-methodology-meta">
          <MetadataItem label="期间" value={<PeriodLabel period={route.period} />} />
          <MetadataItem label="method" value={route.method} />
          <MetadataItem
            label="contentVersion"
            value={route.contentVersion?.version ?? <UnknownValue label="未提供" />}
          />
        </div>
      </div>
      {route.representativeStatement ? (
        <p className="representative-statement">{route.representativeStatement}</p>
      ) : null}
      <div className="route-methodology-grid">
        <div>
          <strong>整理方法</strong>
          {route.methodology.length ? (
            <ul>{route.methodology.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : <UnknownValue label="未提供" />}
        </div>
        <div>
          <strong>证据局限</strong>
          {route.limitations.length ? (
            <ul>{route.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : <UnknownValue label="未提供" />}
        </div>
      </div>
    </section>
  );
}

export function SourceList({
  sources
}: {
  sources: readonly ReadonlySource[];
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
  sources: readonly ReadonlySource[];
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

export function EvidenceList({ evidence }: { evidence: readonly ReadonlyEvidence[] }) {
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

export function ResolvedEvidenceList({
  evidence,
  compact = false
}: {
  evidence: readonly ResolvedEvidenceView[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "resolved-evidence compact-evidence" : "resolved-evidence"}>
      {!compact ? <h3>证据定位</h3> : null}
      {evidence.length === 0 ? <UnknownValue label="暂无直接关联证据" /> : (
        <ul className="plain-list evidence-list">
          {evidence.map(({ evidence: record, source }) => (
            <li key={record.id}>
              <div className="evidence-heading">
                <strong>{record.locator}</strong>
                <span className={`evidence-support support-${record.supportType}`}>
                  {evidenceSupportLabels[record.supportType]}
                </span>
              </div>
              {source ? (
                <span>
                  来源：{source.name} · {source.publisher}
                  {source.url ? <>{" · "}<a className="text-link" href={source.url} target="_blank" rel="noreferrer">打开来源</a></> : null}
                </span>
              ) : <UnknownValue label="来源未解析" />}
              {!compact && record.excerpt ? <span>{record.excerpt}</span> : null}
              {record.notes ? <small>{record.notes}</small> : null}
              {record.scope ? <EvidenceScopeDetails scope={record.scope} compact={compact} /> : null}
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
