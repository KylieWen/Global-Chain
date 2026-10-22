import Link from "next/link";
import { getQueryService } from "../lib/data";
import { SiteShell } from "../components/site-shell";
import { ProductArtwork } from "../components/product-artwork";
import { productPath, supplyChainPath } from "../lib/paths";
export const dynamic = "force-dynamic";
export default async function HomePage() {
 const queries = await getQueryService(); const products = queries.listProducts(); const featured = products[0]; const overview = featured ? queries.getProductOverview(featured.productId) : null; const countries = queries.listCountries(); const href = featured ? productPath(featured.productId) : "/products";
 const steps = [{n:"01",title:"拆开一件商品",copy:"从成品到部件、材料，看看它由什么组成。",href},{n:"02",title:"沿着供应链走",copy:"跟随生产环节，认识各地的分工。",href:featured?supplyChainPath(featured.productId):"/products"},{n:"03",title:"把世界连起来",copy:"在地图上选一个国家，打开它的贸易账本。",href:"/map"}];
 return <SiteShell><div className="content-column wide-column visitor-home">
  <section className="visitor-hero"><div className="visitor-hero-copy"><p className="eyebrow">GLOBECHAIN · EXPLORE THE CONNECTIONS</p><h1>一件商品，<br/>一个相连的世界。</h1><p>从身边熟悉的商品出发，探索它的组成、生产环节与跨越国界的贸易。</p><div className="visitor-hero-actions"><Link className="button button-primary" href={href}>开始探索 →</Link><Link className="text-link" href="/map">直接打开地图 ↗</Link><Link className="text-link" href="/industry">查找产业上下游 ↗</Link></div><div className="visitor-hero-facts"><span><strong>{products.length}</strong> 商品</span><span><strong>{countries.length}</strong> 国家与地区</span><Link href="/demo">3 分钟浏览路径 →</Link></div></div>
  <Link href={href} className="visitor-product-preview" aria-label="打开商品拆解"><span className="preview-kicker">从你熟悉的商品开始</span><ProductArtwork productId={featured?.productId} variant="hero" decorative /><h2>{featured?.item.name ?? "商品目录"}</h2><div className="preview-components">{overview?.directChildren.slice(0,6).map(item=><span key={item.id}>{item.name}</span>)}</div><strong className="preview-explore">打开商品拆解 ↗</strong></Link></section>
  <section aria-labelledby="visitor-steps"><div className="section-heading"><h2 id="visitor-steps">三步，看见商品背后的世界</h2><span className="section-caption">从左到右，也可以随时跳转</span></div><div className="visitor-steps">{steps.map(s=><Link key={s.n} href={s.href} className="visitor-step"><span>{s.n}</span><h3>{s.title}</h3><p>{s.copy}</p><strong>继续探索 ↗</strong></Link>)}</div></section>
  <section className="visitor-next"><div><p className="eyebrow">继续深入</p><h2>带着一个问题，继续查。</h2></div><Link href="/countries"><strong>国家账本 →</strong><span>进口、出口、贸易差额与储备</span></Link><Link href="/trade-guide"><strong>进出口指南 →</strong><span>税费、手续与文件清单</span></Link></section>
 </div></SiteShell>;
}
