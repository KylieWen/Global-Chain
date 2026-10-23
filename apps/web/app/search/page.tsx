import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { industryPath, ledgerPath, nodePath, productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = (first((await searchParams).q) ?? "").trim();
  const normalized = query.toLocaleLowerCase("zh-CN");
  const queries = await getQueryService();
  const products = normalized ? queries.listProducts().filter(({ item }) => `${itemLabel(item)} ${item.description ?? ""} ${item.category}`.toLocaleLowerCase("zh-CN").includes(normalized)) : [];
  const countries = normalized ? queries.listCountries().filter(({ entity, roles }) => `${entity.name} ${entity.iso2 ?? ""} ${entity.iso3 ?? ""} ${roles.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalized)) : [];
  const industryResults = normalized ? queries.listProducts().flatMap(({productId,item}) => {
    const view = queries.getIndustryNetwork(productId,{search:normalized});
    return view && (view.matchingTopics.length || view.directory.length) ? [{productId,product:item,view}] : [];
  }) : [];
  const defaultProductId = queries.listProducts()[0]?.productId;
  const nodeResults = normalized ? queries.listProducts().flatMap(({productId,item}) => {
    const story=queries.getSupplyChainStory(productId);
    return (story?.nodes??[]).filter(view=>[view.node.label,view.item?.name,view.processStage?.label,view.node.notes].join(" ").toLocaleLowerCase("zh-CN").includes(normalized)).map(view=>({productId,product:item,view}));
  }) : [];
  return <SiteShell><div className="content-column narrow-column">
    <Breadcrumbs items={[{ label: "搜索" }]} />
    <PageIntro eyebrow="站内搜索" title={query ? `搜索“${query}”` : "搜索商品、国家或产业环节"} description="输入商品、国家、材料、设备或企业名称，进入相关资料与官方入口。" />
    <form className="page-search" action="/search" role="search" aria-label="资料搜索"><label htmlFor="page-search-input">关键词</label><div><input id="page-search-input" name="q" defaultValue={query} placeholder="商品、国家、材料、设备或企业"/><button className="button button-primary" type="submit">搜索</button></div></form>
    {nodeResults.length>0 && <section className="section-block"><div className="section-heading"><h2>供应链环节与材料</h2><span className="section-caption">{nodeResults.length} 个结果</span></div><div className="component-grid">{nodeResults.map(({productId,product,view})=><Link className="component-card" key={`${productId}-${view.node.id}`} href={nodePath(productId,view.node.id)}><p className="card-kicker">{itemLabel(product)} · {view.processStage?.label}</p><h3>{view.node.label}</h3><p>{view.item?.name}{view.entity?` · ${view.entity.name}`:""}</p><span className="card-footer">打开环节与来源 →</span></Link>)}</div></section>}
    {industryResults.length > 0 && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">产业环节与企业</p><h2>上下游与官方入口</h2></div></div>{industryResults.map(({productId,product,view}) => <div key={productId}><h3>{itemLabel(product)} · {view.region.name}</h3><div className="country-role-list">{view.matchingTopics.map(topic => <Link className="role-chip" key={topic.id} href={industryPath(productId,topic.id)}>{topic.label} →</Link>)}</div><div className="component-grid">{view.directory.map(organization => <article className="component-card" key={organization.id}><h3>{organization.name}</h3><p>{organization.description}</p><Link className="card-footer" href={industryPath(productId,organization.entryTopicId)}>查看上下游与官方入口 →</Link></article>)}</div></div>)}</section>}
    {!query ? <div className="empty-state large-empty"><h2>从一件商品开始</h2><p>也可以选择关键词，直接查看相关资料。</p><div className="country-role-list">{queries.listProducts().map(({productId,item}) => <Link className="filter-chip" key={productId} href={`/search?q=${encodeURIComponent(itemLabel(item))}`}>{itemLabel(item)}</Link>)}</div></div> : <>
      {products.length > 0 && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">商品</p><h2>商品</h2></div><span className="section-caption">{products.length} 个结果</span></div>{products.length ? <div className="product-grid">{products.map(({ productId, item }) => <Link className="product-card" href={productPath(productId)} key={productId}><span className="card-kicker">{item.category}</span><h3>{itemLabel(item)}</h3>{item.description && <p>{item.description}</p>}<span className="card-footer">进入商品探索 →</span></Link>)}</div> : <div className="empty-state">没有匹配的商品。</div>}</section>}
      {countries.length > 0 && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">国家</p><h2>国家</h2></div><span className="section-caption">{countries.length} 个结果</span></div>{countries.length ? <div className="country-grid search-country-grid">{countries.map(({ entity, roles, productIds, ledgerProductIds }) => {
        const ledgerProductId = ledgerProductIds[0];
        const productId = ledgerProductId ?? productIds[0] ?? defaultProductId;
        return <article className="country-card" key={entity.id}><span className="iso-chip">{entity.iso3 ?? entity.name}</span><h3>{entity.name}</h3><div className="country-role-list">{roles.slice(0, 3).map((role) => <span className="role-chip" key={role}>{role}</span>)}</div>{productId ? <Link className="card-footer" href={ledgerProductId ? ledgerPath(productId, entity.id) : productPath(productId)}>{ledgerProductId ? "进入国家账本" : "探索相关商品"} →</Link> : null}</article>;
      })}</div> : <div className="empty-state">没有匹配的国家。</div>}</section>}
      {!products.length && !countries.length && !industryResults.length && !nodeResults.length && <div className="empty-state"><h2>换个关键词试试</h2><p>可以搜索商品名称、国家、材料、设备或企业名称。</p><Link href="/products">从商品目录开始 →</Link></div>}
    </>}
  </div></SiteShell>;
}
