import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../components/site-shell";
import { EvidenceGapStatusBadge, PeriodLabel, StatCard, StatusBadge, WarningList } from "../../../../components/data-display";
import { materialObservationPath, productPath, provenancePath } from "../../../../lib/paths";

type Search = { material?: string; partnerScope?: "world_total" | "entity"; flow?: "import" | "export"; mapping?: "exact" | "aggregate" | "approximate" | "curated" };

export default async function MaterialObservationsPage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<Search> }) {
  const { productId } = await params;
  const filters = await searchParams;
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  const all = queries.getMaterialTradeObservations(productId);
  const observations = queries.getMaterialTradeObservations(productId, { materialItemId: filters.material, partnerScope: filters.partnerScope, flow: filters.flow, classificationMappingType: filters.mapping });
  if (!overview) notFound();
  const materials = [...new Map(all.map((view) => [view.observation.materialItemId, view.item?.name ?? view.observation.materialItemId])).entries()];
  const href = (next: Search) => { const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value).map(([key, value]) => [key, String(value)])); return `${productPath(productId)}/materials${query.size ? `?${query}` : ""}`; };

  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: overview.product.name, href: productPath(productId) }, { label: "材料贸易观察" }]} />
    <PageIntro eyebrow="Material trade evidence" title={`${overview.product.name} · 材料贸易观察`} description="按材料、伙伴范围、方向和分类精度浏览海关观察。这里的双边支持只针对对应 HS 分类主张，不代表手机供应链路线已经被证明。" actions={<Link className="button button-secondary" href={provenancePath(productId)}>来源与版本</Link>} />
    <div className="stat-grid"><StatCard label="当前观察" value={observations.length} detail={`全部 ${all.length} 条`} /><StatCard label="材料" value={materials.length} detail="可筛选材料类别" /><StatCard label="适用期间" value={<PeriodLabel period={overview.period} />} detail="HS 2022" /><StatCard label="数据版本" value={overview.datasetVersion.version} detail="只读 published" /></div>
    <WarningList warnings={overview.warnings} />
    <section className="section-block filter-strip"><div><p className="eyebrow">Filters</p><h2>筛选观察</h2></div><div className="filter-links"><Link href={href({})}>全部</Link>{materials.map(([id, label]) => <Link key={id} href={href({ ...filters, material: id })}>{label}</Link>)}<Link href={href({ ...filters, partnerScope: "world_total" })}>世界总计</Link><Link href={href({ ...filters, partnerScope: "entity" })}>具体伙伴</Link><Link href={href({ ...filters, flow: "import" })}>进口</Link><Link href={href({ ...filters, flow: "export" })}>出口</Link><Link href={href({ ...filters, mapping: "exact" })}>精确分类</Link><Link href={href({ ...filters, mapping: "aggregate" })}>聚合分类</Link></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Observed classifications</p><h2>观察结果</h2></div><span className="section-caption">unknown 不显示为 0</span></div><div className="trade-observation-list">
      {observations.map(({ observation, reporter, partner, item, relatedEvidenceGaps }) => <article className="trade-observation-card" key={observation.observationId}>
        <div className="trade-observation-heading"><div><span className="card-kicker">HS {observation.classificationCode} · {observation.classificationMappingType}</span><h3>{item?.name ?? observation.materialItemId}</h3><p>{reporter?.name} → {partner?.name ?? "世界总计"} · {observation.flow}</p></div><StatusBadge status={observation.valueDataStatus} method={observation.method} /></div>
        <div className="trade-values"><div><small>金额</small><strong>{observation.value === null ? "未知" : observation.value === 0 ? "USD 0 · 来源报告为零" : `USD ${observation.value.toLocaleString()}`}</strong></div><div><small>数量</small><strong>{observation.quantity === null ? "未知/未提供" : observation.quantity === 0 ? "0 · 来源报告为零" : observation.quantity.toLocaleString()}</strong></div></div>
        <p className="muted">{observation.limitation}</p><div className="evidence-gap-summary">{relatedEvidenceGaps.map(({ gap }) => <span className="evidence-gap-summary-item" key={gap.gapId}><EvidenceGapStatusBadge status={gap.status} /> {gap.gapId}</span>)}</div>
        <Link className="card-footer" href={materialObservationPath(productId, observation.observationId)}>查看证据边界与缺口 <span>→</span></Link>
      </article>)}
    </div></section>
  </div></SiteShell>;
}
