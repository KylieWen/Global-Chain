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
  const tradeLines = network?.observations.flatMap(({ observation, reporter, partner, valueDataStatus }) => reporter?.m49 && partner?.m49 ? [{ id: observation.id, reporterM49: reporter.m49, partnerM49: partner.m49, direction: observation.direction, value: observation.value ?? null, currency: observation.currency ?? null, valueDataStatus }] : []) ?? [];
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "世界地图" }]} />
    <PageIntro eyebrow="Country trade context · 国家贸易背景" title="全球国家贸易背景地图" description="以准确的国家轮廓查看已发布数据覆盖，并把有明确报告方和伙伴的贸易统计观察放回地理空间。点击国家可打开贸易账本；地图不展示订单、船舶或物流轨迹，连线也不代表供应商关系。" actions={<Link className="button button-secondary" href="/countries">国家目录</Link>} />
    <section className="map-filters" aria-label="国家贸易统计观察筛选"><span className="filter-label">商品</span>{products.map((product) => <Link key={product.productId} className={product.productId === productId ? "filter-chip active" : "filter-chip"} href={mapPath({ product: product.productId, country: countryId, direction })}>{product.item.name}</Link>)}<span className="filter-label">国家</span><Link className={!countryId ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, direction })}>全部国家</Link>{countries.map(({ entity }) => <Link key={entity.id} className={countryId === entity.id ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: entity.id, direction })}>{entity.name}</Link>)}<span className="filter-label">方向</span><Link className={!direction ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId })}>进出口</Link><Link className={direction === "export" ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId, direction: "export" })}>出口</Link><Link className={direction === "import" ? "filter-chip active" : "filter-chip"} href={mapPath({ product: productId, country: countryId, direction: "import" })}>进口</Link></section>
    <section className="hierarchy-card" aria-label="地图阅读提示"><strong>先读这张图</strong><span>点击国家轮廓后，地图只保留与该国相关的具体伙伴观察；箭头方向表示报告方到伙伴，线条越粗表示报告金额越大，虚线表示进口。金额未知的观察仍保留细线，不会被当成零。线条不等于订单、运输路线、连续供应链或厂家供货关系。</span></section>
    <WorldCountryMap countries={mapCountries} tradeLines={tradeLines} productId={productId} selectedCountryId={countryId} direction={direction} context={pageContext} />
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Mapped countries</p><h2>当前可查看的国家</h2></div><span className="section-caption">{countries.length} 个国家/地区 · 统计观察 {network?.observations.length ?? 0} 条</span></div><div className="map-country-list">{countries.map(({ entity, relatedNodeCount, hasTradeLedger, roles }) => <Link className={`map-country-row${countryId === entity.id ? " selected" : ""}`} href={mapPath({ ...pageContext, product: productId, country: entity.id, direction })} key={entity.id}><strong>{entity.name}</strong><span>{roles.slice(0, 2).join(" · ") || `${relatedNodeCount} 个供应链背景节点`} · {hasTradeLedger ? "有国家账本" : "账本待补"}</span><span>在地图高亮 →</span></Link>)}</div></section>
    <section className="hierarchy-card"><strong>地图口径</strong><span>国界来自 Natural Earth 的 1:110m 世界行政区数据，并使用 Equal Earth 等积投影。地图只用于国家级贸易背景探索；不定位港口、矿山、工厂或厂家。只有具体 partnerCode 的观察才会绘制国家间连线，partnerCode=0 的世界总计不会被画成双边关系。海关统计观察说明某分类商品在报告方与伙伴之间被记录，不说明它最终进入哪件商品。</span></section>
  </div></SiteShell>;
}
