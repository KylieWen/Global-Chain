import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../components/site-shell";
import { contextMismatch, readPageContext } from "../../../../lib/context";
import { PeriodLabel, StatusBadge, ValueDisplay } from "../../../../components/data-display";
import { materialObservationPath, materialObservationsPath, productPath, provenancePath } from "../../../../lib/paths";

type Search = { material?: string; partnerScope?: "world_total" | "entity"; flow?: "import" | "export"; mapping?: "exact" | "aggregate" | "approximate" | "curated" };

export default async function MaterialObservationsPage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<Search> }) {
  const { productId } = await params;
  const filters = await searchParams;
  const pageContext = readPageContext(filters);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  const all = queries.getMaterialTradeObservations(productId);
  const selectedPeriod = pageContext.label ?? pageContext.period;
  const observations = queries.getMaterialTradeObservations(productId, { label: selectedPeriod, materialItemId: filters.material, partnerScope: filters.partnerScope, flow: filters.flow, classificationMappingType: filters.mapping });
  if (!overview) notFound();
  const materials = [...new Map(all.map((view) => [view.observation.materialItemId, view.item?.name ?? view.observation.materialItemId])).entries()];
  const periods = [...new Set(all.map(({ observation }) => observation.period.label))].sort();
  const periodLabel = selectedPeriod ?? periods.join("、");
  const mismatches = contextMismatch(pageContext, { period: periodLabel, datasetVersion: overview.datasetVersion.version });
  const href = (next: Search) => materialObservationsPath(productId, { ...pageContext, ...next });
  const allHref = materialObservationsPath(productId, { datasetVersion: pageContext.datasetVersion });

  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: overview.product.name, href: productPath(productId, pageContext) }, { label: "材料贸易观察" }]} />
    <ContextBanner period={periodLabel} datasetVersion={overview.datasetVersion.version} mismatches={mismatches} />
    <PageIntro eyebrow="Materials & trade" title={`${overview.product.name} · 材料贸易`} description="看看这些材料从哪里来、流向哪里，以及各国的进出口规模。" actions={<Link className="button button-secondary" href={provenancePath(productId, pageContext)}>查看资料来源</Link>} />
    <section className="section-block filter-strip"><div><p className="eyebrow">Filters</p><h2>筛选观察</h2></div><div className="filter-links"><Link href={href({})}>全部</Link>{materials.map(([id, label]) => <Link key={id} href={href({ ...filters, material: id })}>{label}</Link>)}<Link href={href({ ...filters, partnerScope: "world_total" })}>世界总计</Link><Link href={href({ ...filters, partnerScope: "entity" })}>具体伙伴</Link><Link href={href({ ...filters, flow: "import" })}>进口</Link><Link href={href({ ...filters, flow: "export" })}>出口</Link><Link href={href({ ...filters, mapping: "exact" })}>精确分类</Link><Link href={href({ ...filters, mapping: "aggregate" })}>聚合分类</Link></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Trade records</p><h2>材料进出口</h2></div><span className="section-caption">{materials.length} 类材料 · {observations.length} 条记录</span></div><div className="trade-observation-list">
      {observations.map(({ observation, reporter, partner, item }) => <article className="trade-observation-card" key={observation.observationId}>
        <div className="trade-observation-heading"><div><span className="card-kicker">HS {observation.classificationCode} · <PeriodLabel period={observation.period} /></span><h3>{item?.name ?? observation.materialItemId}</h3><p>{observation.partnerScope === "world_total" ? `${reporter?.name} · 对全球${observation.flow === "import" ? "进口" : "出口"}` : observation.flow === "import" ? `${partner?.name} → ${reporter?.name}` : `${reporter?.name} → ${partner?.name}`}</p></div><StatusBadge status={observation.valueDataStatus} method={observation.method} /></div>
        <div className="trade-values"><div><small>金额</small><strong><ValueDisplay compact value={observation.value} status={observation.valueDataStatus} currency={observation.currency} /></strong></div>{observation.quantity !== null && <div><small>数量</small><strong><ValueDisplay compact value={observation.quantity} status={observation.quantityDataStatus} unit={observation.unit} /></strong></div>}</div>
        <Link className="card-footer" href={materialObservationPath(productId, observation.observationId, pageContext)}>查看来源与统计口径 <span>→</span></Link>
      </article>)}
    </div>{observations.length === 0 && <div className="empty-state"><strong>换一组条件继续看看</strong><Link className="text-link" href={allHref}>显示全部材料记录 →</Link></div>}</section>
  </div></SiteShell>;
}
