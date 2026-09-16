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
  const firstProcedure = view.procedures[0];
  const nextSteps = firstProcedure?.steps.slice(0, 3) ?? [];
  const officialSource = view.sources.find((source) => Boolean(source.url));
  const hasUnknownTariff = view.tariffs.some(({ measure }) => measure.dataStatus === "unknown");
  const confirmedCount = [view.requirements.length > 0, view.documents.length > 0, view.procedures.length > 0, Boolean(officialSource)].filter(Boolean).length;
  const pendingCount = [hasUnknownTariff, view.requirements.some(({ requirement }) => requirement.applicability === "conditional")].filter(Boolean).length;
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

      <section className="trade-guide-action-panel" aria-label="开始前先做什么">
        <div className="trade-guide-action-lead">
          <span className="card-kicker">Start here · 开始前</span>
          <strong>{view.directionLabel} · {jurisdiction?.name ?? "未指定国家/地区"}</strong>
          <span>先按顺序确认商品归类、管辖区规则和申报主体，再准备文件。</span>
        </div>
        {nextSteps.length ? <ol className="trade-guide-action-steps">
          {nextSteps.map(({ step }) => <li key={step.id}><span>{step.order + 1}</span><strong>{step.action}</strong></li>)}
        </ol> : <span className="trade-guide-action-empty">暂无已发布的办理步骤，请直接打开官方入口核验。</span>}
      </section>

      <section className="trade-guide-conclusion" aria-label="这组指南能确认什么">
        <div className="trade-guide-conclusion-heading">
          <span className="card-kicker">Quick read · 快速判断</span>
          <strong>{view.directionLabel} · {jurisdiction?.name ?? "未指定国家/地区"}</strong>
          <span>查看税费，再准备手续与文件。</span>
        </div>
        <div className="trade-guide-conclusion-grid">
          <div><span>已整理</span><strong>{confirmedCount} 项</strong><small>手续、文件、流程或官方入口</small></div>
          <div><span>仍需核验</span><strong>{pendingCount} 项</strong><small>{hasUnknownTariff ? "部分税费或适用条件仍待核验" : "按货物规格和日期复核"}</small></div>
          <div>{officialSource?.url ? <a className="button button-secondary" href={officialSource.url} target="_blank" rel="noreferrer">打开官方入口 ↗</a> : <span className="trade-guide-action-empty">暂无官方链接</span>}<small>实际申报以前以官方页面为准</small></div>
        </div>
      </section>

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
        <summary><span>税费核验</span><small>已收录基础规则 · 适用条件与附加措施另核</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-tariff-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-tariff-title`}>税费：先查规则，再算金额</h3><span className="section-caption">按原产地、归类和日期核验</span></div>
          <div className="trade-tariff-grid">
            {view.tariffs.length ? view.tariffs.map(({ measure, measureTypeLabel, rateTypeLabel, applicabilityLabel, displayValue }) => (
              <div className="trade-tariff-card" key={measure.id}>
                <div className="trade-tariff-heading"><strong>{measureTypeLabel}</strong><StatusBadge status={measure.dataStatus} method={measure.method} /></div>
                <strong className="trade-tariff-value">{displayValue}</strong>
                <span>{rateTypeLabel} · {applicabilityLabel}</span>
                <small>记录期间：{measure.period.label}</small>
                <small>{measure.limitations[0]}</small>
              </div>
            )) : <UnknownValue label="暂无税费记录" />}
          </div>
        </section>
      </details>

      <details className="trade-guide-details" open>
        <summary><span>手续与合规核验</span><small>{view.requirements.length} 项 · 按优先顺序准备</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-requirements-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-requirements-title`}>手续与核验项</h3><span className="section-caption">适用条件以官方规则为准</span></div>
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
      </details>

      <details className="trade-guide-details">
        <summary><span>文件清单</span><small>{view.documents.length} 项</small></summary>
        <section className="trade-guide-section" aria-labelledby={`${guide.id}-documents-title`}>
          <div className="trade-guide-section-heading"><h3 id={`${guide.id}-documents-title`}>建议准备的资料</h3><span className="section-caption">是否强制以官方规则为准</span></div>
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
    return <div className="empty-state large-empty"><strong>暂未收录这组目的地/方向</strong><p>可以先打开其他国家的官方入口，或把这组需求登记为待补资料。当前没有资料不代表该国没有规则。</p><Link className="text-link" href={tradeGuidePath({ product: productId })}>查看全部已收录指南 →</Link></div>;
  }
  return <div className="trade-guide-results">{views.map((view) => <TradeGuideCard view={view} key={view.guide.id} />)}</div>;
}
