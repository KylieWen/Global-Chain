import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../components/site-shell";
import { ProductTree } from "../../../components/product-tree";
import { provenancePath, supplyChainPath } from "../../../lib/paths";
import {
  PeriodLabel,
  ProvenancePanel,
  PublicationBadge,
  StatCard,
  StatusBadge,
  WarningList
} from "../../../components/data-display";

export default async function ProductOverviewPage({
  params
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  const breakdown = queries.getProductBreakdown(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !breakdown || !provenance) notFound();

  return (
    <SiteShell>
      <div className="content-column">
        <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: overview.product.name }]} />
        <PageIntro
          eyebrow={`${overview.product.category} / ${overview.product.slug}`}
          title={overview.product.name}
          description={overview.product.description ?? "这是一个由数据配置驱动的通用商品对象。"}
          actions={<Link className="button button-primary" href={supplyChainPath(productId)}>查看供应链全图</Link>}
        />

        <div className="stat-grid">
          <StatCard label="直接组成" value={overview.directChildren.length} detail="个节点" />
          <StatCard label="适用期间" value={<PeriodLabel period={overview.period} />} detail={overview.period.start} />
          <StatCard label="数据集" value={overview.datasetVersion.version} detail={overview.datasetVersion.name} />
          <StatCard label="发布状态" value={<PublicationBadge status={overview.datasetVersion.status} />} detail="页面只读" />
        </div>

        <WarningList warnings={overview.warnings} />

        <section className="section-block" aria-labelledby="breakdown-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Product breakdown</p>
              <h2 id="breakdown-title">商品拆解树</h2>
            </div>
            <span className="section-caption">点击任意节点进入该节点的代表性路径</span>
          </div>
          <ProductTree root={breakdown} productId={productId} />
        </section>

        <section className="section-block" aria-labelledby="children-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">First-level components</p>
              <h2 id="children-title">第一层组成</h2>
            </div>
          </div>
          <div className="component-grid">
            {overview.directChildren.map((item) => (
              <Link className="component-card" href={supplyChainPath(productId, item.id)} key={item.id}>
                <span className="card-kicker">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description ?? "暂无说明"}</p>
                <StatusBadge status={item.dataStatus} method={item.method} />
                <span className="card-footer">进入代表性路径 <span>→</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section-block method-strip" aria-label="页面方法说明">
          <div>
            <p className="eyebrow">Method boundary</p>
            <h2>如何阅读这张链路</h2>
          </div>
          <p>供应链流是人工整理的代表性内容；贸易观察与宏观指标是独立事实类型。路线金额或数量只在数据明确发布时展示，缺失值不会被补成零。</p>
          <Link className="button button-secondary" href={provenancePath(productId)}>查看来源与版本</Link>
        </section>

        <ProvenancePanel provenance={provenance} />
      </div>
    </SiteShell>
  );
}
