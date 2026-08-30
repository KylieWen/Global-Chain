import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getQueryService } from "../../lib/data";
import { productPath, manufacturingProcessPath, mapPath, tradeGuidePath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const featured = products[0];
  const productId = featured?.productId ?? "generic-smartphone";
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "3 分钟演示" }]} />
    <PageIntro eyebrow="Guided demo · 约 3 分钟" title="从一件商品，到一条可执行的进出口核验路径" description="先用贸易指南选择国家和方向，再回到智能手机的组成、供应链和国家账本，看清哪些是办理信息，哪些只是研究背景。" actions={<Link className="button button-primary" href={tradeGuidePath({ product: productId })}>直接进入贸易指南 →</Link>} />

    <section className="demo-callout" aria-label="演示说明">
      <strong>演示重点</strong><span>不是展示一张“看起来很复杂”的地图，而是展示每个节点为什么出现、证据支持到哪里，以及哪些内容仍然未知。</span>
    </section>

    <ol className="demo-step-list">
      <li className="demo-step-card"><span className="demo-step-number">01</span><div><p className="card-kicker">贸易指南</p><h2>先选商品、国家和方向</h2><p>查看关税核验入口、手续顺序、文件清单和当前资料覆盖范围；税率未收录时会明确显示。</p><Link className="button button-secondary" href={tradeGuidePath({ product: productId })}>打开贸易指南 →</Link></div></li>
      <li className="demo-step-card"><span className="demo-step-number">02</span><div><p className="card-kicker">商品背景</p><h2>再理解商品如何形成</h2><p>进入通用智能手机组件树，选择电池、处理器与存储器等部件，阅读代表性国家角色和工艺设备背景。</p><div className="demo-actions"><Link className="button button-secondary" href={productPath(productId)}>打开商品总览 →</Link><Link className="button button-secondary" href={manufacturingProcessPath(productId, "process-chain-semiconductor-packaging")}>看工艺设备 →</Link></div></div></li>
      <li className="demo-step-card"><span className="demo-step-number">03</span><div><p className="card-kicker">国家与空间</p><h2>最后回到国家账本和地图</h2><p>查看国家整体贸易、单品观察和世界轮廓；官方统计与代表性路线始终分开。</p><div className="demo-actions"><Link className="button button-secondary" href="/countries">打开国家账本 →</Link><Link className="button button-secondary" href={mapPath()}>打开世界地图 →</Link></div></div></li>
    </ol>

    <section className="demo-audience-grid" aria-label="适用场景"><article><p className="card-kicker">给研究者</p><h2>可追溯</h2><p>每条路线、指标和设备能力都能回到来源、版本与证据说明。</p></article><article><p className="card-kicker">给采购与战略</p><h2>可探索</h2><p>先定位材料、工序和国家角色，再决定需要补查哪些直接证据。</p></article><article><p className="card-kicker">给课堂与公众</p><h2>可理解</h2><p>用一件日常商品解释全球分工，而不是把统计表直接丢给用户。</p></article></section>

    <section className="demo-boundary-note"><strong>请这样理解 Demo：</strong><span>供应链路线是代表性、可解释的策展路径；贸易金额是海关统计，不等于企业利润、成本或某台具体手机的价格。未知值保持未知。</span></section>
  </div></SiteShell>;
}
