import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { PageIntro, SiteShell } from "../../components/site-shell";
import { productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const queries = await getQueryService();
  const categories = queries.listCategories();
  const products = queries.listProducts();
  return <SiteShell><div className="content-column wide-column">
    <PageIntro eyebrow="按商品门类浏览" title="当前分类" description={`从${products.length}个已收录商品出发，按门类查找成品、部件与材料，继续探索它们的供应链。`} actions={<Link className="button button-secondary" href="/countries">进入国家账本</Link>} />
    <section className="category-grid">{categories.map((category) => <article className="category-card" key={category.category}><span className="card-kicker">商品门类</span><h2>{category.category}</h2><p>{category.itemCount} 项商品、部件与材料</p><div className="category-products">{category.productIds.map((productId) => { const product = products.find(({ productId: id }) => id === productId); return <Link className="filter-chip" href={productPath(productId)} key={productId}>{itemLabel(product?.item) ?? productId}</Link>; })}</div></article>)}</section>
    <section className="hierarchy-next-step"><strong>分类与统计</strong><span>商品门类帮助浏览；海关商品分类及其适用范围可在商品详情和来源资料中查看。</span><Link className="button button-primary" href="/products">查看商品目录 →</Link></section>
  </div></SiteShell>;
}
