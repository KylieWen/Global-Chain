import { itemLabel } from "../../../../lib/item-label";
import { ProductNavigation } from "../../../../components/product-navigation";
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
  const filterGroups: {label:string;key:keyof Search;options:{value:string;label:string}[]}[] = [
    {label:"材料",key:"material",options:[{value:"",label:"全部材料"},...materials.map(([value,label])=>({value,label}))]},
    {label:"统计范围",key:"partnerScope",options:[{value:"",label:"全部范围"},{value:"world_total",label:"世界总计"},{value:"entity",label:"具体伙伴"}]},
    {label:"贸易方向",key:"flow",options:[{value:"",label:"进出口"},{value:"import",label:"进口"},{value:"export",label:"出口"}]},
    {label:"分类口径",key:"mapping",options:[{value:"",label:"全部口径"},{value:"exact",label:"精确分类"},{value:"aggregate",label:"聚合分类"},{value:"approximate",label:"近似分类"}]}
  ];

  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: itemLabel(overview.product), href: productPath(productId, pageContext) }, { label: "材料贸易观察" }]} />
    <ContextBanner period={periodLabel} datasetVersion={overview.datasetVersion.version} mismatches={mismatches} />
    <PageIntro eyebrow="材料贸易" title={`${itemLabel(overview.product)} · 材料贸易`} description="看看这些材料从哪里来、流向哪里，以及各国的进出口规模。" actions={<Link className="button button-secondary" href={provenancePath(productId, pageContext)}>查看资料来源</Link>} />
    <ProductNavigation productId={productId} context={pageContext} active="materials" hasIndustry={Boolean(queries.getIndustryNetwork(productId))} hasMaterials={true}/>
    <section className="section-block filter-strip" aria-label="材料贸易筛选"><div className="material-filter-groups">{filterGroups.map(group=><div className="material-filter-group" key={group.key}><strong>{group.label}</strong>{group.options.map(option=><Link key={option.value} aria-current={(filters[group.key]??"")===option.value?"page":undefined} href={href({...filters,[group.key]:option.value||undefined})}>{option.label}</Link>)}</div>)}<Link className="text-link" href={allHref}>重置全部筛选 →</Link></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">贸易记录</p><h2>材料进出口</h2></div><span className="section-caption">{materials.length} 类材料 · {observations.length} 条记录</span></div><div className="trade-observation-list">
      {observations.map(({ observation, reporter, partner, item }) => <article className="trade-observation-card" key={observation.observationId}>
        <div className="trade-observation-heading"><div><span className="card-kicker">HS {observation.classificationCode} · <PeriodLabel period={observation.period} /></span><h3>{item?.name ?? observation.materialItemId}</h3><p>{observation.partnerScope === "world_total" ? `${reporter?.name} · 对全球${observation.flow === "import" ? "进口" : "出口"}` : observation.flow === "import" ? `${partner?.name} → ${reporter?.name}` : `${reporter?.name} → ${partner?.name}`}</p></div><StatusBadge status={observation.valueDataStatus} method={observation.method} /></div>
        <div className="trade-values"><div><small>金额</small><strong><ValueDisplay compact value={observation.value} status={observation.valueDataStatus} currency={observation.currency} /></strong></div>{observation.quantity !== null && <div><small>数量</small><strong><ValueDisplay compact value={observation.quantity} status={observation.quantityDataStatus} unit={observation.unit} /></strong></div>}</div>
        <Link className="card-footer" href={materialObservationPath(productId, observation.observationId, pageContext)}>查看来源与统计口径 <span>→</span></Link>
      </article>)}
    </div>{observations.length === 0 && <div className="empty-state"><strong>换一组条件继续看看</strong><Link className="text-link" href={allHref}>显示全部材料记录 →</Link></div>}</section>
  </div></SiteShell>;
}
