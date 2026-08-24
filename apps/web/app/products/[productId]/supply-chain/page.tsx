import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../components/site-shell";
import {
  PeriodLabel,
  ProvenancePanel,
  StatCard,
  WarningList
} from "../../../../components/data-display";
import { FlowTable } from "../../../../components/flow-table";
import { ledgerPath, nodePath, productPath, provenancePath, supplyChainPath } from "../../../../lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupplyChainPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const focusItemId = firstParam(query.focus);
  const label = firstParam(query.label);
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  const provenance = queries.getProvenance(productId);
  if (!overview || !provenance) notFound();

  let story;
  try {
    story = queries.getSupplyChainStory(productId, {
      focusItemId,
      label,
      granularity: overview.period.granularity
    });
  } catch {
    notFound();
  }
  if (!story) notFound();

  const focusName = focusItemId
    ? overview.directChildren.find((item) => item.id === focusItemId)?.name
      ?? story.nodes.find((node) => node.item?.id === focusItemId)?.item?.name
      ?? focusItemId
    : "全部代表性路径";
  const flowById = new Map(story.flows.map((flow) => [flow.flow.id, flow]));

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId) },
          { label: "供应链路径" }
        ]} />
        <PageIntro
          eyebrow="Representative supply chain"
          title={`${overview.product.name} · ${focusName}`}
          description="这是一条经过简化的代表性内容路径。它展示国家节点、货物和环节，不宣称唯一、完整或实时。"
          actions={<Link className="button button-secondary" href={provenancePath(productId)}>来源与版本</Link>}
        />

        <div className="stat-grid">
          <StatCard label="路径节点" value={story.nodes.length} detail="国家/市场与商品节点" />
          <StatCard label="流转关系" value={story.flows.length} detail="方向关系，不是金额" />
          <StatCard label="期间" value={<PeriodLabel period={story.period} />} detail={story.period.start} />
          <StatCard label="数据集" value={story.datasetVersion.version} detail={story.datasetVersion.status} />
        </div>

        <WarningList warnings={story.warnings} />

        <section className="filter-strip" aria-label="路径筛选">
          <div>
            <span className="filter-label">聚焦商品</span>
            <div className="filter-links">
              <Link className={!focusItemId ? "filter-chip active" : "filter-chip"} href={supplyChainPath(productId)}>全部</Link>
              {overview.directChildren.map((item) => (
                <Link
                  className={focusItemId === item.id ? "filter-chip active" : "filter-chip"}
                  href={supplyChainPath(productId, item.id)}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <span className="filter-note">期间筛选：{story.period.label}</span>
        </section>

        <section className="section-block" aria-labelledby="route-steps-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Route steps</p>
              <h2 id="route-steps-title">按环节阅读</h2>
            </div>
            <span className="section-caption">表格优先，保证每条边都有出处和状态</span>
          </div>
          <div className="step-stack">
            {story.steps.map((step) => {
              const stepFlows = step.flowIds
                .map((flowId) => flowById.get(flowId))
                .filter((flow): flow is NonNullable<typeof flow> => Boolean(flow));
              return (
                <article className="step-card" key={step.id}>
                  <div className="step-marker">{String(step.order + 1).padStart(2, "0")}</div>
                  <div className="step-body">
                    <div className="step-heading">
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                      <span className="content-status">{step.contentStatus}</span>
                    </div>
                    <FlowTable flows={stepFlows} productId={productId} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section-block" aria-labelledby="route-nodes-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Route nodes</p>
              <h2 id="route-nodes-title">路径节点</h2>
            </div>
          </div>
          <div className="node-grid">
            {story.nodes.map((node) => (
              <article className="node-card" key={node.node.id}>
                <div className="node-card-top">
                  <span className="node-type">{node.node.nodeType}</span>
                  {node.entity ? <span className="iso-chip">{node.entity.iso3 ?? node.entity.id}</span> : null}
                </div>
                <h3>{node.node.label}</h3>
                <p>{node.item?.name ?? "未知货物"} · {node.processStage?.label ?? "未知环节"}</p>
                <div className="node-links">
                  <Link className="text-link" href={nodePath(productId, node.node.id)}>节点详情 →</Link>
                  {node.entity ? <Link className="text-link" href={ledgerPath(productId, node.entity.id)}>国家账本 →</Link> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <ProvenancePanel provenance={provenance} />
      </div>
    </SiteShell>
  );
}
