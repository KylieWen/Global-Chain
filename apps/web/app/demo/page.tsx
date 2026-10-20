import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getQueryService } from "../../lib/data";
import { productPath, supplyChainPath, tradeGuidePath } from "../../lib/paths";
export const dynamic = "force-dynamic";
export default async function DemoPage() {
  const queries = await getQueryService();
  const featured = queries.listProducts()[0];
  const steps = [
    { title: "一件商品，连接世界", label: "旅程与地图", copy: "选择一个国家或部件，沿地图上的连接探索生产分工。", href: "/map" },
    { title: "先拆开，再逐层看清", label: "商品拆解", copy: "从成品进入组件树，看看它由哪些部件和材料组成。", href: featured ? productPath(featured.productId) : "/products" },
    { title: "沿生产环节追到证据", label: "代表性供应链", copy: "查看原料、加工、部件和组装环节，打开一个节点继续深入。", href: featured ? supplyChainPath(featured.productId) : "/products" },
    { title: "看看国家之间的贸易", label: "国家账本", copy: "查看进出口、贸易差额、官方储备与主要贸易伙伴。", href: "/countries" },
    { title: "进一步查手续与官方入口", label: "进出口指南 · 延伸方向之一", copy: "选择国家与方向，查看基础税率、适用条件、文件和办理顺序。", href: tradeGuidePath(featured ? { product: featured.productId } : undefined) },
    { title: "带着来源继续研究", label: "继续研究", copy: "打开相关资料，查看数字和路线的来源，或下载研究快照。", href: "/help" }
  ];
  return <SiteShell><div className="content-column wide-column"><Breadcrumbs items={[{ label: "3 分钟演示" }]} /><PageIntro eyebrow="演示路径 · 约 3 分钟" title="看懂一件商品，如何连接世界" description="从地图进入商品拆解与代表性路线，再看国家账本；进出口指南作为延伸方向，帮助你继续核验。" actions={<Link className="button button-primary" href="/map">从世界地图开始 →</Link>} /><ol className="demo-step-list">{steps.map((step,index)=><li className="demo-step-card" key={step.label}><span className="demo-step-number">{String(index+1).padStart(2,"0")}</span><div><p className="card-kicker">{step.label}</p><h2>{step.title}</h2><p>{step.copy}</p><Link className="button button-secondary" href={step.href}>打开查看 →</Link></div></li>)}</ol></div></SiteShell>;
}
