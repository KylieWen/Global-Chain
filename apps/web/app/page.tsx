import Link from "next/link";
import { getQueryService } from "../lib/data";
import { PageIntro, SiteShell } from "../components/site-shell";
import { StatCard } from "../components/data-display";
import { productPath, tradeGuidePath } from "../lib/paths";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const featured = products[0];
  return <SiteShell><div className="content-column wide-column">
    <PageIntro eyebrow="GlobeChain · 全球进出口信息查询" title="先查清楚，再决定怎么走" description="选择商品、起运国和目的地，快速整理关税核验、手续顺序、资料清单和官方入口。供应链与贸易数据作为背景研究，帮助你理解商品从哪里来、进入市场要核验什么。" actions={<div className="intro-action-stack"><Link className="button button-primary" href={tradeGuidePath()}>开始进出口查询 →</Link>{featured ? <Link className="text-link" href={productPath(featured.productId)}>查看智能手机背景链路 →</Link> : null}</div>} />
    <section className="home-guide-hero" aria-label="贸易指南入口"><div><p className="eyebrow">Trade guide compass</p><h2>把零散的政策、手续和文件，整理成一条可执行的核验路径</h2><p>GlobeChain 目前先深度覆盖通用智能手机，并为美国、德国/欧盟和中国提供示范性进口/出口查询清单。每条信息都链接到官方入口，未收录的税率不会被猜测。</p></div><Link className="button button-primary" href={tradeGuidePath({ product: featured?.productId })}>打开查询工作台 →</Link></section>
    <section className="home-audience-strip" aria-label="适用用户"><div className="home-audience-intro"><p className="eyebrow">Designed for</p><h2>给谁用？</h2></div><div className="home-audience-card"><strong>跨境采购人员</strong><span>先确认商品编码、目的地规则、需要准备的资料和官方办理入口。</span></div><div className="home-audience-card"><strong>外贸调研人员</strong><span>把国家政策查询与商品、供应链和贸易数据背景放在同一条研究路径中。</span></div></section>
    <section className="home-entry-grid" aria-label="四种探索入口">
      <Link className="home-entry-card home-entry-primary" href={tradeGuidePath({ product: featured?.productId })}><span className="card-kicker">01 · 查询</span><h2>进出口指南</h2><p>按商品、国家和方向查看核验顺序、文件清单与官方入口。</p><strong>进入贸易指南 →</strong></Link>
      <Link className="home-entry-card" href={featured ? productPath(featured.productId) : "/products"}><span className="card-kicker">02 · 背景</span><h2>商品供应链</h2><p>从材料、部件到组装，阅读一条有证据边界的代表性路线。</p><strong>查看商品背景 →</strong></Link>
      <Link className="home-entry-card" href="/countries"><span className="card-kicker">03 · 国家</span><h2>国家贸易账本</h2><p>查看国家整体贸易、单品观察和它在供应链中的角色。</p><strong>进入国家账本 →</strong></Link>
      <Link className="home-entry-card" href="/map"><span className="card-kicker">04 · 世界</span><h2>世界地图</h2><p>把国家轮廓和已发布贸易观察放回地理空间。</p><strong>打开世界地图 →</strong></Link>
    </section>
    <section className="home-method-strip"><div><p className="eyebrow">How to read</p><h2>指南给方向，数据给边界</h2></div><p>政策指南不是法律意见，供应链路线不是唯一物流路线，海关贸易额不是利润。每个结果都保留来源、版本和“未收录”状态，方便你继续核验。</p><div className="hero-facts"><StatCard label="已发布商品" value={products.length} detail="当前先聚焦智能手机" /><StatCard label="示范指南" value="4" detail="中、美、德/欧盟" /></div></section>
  </div></SiteShell>;
}
