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
  StatCard,
  StatusBadge,
  UnknownValue,
  WarningList
} from "../../../../components/data-display";
import { FlowTable } from "../../../../components/flow-table";
import { SupplyChainGraph } from "../../../../components/supply-chain-graph";
import { evidenceGapsPath, ledgerPath, manufacturingProcessPath, nodePath, productPath, provenancePath, supplyChainPath } from "../../../../lib/paths";

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
      label,
      granularity: overview.period.granularity
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
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId, pageContext) },
          { label: "供应链路径" }
        ]} />
        <ContextBanner period={story.period.label} datasetVersion={story.datasetVersion.version} contentVersion={story.route.contentVersion?.version} mismatches={contextMismatches} />
        <PageIntro
          eyebrow="Representative supply chain"
          title={`${overview.product.name} · ${focusName}`}
          description={story.route.representativeStatement ?? "这是经过整理的代表性供应链内容，不宣称唯一、完整或实时。"}
          actions={(
            <>
              <Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link>
              <Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>证据缺口登记册</Link>
            </>
          )}
        />

        <section className="exploration-position" aria-label="当前探索位置">
          <span className="exploration-position-label">当前探索</span>
          <strong>{overview.product.name}</strong>
          <span>{focusName} · {story.period.label}</span>
        </section>

        <div className="stat-grid">
          <StatCard label="路径节点" value={story.nodes.length} detail="国家/市场与商品节点" />
          <StatCard label="流转关系" value={story.flows.length} detail="每条边独立标记证据等级" />
          <StatCard label="证据缺口" value={story.evidenceGaps.length} detail="节点与连接的待验证主张" />
          <StatCard label="期间" value={<PeriodLabel period={story.period} />} detail={story.period.start} />
          <StatCard label="内容版本" value={story.route.contentVersion?.version ?? "未提供"} detail={`数据集 ${story.datasetVersion.version}`} />
        </div>

        {story.warnings.length > 0 && <details className="detail-collapsible compact-detail">
          <summary className="detail-summary"><strong>阅读提示与限制</strong><span>{story.warnings.length} 条</span></summary>
          <WarningList warnings={story.warnings} />
        </details>}

        <section className="route-declaration" aria-label="代表性路线声明">
          <div>
            <p className="eyebrow">Interpretation boundary</p>
            <h2>如何理解这条路线</h2>
            <p>{story.route.representativeStatement ?? "代表性路线不等于某件具体商品的唯一真实路线。"}</p>
          </div>
          <details className="route-declaration-details">
            <summary>查看数据与证据等级</summary>
          <div className="route-declaration-meta">
            <MetadataItem label="method" value={story.route.method} />
            <MetadataItem label="datasetVersion" value={story.datasetVersion.version} />
            <MetadataItem label="contentVersion" value={story.route.contentVersion?.version ?? <UnknownValue label="未提供" />} />
          </div>
          <EvidenceLevelLegend levels={[
            ...story.nodes.map((node) => node.evidenceLevel),
            ...story.flows.map((flow) => flow.evidenceLevel)
          ]} />
          </details>
        </section>

        <section className="filter-strip" aria-label="路径筛选">
          <div>
            <span className="filter-label">聚焦商品</span>
            <div className="filter-links">
              <Link className={!focusItemId ? "filter-chip active" : "filter-chip"} href={supplyChainPath(productId, undefined, pageContext)}>全部</Link>
              {overview.directChildren.map((item) => (
                <Link
                  className={focusItemId === item.id ? "filter-chip active" : "filter-chip"}
                  href={supplyChainPath(productId, item.id, pageContext)}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <span className="filter-note">期间筛选：{story.period.label}</span>
        </section>

        <nav className="exploration-nav" aria-label="商品研究层级">
          <Link href={productPath(productId, pageContext)}>① 商品总览</Link>
          <span className="active">② 供应链路线</span>
          <Link href={evidenceGapsPath(productId, pageContext)}>③ 证据缺口</Link>
          <Link href={provenancePath(productId, pageContext)}>④ 来源与版本</Link>
        </nav>

        <section className="interpretation-summary" aria-labelledby="interpretation-summary-title">
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

        {focusedProcessChains.length > 0 && <section className="process-depth-callout" aria-label="工艺与设备深度入口">
          <div><p className="eyebrow">Go deeper</p><h2>继续深入到具体工序与设备</h2><p>国家角色视图之下，还可以逐道查看制造工序、设备类别和公开资料支持的设备厂商。</p></div>
          <div className="process-depth-callout-actions">{focusedProcessChains.map((chain) => <Link className="button button-primary" href={manufacturingProcessPath(productId, chain.id, pageContext)} key={chain.id}>{chain.title} →</Link>)}</div>
        </section>}

        <SupplyChainGraph story={story} productId={productId} context={pageContext} />

        <section className="section-block" aria-labelledby="route-steps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Route steps</p>
              <h2 id="route-steps-title">按环节阅读</h2>
            </div>
            <span className="section-caption">表格优先，保证每条边都有出处和状态</span>
          </div>
          <div className="step-stack">
            {story.steps.map((view) => {
              const { step } = view;
              return (
                <details className="step-card step-card-collapsible" id={`route-step-${step.id}`} key={step.id} open={step.order === 0}>
                  <summary className="step-summary">
                    <span className="step-marker">{String(step.order + 1).padStart(2, "0")}</span>
                    <span className="step-summary-copy"><strong>{step.title}</strong><small>{step.description}</small><em>第 {step.order + 1} 步 / 共 {story.steps.length} 步</em></span>
                    <span className="step-summary-meta"><span className="content-status">{step.contentStatus}</span><span className="method-chip">{step.method}</span></span>
                  </summary>
                  <div className="step-body">
                    <div className="step-heading">
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                      <div className="step-status-stack">
                        <span className="content-status">{step.contentStatus}</span>
                        <span className="method-chip">{step.method}</span>
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
                      <div className="step-version-meta">
                        <MetadataItem label="contentVersion" value={view.contentVersion?.version ?? <UnknownValue label="未提供" />} />
                        <MetadataItem label="来源" value={`${view.sources.length} 个`} />
                        <MetadataItem label="证据" value={`${view.evidence.length} 条`} />
                      </div>
                    </div>
                    <FlowTable flows={view.flows} productId={productId} context={pageContext} />
                    <details className="step-evidence-details">
                      <summary>查看本步骤的直接证据定位</summary>
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

        <section className="section-block evidence-gap-section" aria-labelledby="route-gaps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evidence gap registry</p>
              <h2 id="route-gaps-title">当前路线的证据缺口</h2>
            </div>
            <Link className="text-link" href={evidenceGapsPath(productId, pageContext)}>查看完整登记册 →</Link>
          </div>
          <p className="section-caption">缺口不会被默认补成零；国家角色、双边流向和代表性策展连接分别记录。</p>
          <div className="hierarchy-card"><strong>{story.evidenceGaps.length} 条证据缺口登记</strong><span>当前页面只显示摘要；进入证据缺口页面查看逐条主张、候选来源和不可推断内容。</span><Link className="button button-secondary" href={evidenceGapsPath(productId, pageContext)}>打开证据缺口登记册 →</Link></div>
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
                  <span className="node-type">{node.node.nodeType}</span>
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
                  <MetadataItem label="datasetVersion" value={node.datasetVersion?.version ?? <UnknownValue label="未提供" />} />
                  <MetadataItem label="contentVersion" value={node.contentVersion?.version ?? <UnknownValue label="未提供" />} />
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
        <section className="hierarchy-next-step"><strong>下一层</strong><span>需要查看完整来源、证据定位、许可证和版本信息？</span><Link className="button button-primary" href={provenancePath(productId, pageContext)}>进入来源与版本 →</Link></section>
      </div>
    </SiteShell>
  );
}
