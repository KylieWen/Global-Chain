import Link from "next/link";
import type { TradeGuideView } from "@globe-chain/domain";
import { MetadataItem, StatusBadge, UnknownValue } from "./data-display";
import { tradeGuidePath } from "../lib/paths";

export function TradeGuideSummaryCard({ view, productId }: { view: TradeGuideView; productId: string }) {
  const { guide, jurisdiction, item } = view;
  return (
    <article className="trade-guide-summary-card">
      <div className="trade-guide-card-heading">
        <div>
          <p className="card-kicker">{view.directionLabel} · {view.coverageLabel}</p>
          <h2>{guide.title}</h2>
          <p className="trade-guide-jurisdiction">{jurisdiction?.name ?? "未指定国家/地区"} · {item?.name ?? "未指定商品"}</p>
        </div>
        <StatusBadge status={guide.dataStatus} method={guide.method} />
      </div>
      <p className="trade-guide-summary">{guide.summary}</p>
      <div className="trade-guide-summary-meta">
        <span>{view.jurisdictionRoleLabel}</span>
        <span>{view.originScopeLabel}</span>
        <span>最近复核：{view.lastReviewedLabel}</span>
      </div>
      <Link className="button button-secondary trade-guide-summary-action" href={tradeGuidePath({ product: productId, jurisdiction: guide.scope.jurisdictionEntityId, direction: guide.scope.direction })}>
        查看这组指南 →
      </Link>
    </article>
  );
}

export function TradeGuideDirectory({ views, productId }: { views: readonly TradeGuideView[]; productId: string }) {
  if (views.length === 0) return <div className="empty-state large-empty"><strong>当前没有已发布指南</strong><p>可以先选择其他商品或等待新的国家/地区指南发布。</p></div>;
  return <div className="trade-guide-directory">{views.map((view) => <TradeGuideSummaryCard view={view} productId={productId} key={view.guide.id} />)}</div>;
}

