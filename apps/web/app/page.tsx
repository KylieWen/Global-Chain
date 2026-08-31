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
  const featuredProductId = featured?.productId ?? "generic-smartphone";
  const featuredProductName = featured?.item.name ?? "当前商品";
  const featuredGuides = featured ? queries.getTradeGuides(featured.productId) : [];
  const importGuide = featuredGuides.find((view) => view.guide.scope.direction === "import") ?? featuredGuides[0];
  const exportGuide = featuredGuides.find((view) => view.guide.scope.direction === "export") ?? featuredGuides.find((view) => view !== importGuide);
  const guideJurisdictions = Array.from(new Set(featuredGuides.map((view) => view.jurisdiction?.name).filter((name): name is string => Boolean(name))));
  const featuredPeriod = featuredGuides[0]?.guide.period.label ?? "已发布期间";
  const importGuideHref = importGuide ? tradeGuidePath({ product: featuredProductId, direction: importGuide.guide.scope.direction, jurisdiction: importGuide.guide.scope.jurisdictionEntityId }) : tradeGuidePath({ product: featuredProductId, direction: "import" });
  const exportGuideHref = exportGuide ? tradeGuidePath({ product: featuredProductId, direction: exportGuide.guide.scope.direction, jurisdiction: exportGuide.guide.scope.jurisdictionEntityId }) : tradeGuidePath({ product: featuredProductId, direction: "export" });
  const importJurisdictionName = importGuide?.jurisdiction?.name ?? "已收录目的地";
  const exportJurisdictionName = exportGuide?.jurisdiction?.name ?? "已收录起运地";
  const jurisdictionSummary = guideJurisdictions.length ? guideJurisdictions.join("、") : "已收录国家/地区";
  return <SiteShell><div className="content-column wide-column">
    <PageIntro eyebrow="GlobeChain · 全球进出口信息查询" title="先查清楚，再决定怎么走" description="选择商品、起运地、目的地和方向，快速整理关税核验、手续顺序、资料清单和官方入口。供应链与贸易数据作为背景研究，帮助你理解商品从哪里来、进入市场要核验什么。" actions={<div className="intro-action-stack"><Link className="button button-primary" href={tradeGuidePath({ product: featuredProductId })}>开始进出口查询 →</Link>{featured ? <Link className="text-link" href={productPath(featured.productId)}>查看商品背景 →</Link> : null}</div>} />
    <section className="home-guide-hero" aria-label="贸易指南入口"><div><p className="eyebrow">先完成一个查询任务</p><h2>把零散的政策、手续和文件，整理成一条可执行的核验路径</h2><p>当前先深度覆盖{featuredProductName}，为{jurisdictionSummary}提供示范性进口/出口查询清单。未收录的税率不会被猜测，会明确告诉你去哪里核验。</p></div><Link className="button button-primary" href={tradeGuidePath({ product: featuredProductId })}>打开查询工作台 →</Link></section>
    <section className="home-task-section" aria-labelledby="home-task-title"><div className="section-heading"><div><p className="eyebrow">Start with a task</p><h2 id="home-task-title">从一个具体任务开始</h2></div><span className="section-caption">示范数据 · {featuredPeriod} · {products.length} 个商品</span></div><div className="home-task-grid">
      <Link className="home-task-card home-task-primary" href={importGuideHref}><span className="task-icon" aria-hidden="true">↓</span><div><strong>我要进口</strong><p>例如：把{featuredProductName}进口到{importJurisdictionName}，先看归类、手续和资料。</p></div><span className="task-action">查看{importJurisdictionName}进口示范 →</span></Link>
      <Link className="home-task-card" href={exportGuideHref}><span className="task-icon" aria-hidden="true">↑</span><div><strong>我要出口</strong><p>例如：从{exportJurisdictionName}出口{featuredProductName}，先确认申报和目的地核验项。</p></div><span className="task-action">查看{exportJurisdictionName}出口示范 →</span></Link>
      <Link className="home-task-card" href={featured ? productPath(featured.productId) : "/products"}><span className="task-icon" aria-hidden="true">◎</span><div><strong>我想了解供应链</strong><p>从材料、部件到组装，先建立商品背景，再回到贸易查询。</p></div><span className="task-action">查看智能手机背景 →</span></Link>
    </div></section>
    <section className="home-audience-strip" aria-label="适用用户"><div className="home-audience-intro"><p className="eyebrow">Designed for</p><h2>给谁用？</h2></div><div className="home-audience-card"><strong>跨境采购人员</strong><span>先确认商品编码、目的地规则、需要准备的资料和官方办理入口。</span></div><div className="home-audience-card"><strong>外贸调研人员</strong><span>把国家政策查询与商品、供应链和贸易数据背景放在同一条研究路径中。</span></div></section>
    <section className="home-entry-section" aria-labelledby="home-background-title"><div className="section-heading"><div><p className="eyebrow">Understand the context</p><h2 id="home-background-title">再了解商品与国家背景</h2></div><span className="section-caption">查询之后再深入</span></div><div className="home-entry-grid">
      <Link className="home-entry-card" href={featured ? productPath(featured.productId) : "/products"}><span className="card-kicker">01 · 商品</span><h2>商品供应链</h2><p>从材料、部件到组装，阅读一条有证据边界的代表性路线。</p><strong>查看商品背景 →</strong></Link>
      <Link className="home-entry-card" href="/countries"><span className="card-kicker">02 · 国家</span><h2>国家贸易账本</h2><p>查看国家整体贸易、单品观察和它在供应链中的角色。</p><strong>进入国家账本 →</strong></Link>
      <Link className="home-entry-card" href="/map"><span className="card-kicker">03 · 世界</span><h2>国家贸易背景地图</h2><p>把国家轮廓和已发布统计观察放回地理空间。</p><strong>打开背景地图 →</strong></Link>
    </div></section>
    <section className="home-method-strip"><div><p className="eyebrow">How to read</p><h2>指南给方向，数据给边界</h2></div><p>政策指南不是法律意见，供应链路线不是唯一物流路线，海关贸易额不是利润。每个结果都保留来源、版本和“未收录”状态，方便你继续核验。</p><div className="hero-facts"><StatCard label="已发布商品" value={products.length} detail="当前展示的商品数量" /><StatCard label="示范指南" value={featuredGuides.length} detail={`${guideJurisdictions.length} 个国家/地区`} /></div></section>
  </div></SiteShell>;
}
