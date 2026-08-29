import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { readPageContext, type SearchParamsLike } from "../../../../../lib/context";
import { productPath, provenancePath, supplyChainPath } from "../../../../../lib/paths";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../../../../components/site-shell";
import { PeriodLabel, StatCard, WarningList } from "../../../../../components/data-display";

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
        <strong>这里回答的是“某道工序通常需要什么设备、哪些厂商公开提供这类设备”。</strong>
        <span>它不证明这些厂商向某家封装厂、某款芯片或某部手机实际供货。</span>
      </section>

      <div className="stat-grid">
        <StatCard label="关键工序" value={view.steps.length} detail="首批代表性拆解" />
        <StatCard label="设备类别" value={equipmentCount} detail="按工序关联" />
        <StatCard label="厂商能力记录" value={capabilityCount} detail={`${view.organizations.length} 家企业`} />
        <StatCard label="厂商证据覆盖" value={`${equipmentWithManufacturerCount}/${equipmentCount}`} detail="其余设备类别明确保留为待补" />
        <StatCard label="已证实客户供货关系" value={commercialRelationshipCount} detail="没有证据时保持 0 条关系记录" />
        <StatCard label="适用期间" value={<PeriodLabel period={view.chain.period} />} detail={view.datasetVersion.version} />
      </div>

      <section className="section-block" aria-labelledby="process-variants-title">
        <div className="section-heading"><div><p className="eyebrow">Route variants</p><h2 id="process-variants-title">先选择工艺路线，再阅读具体工序</h2></div><span className="section-caption">不同路线共享部分工序，也包含互相替代的步骤</span></div>
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
        <div className="section-heading"><div><p className="eyebrow">Process sequence</p><h2 id="process-flow-title">从晶圆后段到封装测试</h2></div><span className="section-caption">不同封装类型可能跳过、替换或重排部分工序</span></div>
        <ol className="manufacturing-step-list">
          {view.steps.map((step) => <li className="manufacturing-step" key={step.step.id}>
            <div className="manufacturing-step-index">{String(step.step.order + 1).padStart(2, "0")}</div>
            <div className="manufacturing-step-main">
              <div className="manufacturing-step-heading"><div><span className="card-kicker">{step.step.phase}</span><h3>{step.step.name}</h3><p>{step.step.description}</p><div className="process-route-tags">{step.routeVariants.map((variant) => <span key={variant.id}>{variant.name}</span>)}</div></div><span className="coverage-status coverage-status-route_published">工艺背景已整理</span></div>
              {step.requirements.map((requirement) => <section className="equipment-requirement" key={requirement.requirement.id}>
                <div className="equipment-requirement-heading"><div><span className="card-kicker">{requirement.requirement.requirementType === "equipment" ? "主要设备类别" : "材料 / 耗材需求"}</span><h4>{requirement.equipmentCategory?.name ?? requirement.requirement.name}</h4></div><span className="method-chip">{requirement.requirement.necessity === "core" ? "核心" : "辅助"}</span></div>
                <p>{requirement.equipmentCategory?.description ?? requirement.requirement.description}</p>
                {requirement.item && <small className="requirement-item-link">关联商品维度：{requirement.item.name}</small>}
                <div className="manufacturer-capability-list">
                  {requirement.capabilities.length > 0 ? requirement.capabilities.map((capability) => <article className="manufacturer-capability" key={capability.capability.id}>
                    <div className="manufacturer-capability-heading"><div><strong>{capability.organization?.name ?? "未知厂商"}</strong><span>{capability.headquarters?.name ?? "总部地区未纳入当前国家维度"}</span></div><span className="coverage-status coverage-status-partial_route">{capability.relationshipLabel}</span></div>
                    <p>{capability.capability.claim}</p>
                    <small>{capability.relationshipDescription}</small>
                    <details><summary>查看证据与限制</summary><div className="manufacturer-evidence-detail"><span>来源：{capability.sources.map((source) => source.name).join("；")}</span><span>证据定位：{capability.evidence.map(({ evidence }) => evidence.locator).join("；")}</span><span>限制：{capability.capability.limitations.join("；")}</span></div></details>
                  </article>) : <div className="manufacturer-empty"><strong>厂商证据待补</strong><span>当前只确认该工序需要此类设备，尚未发布可验证的厂商能力记录。</span></div>}
                </div>
              </section>)}
            </div>
          </li>)}
        </ol>
      </section>

      <details className="detail-collapsible compact-detail">
        <summary className="detail-summary"><strong>数据限制与审计信息</strong><span>{view.warnings.length} 条说明</span></summary>
        <WarningList warnings={view.warnings} />
      </details>
    </div>
  </SiteShell>;
}
