import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { readPageContext, type SearchParamsLike } from "../../../../../lib/context";
import { productPath, provenancePath, supplyChainPath } from "../../../../../lib/paths";
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

function uniqueEvidenceCount(
  step: {
    evidence: readonly { evidence: { id: string } }[];
    requirements: readonly {
      evidence: readonly { evidence: { id: string } }[];
      capabilities: readonly { evidence: readonly { evidence: { id: string } }[] }[];
    }[];
  }
): number {
  return new Set([
    ...step.evidence.map(({ evidence }) => evidence.id),
    ...step.requirements.flatMap((requirement) => [
      ...requirement.evidence.map(({ evidence }) => evidence.id),
      ...requirement.capabilities.flatMap((capability) => capability.evidence.map(({ evidence }) => evidence.id))
    ])
  ]).size;
}

export default async function ManufacturingProcessPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string; processChainId: string }>;
  searchParams: Promise<SearchParamsLike>;
}) {
  const { productId, processChainId } = await params;
  const pageContext = readPageContext(await searchParams);
  const queries = await getQueryService(pageContext.datasetVersion);
  const view = queries.getManufacturingProcessChain(productId, processChainId);
  if (!view) notFound();

  const equipmentCount = new Set(view.steps.flatMap((step) => step.requirements.flatMap((requirement) => requirement.equipmentCategory ? [requirement.equipmentCategory.id] : []))).size;
  const capabilityCount = view.steps.reduce((total, step) => total + step.requirements.reduce((sum, requirement) => sum + requirement.capabilities.length, 0), 0);
  const commercialRelationshipCount = view.steps.reduce((total, step) => total + step.requirements.reduce((sum, requirement) => sum + requirement.capabilities.filter(({ capability }) => capability.commercialRelationshipClaimed).length, 0), 0);
  const equipmentWithManufacturerCount = new Set(view.steps.flatMap((step) => step.requirements.filter((requirement) => requirement.capabilities.length > 0).flatMap((requirement) => requirement.equipmentCategory ? [requirement.equipmentCategory.id] : []))).size;

  return <SiteShell>
    <div className="content-column wide-column">
      <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: view.product.name, href: productPath(productId, pageContext) }, { label: view.chain.title }]} />
      <ContextBanner period={view.chain.period.label} datasetVersion={view.datasetVersion.version} contentVersion={view.contentVersion?.version} mismatches={[]} />
      <PageIntro
        eyebrow="Manufacturing process depth"
        title={view.chain.title}
        description={view.chain.description}
        actions={<><Link className="button button-secondary" href={view.componentItem ? supplyChainPath(productId, view.componentItem.id, pageContext) : productPath(productId, pageContext)}>返回组件证据视图</Link><Link className="button button-secondary" href={provenancePath(productId, pageContext)}>来源与版本</Link></>}
      />

      <section className="process-boundary-banner">
        <strong>这里回答的是“每道工序通常需要什么，以及哪些厂商公开提供这类设备”。</strong>
        <span>它不证明这些厂商向某家工厂、某款芯片或某部手机实际供货；展开详情可以查看证据范围。</span>
      </section>

      <div className="stat-grid">
        <StatCard label="关键工序" value={view.steps.length} detail="按顺序查看阶段摘要" />
        <StatCard label="设备类别" value={equipmentCount} detail="按工序关联" />
        <StatCard label="厂商能力记录" value={capabilityCount} detail={`${view.organizations.length} 家企业`} />
        <StatCard label="厂商证据覆盖" value={`${equipmentWithManufacturerCount}/${equipmentCount}`} detail="其余设备类别保留为待补" />
        <StatCard label="已证实客户供货关系" value={commercialRelationshipCount} detail="没有证据时保持 0 条关系记录" />
        <StatCard label="适用期间" value={<PeriodLabel period={view.chain.period} />} detail={view.datasetVersion.version} />
      </div>

      <section className="section-block" aria-labelledby="process-variants-title">
        <div className="section-heading"><div><p className="eyebrow">Route variants</p><h2 id="process-variants-title">先了解可选路线，再阅读工序</h2></div><span className="section-caption">不同路线共享部分工序，也可能替换或跳过某些步骤</span></div>
        <div className="process-variant-grid">
          {view.routeVariants.map((variant) => <article className="process-variant-card" key={variant.id}>
            <div><span className="card-kicker">{variant.stepIds.length} 道关联工序</span><h3>{variant.name}</h3></div>
            <p>{variant.description}</p>
            <strong>{variant.applicability}</strong>
            <small>{variant.limitations.join("；")}</small>
          </article>)}
        </div>
      </section>

      <section className="section-block" aria-labelledby="process-flow-title">
        <div className="section-heading"><div><p className="eyebrow">Process sequence</p><h2 id="process-flow-title">按顺序查看每道工序</h2></div><span className="section-caption">先看摘要；点击某一步，再查看输入、输出、设备、厂商和证据</span></div>
        <ol className="manufacturing-step-list">
          {view.steps.map((stepView) => {
            const { step } = stepView;
            const equipmentRequirements = stepView.requirements.filter(({ requirement }) => requirement.requirementType === "equipment");
            const manufacturerCount = stepView.requirements.reduce((total, requirement) => total + requirement.capabilities.length, 0);
            const evidenceCount = uniqueEvidenceCount(stepView);
            const summaryItems = [
              stepView.inputItems.length > 0 ? `输入：${stepView.inputItems.map((item) => item.name).join("、")}` : "输入：未指定",
              stepView.outputItems.length > 0 ? `输出：${stepView.outputItems.map((item) => item.name).join("、")}` : "输出：未指定",
              `${equipmentRequirements.length} 类设备`,
              `${manufacturerCount} 条厂商能力记录`,
              `${evidenceCount} 条证据`
            ];
            return <li className="manufacturing-step" key={step.id}>
              <details className="manufacturing-step-card">
                <summary className="manufacturing-step-summary">
                  <span className="manufacturing-step-index">{String(step.order + 1).padStart(2, "0")}</span>
                  <span className="manufacturing-step-summary-copy">
                    <span className="card-kicker">{step.phase}</span>
                    <strong>{step.name}</strong>
                    <span>{step.description}</span>
                    <span className="manufacturing-step-summary-facts">{summaryItems.map((item) => <span key={item}>{item}</span>)}</span>
                  </span>
                  <span className="manufacturing-step-summary-status"><StatusBadge status={step.dataStatus} method={step.method} /><span className="manufacturing-step-expand">查看详情</span></span>
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
                    <div className="process-detail-panel">
                      <span className="metadata-label">适用路线</span>
                      <div className="process-route-tags">{stepView.routeVariants.length > 0 ? stepView.routeVariants.map((variant) => <span key={variant.id}>{variant.name}</span>) : <UnknownValue label="未指定" />}</div>
                    </div>
                    <div className="process-detail-panel">
                      <span className="metadata-label">期间与状态</span>
                      <PeriodLabel period={step.period} />
                      <StatusBadge status={step.dataStatus} method={step.method} />
                    </div>
                  </div>

                  <div className="process-requirement-list">
                    {stepView.requirements.map((requirementView) => {
                      const { requirement } = requirementView;
                      const capabilityCountForRequirement = requirementView.capabilities.length;
                      return <article className="equipment-requirement" key={requirement.id}>
                        <div className="equipment-requirement-heading">
                          <div><span className="card-kicker">{requirementTypeLabel(requirement.requirementType)}</span><h4>{requirementView.equipmentCategory?.name ?? requirementView.item?.name ?? requirement.name}</h4></div>
                          <div className="process-requirement-badges"><span className="method-chip">{requirement.necessity === "core" ? "核心" : requirement.necessity === "supporting" ? "辅助" : "可选"}</span><span className="process-count-chip">{capabilityCountForRequirement} 家厂商能力</span><StatusBadge status={requirement.dataStatus} method={requirement.method} /></div>
                        </div>
                        <p>{requirementView.equipmentCategory?.description ?? requirement.description}</p>
                        {requirementView.item && <small className="requirement-item-link">关联商品：{requirementView.item.name}</small>}
                        {capabilityCountForRequirement > 0 ? <details className="process-nested-details">
                          <summary>查看厂商能力与证据（{capabilityCountForRequirement}）</summary>
                          <div className="manufacturer-capability-list">
                            {requirementView.capabilities.map((capability) => <article className="manufacturer-capability" key={capability.capability.id}>
                              <div className="manufacturer-capability-heading"><div><strong>{capability.organization?.name ?? "未知厂商"}</strong><span>{capability.headquarters?.name ?? "总部地区未纳入当前国家维度"}</span></div><span className="coverage-status coverage-status-partial_route">{capability.relationshipLabel}</span></div>
                              <p>{capability.capability.claim}</p>
                              <small>{capability.relationshipDescription}</small>
                              <details><summary>查看证据与限制</summary><div className="manufacturer-evidence-detail"><span>来源：{capability.sources.map((source) => source.name).join("；") || "未解析"}</span><span>证据定位：{capability.evidence.map(({ evidence }) => evidence.locator).join("；") || "未提供"}</span><span>限制：{capability.capability.limitations.join("；")}</span></div></details>
                            </article>)}
                          </div>
                        </details> : <div className="manufacturer-empty"><strong>厂商能力记录待补</strong><span>当前只确认该工序需要此类需求，尚未发布可验证的厂商能力记录。</span></div>}
                        {requirementView.evidence.length > 0 && <details className="process-nested-details"><summary>查看该需求的证据（{requirementView.evidence.length}）</summary><ResolvedEvidenceList evidence={requirementView.evidence} compact /></details>}
                      </article>;
                    })}
                  </div>

                  <details className="process-nested-details process-step-evidence-details">
                    <summary>查看本步骤来源与证据（{stepView.sources.length} 个来源，{stepView.evidence.length} 条直接证据）</summary>
                    {stepView.evidence.length > 0 ? <ResolvedEvidenceList evidence={stepView.evidence} compact /> : <UnknownValue label="暂无本步骤直接证据" />}
                  </details>
                  <div className="process-step-audit-meta">
                    <span>contentVersion：{stepView.contentVersion?.version ?? "未提供"}</span>
                    <span>数据集：{stepView.datasetVersion?.version ?? "未提供"}</span>
                  </div>
                </div>
              </details>
            </li>;
          })}
        </ol>
      </section>

      <details className="detail-collapsible compact-detail">
        <summary className="detail-summary"><strong>数据限制与审计信息</strong><span>{view.warnings.length} 条说明</span></summary>
        <WarningList warnings={view.warnings} />
      </details>
    </div>
  </SiteShell>;
}
