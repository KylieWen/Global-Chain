import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const queries = await getQueryService();
  const featured = queries.listProducts()[0];
  const overview = featured ? queries.getProductOverview(featured.productId) : null;
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "使用指南" }]} />
    <PageIntro eyebrow="How to explore" title="带着好奇，从一件商品开始" description={`探索商品组成、生产分工和国际贸易。${overview ? `当前统计覆盖 ${overview.statisticsPeriodLabel} 年。` : ""}`} actions={<Link className="button button-primary" href="/products">开始探索</Link>} />
    <div className="help-list">
      <section className="help-card"><span className="card-kicker">01 · 商品</span><h2>拆开看看，里面有什么</h2><p>从商品选择一个部件，沿材料、加工和组装环节向上游或下游探索；点击节点可以查看它的生产过程。</p></section>
      <section className="help-card"><span className="card-kicker">02 · 地图</span><h2>看看这些环节发生在哪里</h2><p>供应链图层展示代表性生产分工，贸易图层展示海关记录。可以选择材料、国家和年份，点击连接查看详细数字。</p></section>
      <section className="help-card"><span className="card-kicker">03 · 账本</span><h2>了解一个国家的贸易</h2><p>账本展示进出口、贸易差额、储备及相关商品。数字旁保留实际年份；“估算”标记表示数值经过估计。点开资料可以查看原始来源和计算方法。</p></section>
      <section className="help-card"><span className="card-kicker">04 · 指南</span><h2>带着具体需求继续查</h2><p>选择商品、国家和进出口方向，查看基础税率、适用条件、文件和办理顺序，再通过官方入口了解具体申报要求。</p></section>
    </div>
  </div></SiteShell>;
}
