import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "../../components/site-shell";
import { WorldCountryMap } from "../../components/world-country-map";
import { getQueryService } from "../../lib/data";
import { mapPath, provenancePath, type MapFilters } from "../../lib/paths";
import { firstParam, readPageContext } from "../../lib/context";
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
  const filters: MapFilters & { product: string } = {
    ...pageContext, period: undefined, label: undefined,
    product: productId ?? "", country: firstParam(params.country),
    direction: rawDirection === "import" || rawDirection === "export" ? rawDirection : undefined,
    scope: rawScope === "bilateral" || rawScope === "world" ? rawScope : undefined,
    layer: firstParam(params.layer) === "trade" ? "trade" : "supply-chain",
    focus: firstParam(params.focus), year: firstParam(params.year) ?? pageContext.label ?? pageContext.period
  };
  const view = productId ? createMapView(queries, filters) : null;
  if (productId && (!view || (filters.country && !view.countries.some(country => country.id === filters.country)))) notFound();

  return <SiteShell><div className="content-column wide-column atlas-page">
    <header className="atlas-page-heading"><h1>世界地图</h1><nav className="atlas-layer-switch" aria-label="地图图层">
      <Link aria-current={filters.layer === "supply-chain" ? "page" : undefined} href={mapPath({ ...filters, layer: "supply-chain", year: undefined, direction: undefined, scope: undefined })}>代表性供应链</Link>
      <Link aria-current={filters.layer === "trade" ? "page" : undefined} href={mapPath({ ...filters, layer: "trade", year: undefined, scope: undefined })}>官方贸易统计</Link>
    </nav><Link className="text-link atlas-directory-link" href="/countries">国家账本 →</Link></header>
    {view ? <WorldCountryMap key={`${productId}-${filters.layer}-${filters.focus ?? ""}`} view={view} filters={filters} products={products.map(product => ({ id: product.productId, name: product.item.name }))} /> : <p>暂无已发布商品。</p>}
    <details className="atlas-reading-notes"><summary>地图与数据说明</summary><p>代表性供应链连接已有的国家生产角色，包含多个分支。官方贸易按商品分类、报告方与实际年度分别呈现；材料分类可能为汇总或近似范围，具体标记见记录。世界总计只标报告国，不绘制成双边连线。连线不表示实际运输轨迹。</p><p>国家轮廓：Natural Earth · Equal Earth 投影。{view && <Link href={provenancePath(filters.product, { datasetVersion: view.datasetVersion })}>来源与版本 →</Link>}</p></details>
  </div></SiteShell>;
}
