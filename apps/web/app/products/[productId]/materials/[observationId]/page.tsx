import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { EvidenceGapRegistry, MetadataItem, SourceMetadata, ValueDisplay } from "../../../../../components/data-display";
import { ledgerPath, materialObservationsPath, provenancePath } from "../../../../../lib/paths";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../../../lib/context";

export default async function MaterialObservationDetailPage({ params, searchParams }: { params: Promise<{ productId: string; observationId: string }>; searchParams: Promise<SearchParamsLike> }) {
  const { productId, observationId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  const view = queries.getMaterialTradeObservation(productId, observationId);
  if (!overview || !view) notFound();
  const { observation, reporter, partner, item, source, relatedEvidenceGaps } = view;
  const ledgerExists = (entityId: string) => queries.getCountryLedger(productId, entityId) !== null;
  const ledgerLinks = [
    reporter && reporter.id && ledgerExists(reporter.id)
      ? { id: reporter.id, name: reporter.name, role: "报告国" }
      : null,
    partner && partner.id && view.partnerScope === "entity" && ledgerExists(partner.id)
      ? { id: partner.id, name: partner.name, role: "伙伴国" }
      : null
  ].filter((entry): entry is { id: string; name: string; role: string } => entry !== null);
  const direction = observation.flow === "import" ? "进口" : "出口";
  const connection = observation.partnerScope === "world_total" ? `${reporter?.name} · 对全球${direction}` : observation.flow === "import" ? `${partner?.name} → ${reporter?.name}` : `${reporter?.name} → ${partner?.name}`;
  const mapping = {exact: "精确分类", aggregate: "汇总分类", approximate: "近似分类", curated: "整理分类"}[observation.classificationMappingType];
  const mismatches = contextMismatch(pageContext, { period: observation.period.label, datasetVersion: overview.datasetVersion.version });
  return <SiteShell><div className="content-column">
    <PageIntro eyebrow={`${observation.classificationSystem} ${observation.classificationVersion} / ${observation.classificationCode}`} title={`${item?.name ?? observation.materialItemId} · ${connection}`} description={`${observation.period.label} · ${reporter?.name}${direction}报告 · ${mapping}`} meta={<ContextBanner period={observation.period.label} datasetVersion={overview.datasetVersion.version} mismatches={mismatches} />} actions={<Link className="button button-secondary" href={materialObservationsPath(productId, pageContext)}>返回材料贸易</Link>} />
    <section className="section-block"><div className="trade-values"><div><small>贸易金额</small><strong><ValueDisplay value={observation.value} status={observation.valueDataStatus} currency={observation.currency} /></strong></div>{observation.quantity !== null && <div><small>数量</small><strong><ValueDisplay value={observation.quantity} status={observation.quantityDataStatus} unit={observation.unit} /></strong></div>}</div></section>
    {source && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">资料来源</p><h2>数据来源</h2></div></div><p>{source.publisher} · {source.url ? <a className="text-link" href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> : source.name}</p><details className="reading-details"><summary>来源与统计口径</summary><p>{observation.limitation}</p><SourceMetadata source={source} /><div className="fact-metadata-grid"><MetadataItem label="报告国代码" value={observation.reporterCode} /><MetadataItem label="伙伴代码" value={observation.partnerCode} /><MetadataItem label="记录编号" value={observation.observationId} /><MetadataItem label="整理方法" value={observation.method} />{typeof observation.quality.rawResponseSha256 === "string" && <MetadataItem label="原文校验" value={observation.quality.rawResponseSha256} />}</div>{typeof observation.quality.requestUrl === "string" && <p><a className="text-link" href={observation.quality.requestUrl} target="_blank" rel="noreferrer">打开原始统计查询 ↗</a></p>}</details></section>}
    {relatedEvidenceGaps.length > 0 && <details className="section-block detail-collapsible"><summary className="detail-summary"><strong>相关研究记录</strong></summary><EvidenceGapRegistry gaps={relatedEvidenceGaps} compact /></details>}
    <section className="hierarchy-next-step"><strong>继续探索</strong><span>查看其他材料与商品的资料。</span>{ledgerLinks.map(link => <Link key={link.id} className="text-link" href={ledgerPath(productId, link.id, pageContext)}>{link.role}账本 · {link.name} →</Link>)}<Link className="button button-secondary" href={provenancePath(productId, pageContext)}>全部来源 →</Link></section>
  </div></SiteShell>;
}
