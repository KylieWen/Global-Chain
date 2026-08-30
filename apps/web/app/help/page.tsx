import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "阅读指南" }]} />
    <PageIntro eyebrow="How to explore" title="如何使用 GlobeChain" description="先用贸易指南整理进出口核验项，再用商品、国家和地图补充背景。平台展示可追溯资料，不替你作法律或商业结论。" actions={<Link className="button button-primary" href="/trade-guide">开始贸易查询</Link>} />
    <div className="help-list">
      <section className="help-card"><span className="card-kicker">01 · 贸易指南</span><h2>先查商品、国家和方向</h2><p>指南给出关税核验入口、手续顺序、常见资料和官方链接。税率或许可未收录时会显示“待核验”，不会自动猜测。</p></section>
      <section className="help-card"><span className="card-kicker">02 · 商品背景</span><h2>从原料走到消费市场</h2><p>选择智能手机后，可以按原料、材料、部件、电芯、模组、组装和消费市场浏览代表性路线。它是研究背景，不是订单或唯一物流路线。</p></section>
      <section className="help-card"><span className="card-kicker">03 · 国家账本</span><h2>看一个国家如何嵌入贸易</h2><p>国家账本展示商品进出口、贸易差额、官方储备和智能手机贸易观察。海关金额不是企业利润，也不是手机价格。</p></section>
      <section className="help-card"><span className="card-kicker">04 · 数据边界</span><h2>看清“未知”和“已知”</h2><p>没有收录不等于 0，代表性路线不等于确定交易，政策指南也不等于法律意见。每个页面都保留来源、版本和限制说明。</p></section>
    </div>
  </div></SiteShell>;
}
