import { itemLabel } from "../lib/item-label";
import Link from "next/link";
import { getQueryService } from "../lib/data";
import { SiteShell } from "../components/site-shell";
import { HomeMapPreview } from "../components/home-map-preview";
import { createMapView } from "../lib/map-view-model";
import { chinaMapPath, industryPath, mapPath, productPath, supplyChainPath } from "../lib/paths";
import demoNavigation from "../../../content/demo-navigation.json";
export const dynamic = "force-dynamic";
export default async function HomePage() {
 const queries = await getQueryService(); const products = queries.listProducts(); const featured = products.find(product=>product.productId===demoNavigation.featuredProductId)??products[0]; const countries = queries.listCountries(); const href = featured ? productPath(featured.productId) : "/products";
 const mapView = featured ? createMapView(queries,{product:featured.productId,layer:'supply-chain'}) : null;
 const steps = [{n:"01",title:"拆开一件商品",copy:"从成品到部件、材料，看看它由什么组成。",href},{n:"02",title:"沿着供应链走",copy:"跟随生产环节，认识各地的分工。",href:featured?supplyChainPath(featured.productId):"/products"},{n:"03",title:"把世界连起来",copy:"在地图上选一个国家，打开它的贸易账本。",href:"/map"}];
 return <SiteShell><div className="content-column wide-column visitor-home">
  <section className="visitor-hero"><div className="visitor-hero-copy"><p className="eyebrow">从地图，看见全球分工</p><h1>一件商品，<br/>一个相连的世界。</h1><p>沿着世界地图追溯原料与制造，再走进中国的省市和产业环节。</p><div className="visitor-hero-actions"><Link className="button button-primary" href="/map">从世界地图开始 →</Link><Link className="text-link" href={chinaMapPath()}>走进中国供应链 ↗</Link><Link className="text-link" href={industryPath(demoNavigation.industry.productId,demoNavigation.industry.topicId)}>{demoNavigation.industry.label} ↗</Link></div><div className="visitor-hero-facts"><span><strong>{products.length}</strong> 商品</span><span><strong>{countries.length}</strong> 国家与地区</span><Link href="/demo">3 分钟浏览路径 →</Link></div></div>
  {mapView && featured && <HomeMapPreview view={mapView} productId={featured.productId}/>}</section>
  <section className="home-product-strip" aria-label="按商品进入地图">{products.map(product=><Link key={product.productId} href={mapPath({product:product.productId})}><strong>{itemLabel(product.item)}</strong><span>在世界地图上探索 ↗</span></Link>)}</section>
  <section aria-labelledby="visitor-steps"><div className="section-heading"><h2 id="visitor-steps">三步，看见商品背后的世界</h2><span className="section-caption">从左到右，也可以随时跳转</span></div><div className="visitor-steps">{steps.map(s=><Link key={s.n} href={s.href} className="visitor-step"><span>{s.n}</span><h3>{s.title}</h3><p>{s.copy}</p><strong>继续探索 ↗</strong></Link>)}</div></section>
  <section className="visitor-next"><div><p className="eyebrow">继续深入</p><h2>带着一个问题，继续查。</h2></div><Link href="/countries"><strong>国家账本 →</strong><span>进口、出口、贸易差额与储备</span></Link><Link href="/trade-guide"><strong>进出口指南 →</strong><span>税费、手续与文件清单</span></Link></section>
 </div></SiteShell>;
}
