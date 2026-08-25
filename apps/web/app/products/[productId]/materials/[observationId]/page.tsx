import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { EvidenceGapRegistry, EvidenceLevelBadge, MetadataItem, StatusBadge } from "../../../../../components/data-display";
import { materialObservationsPath, productPath, provenancePath } from "../../../../../lib/paths";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../../../lib/context";

export default async function MaterialObservationDetailPage({ params, searchParams }: { params: Promise<{ productId: string; observationId: string }>; searchParams: Promise<SearchParamsLike> }) {
  const { productId, observationId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const overview = queries.getProductOverview(productId);
  const view = queries.getMaterialTradeObservation(productId, observationId);
  if (!overview || !view) notFound();
  const { observation, reporter, partner, item, source, evidenceLevel, relatedEvidenceGaps } = view;
  const mismatches = contextMismatch(pageContext, { period: observation.period.label, datasetVersion: observation.datasetVersionId, contentVersion: null });
  return <SiteShell><div className="content-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: overview.product.name, href: productPath(productId, pageContext) }, { label: "材料观察", href: materialObservationsPath(productId, pageContext) }, { label: observation.observationId }]} />
    <ContextBanner period={observation.period.label} datasetVersion={observation.datasetVersionId} contentVersion={null} mismatches={mismatches} />
    <PageIntro eyebrow={`${observation.classificationSystem} ${observation.classificationVersion} / ${observation.classificationCode}`} title={`${item?.name ?? observation.materialItemId} · ${reporter?.name} → ${partner?.name ?? "世界总计"}`} description="这是一个分类商品海关观察详情，不是手机、电池、企业、工厂或批次的物料追踪记录。" actions={<><Link className="button button-primary" href={materialObservationsPath(productId, pageContext)}>返回材料观察</Link><Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link></>} />
    <section className="section-block node-identity-panel"><div><p className="eyebrow">Evidence boundary</p><h2>这条观察能支持什么</h2><p>支持指定报告方、伙伴、方向、期间和 HS 分类的海关贸易主张。</p><EvidenceLevelBadge level={evidenceLevel} /></div><div className="node-identity-meta"><MetadataItem label="方向" value={observation.flow} /><MetadataItem label="伙伴范围" value={observation.partnerScope} /><MetadataItem label="分类映射" value={observation.classificationMappingType} /><MetadataItem label="期间" value={observation.period.label} /><MetadataItem label="数据集" value={observation.datasetVersionId} /><MetadataItem label="方法" value={observation.method} /></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Measured values</p><h2>金额与数量</h2></div></div><div className="trade-values"><div><small>金额状态</small><StatusBadge status={observation.valueDataStatus} /><strong>{observation.value === null ? "未知" : observation.value === 0 ? `${observation.currency ?? ""} 0 · 来源报告为零` : `${observation.currency ?? ""} ${observation.value.toLocaleString()}`}</strong></div><div><small>数量状态</small><StatusBadge status={observation.quantityDataStatus} /><strong>{observation.quantity === null ? "未知/未提供" : observation.quantity === 0 ? "0 · 来源报告为零" : observation.quantity.toLocaleString()}</strong></div></div><p className="muted">{observation.limitation}</p></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Source</p><h2>来源与审计字段</h2></div></div><div className="fact-metadata-grid"><MetadataItem label="来源" value={source?.name ?? "未解析"} /><MetadataItem label="机构" value={source?.publisher ?? "未提供"} /><MetadataItem label="reporterCode" value={observation.reporterCode} /><MetadataItem label="partnerCode" value={observation.partnerCode} /><MetadataItem label="观察 ID" value={observation.observationId} /><MetadataItem label="获取时间" value={String(observation.quality.retrievedAt ?? "未提供")} /><MetadataItem label="响应哈希" value={String(observation.quality.rawResponseSha256 ?? "未提供")} /></div>{typeof observation.quality.requestUrl === "string" ? <p><a href={observation.quality.requestUrl}>打开该材料观察的原始查询</a></p> : null}</section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Related gaps</p><h2>相关证据缺口</h2></div><span className="section-caption">匹配材料节点或 HS 分类候选</span></div>{relatedEvidenceGaps.length ? <EvidenceGapRegistry gaps={relatedEvidenceGaps} compact /> : <p className="muted">当前没有自动匹配的登记项；这不表示证据完整。</p>}</section>
  </div></SiteShell>;
}
