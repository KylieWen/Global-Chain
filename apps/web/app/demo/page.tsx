import Link from "next/link";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getQueryService } from "../../lib/data";
import { productPath, manufacturingProcessPath, mapPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const featured = products[0];
  const productId = featured?.productId ?? "generic-smartphone";
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "3 分钟演示" }]} />
    <PageIntro eyebrow="Guided demo · 约 3 分钟" title="从一部手机，看见一条全球产业链" description="按下面的顺序点击，你会看到 GlobeChain 如何把商品拆解、制造工艺、设备厂商、国家贸易和证据边界连接在同一条可追溯路径上。" actions={<Link className="button button-primary" href={productPath(productId)}>直接进入商品总览 →</Link>} />

    <section className="demo-callout" aria-label="演示说明">
      <strong>演示重点</strong><span>不是展示一张“看起来很复杂”的地图，而是展示每个节点为什么出现、证据支持到哪里，以及哪些内容仍然未知。</span>
    </section>

    <ol className="demo-step-list">
      <li className="demo-step-card"><span className="demo-step-number">01</span><div><p className="card-kicker">商品拆解</p><h2>先看手机由什么组成</h2><p>从通用智能手机进入组件树，选择电池、处理器与存储器等部件，建立“成品 → 部件 → 材料”的阅读起点。</p><Link className="button button-secondary" href={productPath(productId)}>打开商品总览 →</Link></div></li>
      <li className="demo-step-card"><span className="demo-step-number">02</span><div><p className="card-kicker">工艺与设备</p><h2>再看一颗芯片怎样被制造</h2><p>进入半导体封装工艺，切换线焊与倒装代表路线，查看 18 道工序、设备类别、材料耗材和已有厂商能力证据。</p><Link className="button button-secondary" href={manufacturingProcessPath(productId, "process-chain-semiconductor-packaging")}>打开工艺链 →</Link></div></li>
      <li className="demo-step-card"><span className="demo-step-number">03</span><div><p className="card-kicker">国家与贸易</p><h2>最后把链路放回世界经济</h2><p>选择国家查看贸易账本，再打开世界地图，观察国家整体轮廓、伙伴贸易观察和数据覆盖范围。</p><div className="demo-actions"><Link className="button button-secondary" href="/countries">打开国家账本 →</Link><Link className="button button-secondary" href={mapPath()}>打开世界地图 →</Link></div></div></li>
    </ol>

    <section className="demo-audience-grid" aria-label="适用场景"><article><p className="card-kicker">给研究者</p><h2>可追溯</h2><p>每条路线、指标和设备能力都能回到来源、版本与证据说明。</p></article><article><p className="card-kicker">给采购与战略</p><h2>可探索</h2><p>先定位材料、工序和国家角色，再决定需要补查哪些直接证据。</p></article><article><p className="card-kicker">给课堂与公众</p><h2>可理解</h2><p>用一件日常商品解释全球分工，而不是把统计表直接丢给用户。</p></article></section>

    <section className="demo-boundary-note"><strong>请这样理解 Demo：</strong><span>供应链路线是代表性、可解释的策展路径；贸易金额是海关统计，不等于企业利润、成本或某台具体手机的价格。未知值保持未知。</span></section>
  </div></SiteShell>;
}
