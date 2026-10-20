import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../components/site-shell";
import { ProductTree } from "../../../components/product-tree";
import { manufacturingProcessPath, mapPath, materialObservationsPath, provenancePath, supplyChainPath, tradeGuidePath } from "../../../lib/paths";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../lib/context";
import {
  StatusBadge,
  WarningList
} from "../../../components/data-display";

export default async function ProductOverviewPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<SearchParamsLike>;
}) {
  const { productId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  const breakdown = queries.getProductBreakdown(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !breakdown || !provenance) notFound();
  const coverageByItemId = new Map(overview.componentCoverage.map((coverage) => [coverage.item.id, coverage]));
  const publishedComponents = overview.componentCoverage.filter((coverage) => coverage.status === "route_published");
  const processChains = [...new Map(overview.componentCoverage.flatMap((coverage) => coverage.processChains).map((chain) => [chain.id, chain])).values()];
  const mismatches = contextMismatch(pageContext, { period: overview.period.label, datasetVersion: overview.datasetVersion.version, contentVersion: provenance.route.contentVersion?.version });

  return (
    <SiteShell>
      <div className="content-column">
        <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: overview.product.name }]} />
        <ContextBanner period={overview.period.label} datasetVersion={overview.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={mismatches} />
        <PageIntro
          eyebrow={`${overview.product.category} / ${overview.product.slug}`}
          title={overview.product.name}
          description="从部件组成出发，沿供应链探索各国的生产与贸易联系。"
          actions={<><Link className="button button-primary" href={supplyChainPath(productId, undefined, pageContext)}>查看供应链路线</Link><Link className="button button-secondary" href={mapPath({ ...pageContext, product: productId, layer: "supply-chain" })}>在地图上探索</Link><Link className="button button-secondary" href={tradeGuidePath({ product: productId, ...pageContext })}>查进出口要求</Link><Link className="button button-secondary" href={materialObservationsPath(productId, pageContext)}>材料贸易观察</Link></>}
        />




        <nav className="exploration-nav" aria-label="商品研究层级">
          <span className="active">① 商品总览</span>
                    <Link href={supplyChainPath(productId, undefined, pageContext)}>② 供应链路线</Link>
          <Link href={materialObservationsPath(productId, pageContext)}>③ 材料贸易</Link>
          <Link href={tradeGuidePath({ product: productId, ...pageContext })}>④ 进出口指南</Link>
          <Link href={provenancePath(productId, pageContext)}>⑤ 来源与版本</Link>
        </nav>

        <section className="product-focus-strip" aria-label="当前商品覆盖重点">
          <div>
            <span className="product-focus-kicker">当前深度案例</span>
            <strong>{publishedComponents.length ? publishedComponents.map((coverage) => coverage.item.name).join("、") : "正在整理"}</strong>

          </div>
          <div className="product-focus-meta">
            <span><strong>{publishedComponents.length}</strong> 个组件已有路线</span>
            {publishedComponents[0] ? <Link className="button button-primary" href={supplyChainPath(productId, publishedComponents[0].item.id, pageContext)}>开始查看 →</Link> : null}
          </div>
        </section>




        <section className="section-block" aria-labelledby="breakdown-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Product breakdown</p>
              <h2 id="breakdown-title">商品拆解树</h2>
            </div>
            <span className="section-caption">{overview.directChildren.length} 个部件 · 选择节点查看路线</span>
          </div>
          <ProductTree root={breakdown} maxDepth={1} productId={productId} componentCoverage={overview.componentCoverage} context={pageContext} />
        </section>

        <section className="section-block" aria-labelledby="children-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">First-level components</p>
              <h2 id="children-title">商品由哪些部分组成？</h2>
            </div>
            <span className="section-caption">先看组件，再进入对应的供应链路线</span>
          </div>
          <div className="component-grid">
            {overview.directChildren.map((item) => {
              const coverage = coverageByItemId.get(item.id);
              const hasInspectableStory = coverage?.hasInspectableStory ?? false;
              return hasInspectableStory ? <Link className="component-card" href={supplyChainPath(productId, item.id, pageContext)} key={item.id}>
                <span className="card-kicker">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description ?? "暂无说明"}</p>
                <span className={`coverage-status coverage-status-${coverage?.status ?? "catalog_only"}`}>{coverage?.statusLabel ?? "组件记录，路线待补"}</span>
                <StatusBadge status={item.dataStatus} method={item.method} />
                <span className="card-footer">{coverage?.status === "partial_route" ? "查看已整理环节" : "进入代表性路径"} <span>→</span></span>
              </Link> : <article className="component-card component-card-disabled" key={item.id}>
                <span className="card-kicker">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description ?? "暂无说明"}</p>
                <span className={`coverage-status coverage-status-${coverage?.status ?? "catalog_only"}`}>{coverage?.statusLabel ?? "组件记录，路线待补"}</span>
                <StatusBadge status={item.dataStatus} method={item.method} />
                <span className="card-footer">尚无已发布供应链路线</span>
              </article>;
            })}
          </div>
        </section>

        {processChains.length > 0 && <section className="section-block" aria-labelledby="process-depth-title">
          <div className="section-heading">
            <div><p className="eyebrow">Process and equipment depth</p><h2 id="process-depth-title">深入到工序、设备与厂商</h2></div>
            <span className="section-caption">逐步查看制造过程</span>
          </div>
          <div className="process-chain-entry-grid">
            {processChains.map((chain) => <article className="process-chain-entry" key={chain.id}>
              <span className="card-kicker">{chain.item?.name ?? "制造工艺"}</span>
              <h3>{chain.title}</h3>
              <p>按工序查看所需设备类别，以及公开资料支持的设备厂商能力。</p>
              <div className="process-chain-entry-meta"><span>{chain.stepCount} 道关键工序</span><span>{chain.equipmentCategoryCount} 类设备</span><span>{chain.manufacturerCount} 家已整理厂商</span></div>
              <Link className="button button-primary" href={manufacturingProcessPath(productId, chain.id, pageContext)}>查看工艺与设备 →</Link>
            </article>)}
          </div>
        </section>}

        <details className="section-block coverage-details" aria-labelledby="coverage-title">
          <summary className="section-heading coverage-summary">
            <div><p className="eyebrow">Data layer coverage</p><h2 id="coverage-title">组件数据覆盖矩阵</h2></div>
            <span className="section-caption">点击展开查看详细覆盖状态</span>
          </summary>
          <div className="coverage-list">
            {overview.componentCoverage.map((coverage) => (
              <article className="coverage-row" key={coverage.item.id}>
                <div><strong>{coverage.item.name}</strong><span className="muted">{coverage.item.category}</span></div>
                <span className={`coverage-status coverage-status-${coverage.status}`}>{coverage.statusLabel}</span>
                <span className="muted">节点 {coverage.nodeCount} · 连接 {coverage.flowCount} · 缺口 {coverage.evidenceGapCount}</span>
                <span className="muted">{coverage.statusDescription}</span>
                <span className="muted">证据：{coverage.evidenceLevels.length ? coverage.evidenceLevels.join("、") : "尚无路线证据"}</span>
                {coverage.classificationMappings.length > 0 && <div className="muted">
                  分类候选：{coverage.classificationMappings.map(({ classification, mappingType }) => `${classification.system} ${classification.version}/${classification.code} · ${mappingType}`).join("；")}
                  <br />限制：{coverage.classificationMappings.map(({ limitation }) => limitation).join("；")}
                </div>}
              </article>
            ))}
          </div>
        </details>

        <details className="section-block detail-collapsible method-details" aria-label="页面方法说明">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">Data notes</p><h2>数据说明</h2></div><span className="section-caption">了解数据如何整理</span></summary>
          <div className="method-strip">
          <div>
            <p className="eyebrow">Method boundary</p>
            <h2>如何阅读这张链路</h2>
          </div>
          <WarningList warnings={overview.warnings} />
          <p>供应链流是人工整理的代表性内容；贸易观察与宏观指标是独立事实类型。路线金额或数量只在数据明确发布时展示，缺失值不会被补成零。</p>
          <Link className="button button-secondary" href={provenancePath(productId, pageContext)}>查看来源与版本</Link>
          </div>
        </details>

        <section className="hierarchy-next-step"><strong>继续探索</strong><span>选择一个组件，沿着路线继续探索。</span><Link className="button button-primary" href={supplyChainPath(productId, undefined, pageContext)}>进入供应链路线 →</Link></section>
      </div>
    </SiteShell>
  );
}
