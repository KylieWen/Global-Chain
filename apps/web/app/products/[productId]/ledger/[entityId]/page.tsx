import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../../../../components/site-shell";
import {
  PeriodLabel,
  ProvenancePanel,
  StatCard,
  StatusBadge,
  UnknownValue,
  ValueDisplay,
  WarningList
} from "../../../../../components/data-display";
import { ledgerPath, nodePath, productPath, supplyChainPath } from "../../../../../lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CountryLedgerPage({
  params,
  searchParams
}: {
  params: Promise<{ productId: string; entityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { productId, entityId } = await params;
  const query = await searchParams;
  const label = firstParam(query.label);
  const queries = await getQueryService();
  const overview = queries.getProductOverview(productId);
  if (!overview) notFound();
  const ledger = queries.getCountryLedger(productId, entityId, {
    label,
    granularity: overview.period.granularity
  });
  const provenance = queries.getProvenance(productId);
  if (!ledger || !provenance) notFound();
  const firstRelatedNode = ledger.relatedNodes[0];

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[
          { label: "商品目录", href: "/products" },
          { label: overview.product.name, href: productPath(productId) },
          { label: "国家贸易账本" },
          { label: ledger.entity.name }
        ]} />
        <PageIntro
          eyebrow="Country trade ledger"
          title={`${ledger.entity.name} · 国家账本`}
          description="贸易观察和宏观指标与代表性供应链流分开存储。这里展示已发布或明确标记状态的事实，不从路线推导利润或因果结论。"
          actions={<Link className="button button-secondary" href={firstRelatedNode ? nodePath(productId, firstRelatedNode.node.id) : supplyChainPath(productId)}>返回节点路径</Link>}
        />

        <div className="stat-grid">
          <StatCard label="报告国" value={ledger.entity.iso3 ?? ledger.entity.name} detail={ledger.entity.iso2 ?? "未提供 ISO2"} />
          <StatCard label="统计期间" value={<PeriodLabel period={ledger.period} />} detail={ledger.period.start} />
          <StatCard label="贸易观察" value={ledger.tradeObservations.length} detail="当前商品 fixture" />
          <StatCard label="宏观指标" value={ledger.macroIndicators.length} detail="不自动计算余额" />
        </div>

        <WarningList warnings={ledger.warnings} />

        <section className="section-block" aria-labelledby="trade-title">
          <div className="section-heading">
            <div><p className="eyebrow">Trade observations</p><h2 id="trade-title">进出口观察</h2></div>
            <span className="section-caption">金额、数量和单位按事实原样呈现</span>
          </div>
          {ledger.resolvedTradeObservations.length === 0 ? <div className="empty-state">当前期间没有已发布的贸易观察。</div> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>方向</th><th>伙伴</th><th>商品</th><th>分类</th><th>金额</th><th>数量</th><th>状态</th></tr>
                </thead>
                <tbody>
                  {ledger.resolvedTradeObservations.map((view) => {
                    const observation = view.observation;
                    return (
                      <tr key={observation.id}>
                        <td><span className={`direction-pill direction-${observation.direction}`}>{observation.direction === "export" ? "出口" : "进口"}</span></td>
                        <td>{view.partner ? <Link className="text-link" href={ledgerPath(productId, view.partner.id)}>{view.partner.name}</Link> : <UnknownValue label="世界总计/未提供" />}</td>
                        <td>{view.item?.name ?? <UnknownValue />}</td>
                        <td>{observation.classificationSystem} {observation.classificationCode}</td>
                        <td><ValueDisplay value={observation.value} status={observation.dataStatus} currency={observation.currency} /></td>
                        <td><ValueDisplay value={observation.quantity} status={observation.dataStatus} unit={observation.unit} /></td>
                        <td><StatusBadge status={observation.dataStatus} method={observation.method} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section-block" aria-labelledby="macro-title">
          <div className="section-heading">
            <div><p className="eyebrow">Macro indicators</p><h2 id="macro-title">宏观指标</h2></div>
            <span className="section-caption">外汇储备等指标不与商品贸易额混为一谈</span>
          </div>
          {ledger.macroIndicators.length === 0 ? <div className="empty-state">当前期间没有已发布的宏观指标。</div> : (
            <div className="metric-list">
              {ledger.macroIndicators.map((observation) => (
                <article className="metric-row" key={observation.id}>
                  <div><span className="card-kicker">{observation.indicator}</span><h3>{observation.notes ?? "未提供指标说明"}</h3></div>
                  <ValueDisplay value={observation.value} status={observation.dataStatus} currency={observation.currency} unit={observation.unit} />
                  <StatusBadge status={observation.dataStatus} method={observation.method} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="section-block" aria-labelledby="related-title">
          <div className="section-heading">
            <div><p className="eyebrow">Cross-module context</p><h2 id="related-title">关联供应链节点</h2></div>
            <Link className="text-link" href={supplyChainPath(productId)}>查看完整路径 →</Link>
          </div>
          {ledger.relatedNodes.length === 0 ? <div className="empty-state">当前国家没有关联的代表性节点。</div> : (
            <div className="node-grid compact-grid">
              {ledger.relatedNodes.map((node) => (
                <Link className="node-card" href={nodePath(productId, node.node.id)} key={node.node.id}>
                  <span className="node-type">{node.node.nodeType}</span>
                  <h3>{node.node.label}</h3>
                  <p>{node.item?.name ?? "未知货物"} · {node.processStage?.label ?? "未知环节"}</p>
                  <span className="card-footer">打开节点详情 <span>→</span></span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <ProvenancePanel provenance={provenance} />
      </div>
    </SiteShell>
  );
}
