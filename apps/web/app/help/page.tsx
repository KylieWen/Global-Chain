import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "阅读指南" }]} />
    <PageIntro eyebrow="How to explore" title="阅读指南" description="GlobeChain 用两条线帮助你探索世界：沿一件商品看供应链，沿一个国家看贸易账本。" actions={<Link className="button button-secondary" href="/products">开始探索</Link>} />
    <div className="help-list">
      <section className="help-card"><span className="card-kicker">01 · 商品路线</span><h2>从原料走到消费市场</h2><p>选择智能手机后，可以按原料、材料、部件、电芯、模组、组装和消费市场逐步浏览。点击节点可查看它所在的国家和证据。</p></section>
      <section className="help-card"><span className="card-kicker">02 · 国家账本</span><h2>看一个国家如何嵌入贸易</h2><p>国家账本展示商品进出口、贸易差额、官方储备和智能手机贸易观察。海关金额不是企业利润，也不是手机价格。</p></section>
      <section className="help-card"><span className="card-kicker">03 · 如何理解数据</span><h2>路线是代表性解释</h2><p>代表性路线用于帮助理解产业分工，不等于某一台手机的唯一真实物流路线。未知数据会明确显示为未知，不会被补成 0。</p></section>
      <section className="help-card"><span className="card-kicker">04 · 证据等级</span><h2>先看结论，再看出处</h2><p>页面先展示容易阅读的摘要；来源、版本、统计代码和证据定位可以在“来源与版本”或详情折叠区中继续查看。</p></section>
    </div>
  </div></SiteShell>;
}
