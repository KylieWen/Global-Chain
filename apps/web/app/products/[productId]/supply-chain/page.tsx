import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../lib/context";
import {
  EvidenceLevelBadge,
  EvidenceLevelLegend,
  MetadataItem,
  PeriodLabel,
  ResolvedEvidenceList,
  StatusBadge,
  WarningList
} from "../../../../components/data-display";
import { FlowTable } from "../../../../components/flow-table";
import { SupplyChainGraph } from "../../../../components/supply-chain-graph";
import { ledgerPath, manufacturingProcessPath, mapPath, nodePath, productPath, provenancePath, supplyChainPath } from "../../../../lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupplyChainPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const focusItemId = firstParam(query.focus);
  const pageContext = readPageContext(query);
  const label = firstParam(query.label);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  if (!overview) notFound();

  let story;
  try {
    story = queries.getSupplyChainStory(productId, {
      focusItemId,
      label
    });
  } catch {
    notFound();
  }
  if (!story) notFound();
  const contextMismatches = contextMismatch(pageContext, {
    period: story.period.label,
    datasetVersion: story.datasetVersion.version,
    contentVersion: story.route.contentVersion?.version
  });

  const focusName = focusItemId
    ? overview.directChildren.find((item) => item.id === focusItemId)?.name
      ?? story.nodes.find((node) => node.item?.id === focusItemId)?.item?.name
      ?? focusItemId
    : "全部代表性路径";
  const focusedProcessChains = focusItemId
    ? overview.componentCoverage.find((coverage) => coverage.item.id === focusItemId)?.processChains ?? []
    : [];

  return (
    <SiteShell>
      <div className="content-column wide-column route-page">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "供应链路径" }
        ]} />
        <ContextBanner period={story.period.label} datasetVersion={story.datasetVersion.version} contentVersion={story.route.contentVersion?.version} mismatches={contextMismatches} />
        <PageIntro
          eyebrow="Representative supply chain"
          title={`${overview.product.name} · ${focusName}`}
          description="从材料、部件到整机，点击生产环节继续向上下游探索。"
          actions={(
            <>
              <Link className="button button-primary" href={mapPath({ ...pageContext, product: productId, layer: "supply-chain", focus: focusItemId })}>在地图上查看这些环节</Link>
              <Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link>
            </>
          )}
        />

        <section className="filter-strip" aria-label="路径筛选">
          <div>
            <span className="filter-label">聚焦商品</span>
            <div className="filter-links">
              <Link className={!focusItemId ? "filter-chip active" : "filter-chip"} href={supplyChainPath(productId, undefined, pageContext)}>全部</Link>
              {overview.componentCoverage.map((coverage) => coverage.hasInspectableStory ? (
                <Link
                  className={focusItemId === coverage.item.id ? "filter-chip active" : "filter-chip"}
                  href={supplyChainPath(productId, coverage.item.id, pageContext)}
                  key={coverage.item.id}
                  title={coverage.statusDescription}
                >
                  {coverage.item.name}
                </Link>
              ) : <span className="filter-chip muted" aria-disabled="true" key={coverage.item.id}>{coverage.item.name} · 仅类别说明</span>)}
            </div>
          </div>
          <span className="filter-note">{story.nodes.length} 个环节 · {story.flows.length} 条连接</span>
        </section>

        <SupplyChainGraph story={story} productId={productId} context={pageContext} />

        {story.warnings.length > 0 && <details className="detail-collapsible compact-detail">
          <summary className="detail-summary"><strong>阅读提示与限制</strong><span>{story.warnings.length} 条</span></summary>
          <WarningList warnings={story.warnings} />
        </details>}

        <details className="route-declaration reading-details"><summary>路线说明与资料</summary><p>{story.route.representativeStatement}</p><MetadataItem label="版本" value={story.route.contentVersion?.version ?? "未提供"} /><EvidenceLevelLegend levels={[...story.nodes.map((node) => node.evidenceLevel), ...story.flows.map((flow) => flow.evidenceLevel)]} /></details>

        <details className="reading-details"><summary>路线资料概览</summary><section className="interpretation-summary" aria-labelledby="interpretation-summary-title">
          <div className="interpretation-summary-heading">
            <p className="eyebrow">Evidence at a glance</p>
            <h2 id="interpretation-summary-title">{story.interpretationSummary.title}</h2>
            <p>{story.interpretationSummary.description}</p>
          </div>
          <div className="interpretation-summary-grid">
            {story.interpretationSummary.items.map((item) => (
              <article className={`interpretation-card interpretation-card-${item.tone}`} key={item.code}>
                <strong>{item.count}</strong>
                <span>{item.label}</span>
                <small>{item.description}</small>
              </article>
            ))}
          </div>
        </section>

        </details>

        {focusedProcessChains.length > 0 && <section className="process-depth-callout" aria-label="工艺与设备深度入口">
          <div><p className="eyebrow">Go deeper</p><h2>继续深入到具体工序与设备</h2><p>国家角色视图之下，还可以逐道查看制造工序、设备类别和公开资料支持的设备厂商。</p></div>
          <div className="process-depth-callout-actions">{focusedProcessChains.map((chain) => <Link className="button button-primary" href={manufacturingProcessPath(productId, chain.id, pageContext)} key={chain.id}>{chain.title} →</Link>)}</div>
        </section>}

        <section className="section-block" aria-labelledby="route-steps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Route steps</p>
              <h2 id="route-steps-title">按环节阅读</h2>
            </div>
            <span className="section-caption">按生产顺序查看投入、产出与相关国家</span>
          </div>
          <div className="step-stack">
            {story.steps.map((view) => {
              const { step } = view;
              return (
                <details className="step-card step-card-collapsible" id={`route-step-${step.id}`} key={step.id} open={step.order === 0}>
                  <summary className="step-summary">
                    <span className="step-marker">{String(step.order + 1).padStart(2, "0")}</span>
                    <span className="step-summary-copy"><strong>{step.title}</strong><small>{step.description}</small><em>第 {step.order + 1} 步 / 共 {story.steps.length} 步</em></span>
                  </summary>
                  <div className="step-body">
                    <div className="step-heading">
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>

                    </div>
                    <div className="step-context">
                      <div>
                        <span className="metadata-label">本步骤节点</span>
                        <div className="step-node-list">
                          {view.nodes.map((node) => (
                              <Link className="step-node-chip" href={nodePath(productId, node.node.id, pageContext)} key={node.node.id}>
                              {node.node.label}
                            </Link>
                          ))}
                        </div>
                      </div>

                    </div>
                    <FlowTable flows={view.flows} productId={productId} context={pageContext} />
                    <details className="step-evidence-details">
                      <summary>查看本步骤的资料来源</summary>
                      <ResolvedEvidenceList evidence={view.evidence} compact />
                    </details>
                    <nav className="step-sequence-nav" aria-label={`${step.title}步骤导航`}>
                      {story.steps[step.order - 1] ? <a className="button button-secondary" href={`#route-step-${story.steps[step.order - 1].step.id}`}>← 上一步</a> : <span />}
                      {story.steps[step.order + 1] ? <a className="button button-primary" href={`#route-step-${story.steps[step.order + 1].step.id}`}>下一步 →</a> : <Link className="button button-primary" href={provenancePath(productId, pageContext)}>查看来源 →</Link>}
                    </nav>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className="section-block" aria-labelledby="route-nodes-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Route nodes</p>
              <h2 id="route-nodes-title">路径节点</h2>
            </div>
          </div>
          <div className="node-grid route-node-index">
            {story.nodes.slice(0, 6).map((node) => (
              <article className="node-card" key={node.node.id}>
                <div className="node-card-top">
                  <span className="node-type">{node.processStage?.label}</span>
                  {node.entity ? <span className="iso-chip">{node.entity.iso3 ?? node.entity.id}</span> : null}
                </div>
                <h3>{node.node.label}</h3>
                <p>{node.item?.name ?? "未知货物"} · {node.processStage?.label ?? "未知环节"}</p>
                <div className="node-card-evidence">
                  <EvidenceLevelBadge level={node.evidenceLevel} />
                  <StatusBadge status={node.node.dataStatus} method={node.node.method} />
                </div>
                <div className="node-card-meta">
                  <MetadataItem label="期间" value={<PeriodLabel period={node.period} />} />
                </div>
                <div className="node-links">
                  <Link className="text-link" href={nodePath(productId, node.node.id, pageContext)}>节点详情 →</Link>
                  {node.entity ? <Link className="text-link" href={ledgerPath(productId, node.entity.id, pageContext)}>国家账本 →</Link> : null}
                </div>
              </article>
            ))}
          </div>
          {story.nodes.length > 6 ? <div className="hierarchy-card compact-hierarchy-card"><span>还有 {story.nodes.length - 6} 个节点详情。</span><Link className="text-link" href={nodePath(productId, story.nodes[6].node.id, pageContext)}>从节点索引继续探索 →</Link></div> : null}
        </section>
        <section className="hierarchy-next-step"><strong>下一层</strong><span>想进一步了解这些环节？</span><Link className="button button-primary" href={provenancePath(productId, pageContext)}>查看相关资料 →</Link></section>
      </div>
    </SiteShell>
  );
}
