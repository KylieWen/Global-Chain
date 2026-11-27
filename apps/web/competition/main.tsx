import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createInMemoryFixtureRepository, createProductQueryService, type ReadonlyProductFixture } from "@globe-chain/domain";
import regionalNavigation from "../../../content/geography/regional-navigation.json";
import { WorldCountryMap } from "../components/world-country-map";
import { mapValue } from "../components/map-record-details";
import { createMapView } from "../lib/map-view-model";
import { itemLabel } from "../lib/item-label";
import { chinaMapPath, mapPath, productPath, provenancePath, type MapFilters } from "../lib/paths";
import Link, { MapLinkContext, useLocation } from "./navigation";
import { findTradeTimeline, type TradeTimeline } from "./trade-timeline";
import { ProductExplorer } from "./product-explorer";
import { CountryLedger, MaterialLedgerLink } from "./country-ledger";
import { DroneWorkstation } from "../components/drone-workstation";
import { ThemeSwitcher } from "../components/theme-switcher";
import { buildExplodedModel } from "../lib/exploded-model";
import { productPrototype } from "../lib/exploded-appearance";
import type { PageContext } from "../lib/context";
import "../app/globals.css";
import "../app/theme.css";
import "../app/atlas-navigation.css";
import "../app/interaction.css";
import "../app/mobile.css";
import "../app/map-focus.css";
import "../app/products/[productId]/industry/industry.css";
import "./preview.css";

const root = createRoot(document.getElementById("root")!);
const ChinaAtlas = lazy(() => import("./china-atlas").then(module => ({ default: module.CompetitionChinaAtlas })));
const Industry = lazy(() => import("./china-atlas").then(module => ({ default: module.CompetitionIndustry })));

type Queries = ReturnType<typeof createProductQueryService>;

function readMapFilters(params: URLSearchParams, product: string, supplyChainRoute = false): MapFilters & { product: string } {
  const layer = supplyChainRoute || params.get("layer") === "supply-chain" ? "supply-chain" : "trade";
  const focus = params.get("focus") ?? undefined;
  const direction = params.get("direction");
  const scope = params.get("scope");

  return {
    product, layer, focus,
    items: params.get("items") ?? (layer === "trade" && !focus ? product : undefined),
    year: params.get("year") ?? params.get("label") ?? params.get("period") ?? undefined,
    country: params.get("country") ?? undefined,
    direction: direction === "import" || direction === "export" ? direction : undefined,
    scope: scope === "world" || scope === "bilateral" ? scope : undefined,
    currency: params.get("currency") ?? undefined,
    measure: params.get("measure") === "quantity" ? "quantity" : undefined,
    unit: params.get("unit") ?? undefined,
    datasetVersion: params.get("datasetVersion") ?? undefined,
    contentVersion: params.get("contentVersion") ?? undefined
  };
}

function competitionChinaPath(product: string, worldSearch?: string, nested?: URLSearchParams) {
  // Top-level navigation resets transient selection (province/stage/node), matching
  // the Next app's ProductNavigation. Those filters are restored only from a nested
  // `china=` search carried over from the industry page.
  const context: { product: string; map?: string; province?: string; stage?: string; node?: string } = {
    product,
    map: worldSearch
  };
  if (nested) {
    context.province = nested.get("province") ?? undefined;
    context.stage = nested.get("stage") ?? undefined;
    context.node = nested.get("node") ?? undefined;
  }
  return chinaMapPath(context);
}

