import { createRoot } from "react-dom/client";
import { createInMemoryFixtureRepository, createProductQueryService, type ReadonlyProductFixture, type ProductBreakdownNode } from "@globe-chain/domain";
import { WorldCountryMap } from "../components/world-country-map";
import { mapValue } from "../components/map-record-details";
import { createMapView } from "../lib/map-view-model";
import { itemLabel } from "../lib/item-label";
import { mapPath, productPath, provenancePath, type MapFilters } from "../lib/paths";
import Link, { useLocation } from "./navigation";
import "../app/globals.css";
import "../app/atlas-navigation.css";
import "../app/interaction.css";
import "../app/mobile.css";
import "../app/map-focus.css";
import "./preview.css";

const root = createRoot(document.getElementById("root")!);

function Breakdown({ node }: { node: ProductBreakdownNode }) {
  return <li>{itemLabel(node.item)}{node.children.length > 0 && <ul>{node.children.map(child => <Breakdown key={child.item.id} node={child} />)}</ul>}</li>;
}

function App({ fixtures }: { fixtures: readonly ReadonlyProductFixture[] }) {
  const url = new URL(useLocation());
  const productRoute = url.pathname.match(/^\/products\/([^/]+)(?:\/(.*))?$/);
  const requested = productRoute?.[1] ?? url.searchParams.get("product");
  const params = url.searchParams;
  const fixture = fixtures.find(snapshot => snapshot.productId === requested) ?? fixtures[0];
  const product = fixture.productId;
  const layer = url.pathname.endsWith("/supply-chain") || params.get("layer") === "supply-chain" ? "supply-chain" : "trade";
  const focus = params.get("focus") ?? undefined;
  const direction = params.get("direction");
  const scope = params.get("scope");
  const filters: MapFilters & { product: string } = {
    product, layer, focus,
    items: params.get("items") ?? (layer === "trade" && !focus ? product : undefined),
    year: params.get("year") ?? params.get("label") ?? params.get("period") ?? undefined,
    country: params.get("country") ?? undefined,
    direction: direction === "import" || direction === "export" ? direction : undefined,
    scope: scope === "world" || scope === "bilateral" ? scope : undefined,
    currency: params.get("currency") ?? undefined,
    measure: params.get("measure") === "quantity" ? "quantity" : undefined,
    unit: params.get("unit") ?? undefined
  };
  const products = queries.listProducts().map(entry => ({ id: entry.productId, name: itemLabel(entry.item) }));
  const title = products.find(entry => entry.id === product)?.name;
  const subsection = productRoute?.[2] ?? "";
  const breakdown = queries.getProductBreakdown(product);
  const ledgerId = subsection.match(/^ledger\/([^/]+)$/)?.[1];
  const materialId = subsection.match(/^materials\/([^/]+)$/)?.[1];
  const nodeId = subsection.match(/^nodes\/([^/]+)$/)?.[1];
  const ledger = ledgerId ? queries.getCountryLedger(product, ledgerId) : null;
  const material = materialId ? queries.getMaterialTradeObservation(product, materialId) : null;
  const node = nodeId ? queries.getSupplyChainNode(product, nodeId) : null;
  const isMap = !productRoute || subsection === "supply-chain";
  const view = isMap ? createMapView(queries, filters) ?? createMapView(queries, { ...filters, focus: undefined, items: product }) : null;

  return <div className="competition-shell">
    <header className="competition-header"><Link href="/">GlobeChain</Link><span>全球商品供应链与贸易地图</span></header>
    <main className="content-column wide-column atlas-page">
      <header className="atlas-page-heading"><h1>{isMap ? "世界地图" : title}</h1>
        {isMap && <nav className="atlas-layer-switch" aria-label="地图图层">
          <Link aria-current={layer === "trade" ? "page" : undefined} href={mapPath({ ...filters, layer: "trade", year: undefined })}>官方贸易统计</Link>
          <Link aria-current={layer === "supply-chain" ? "page" : undefined} href={mapPath({ ...filters, layer: "supply-chain", year: undefined, direction: undefined, scope: undefined })}>代表性供应链</Link>
        </nav>}
      </header>
      <nav className="product-level-nav" aria-label="当前商品探索">
        <Link aria-current={isMap ? "page" : undefined} href={mapPath({ product })}>世界地图</Link>
        <Link href={productPath(product)}>商品拆解</Link>
        <Link href={provenancePath(product)}>资料来源</Link>
      </nav>
      {view && <WorldCountryMap key={product + layer} view={view} filters={filters} products={products} />}
      {productRoute && !subsection && breakdown && <section className="competition-card"><h2>商品拆解</h2><ul><Breakdown node={breakdown} /></ul></section>}
      {subsection === "provenance" && <section className="competition-card"><h2>资料来源</h2><p>{fixture.datasetVersion.version}</p><ul>{fixture.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> : source.name}</li>)}</ul></section>}
      {ledger && <section className="competition-card"><h2>报告国账本</h2><ul>{ledger.tradeObservations.map(observation => { const source = fixture.sources.find(entry => entry.id === observation.sourceId); return <li key={observation.id}>{observation.period.label} · {observation.direction === "export" ? "出口" : "进口"} · HS {observation.classificationCode} · {mapValue(observation.value ?? null, observation.valueDataStatus ?? observation.dataStatus, observation.currency ?? null)}{source?.url && <> · <a href={source.url} target="_blank" rel="noreferrer">{source.publisher} ↗</a></>}</li>; })}</ul></section>}
      {material && <section className="competition-card"><h2>材料统计详情</h2><p>{material.observation.period.label} · HS {material.observation.classificationCode} · {mapValue(material.observation.value, material.observation.valueDataStatus, material.observation.currency)}</p><Link href={provenancePath(product)}>资料来源 →</Link></section>}
      {node && <section className="competition-card"><h2>{node.node.node.label}</h2><p>{node.node.period.label}</p><Link href={provenancePath(product)}>资料来源 →</Link></section>}
      {!isMap && subsection && subsection !== "provenance" && !ledger && !material && !node && <p>当前快照未收录这条记录。</p>}
    </main>
  </div>;
}

let queries: ReturnType<typeof createProductQueryService>;
fetch("/fixtures.json").then(response => {
  if (!response.ok) throw new Error("无法读取发布快照");
  return response.json() as Promise<readonly ReadonlyProductFixture[]>;
}).then(fixtures => {
  if (!fixtures.length) throw new Error("发布快照为空");
  queries = createProductQueryService(createInMemoryFixtureRepository(fixtures));
  root.render(<App fixtures={fixtures} />);
}).catch(() => root.render(<main className="competition-card"><h1>贸易地图暂时无法加载</h1><button onClick={() => window.location.reload()}>重新加载</button></main>));
