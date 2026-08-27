import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../components/site-shell";
import { PeriodLabel, StatCard } from "../../components/data-display";
import { ledgerPath, productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function CountriesPage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const countries = queries.listCountries();
  const product = products[0];
  const period = product?.item.validPeriod;
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "国家账本" }]} />
    {product && period ? <ContextBanner period={period.label} datasetVersion={product.datasetVersion.version} /> : null}
    <PageIntro eyebrow="Country explorer" title="国家目录" description="从一个国家进入贸易账本，再回到它在商品供应链中的产业角色。当前目录只显示 published 数据集中有记录的国家，不代表全球覆盖完整。" actions={product ? <Link className="button button-secondary" href={productPath(product.productId)}>返回商品目录</Link> : null} />
    <div className="stat-grid"><StatCard label="当前国家" value={countries.length} detail="published 数据集中有记录的国家/地区" /><StatCard label="可用商品" value={products.length} detail="当前发布版本" /><StatCard label="期间" value={period ? <PeriodLabel period={period} /> : "未知"} detail="缺失期间不补默认值" /></div>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Browse by country</p><h2>选择国家</h2></div><span className="section-caption">国家账本与供应链角色分开表达</span></div>
      <div className="country-grid">{countries.map(({ entity, productIds, relatedNodeCount, hasTradeLedger, datasetVersion, roles }) => { const targetProduct = productIds[0] ?? product?.productId; return <article className="country-card" key={entity.id}><div className="country-card-top"><span className="iso-chip">{entity.iso3 ?? entity.id}</span><span className={hasTradeLedger ? "coverage-status coverage-status-route_published" : "coverage-status coverage-status-catalog_only"}>{hasTradeLedger ? "有账本观察" : "账本待补"}</span></div><h3>{entity.name}</h3><div className="country-role-list">{roles.length ? roles.slice(0, 3).map((role) => <span className="role-chip" key={role}>{role}</span>) : <span className="muted">暂无已发布角色</span>}</div><p>{entity.iso2 ?? "未知 ISO2"} · {entity.m49 ?? "未知 M49"}</p><div className="country-card-meta"><span>{relatedNodeCount} 个供应链节点</span><span>{productIds.length} 个商品</span><span>{datasetVersion.version}</span></div>{targetProduct ? <Link className="card-footer" href={ledgerPath(targetProduct, entity.id)}>进入国家账本 <span>→</span></Link> : null}</article>; })}</div>
    </section>
  </div></SiteShell>;
}