function App({ fixtures, queries, timelines }: { fixtures: readonly ReadonlyProductFixture[]; queries: Queries; timelines: readonly TradeTimeline[] }) {
  const url = new URL(useLocation());
  const productRoute = url.pathname.match(/^\/products\/([^/]+)(?:\/(.*))?$/);
  const requested = productRoute?.[1] ?? url.searchParams.get("product");
  const params = url.searchParams;
  const fixture = fixtures.find(snapshot => snapshot.productId === requested) ?? fixtures[0];
  const product = fixture.productId;
  const filters = readMapFilters(params, product, url.pathname.endsWith("/supply-chain"));
  const layer = filters.layer;
  const products = queries.listProducts().map(entry => ({ id: entry.productId, name: itemLabel(entry.item) }));
  const title = products.find(entry => entry.id === product)?.name;
  const subsection = productRoute?.[2] ?? "";
  const breakdown = queries.getProductBreakdown(product);
  const overview = queries.getProductOverview(product);
  const provenance = queries.getProvenance(product);
  const completeStory = queries.getSupplyChainStory(product);
  const tradeMapView = queries.getTradeMapView(product);
  const tradeItems = new Set(
    (tradeMapView?.itemCoverage ?? []).filter(entry => entry.directObservationCount > 0).map(entry => entry.item.id)
  );
  const explorableItemIds = [...new Set([
    ...(completeStory?.nodes.flatMap(node => (node.item ? [node.item.id] : [])) ?? []),
    ...(completeStory?.flows.map(flow => flow.flow.itemId) ?? [])
  ])];
  const ledgerEntitiesByItem: Record<string, { id: string; name: string }[]> = {};
  for (const node of completeStory?.nodes ?? []) {
    if (node.item && node.entity) {
      const list = ledgerEntitiesByItem[node.item.id] ?? [];
      if (!list.some(entry => entry.id === node.entity!.id)) list.push({ id: node.entity!.id, name: node.entity!.name });
      ledgerEntitiesByItem[node.item.id] = list;
    }
  }
  const isDronePrototype = productPrototype(product) === "drone";
  const routeContext: PageContext = {
    period: overview?.period.label,
    datasetVersion: fixture.datasetVersion.version,
    contentVersion: provenance?.route.contentVersion?.version ?? undefined
  };
  const explodedModel = breakdown && overview ? buildExplodedModel({
    root: breakdown,
    componentCoverage: overview.componentCoverage,
    tradeItems,
    explorableItemIds,
    ledgerEntitiesByItem
  }) : null;
  const storyReadingSteps = completeStory
    ? (completeStory.steps.filter(step => step.flows.length > 0).length > 0
      ? completeStory.steps.filter(step => step.flows.length > 0)
      : completeStory.steps)
    : [];
  const ledgerId = subsection.match(/^ledger\/([^/]+)$/)?.[1];
  const materialId = subsection.match(/^materials\/([^/]+)$/)?.[1];
  const nodeId = subsection.match(/^nodes\/([^/]+)$/)?.[1];
  const ledger = ledgerId ? queries.getCountryLedger(product, ledgerId) : null;
  const material = materialId ? queries.getMaterialTradeObservation(product, materialId) : null;
  const node = nodeId ? queries.getSupplyChainNode(product, nodeId) : null;
  const isChina = url.pathname === "/map/china" || url.pathname === "/map/china/";
  const isIndustry = subsection === "industry";
  const isDroneRoute = isDronePrototype && subsection === "supply-chain";
  const isMap = !isChina && (!productRoute || (subsection === "supply-chain" && !isDroneRoute));
  const chinaParams = new URLSearchParams(isIndustry ? params.get("china") ?? "" : "");
  const mapParams = new URLSearchParams(chinaParams.get("map") ?? params.get("map") ?? "");
  const mapProduct = mapParams.get("product");
  const hasOriginMap = fixtures.some(entry => entry.productId === mapProduct) && (isChina || chinaParams.get("product") === product || mapProduct === product);
  const mapFilters = isMap ? filters : hasOriginMap && mapProduct ? readMapFilters(mapParams, mapProduct) : null;
  const mapHref = mapPath(mapFilters ?? { product });
  const worldSearch = mapFilters ? mapHref.split("?")[1] : undefined;
  const chinaHref = competitionChinaPath(product, worldSearch, isIndustry ? chinaParams : undefined);
  const chinaSearch = isChina || chinaParams.get("product") === product ? chinaHref.split("?")[1] : undefined;
  const mapContext = worldSearch || chinaSearch ? { product, search: worldSearch, china: chinaSearch } : null;
  const regionalLinks = regionalNavigation.map(region => ({ ...region, href: chinaHref }));
  const industry = isChina || isIndustry ? queries.getIndustryNetwork(product, { topicId: isIndustry ? params.get("topic") ?? undefined : undefined }) : null;
  const view = isMap ? createMapView(queries, filters) ?? createMapView(queries, { ...filters, focus: undefined, items: product }) : null;
  const timeline = timelines.find(candidate => candidate.product === product) ?? timelines[0];
  const isTimelineOpen = timeline && filters.product === timeline.product && layer === "trade" &&
    filters.scope === "bilateral" && filters.items === timeline.product && filters.currency === timeline.currency &&
    filters.country === timeline.country && filters.direction === timeline.direction &&
    !filters.focus && !filters.measure && filters.year && timeline.years.includes(filters.year);

  return <MapLinkContext.Provider value={mapContext}><div className="competition-shell">
    <header className="competition-header"><Link href="/">Global Chain</Link><span>全球商品供应链与贸易地图</span><ThemeSwitcher /></header>
    <main className={`content-column wide-column atlas-page${isChina ? " china-atlas-page" : ""}${isIndustry ? " industry-page" : ""}`}>
      <header className={isChina ? "regional-heading" : "atlas-page-heading"}><h1>{isMap ? "世界地图" : isChina ? "中国供应链" : isIndustry ? `${title} · 产业上下游` : title}</h1>
        {isChina && <Link className="text-link" href={mapHref}>← 返回世界地图</Link>}
        {isIndustry && <Link className="text-link" href={chinaHref}>← 返回中国供应链</Link>}
        {isMap && <nav className="atlas-layer-switch" aria-label="地图图层">
          <Link aria-current={layer === "trade" ? "page" : undefined} href={mapPath({ ...filters, layer: "trade", year: undefined })}>官方贸易统计</Link>
          <Link aria-current={layer === "supply-chain" ? "page" : undefined} href={mapPath({ ...filters, layer: "supply-chain", year: undefined, direction: undefined, scope: undefined })}>代表性路线</Link>
        </nav>}
        {isMap && <Link className="text-link atlas-directory-link" href={chinaHref}>走进中国供应链 →</Link>}
      </header>
      <nav className="product-level-nav" aria-label="当前商品探索">
        <Link aria-current={isMap ? "page" : undefined} href={mapHref}>世界地图</Link>
        <Link aria-current={isChina ? "page" : undefined} href={chinaHref}>中国供应链</Link>
        <Link href={productPath(product)}>商品拆解</Link>
        <Link href={provenancePath(product)}>资料来源</Link>
        {isMap && timeline && !isTimelineOpen && <Link className="competition-timeline-link"
          href={mapPath({ product: timeline.product, layer: "trade", scope: "bilateral", items: timeline.product,
            currency: timeline.currency, country: timeline.country, direction: timeline.direction, year: timeline.years[0] })}>
          看历年贸易 →
        </Link>}
      </nav>
      {view && <WorldCountryMap key={product + layer} view={view} filters={filters} products={products} regionalLinks={regionalLinks} />}
      {isChina && <Suspense fallback={<p role="status">正在加载中国供应链地图…</p>}>
        <ChinaAtlas product={product} products={products} industry={industry} worldSearch={worldSearch} />
      </Suspense>}
      {isIndustry && industry && <Suspense fallback={<p role="status">正在加载产业上下游…</p>}>
        <Industry product={product} view={industry} />
      </Suspense>}
      {productRoute && !subsection && breakdown && isDronePrototype && explodedModel && (
        <DroneWorkstation
          model={explodedModel}
          productId={product}
          context={routeContext}
          initialFocus={params.get("focus")}
          evidenceGapCount={provenance?.evidenceGaps.length ?? 0}
        />
      )}
      {productRoute && !subsection && breakdown && !(isDronePrototype && explodedModel) && (
        <ProductExplorer breakdown={breakdown} queries={queries} />
      )}
      {isDroneRoute && completeStory && (
        <section className="competition-card route-story">
          <h2>{title} · 代表性路线</h2>
          <div className="step-stack">
            {storyReadingSteps.map((view, index) => (
              <details className="step-card step-card-collapsible" key={view.step.id} open={index === 0}>
                <summary className="step-summary">
                  <span className="step-marker">{String(index + 1).padStart(2, "0")}</span>
                  <span className="step-summary-copy"><strong>{view.step.title}</strong><small>{view.step.description}</small></span>
                </summary>
                <div className="step-body">
                  <div className="step-node-list">
                    {view.nodes.map(node => <span className="step-node-chip" key={node.node.id}>{node.node.label}</span>)}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
      {subsection === "provenance" && <section className="competition-card"><h2>资料来源</h2><p>{fixture.datasetVersion.version}</p><ul>{fixture.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> : source.name}</li>)}</ul></section>}
      {ledger && <CountryLedger key={`${product}:${ledger.entity.id}:${filters.focus ?? ""}:${filters.year ?? ""}`} ledger={ledger}
        initialItem={filters.focus} initialYear={filters.year} materials={queries.getMaterialTradeObservations(product, { reporterEntityId: ledger.entity.id })} />}
      {material && <section className="competition-card"><h2>材料统计详情</h2><p>{material.observation.period.label} · HS {material.observation.classificationCode} · {mapValue(material.observation.value, material.observation.valueDataStatus, material.observation.currency)}</p><p><MaterialLedgerLink product={product} material={material} /></p><Link href={provenancePath(product)}>资料来源 →</Link></section>}
      {node && <section className="competition-card"><h2>{node.node.node.label}</h2><p>{node.node.period.label}</p><Link href={provenancePath(product)}>资料来源 →</Link></section>}
      {!isMap && !isDroneRoute && subsection && subsection !== "provenance" && !ledger && !material && !node && !industry && <p className="empty-state">当前快照未收录这条记录。</p>}
    </main>
  </div></MapLinkContext.Provider>;
}

fetch("/fixtures.json").then(response => {
  if (!response.ok) throw new Error("无法读取发布快照");
  return response.json() as Promise<readonly ReadonlyProductFixture[]>;
}).then(fixtures => {
  if (!fixtures.length) throw new Error("发布快照为空");
  const queries = createProductQueryService(createInMemoryFixtureRepository(fixtures));
  const timelines = fixtures.flatMap(({ productId }) => findTradeTimeline(queries, productId) ?? [])
    .sort((first, second) => Number(Boolean(second.country)) - Number(Boolean(first.country)) || second.years.length - first.years.length);
  root.render(<App fixtures={fixtures} queries={queries} timelines={timelines} />);
}).catch(() => root.render(<main className="competition-card"><h1>贸易地图暂时无法加载</h1><button onClick={() => window.location.reload()}>重新加载</button></main>));