export function TradeGuideCard({ view }: { view: TradeGuideView }) {
  const { guide, jurisdiction, item, classification } = view;
  return (
    <article className="trade-guide-card">
      <div className="trade-guide-card-heading">
        <div>
          <p className="card-kicker">{view.directionLabel} · {view.coverageLabel}</p>
          <h2>{guide.title}</h2>
          <p className="trade-guide-jurisdiction">{jurisdiction?.name ?? "未指定国家/地区"} · {item?.name ?? "未指定商品"}</p>
        </div>
        <StatusBadge status={guide.dataStatus} method={guide.method} />
      </div>
      <p className="trade-guide-summary">{guide.summary}</p>

      <div className="trade-guide-scope">
        <MetadataItem label="整理范围" value={guide.period.label} />
        <MetadataItem label="商品编码" value={classification ? `${classification.system} ${classification.version} · ${classification.code}` : guide.scope.classification?.code ?? <UnknownValue label="未指定" />} />
        <MetadataItem label="查询角色" value={view.scopeSummary} />
        <MetadataItem label="原产地范围" value={view.originScopeLabel} />
        <MetadataItem label="规则类型" value={view.regimeLabel} />
        <MetadataItem label="资料状态" value={view.reviewStatusLabel} />
        <MetadataItem label="最近复核" value={view.lastReviewedLabel} />
        {view.nextReviewLabel ? <MetadataItem label="下次复核" value={view.nextReviewLabel} /> : null}
        <MetadataItem label="资料版本" value={view.contentVersion?.version ?? <UnknownValue label="未提供" />} />
      </div>

      <section className="trade-guide-section" aria-labelledby={`${guide.id}-tariff-title`}>
        <div className="trade-guide-section-heading"><h3 id={`${guide.id}-tariff-title`}>税费：先查规则，再算金额</h3><span className="section-caption">本演示不固化税率</span></div>
        <div className="trade-tariff-grid">
          {view.tariffs.length ? view.tariffs.map(({ measure, measureTypeLabel, rateTypeLabel, applicabilityLabel, displayValue }) => (
            <div className="trade-tariff-card" key={measure.id}>
              <div className="trade-tariff-heading"><strong>{measureTypeLabel}</strong><StatusBadge status={measure.dataStatus} method={measure.method} /></div>
              <strong className="trade-tariff-value">{displayValue}</strong>
              <span>{rateTypeLabel} · {applicabilityLabel}</span>
              <small>{measure.limitations[0]}</small>
            </div>
          )) : <UnknownValue label="暂无税费记录" />}
        </div>
      </section>

      <section className="trade-guide-section" aria-labelledby={`${guide.id}-requirements-title`}>
        <div className="trade-guide-section-heading"><h3 id={`${guide.id}-requirements-title`}>手续与核验项</h3><span className="section-caption">按优先顺序准备</span></div>
        <div className="trade-requirement-list">
          {view.requirements.length ? view.requirements.map(({ requirement, requirementTypeLabel, applicabilityLabel, evidenceLevelLabel }) => (
            <div className="trade-requirement-row" key={requirement.id}>
              <div><strong>{requirement.title}</strong><span>{requirement.summary}</span></div>
              <div className="trade-requirement-meta"><span>{requirementTypeLabel}</span><span>{applicabilityLabel}</span><span>{evidenceLevelLabel}</span></div>
              {requirement.conditions.length ? <ul>{requirement.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : null}
            </div>
          )) : <UnknownValue label="暂无手续记录" />}
        </div>
      </section>

      <section className="trade-guide-section" aria-labelledby={`${guide.id}-documents-title`}>
        <div className="trade-guide-section-heading"><h3 id={`${guide.id}-documents-title`}>建议准备的资料</h3><span className="section-caption">是否强制以官方规则为准</span></div>
        <div className="trade-document-grid">
          {view.documents.length ? view.documents.map(({ document, mandatoryStatusLabel }) => <div className="trade-document-card" key={document.id}><strong>{document.label}</strong><span>{mandatoryStatusLabel}</span><small>{document.purpose}</small></div>) : <UnknownValue label="暂无资料清单" />}
        </div>
      </section>

      {view.procedures.map(({ procedure, processingTimeLabel, steps }) => (
        <section className="trade-guide-section" aria-labelledby={`${procedure.id}-title`} key={procedure.id}>
          <div className="trade-guide-section-heading"><h3 id={`${procedure.id}-title`}>{procedure.title}</h3><span className="section-caption">办理时限：{processingTimeLabel}</span></div>
          <p className="trade-procedure-purpose">{procedure.purpose}</p>
          <ol className="trade-procedure-list">
            {steps.map(({ step, actorLabel, channelLabel }) => <li key={step.id}><span className="trade-step-index">{String(step.order + 1).padStart(2, "0")}</span><div><strong>{step.action}</strong><span>{actorLabel} · {channelLabel}</span>{step.notes ? <small>{step.notes}</small> : null}</div></li>)}
          </ol>
        </section>
      ))}

      <section className="trade-guide-sources" aria-label="官方入口与限制">
        <div><strong>官方入口</strong><div className="trade-source-links">{view.sources.map((source) => source.url ? <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.name} ↗</a> : <span key={source.id}>{source.name}</span>)}</div></div>
        <div className="trade-guide-boundary"><strong>使用边界</strong><span>{guide.disclaimer}</span><span>{guide.limitations[0]}</span></div>
      </section>
    </article>
  );
}

export function TradeGuideResults({ views, productId }: { views: readonly TradeGuideView[]; productId: string }) {
  if (views.length === 0) {
    return <div className="empty-state large-empty"><strong>暂未收录这组目的地/方向</strong><p>可以先打开其他国家的官方入口，或把这组需求登记为待补资料。当前没有资料不代表该国没有规则。</p><Link className="text-link" href={tradeGuidePath({ product: productId })}>查看全部已收录指南 →</Link></div>;
  }
  return <div className="trade-guide-results">{views.map((view) => <TradeGuideCard view={view} key={view.guide.id} />)}</div>;
}
