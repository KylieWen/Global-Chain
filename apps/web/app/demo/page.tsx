import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getQueryService } from "../../lib/data";
import { productPath, supplyChainPath, tradeGuidePath } from "../../lib/paths";
export const dynamic = "force-dynamic";
export default async function DemoPage() {
  const queries = await getQueryService();
  const featured = queries.listProducts()[0];
  const steps = [
    { title: "一件商品，连接世界", label: "旅程与地图", copy: "在世界地图查看高亮国家与双边贸易观察。连线有统计依据，但不代表运输路径。", href: "/map" },
    { title: "先拆开，再逐层看清", label: "商品拆解", copy: "从成品进入组件树，选择已有路线的部件；待补证的部分会明确标出。", href: featured ? productPath(featured.productId) : "/products" },
    { title: "沿生产环节追到证据", label: "代表性供应链", copy: "查看原料、加工、部件和组装环节，区分国家角色与直接双边证据。数量未知不填零。", href: featured ? supplyChainPath(featured.productId) : "/products" },
    { title: "看看国家之间的贸易", label: "国家账本", copy: "核对进出口、贸易差额、官方储备与商品观察。每个数字带单位、年份、来源和状态；贸易额不等于利润。", href: "/countries" },
    { title: "进一步查手续与官方入口", label: "进出口指南 · 延伸方向之一", copy: "选择国家与方向，查看编码归类、关税核验、手续与文件；未收录税率显示待核验。", href: tradeGuidePath(featured ? { product: featured.productId } : undefined) },
    { title: "带着来源继续研究", label: "可信边界", copy: "当前为有限覆盖的公开数据示范。查看来源与版本，保留未知、估算、未披露和真实零值的区别。", href: "/help" }
  ];
  return <SiteShell><div className="content-column wide-column"><Breadcrumbs items={[{ label: "3 分钟演示" }]} /><PageIntro eyebrow="演示路径 · 约 3 分钟" title="看懂一件商品，如何连接世界" description="从地图进入商品拆解与代表性路线，再看国家账本；进出口指南作为延伸方向，帮助你继续核验。" actions={<Link className="button button-primary" href="/map">从世界地图开始 →</Link>} /><ol className="demo-step-list">{steps.map((step,index)=><li className="demo-step-card" key={step.label}><span className="demo-step-number">{String(index+1).padStart(2,"0")}</span><div><p className="card-kicker">{step.label}</p><h2>{step.title}</h2><p>{step.copy}</p><Link className="button button-secondary" href={step.href}>打开查看 →</Link></div></li>)}</ol><section className="demo-boundary-note"><strong>请这样理解 Demo：</strong><span>代表性路线不证明某台商品、工厂或订单的真实路径。海关贸易额不等于企业利润。每条信息都应回到其来源和版本。</span></section></div></SiteShell>;
}
