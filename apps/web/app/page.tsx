import Link from "next/link";
import { getQueryService } from "../lib/data";
import { PageIntro, SiteShell } from "../components/site-shell";
import { StatCard } from "../components/data-display";
import { productPath } from "../lib/paths";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const featured = products[0];
  return <SiteShell><div className="content-column wide-column">
    <PageIntro eyebrow="GlobeChain · 全球商品与贸易观察" title="从一件商品，走进世界经济" description="沿商品拆解供应链，沿国家读取贸易账本，再通过地图和双边观察核验它们如何连接。所有页面都是被动数据展示，保留来源、版本和不确定性。" actions={featured ? <Link className="button button-primary" href={productPath(featured.productId)}>从智能手机开始 →</Link> : null} />
    <section className="home-entry-grid" aria-label="四种探索入口">
      <Link className="home-entry-card home-entry-primary" href={featured ? productPath(featured.productId) : "/products"}><span className="card-kicker">01 · 商品</span><h2>从商品开始</h2><p>拆解一部手机如何经过材料、部件、生产阶段和消费市场。</p><strong>进入商品探索 →</strong></Link>
      <Link className="home-entry-card" href="/countries"><span className="card-kicker">02 · 国家</span><h2>从国家开始</h2><p>查看一个国家的宏观贸易、单品观察和供应链角色。</p><strong>进入国家目录 →</strong></Link>
      <Link className="home-entry-card" href="/categories"><span className="card-kicker">03 · 门类</span><h2>从商品门类开始</h2><p>按电子产品、工业品、化工品等用户可读类别浏览。</p><strong>查看商品门类 →</strong></Link>
      <Link className="home-entry-card" href="/map"><span className="card-kicker">04 · 世界</span><h2>从世界地图开始</h2><p>把当前数据中的国家和具体伙伴贸易观察放回空间。</p><strong>打开世界地图 →</strong></Link>
    </section>
    <section className="home-method-strip"><div><p className="eyebrow">How to read</p><h2>事实、路线与限制分开</h2></div><p>代表性供应链不是唯一真实路线；海关贸易额不是利润；unknown 不等于 0。数据版本、来源和证据可以在每个模块继续展开。</p><div className="hero-facts"><StatCard label="已发布商品" value={products.length} detail="当前只读数据集" /><StatCard label="探索入口" value="4" detail="商品 · 国家 · 门类 · 世界" /></div></section>
  </div></SiteShell>;
}
