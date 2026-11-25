import { itemLabel } from "../../../lib/item-label";
import { ProductNavigation } from "../../../components/product-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../lib/data";
import { ContextBanner, PageIntro, SiteShell } from "../../../components/site-shell";
import { ProductTree } from "../../../components/product-tree";
import { ProductArtwork } from "../../../components/product-artwork";
import { industryPath, manufacturingProcessPath, mapPath, materialObservationsPath, provenancePath, supplyChainPath, tradeGuidePath } from "../../../lib/paths";
import { contextMismatch, firstParam, readPageContext, type SearchParamsLike } from "../../../lib/context";
import { buildExplodedModel } from "../../../lib/exploded-model";
import { ExplodedExplorer } from "../../../components/exploded-explorer";
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
  const queryParams = await searchParams;
  const pageContext = readPageContext(queryParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const routeContext = { datasetVersion: pageContext.datasetVersion, contentVersion: pageContext.contentVersion };
  const overview = queries.getProductOverview(productId);
  const breakdown = queries.getProductBreakdown(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !breakdown || !provenance) notFound();
  const coverageByItemId = new Map(overview.componentCoverage.map((coverage) => [coverage.item.id, coverage]));
  const tradeItems = new Set(queries.getTradeMapView(productId)?.itemCoverage.filter(entry => entry.directObservationCount > 0).map(entry => entry.item.id));
  const industry = queries.getIndustryNetwork(productId);
  const hasGuides = queries.getTradeGuides(productId).length > 0;
  const hasMaterialTrade = queries.getMaterialTradeObservations(productId).length > 0;
  const completeStory = queries.getSupplyChainStory(productId);
  const explorableItemIds = [...new Set([...(completeStory?.nodes.flatMap((node) => node.item ? [node.item.id] : []) ?? []), ...(completeStory?.flows.map((flow) => flow.flow.itemId) ?? [])])];
  const focusParam = firstParam(queryParams.focus);
  const ledgerEntitiesByItem: Record<string, { id: string; name: string }[]> = {};
  for (const storyNode of completeStory?.nodes ?? []) {
    if (storyNode.item && storyNode.entity) {
      const list = ledgerEntitiesByItem[storyNode.item.id] ?? [];
      if (!list.some((entry) => entry.id === storyNode.entity!.id)) {
        list.push({ id: storyNode.entity.id, name: storyNode.entity.name });
      }
      ledgerEntitiesByItem[storyNode.item.id] = list;
    }
  }
  const explodedModel = buildExplodedModel({
    root: breakdown,
    componentCoverage: overview.componentCoverage,
    tradeItems: [...tradeItems],
    explorableItemIds,
    ledgerEntitiesByItem
  });
  const processChains = [...new Map(overview.componentCoverage.flatMap((coverage) => coverage.processChains).map((chain) => [chain.id, chain])).values()];
  const mismatches = contextMismatch(pageContext, { period: overview.period.label, datasetVersion: overview.datasetVersion.version, contentVersion: provenance.route.contentVersion?.version });

  return (
    <SiteShell>
      <div className="content-column product-overview-page">
        <ProductNavigation productId={productId} context={routeContext} active="overview" hasIndustry={Boolean(industry)} hasMaterials={hasMaterialTrade}/>
        <div className="product-overview-intro product-overview-intro--compact">
        <PageIntro
          eyebrow={overview.product.category}
          title={itemLabel(overview.product)}
          description="从部件组成出发，沿供应链探索各国的生产与贸易联系。"
          meta={<ContextBanner period={overview.period.label} datasetVersion={overview.datasetVersion.version} contentVersion={provenance.route.contentVersion?.version} mismatches={mismatches} />}
          actions={<>{industry && <Link className="button button-primary" href={industryPath(productId, undefined, routeContext)}>查找中国产业上下游</Link>}<Link className="button button-primary" href={supplyChainPath(productId, undefined, routeContext)}>查看供应链路线</Link><Link className="button button-secondary" href={mapPath({ ...routeContext, product: productId, layer: "supply-chain" })}>在地图上探索</Link>{hasGuides && <Link className="button button-secondary" href={tradeGuidePath({ product: productId, ...pageContext })}>查进出口要求</Link>}{hasMaterialTrade && <Link className="button button-secondary" href={materialObservationsPath(productId, pageContext)}>材料贸易观察</Link>}</>}
        />
        <ProductArtwork productId={productId} variant="overview" />
        </div>

        <ExplodedExplorer model={explodedModel} productId={productId} context={routeContext} initialFocus={focusParam} />

        <section className="section-block" aria-labelledby="children-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">商品组成</p>
              <h2 id="children-title">商品由哪些部分组成？</h2>
            </div>
            <span className="section-caption">先看组件，再进入对应的供应链路线</span>
          </div>
          <div className="component-grid">
            {overview.directChildren.map((item) => {
              const coverage = coverageByItemId.get(item.id);
              const processChain = coverage?.processChains[0];
              const hasInspectableStory = coverage?.hasInspectableStory ?? false;
              const target = hasInspectableStory ? supplyChainPath(productId, item.id, routeContext) : processChain ? manufacturingProcessPath(productId, processChain.id, routeContext) : tradeItems.has(item.id) ? mapPath({ ...routeContext, product: productId, layer: "trade", items: item.id }) : null;
              return target ? <Link className="component-card" href={target} key={item.id}>
                <span className="card-kicker">{item.category}</span>
                <h3>{item.name}</h3>
                {item.description ? <p>{item.description}</p> : null}
                <span className="muted">{hasInspectableStory ? `${coverage?.nodeCount} 个生产环节` : processChain ? `${processChain.stepCount} 道制造工序` : ""}</span>
                <StatusBadge status={item.dataStatus} method={item.method} />
                <span className="card-footer">{hasInspectableStory ? "探索生产路线" : processChain ? "查看制造工序" : "查看贸易地图"} <span>→</span></span>
              </Link> : <article className="component-card component-card-disabled" key={item.id}>
                <span className="card-kicker">{item.category}</span>
                <h3>{item.name}</h3>
                {item.description ? <p>{item.description}</p> : null}
                <span className="muted">{hasInspectableStory ? `${coverage?.nodeCount} 个生产环节` : processChain ? `${processChain.stepCount} 道制造工序` : ""}</span>
                <StatusBadge status={item.dataStatus} method={item.method} />
                <span className="card-footer">尚无已发布供应链路线</span>
              </article>;
            })}
          </div>
        </section>

        <details className="section-block detail-collapsible">
          <summary className="section-heading detail-summary"><div><p className="eyebrow">完整拆解</p><h2>展开完整拆解树</h2></div><span className="section-caption">从整件商品查看组成关系</span></summary>
          <ProductTree root={breakdown} productId={productId} componentCoverage={overview.componentCoverage} tradeItems={tradeItems} explorableItemIds={explorableItemIds} context={routeContext} />
        </details>

        {processChains.length > 0 && <section className="section-block" aria-labelledby="process-depth-title">
          <div className="section-heading">
            <div><p className="eyebrow">工艺与设备</p><h2 id="process-depth-title">深入制造过程</h2></div>
            <span className="section-caption">逐步查看制造过程</span>
          </div>
          <div className="process-chain-entry-grid">
            {processChains.map((chain) => <article className="process-chain-entry" key={chain.id}>
              <span className="card-kicker">{chain.item?.name ?? "制造工艺"}</span>
              <h3>{chain.title}</h3>
              <p>{chain.equipmentCategoryCount > 0 ? "按工序了解投入、产出、设备与厂商资料。" : "按工序查看材料如何加工、部件如何装配。"}</p>
              <div className="process-chain-entry-meta"><span>{chain.stepCount} 道关键工序</span>{chain.equipmentCategoryCount > 0 && <span>{chain.equipmentCategoryCount} 类设备</span>}{chain.manufacturerCount > 0 && <span>{chain.manufacturerCount} 家厂商</span>}</div>
              <Link className="button button-primary" href={manufacturingProcessPath(productId, chain.id, routeContext)}>查看制造工序 →</Link>
            </article>)}
          </div>
        </section>}

        <details className="section-block coverage-details" aria-labelledby="coverage-title">
          <summary className="section-heading coverage-summary">
            <div><p className="eyebrow">资料覆盖</p><h2 id="coverage-title">组件数据覆盖矩阵</h2></div>
            <span className="section-caption">点击展开查看详细覆盖状态</span>
          </summary>
          <div className="coverage-list">
            {overview.componentCoverage.map((coverage) => (
              <article className="coverage-row" key={coverage.item.id}>
                <div><strong>{itemLabel(coverage.item)}</strong><span className="muted">{coverage.item.category}</span></div>
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
          <summary className="section-heading detail-summary"><div><p className="eyebrow">资料说明</p><h2>数据说明</h2></div><span className="section-caption">了解数据如何整理</span></summary>
          <div className="method-strip">
          <div>
            <p className="eyebrow">阅读范围</p>
            <h2>如何阅读这张链路</h2>
          </div>
          <WarningList warnings={overview.warnings} />
          <p>供应链流是人工整理的代表性内容；贸易观察与宏观指标是独立事实类型。路线金额或数量只在数据明确发布时展示，缺失值不会被补成零。</p>
          <Link className="button button-secondary" href={provenancePath(productId, pageContext)}>查看来源与版本</Link>
          </div>
        </details>

        <section className="hierarchy-next-step"><strong>继续探索</strong><span>选择一个组件，沿着路线继续探索。</span><Link className="button button-primary" href={supplyChainPath(productId, undefined, routeContext)}>进入供应链路线 →</Link></section>
      </div>
    </SiteShell>
  );
}
