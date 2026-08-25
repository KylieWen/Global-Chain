import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { productPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const queries = await getQueryService();
  const categories = queries.listCategories();
  const products = queries.listProducts();
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: "商品门类" }]} />
    <PageIntro eyebrow="Commodity categories" title="商品门类" description="这是 GlobeChain 的第一层商品分类入口。当前页面只列出已进入 published 数据集的类别；空白类别不会被伪造为已有数据。" actions={<Link className="button button-secondary" href="/countries">进入国家目录</Link>} />
    <section className="category-grid">{categories.map((category) => <article className="category-card" key={category.category}><span className="card-kicker">GlobeChain category</span><h2>{category.category}</h2><p>{category.itemCount} 个商品/部件记录 · {category.publishedItemCount} 个已发布观察对象</p><div className="category-products">{category.productIds.map((productId) => { const product = products.find(({ productId: id }) => id === productId); return <Link className="filter-chip" href={productPath(productId)} key={productId}>{product?.item.name ?? productId}</Link>; })}</div></article>)}</section>
    <section className="hierarchy-next-step"><strong>分类体系说明</strong><span>门类、商品、部件和材料是 GlobeChain 的浏览层；HS/SITC 等统计编码在商品详情和来源层展示，不把宽泛编码直接解释为手机用途。</span><Link className="button button-primary" href="/products">查看商品目录 →</Link></section>
  </div></SiteShell>;
}
