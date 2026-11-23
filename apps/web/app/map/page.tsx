import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "../../components/site-shell";
import { WorldCountryMap } from "../../components/world-country-map";
import { getQueryService } from "../../lib/data";
import { chinaMapPath, mapPath, provenancePath, worldStateSearch, type MapFilters } from "../../lib/paths";
import { ProductNavigation } from "../../components/product-navigation";
import { firstParam, readPageContext } from "../../lib/context";
import regionalNavigation from "../../../../content/geography/regional-navigation.json";
import { createMapView } from "../../lib/map-view-model";

export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pageContext = readPageContext(params);
  const queries = await getQueryService(pageContext.datasetVersion);
  const products = queries.listProducts();
  const productId = firstParam(params.product) ?? products[0]?.productId;
  const rawDirection = firstParam(params.direction);
  const rawScope = firstParam(params.scope);
  const focus = firstParam(params.focus);
  const layer = firstParam(params.layer) === "supply-chain" || (!params.layer && focus) ? "supply-chain" : "trade";
  const filters: MapFilters & { product: string } = {
    ...pageContext, period: undefined, label: undefined,
    product: productId ?? "", country: firstParam(params.country),
    direction: rawDirection === "import" || rawDirection === "export" ? rawDirection : undefined,
    scope: rawScope === "bilateral" || rawScope === "world" ? rawScope : undefined,
    layer, focus, items: firstParam(params.items) ?? (layer === "trade" && !focus ? productId : undefined),
    currency: firstParam(params.currency), measure: firstParam(params.measure) === "quantity" ? "quantity" : undefined,
    unit: firstParam(params.unit), year: firstParam(params.year) ?? pageContext.label ?? pageContext.period
  };
  let view = productId ? createMapView(queries, filters) : null;
  if (productId && !view) notFound();
  const unavailableCountry = Boolean(view && filters.country && !view.countries.some(country => country.id === filters.country));
  if (unavailableCountry) {
    filters.country = undefined;
    view = createMapView(queries, filters);
  }
  const regionalContext = {product:productId,datasetVersion:view?.datasetVersion};
  // Encode the current world filters so the China map can restore them on the way back.
  const worldSearch = worldStateSearch(filters);

  return <SiteShell><div className="content-column wide-column atlas-page">
    <header className="atlas-page-heading"><h1>世界地图</h1><nav className="atlas-layer-switch" aria-label="地图图层">
      <Link aria-current={filters.layer === "supply-chain" ? "page" : undefined} href={mapPath({ ...filters, layer: "supply-chain", year: undefined, direction: undefined, scope: undefined })}>代表性供应链</Link>
      <Link aria-current={filters.layer === "trade" ? "page" : undefined} href={mapPath({ ...filters, layer: "trade", year: undefined, scope: undefined })}>官方贸易统计</Link>
    </nav><Link className="text-link atlas-directory-link" href={chinaMapPath({...pageContext,product:productId,map:worldSearch})}>走进中国供应链 →</Link></header>
    {productId && <ProductNavigation productId={productId} context={pageContext} active="world" hasIndustry={Boolean(queries.getIndustryNetwork(productId))} hasMaterials={queries.getMaterialTradeObservations(productId).length>0} worldSearch={worldSearch}/>}
    {unavailableCountry && <p className="atlas-filter-notice" role="status">所选国家未收录在当前商品中，已显示全部国家。<Link href={mapPath(filters)}>清除链接中的国家筛选 →</Link></p>}
    {view ? <WorldCountryMap key={`${productId}-${filters.layer}-${filters.focus ?? ""}`} view={view} filters={filters} products={products.map(product => ({ id: product.productId, name: itemLabel(product.item) }))} regionalLinks={regionalNavigation.map(region=>({entityId:region.entityId,label:region.label,href:chinaMapPath({...regionalContext,map:worldSearch})}))} /> : <p>暂无已发布商品。</p>}
    <details className="atlas-reading-notes"><summary>地图与数据说明</summary><p>代表性供应链连接已有的国家生产角色，包含多个分支。官方贸易按商品分类、报告方与实际年度分别呈现；材料分类可能为汇总或近似范围，具体标记见记录。世界总计只标报告国，不绘制成双边连线。连线不表示实际运输轨迹。</p><p>国家轮廓：Natural Earth · Equal Earth 投影。{view && <Link href={provenancePath(filters.product, { datasetVersion: view.datasetVersion })}>来源与版本 →</Link>}</p></details>
  </div></SiteShell>;
}
