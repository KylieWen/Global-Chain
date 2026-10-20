import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { WorldCountryMap } from "../../components/world-country-map";
import { getQueryService } from "../../lib/data";
import { mapPath, type MapFilters } from "../../lib/paths";
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
  const filters: MapFilters & { product: string } = {
    ...pageContext,
    // The map uses a single year parameter; legacy research links remain readable.
    period: undefined, label: undefined,
    product: productId ?? "",
    country: firstParam(params.country),
    direction: rawDirection === "import" || rawDirection === "export" ? rawDirection : undefined,
    layer: firstParam(params.layer) === "trade" ? "trade" : "supply-chain",
    focus: firstParam(params.focus),
    year: firstParam(params.year) ?? pageContext.label ?? pageContext.period
  };
  const view = productId ? createMapView(queries, filters) : null;
  if (productId && (!view || (filters.country && !view.countries.some(country => country.id === filters.country)))) notFound();

  return <SiteShell><div className="content-column wide-column atlas-page">
    <Breadcrumbs items={[{ label: "世界地图" }]} />
    <PageIntro eyebrow="WORLD CONNECTIONS" title="在地图上，读懂商品与世界" description="沿生产环节探索代表性供应链，或切换到官方贸易统计核验国家之间的联系。" actions={<Link className="text-link" href="/countries">浏览国家账本 →</Link>} />
    <nav className="atlas-layer-tabs" aria-label="地图图层">
      <Link aria-current={filters.layer === "supply-chain" ? "page" : undefined} className={filters.layer === "supply-chain" ? "active" : ""} href={mapPath({ ...filters, layer: "supply-chain", year: undefined, direction: undefined })}><strong>代表性供应链</strong><span>材料、部件与生产环节</span></Link>
      <Link aria-current={filters.layer === "trade" ? "page" : undefined} className={filters.layer === "trade" ? "active" : ""} href={mapPath({ ...filters, layer: "trade", year: undefined })}><strong>官方贸易统计</strong><span>报告方、伙伴与进出口观察</span></Link>
    </nav>
    <section className="map-filters" aria-label="地图商品筛选">
      <div className="atlas-filter-group"><span className="filter-label">商品</span>{products.map(product => <Link key={product.productId} className={`filter-chip${product.productId === productId ? " active" : ""}`} href={mapPath({ ...filters, product: product.productId, focus: undefined, country: undefined, year: undefined })}>{product.item.name}</Link>)}</div>
      {filters.layer === "trade" && <div className="atlas-filter-group"><span className="filter-label">报告方向</span>{([{ label: "全部", value: undefined }, { label: "出口", value: "export" }, { label: "进口", value: "import" }] as const).map(direction => <Link key={direction.label} className={`filter-chip${filters.direction === direction.value ? " active" : ""}`} href={mapPath({ ...filters, direction: direction.value })}>{direction.label}</Link>)}</div>}
    </section>
    {view ? <>
      <p className={`atlas-layer-note atlas-layer-note-${view.layer}`}>{view.layer === "supply-chain" ? "代表性示意：展示有来源的国家角色与整理连接，不证明某件商品、工厂或订单的实际路径。金额与数量未知时保留未知。" : "官方统计：每条观察分别保留报告方、伙伴、商品分类和实际年度。不同报告方或年度的记录不能直接相加，也不代表连续供应链。"}</p>
      <WorldCountryMap key={`${productId}-${filters.layer}-${filters.focus ?? ""}`} countries={view.countries} lines={view.lines} nodes={view.nodes} items={view.items} years={view.years} filters={filters} datasetVersion={view.datasetVersion} />
    </> : <p>暂无已发布商品。</p>}
    <details className="reading-details"><summary>地图、覆盖范围与统计说明</summary><p>国家轮廓使用 Natural Earth 数据与 Equal Earth 投影。连线连接国家质心，用于阅读关系，不表示运输轨迹或工厂位置。同一国家内的工序以环线展示。国家高亮区分当前图层有记录与仅有账本；无记录表示尚未收录，不表示为零。官方贸易的世界总计不绘制成双边连线。来源、方法与版本可在单条记录详情中查看。</p></details>
  </div></SiteShell>;
}
