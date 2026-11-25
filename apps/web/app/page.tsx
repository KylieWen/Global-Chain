import { itemLabel } from "../lib/item-label";
import Link from "next/link";
import { getQueryService } from "../lib/data";
import { SiteShell } from "../components/site-shell";
import { HomeHeroMap, HomeProductStrip, type HomeSummary } from "../components/home-atlas-preview";
import { PersonaHome } from "../components/persona-home";
import { FirstVisitGuide, GuideLauncher } from "../components/first-visit-guide";
import { createMapView } from "../lib/map-view-model";
import { chinaMapPath, industryPath, mapPath, provenancePath } from "../lib/paths";
import demoNavigation from "../../../content/demo-navigation.json";
import "./home.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const featured = products.find(product => product.productId === demoNavigation.featuredProductId) ?? products[0];
  const countries = queries.listCountries();

  const summaries: HomeSummary[] = products.map(product => {
    const view = createMapView(queries, { product: product.productId, layer: "supply-chain" });
    const lines = (view?.lines ?? []).map(line => ({ from: line.fromM49, to: line.toM49, itemId: line.itemId ?? "" }));
    const years = view?.years ?? [];
    const yearLabel = years.length === 0 ? "" : years.length === 1 ? years[0] : `${years[years.length - 1]}–${years[0]}`;
    return {
      id: product.productId,
      name: itemLabel(product.item),
      recordCount: view?.records.length ?? 0,
      countryCount: view?.countries.length ?? 0,
      yearLabel,
      lines
    };
  });

  return (
    <SiteShell>
      <FirstVisitGuide products={products.map(product => ({ id: product.productId, name: itemLabel(product.item) }))} />
      <div className="content-column wide-column visitor-home home-page">
        <section className="home-hero">
          <HomeHeroMap products={summaries} featuredId={featured.productId} />
          <div className="home-hero-mask" aria-hidden="true" />
          <div className="home-hero-claim">
            <p className="eyebrow">从地图，看见全球分工</p>
            <h1>一件商品，<br />一个相连的世界。</h1>
            <p>沿着世界地图追溯原料与制造，再走进中国的省市和产业环节。每一条连线都回到已收录的年度、来源与数据版本。</p>
            <div className="home-hero-actions">
              <Link className="button button-primary" href={featured ? mapPath({ product: featured.productId }) : "/map"}>从世界地图开始 →</Link>
              <Link className="text-link" href={chinaMapPath()}>走进中国供应链 ↗</Link>
              <Link className="text-link" href={industryPath(demoNavigation.industry.productId, demoNavigation.industry.topicId)}>{demoNavigation.industry.label} ↗</Link>
            </div>
            <div className="home-hero-facts">
              <span><strong>{products.length}</strong> 商品</span>
              <span><strong>{countries.length}</strong> 国家与地区</span>
              <GuideLauncher className="text-link" />
            </div>
          </div>
        </section>

        <HomeProductStrip products={summaries} />

        <div className="home-below">
        <PersonaHome provenanceHref={featured ? provenancePath(featured.productId) : "/versions"} />

        <section className="visitor-next" aria-labelledby="visitor-next-title">
          <div>
            <p className="eyebrow">继续深入</p>
            <h2 id="visitor-next-title">带着一个问题，继续查。</h2>
          </div>
          <Link href="/countries"><strong>国家账本 →</strong><span>进口、出口、贸易差额与储备</span></Link>
          <Link href="/trade-guide"><strong>进出口指南 →</strong><span>税费、手续与文件清单</span></Link>
        </section>
        </div>
      </div>
    </SiteShell>
  );
}
