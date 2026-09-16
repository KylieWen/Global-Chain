import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const queries = await getQueryService();
  const featured = queries.listProducts()[0];
  const overview = featured ? queries.getProductOverview(featured.productId) : null;
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "阅读指南" }]} />
    <PageIntro eyebrow="How to explore" title="如何使用 GlobeChain" description={`从商品拆解与供应链出发，在世界地图和国家账本查看贸易；进出口指南提供延伸查询。${overview?.statisticsPeriodLabel ?? "期间待核验"} 年分项统计 · ${queries.listProducts().length} 个商品示范 · 覆盖有限 · 未收录税率显示待核验。`} actions={<Link className="button button-primary" href="/products">开始商品探索</Link>} />
    <div className="help-list">
      <section className="help-card"><span className="card-kicker">01 · 商品拆解与供应链</span><h2>从原料走到消费市场</h2><p>选择商品后，可以按原料、材料、部件、电芯、模组、组装和消费市场浏览代表性路线。它是研究背景，不是订单或唯一物流路线。</p></section>
      <section className="help-card"><span className="card-kicker">02 · 国家账本与地图</span><h2>看一个国家如何嵌入贸易</h2><p>国家账本展示商品进出口、贸易差额、官方储备和所选商品贸易观察。海关金额不是企业利润，也不是单件商品价格。</p></section>
      <section className="help-card"><span className="card-kicker">03 · 数据边界</span><h2>看清“未知”和“已知”</h2><p>没有收录不等于 0，代表性路线不等于确定交易，政策指南也不等于法律意见。每个页面都保留来源、版本和限制说明。</p></section>
      <section className="help-card"><span className="card-kicker">04 · 进出口指南（延伸方向）</span><h2>先查商品、国家和方向</h2><p>指南给出关税核验入口、手续顺序、常见资料和官方链接。税率或许可未收录时会显示“待核验”，不会自动猜测。</p></section>
    </div>
  </div></SiteShell>;
}
