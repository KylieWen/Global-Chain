import Link from "next/link";
import type { TradeGuideView } from "@globe-chain/domain";
import { MetadataItem, StatusBadge, UnknownValue } from "./data-display";
import { tradeGuidePath } from "../lib/paths";
import { HintLink } from "./hint-link";
import { itemLabel } from "../lib/item-label";

export function TradeGuideSummaryCard({ view, productId }: { view: TradeGuideView; productId: string }) {
  const { guide, jurisdiction, item } = view;
  return (
    <article className="trade-guide-summary-card">
      <div className="trade-guide-card-heading">
        <div>
          <p className="card-kicker">{view.directionLabel} · {view.coverageLabel}</p>
          <h2>{guide.title}</h2>
          <p className="trade-guide-jurisdiction">{jurisdiction?.name ?? "未指定国家/地区"} · {itemLabel(item)}</p>
        </div>
        <StatusBadge status={guide.dataStatus} method={guide.method} />
      </div>
      <div className="trade-guide-summary-meta">
        <span>{view.jurisdictionRoleLabel}</span>
        <span>{view.originScopeLabel}</span>
        <span>最近复核：{view.lastReviewedLabel}</span>
      </div>
      <HintLink className="button button-secondary trade-guide-summary-action" href={tradeGuidePath({ product: productId, jurisdiction: guide.scope.jurisdictionEntityId, direction: guide.scope.direction })} label="查看这组指南 →" explanation={guide.summary} />
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
          <p className="trade-guide-jurisdiction">{jurisdiction?.name ?? "未指定国家/地区"} · {itemLabel(item)}</p>
        </div>
        <StatusBadge status={guide.dataStatus} method={guide.method} />
      </div>
      <p className="trade-guide-summary">{guide.summary}</p>

      <details className="trade-guide-details trade-guide-meta-details">
        <summary><span>查看查询范围与更新时间</span><small>商品编码、适用期间、覆盖状态</small></summary>
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
      </details>

      <details className="trade-guide-details" open>
        <summary><span>税费</span><small>税率与适用条件</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-tariff-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-tariff-title`}>税率与税费</h3><span className="section-caption">原产地 · 商品分类 · 日期</span></div>
          <div className="trade-tariff-grid">
            {view.tariffs.length ? view.tariffs.map(({ measure, measureTypeLabel, rateTypeLabel, applicabilityLabel, displayValue }) => (
              <div className="trade-tariff-card" key={measure.id}>
                <div className="trade-tariff-heading"><strong>{measureTypeLabel}</strong><StatusBadge status={measure.dataStatus} method={measure.method} /></div>
                <strong className="trade-tariff-value">{displayValue}</strong>
                <span>{rateTypeLabel} · {applicabilityLabel}</span>
                <small>记录期间：{measure.period.label}</small>
                <details><summary>适用说明</summary><p>{measure.limitations.join("；")}</p></details>
              </div>
            )) : <UnknownValue label="暂无税费记录" />}
          </div>
        </section>
      </details>

      <details className="trade-guide-details" open>
        <summary><span>手续与要求</span><small>{view.requirements.length} 项 · 按优先顺序准备</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-requirements-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-requirements-title`}>需要办理什么</h3><span className="section-caption">查看对应条件</span></div>
          <div className="trade-requirement-list">
            {view.requirements.length ? view.requirements.map(({ requirement, requirementTypeLabel, applicabilityLabel }) => (
              <div className="trade-requirement-row" key={requirement.id}>
                <div><strong>{requirement.title}</strong><span>{requirement.summary}</span></div>
                <div className="trade-requirement-meta"><span>{requirementTypeLabel}</span><span>{applicabilityLabel}</span></div>
                {requirement.conditions.length ? <ul>{requirement.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : null}
              </div>
            )) : <UnknownValue label="暂无手续记录" />}
          </div>
        </section>
      </details>

      <details className="trade-guide-details">
        <summary><span>文件清单</span><small>{view.documents.length} 项</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-documents-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-documents-title`}>建议准备的资料</h3></div>
          <div className="trade-document-grid">
            {view.documents.length ? view.documents.map(({ document, mandatoryStatusLabel }) => <div className="trade-document-card" key={document.id}><strong>{document.label}</strong><span>{mandatoryStatusLabel}</span><small>{document.purpose}</small></div>) : <UnknownValue label="暂无资料清单" />}
          </div>
        </section>
      </details>

      <details className="trade-guide-details">
        <summary><span>办理步骤</span><small>{view.procedures.reduce((count, procedure) => count + procedure.steps.length, 0)} 步</small></summary>
        {view.procedures.map(({ procedure, processingTimeLabel, steps }) => (
          <section className="trade-guide-section" aria-labelledby={`${procedure.id}-title`} key={procedure.id}>
            <div className="trade-guide-section-heading"><h3 id={`${procedure.id}-title`}>{procedure.title}</h3><span className="section-caption">办理时限：{processingTimeLabel}</span></div>
            <p className="trade-procedure-purpose">{procedure.purpose}</p>
            <ol className="trade-procedure-list">
              {steps.map(({ step, actorLabel, channelLabel }) => <li key={step.id}><span className="trade-step-index">{String(step.order + 1).padStart(2, "0")}</span><div><strong>{step.action}</strong><span>{actorLabel} · {channelLabel}</span>{step.notes ? <small>{step.notes}</small> : null}</div></li>)}
            </ol>
          </section>
        ))}
      </details>

      <details className="trade-guide-details">
        <summary><span>官方入口与数据依据</span><small>{view.sources.length} 个来源</small></summary>
        <section className="trade-guide-sources" aria-label="官方入口与限制">
          <div><strong>官方入口</strong><div className="trade-source-links">{view.sources.map((source) => source.url ? <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.name} ↗</a> : <span key={source.id}>{source.name}</span>)}</div></div>
          <div className="trade-guide-boundary"><strong>使用边界</strong><span>{guide.disclaimer}</span><span>{guide.limitations[0]}</span></div>
        </section>
      </details>
    </article>
  );
}

export function TradeGuideResults({ views, productId }: { views: readonly TradeGuideView[]; productId: string }) {
  if (views.length === 0) {
    return <div className="empty-state large-empty"><strong>暂未收录这组目的地/方向</strong><p>换一个国家或方向，查看已整理的规则和办理步骤。</p><Link className="text-link" href={tradeGuidePath({ product: productId })}>查看全部已收录指南 →</Link></div>;
  }
  return <div className="trade-guide-results">{views.map((view) => <TradeGuideCard view={view} key={view.guide.id} />)}</div>;
}
