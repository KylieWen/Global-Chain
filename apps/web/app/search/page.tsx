import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { ledgerPath, productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = (first((await searchParams).q) ?? "").trim();
  const normalized = query.toLocaleLowerCase("zh-CN");
  const queries = await getQueryService();
  const products = normalized ? queries.listProducts().filter(({ item }) => `${item.name} ${item.description ?? ""} ${item.category}`.toLocaleLowerCase("zh-CN").includes(normalized)) : [];
  const countries = normalized ? queries.listCountries().filter(({ entity, roles }) => `${entity.name} ${entity.iso2 ?? ""} ${entity.iso3 ?? ""} ${roles.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalized)) : [];
  const defaultProductId = queries.listProducts()[0]?.productId;
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "搜索" }]} />
    <PageIntro eyebrow="Global search" title={query ? `搜索“${query}”` : "搜索商品或国家"} description="输入商品名称、国家名称、ISO 代码或供应链角色，快速进入相关页面。" />
    {!query ? <div className="empty-state large-empty"><h2>请输入关键词</h2><p>例如：智能手机、中国、锂、组装或消费市场。</p></div> : <>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Products</p><h2>商品</h2></div><span className="section-caption">{products.length} 个结果</span></div>{products.length ? <div className="product-grid">{products.map(({ productId, item }) => <Link className="product-card" href={productPath(productId)} key={productId}><span className="card-kicker">{item.category}</span><h3>{item.name}</h3><p>{item.description ?? "暂无说明"}</p><span className="card-footer">进入商品探索 →</span></Link>)}</div> : <div className="empty-state">没有匹配的商品。</div>}</section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Countries</p><h2>国家</h2></div><span className="section-caption">{countries.length} 个结果</span></div>{countries.length ? <div className="country-grid search-country-grid">{countries.map(({ entity, roles, productIds }) => { const productId = productIds[0] ?? defaultProductId; return <article className="country-card" key={entity.id}><span className="iso-chip">{entity.iso3 ?? entity.id}</span><h3>{entity.name}</h3><div className="country-role-list">{roles.slice(0, 3).map((role) => <span className="role-chip" key={role}>{role}</span>)}</div>{productId ? <Link className="card-footer" href={ledgerPath(productId, entity.id)}>进入国家账本 →</Link> : null}</article>; })}</div> : <div className="empty-state">没有匹配的国家。</div>}</section>
    </>}
  </div></SiteShell>;
}
