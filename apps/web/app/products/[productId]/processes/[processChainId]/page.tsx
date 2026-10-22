import { itemLabel } from "../../../../../lib/item-label";
import { ProductNavigation } from "../../../../../components/product-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { contextMismatch, readPageContext, type SearchParamsLike } from "../../../../../lib/context";
import { industryPath, productPath, provenancePath, supplyChainPath } from "../../../../../lib/paths";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import {
  PeriodLabel,
  ResolvedEvidenceList,
  StatCard,
  StatusBadge,
  UnknownValue,
  WarningList
} from "../../../../../components/data-display";

function requirementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    equipment: "设备类别",
    material: "材料",
    consumable: "耗材",
    software: "软件",
    service: "服务"
  };
  return labels[type] ?? "工序需求";
}

export default async function ManufacturingProcessPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string; processChainId: string }>;
  searchParams: Promise<SearchParamsLike>;
}) {
  const { productId, processChainId } = await params;
  const requestedContext = readPageContext(await searchParams);
  const queries = await getQueryService(requestedContext.datasetVersion);
  const view = queries.getManufacturingProcessChain(productId, processChainId);
  if (!view) notFound();
  const mismatches = contextMismatch({datasetVersion:requestedContext.datasetVersion},{period:view.chain.period.label,datasetVersion:view.datasetVersion.version});
  const pageContext = {...requestedContext,...(mismatches.length ? {datasetVersion:view.datasetVersion.version} : {})};

  const industry = queries.getIndustryNetwork(productId);
  const equipmentCount = new Set(view.steps.flatMap((step) => step.requirements.flatMap((requirement) => requirement.equipmentCategory ? [requirement.equipmentCategory.id] : []))).size;
  const capabilityCount = view.steps.reduce((total, step) => total + step.requirements.reduce((sum, requirement) => sum + requirement.capabilities.length, 0), 0);

  return <SiteShell>
    <div className="content-column wide-column manufacturing-page">
      <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: itemLabel(view.product), href: productPath(productId, pageContext) }, { label: view.chain.title }]} />
      <ContextBanner period={view.chain.period.label} datasetVersion={view.datasetVersion.version} contentVersion={view.contentVersion?.version} mismatches={mismatches} />
      <PageIntro
        eyebrow="制造工艺"
        title={view.chain.title}
        description={view.chain.description}
        actions={<>{industry && <Link className="button button-primary" href={industryPath(productId,undefined,pageContext)}>查企业与产业上下游</Link>}<Link className="button button-secondary" href={view.componentItem ? supplyChainPath(productId, view.componentItem.id, pageContext) : productPath(productId, pageContext)}>返回组件路线</Link><Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link></>}
      />

      <ProductNavigation productId={productId} context={pageContext} active="route" hasIndustry={Boolean(industry)} hasMaterials={queries.getMaterialTradeObservations(productId).length>0}/>
      <div className="stat-grid">
        <StatCard label="关键工序" value={view.steps.length} detail="按顺序查看阶段摘要" />
        {equipmentCount > 0 && <StatCard label="设备类别" value={equipmentCount} detail="按工序关联" />}
        {capabilityCount > 0 && <StatCard label="厂商能力记录" value={capabilityCount} detail={`${view.organizations.length} 家企业`} />}
      </div>

      {view.routeVariants.length > 0 && <section className="section-block" aria-labelledby="process-variants-title">
        <div className="section-heading"><div><p className="eyebrow">可选工艺路线</p><h2 id="process-variants-title">先了解可选路线，再阅读工序</h2></div><span className="section-caption">不同路线共享部分工序，也可能替换或跳过某些步骤</span></div>
        <div className="process-variant-grid">
          {view.routeVariants.map((variant) => <article className="process-variant-card" key={variant.id}>
            <div><span className="card-kicker">{variant.stepIds.length} 道关联工序</span><h3>{variant.name}</h3></div>
            <p>{variant.description}</p>
            <strong>{variant.applicability}</strong>
            <details><summary>路线资料说明</summary><p>{variant.limitations.join("；")}</p></details>
          </article>)}
        </div>
      </section>}

      <section className="section-block" aria-labelledby="process-flow-title">
        <div className="section-heading"><div><p className="eyebrow">工序顺序</p><h2 id="process-flow-title">按顺序查看每道工序</h2></div><span className="section-caption">先看摘要；点击某一步，再查看输入、输出、设备、厂商和证据</span></div>
        <ol className="manufacturing-step-list">
          {view.steps.map((stepView, index) => {
            const { step } = stepView;
            const equipmentRequirements = stepView.requirements.filter(({ requirement }) => requirement.requirementType === "equipment");
            const manufacturerCount = stepView.requirements.reduce((total, requirement) => total + requirement.capabilities.length, 0);
            const summaryItems = [
              stepView.inputItems.length > 0 ? `输入：${stepView.inputItems.map((item) => item.name).join("、")}` : null,
              stepView.outputItems.length > 0 ? `输出：${stepView.outputItems.map((item) => item.name).join("、")}` : null,
              equipmentRequirements.length > 0 ? `${equipmentRequirements.length} 类设备` : null,
              manufacturerCount ? `${manufacturerCount} 条厂商资料` : null
            ].filter(Boolean);
            return <li className="manufacturing-step" key={step.id}>
              <details className="manufacturing-step-card">
                <summary className="manufacturing-step-summary">
                  <span className="manufacturing-step-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="manufacturing-step-summary-copy">
                    <span className="card-kicker">{step.phase}</span>
                    <strong>{step.name}</strong>
                    <span>{step.description}</span>
                    <span className="manufacturing-step-summary-facts">{summaryItems.map((item) => <span key={item}>{item}</span>)}</span>
                  </span>
                  <span className="manufacturing-step-summary-status"><StatusBadge status={step.dataStatus} method={step.method} /></span>
                </summary>

                <div className="manufacturing-step-detail">
                  <div className="manufacturing-step-detail-grid">
                    <div className="process-detail-panel">
                      <span className="metadata-label">输入</span>
                      {stepView.inputItems.length > 0 ? <ul className="process-item-list">{stepView.inputItems.map((item) => <li key={item.id}>{item.name}</li>)}</ul> : <UnknownValue label="未指定" />}
                    </div>
                    <div className="process-detail-panel">
                      <span className="metadata-label">输出</span>
                      {stepView.outputItems.length > 0 ? <ul className="process-item-list">{stepView.outputItems.map((item) => <li key={item.id}>{item.name}</li>)}</ul> : <UnknownValue label="未指定" />}
                    </div>
                    {stepView.routeVariants.length > 0 && <div className="process-detail-panel">
                      <span className="metadata-label">适用路线</span>
                      <div className="process-route-tags">{stepView.routeVariants.length > 0 ? stepView.routeVariants.map((variant) => <span key={variant.id}>{variant.name}</span>) : <UnknownValue label="未指定" />}</div>
                    </div>}
                    <div className="process-detail-panel">
                      <span className="metadata-label">资料年份</span>
                      <PeriodLabel period={step.period} />
                      <StatusBadge status={step.dataStatus} method={step.method} />
                    </div>
                  </div>

                  {stepView.relatedIndustryTopics.length > 0 && <div className="process-industry-links"><strong>继续查材料与部件的上下游</strong><div>{stepView.relatedIndustryTopics.map(topic => <Link key={topic.id} href={industryPath(productId,topic.id,pageContext)}>{topic.label} →</Link>)}</div></div>}
                  <div className="process-requirement-list">
                    {stepView.requirements.filter(({requirement}) => requirement.requirementType !== "material").map((requirementView) => {
                      const { requirement } = requirementView;
                      const capabilityCountForRequirement = requirementView.capabilities.length;
                      return <article className="equipment-requirement" key={requirement.id}>
                        <div className="equipment-requirement-heading">
                          <div><span className="card-kicker">{requirementTypeLabel(requirement.requirementType)}</span><h4>{requirementView.equipmentCategory?.name ?? requirementView.item?.name ?? requirement.name}</h4></div>
                          <div className="process-requirement-badges"><span className="method-chip">{requirement.necessity === "core" ? "核心" : requirement.necessity === "supporting" ? "辅助" : "可选"}</span>{capabilityCountForRequirement > 0 && <span className="process-count-chip">{capabilityCountForRequirement} 家厂商</span>}<StatusBadge status={requirement.dataStatus} method={requirement.method} /></div>
                        </div>
                        <p>{requirementView.equipmentCategory?.description ?? requirement.description}</p>
                        {requirementView.item && <small className="requirement-item-link">关联商品：{requirementView.item.name}</small>}
                        {capabilityCountForRequirement > 0 ? <details className="process-nested-details">
                          <summary>查看厂商能力与证据（{capabilityCountForRequirement}）</summary>
                          <div className="manufacturer-capability-list">
                            {requirementView.capabilities.map((capability) => <article className="manufacturer-capability" key={capability.capability.id}>
                              <div className="manufacturer-capability-heading"><div><strong>{capability.organization?.name ?? "未知厂商"}</strong><span>{capability.headquarters?.name ?? "总部地区未纳入当前国家维度"}</span></div><span className="coverage-status coverage-status-partial_route">{capability.relationshipLabel}</span></div>
                              <p>{capability.capability.claim}</p>
                              <details><summary>能力资料说明</summary><p>{capability.relationshipDescription}</p></details>
                              <details><summary>查看证据与限制</summary><div className="manufacturer-evidence-detail"><span>来源：{capability.sources.map((source) => source.name).join("；") || "未解析"}</span><span>证据定位：{capability.evidence.map(({ evidence }) => evidence.locator).join("；") || "未提供"}</span><span>限制：{capability.capability.limitations.join("；")}</span></div></details>
                            </article>)}
                          </div>
                        </details> : null}
                        {requirementView.evidence.length > 0 && <details className="process-nested-details"><summary>查看该需求的证据（{requirementView.evidence.length}）</summary><ResolvedEvidenceList evidence={requirementView.evidence} compact /></details>}
                      </article>;
                    })}
                  </div>

                  <details className="process-nested-details process-step-evidence-details">
                    <summary>查看本步骤来源与证据（{stepView.sources.length} 个来源，{stepView.evidence.length} 条直接证据）</summary>
                    {stepView.evidence.length > 0 ? <ResolvedEvidenceList evidence={stepView.evidence} compact /> : <UnknownValue label="暂无本步骤直接证据" />}
                  </details>

                </div>
              </details>
            </li>;
          })}
        </ol>
      </section>

      <details className="detail-collapsible compact-detail">
        <summary className="detail-summary"><strong>资料与方法说明</strong><span>{view.warnings.length} 条说明</span></summary>
        <WarningList warnings={view.warnings} />
      </details>
    </div>
  </SiteShell>;
}
