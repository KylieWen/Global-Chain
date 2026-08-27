import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { WorldCountryMap } from "../../components/world-country-map";
import { getQueryService } from "../../lib/data";
import { mapPath } from "../../lib/paths";
import { readPageContext } from "../../lib/context";

export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const productId = first(params.product) ?? "generic-smartphone";
  const countryId = first(params.country);
  const direction = first(params.direction) as "import" | "export" | undefined;
  const queries = await getQueryService();
  const countries = queries.listCountries();
  const products = queries.listProducts();
  const pageContext = readPageContext(params);
  const network = queries.getTradeNetwork(productId, { countryEntityId: countryId, direction, ...pageContext });
  const mapCountries = countries.map(({ entity, relatedNodeCount, hasTradeLedger, roles }) => ({ id: entity.id, name: entity.name, m49: entity.m49 ?? null, roles, relatedNodeCount, hasTradeLedger }));
  const tradeLines = network?.observations.flatMap(({ observation, reporter, partner }) => reporter?.m49 && partner?.m49 ? [{ id: observation.id, reporterM49: reporter.m49, partnerM49: partner.m49, direction: observation.direction }] : []) ?? [];
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "世界地图" }]} />
    <PageIntro eyebrow="Global view" title="世界贸易与供应链地图" description="以完整国家轮廓呈现当前数据覆盖。点击国家查看贸易账本；双边贸易观察以国家质心节点和连线叠加显示。" actions={<Link className="button button-secondary" href="/countries">国家目录</Link>} />
    <section className="map-filters" aria-label="地图筛选"><span className="filter-label">商品</span>{products.map((product) => <Link key={product.productId} className={product.productId === productId ? "filter-chip active" : "filter-chip"} href={mapPath({ product: product.productId, country: countryId, direction })}>{product.item.name}</Link>)}<span className="filter-label">国家</span><Link className={!countryId ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, direction })}>全部国家</Link>{countries.map(({ entity }) => <Link key={entity.id} className={countryId === entity.id ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: entity.id, direction })}>{entity.name}</Link>)}<span className="filter-label">方向</span><Link className={!direction ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId })}>进出口</Link><Link className={direction === "export" ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId, direction: "export" })}>出口</Link><Link className={direction === "import" ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId, direction: "import" })}>进口</Link></section>
    <WorldCountryMap countries={mapCountries} tradeLines={tradeLines} productId={productId} selectedCountryId={countryId} direction={direction} context={pageContext} />
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Mapped countries</p><h2>当前数据覆盖</h2></div><span className="section-caption">{countries.length} 个国家/地区 · 当前连线 {network?.observations.length ?? 0} 条</span></div><div className="map-country-list">{countries.map(({ entity, relatedNodeCount, hasTradeLedger, roles }) => <Link className={`map-country-row${countryId === entity.id ? " selected" : ""}`} href={mapPath({ ...pageContext, product: productId, country: entity.id, direction })} key={entity.id}><strong>{entity.name}</strong><span>{roles.slice(0, 2).join(" · ") || `${relatedNodeCount} 个供应链节点`} · {hasTradeLedger ? "有国家账本" : "账本待补"}</span><span>在地图高亮 →</span></Link>)}</div></section>
    <section className="hierarchy-card"><strong>地图说明</strong><span>国界来自 Natural Earth 的 1:110m 世界行政区数据并使用 Equal Earth 等积投影。地图用于国家级探索，不定位港口、矿山或工厂；贸易连线只来自具体伙伴观察，partnerCode=0 世界总计不会被绘制为双边关系。</span></section>
  </div></SiteShell>;
}
