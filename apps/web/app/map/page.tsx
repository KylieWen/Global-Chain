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
  const pageContext = readPageContext(params);
  const queries = await getQueryService(pageContext.datasetVersion);
  const countries = queries.listCountries(); const products = queries.listProducts();
  const productId = first(params.product) ?? products[0]?.productId;
  const countryId = first(params.country);
  const rawDirection = first(params.direction); const direction = rawDirection === "import" || rawDirection === "export" ? rawDirection : undefined;
  const network = productId ? queries.getTradeNetwork(productId, { countryEntityId: countryId, direction }) : null;
  const mapCountries = countries.map(({ entity, relatedNodeCount, hasTradeLedger, roles }) => ({ id: entity.id, name: entity.name, m49: entity.m49 ?? null, roles, relatedNodeCount, hasTradeLedger }));
  const tradeLines = network?.observations.flatMap(({ observation, reporter, partner, valueDataStatus }) => reporter?.m49 && partner?.m49 ? [{ id: observation.id, reporterM49: reporter.m49, partnerM49: partner.m49, direction: observation.direction, value: observation.value ?? null, currency: observation.currency ?? null, periodLabel: observation.period.label, valueDataStatus }] : []) ?? [];
  return <SiteShell><div className="content-column wide-column atlas-page"><Breadcrumbs items={[{ label: "世界地图" }]} /><PageIntro eyebrow="WORLD TRADE" title="一张地图，看见贸易联系" description="选一个国家，看看它与世界怎样连接。" actions={<Link className="text-link" href="/countries">浏览国家账本 →</Link>} />
    <section className="map-filters" aria-label="国家贸易统计观察筛选"><div className="atlas-filter-group"><span className="filter-label">商品</span>{products.map(p => <Link key={p.productId} className={`filter-chip${p.productId === productId ? " active" : ""}`} href={mapPath({ ...pageContext, product: p.productId, country: countryId, direction })}>{p.item.name}</Link>)}</div><div className="atlas-filter-group"><span className="filter-label">报告方向</span>{([{ label: "全部", value: undefined }, { label: "出口", value: "export" }, { label: "进口", value: "import" }] as const).map(d => <Link key={d.label} className={`filter-chip${direction === d.value ? " active" : ""}`} href={mapPath({ ...pageContext, product: productId, country: countryId, direction: d.value })}>{d.label}</Link>)}</div></section>
    {productId ? <WorldCountryMap countries={mapCountries} tradeLines={tradeLines} productId={productId} selectedCountryId={countryId} direction={direction} context={pageContext} /> : <p>暂无商品。</p>}
    <details className="reading-details"><summary>地图与统计说明</summary><p>国家轮廓使用 Natural Earth 数据与 Equal Earth 投影。双边记录按报告方和年份分别保留；世界总计不绘制连线。细线表示联系，不按不同年度金额排名。数据来源与各项定义可在国家账本展开查看。</p></details>
  </div></SiteShell>;
}
