
import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { ProductArtwork } from "../../components/product-artwork";
import { industryPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function IndustryDirectoryPage() {
  const queries = await getQueryService();
  const networks = queries.listProducts().flatMap(({productId,item}) => {
    const view = queries.getIndustryNetwork(productId);
    return view ? [{productId,item,view}] : [];
  });
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{label:"产业上下游"}]} />
    <PageIntro eyebrow="从环节找到企业" title="产业上下游" description="查看材料、部件、制造设备和产品应用，沿上下游找到企业的官方产品、联系与销售入口。" />
    <div className="product-grid">{networks.map(({productId,item,view}) => <Link className="product-card" key={productId} href={industryPath(productId)}>
      <ProductArtwork productId={productId} variant="catalog" decorative />
      <span className="card-kicker">{view.region.name} · {item.category}</span><h2>{itemLabel(item)}</h2>
      <p>{view.topics.length} 个产业环节 · {view.directory.length} 家企业</p>
      <span className="card-footer">探索上下游与官方入口 →</span>
    </Link>)}</div>
    {!networks.length && <p>当前产业资料尚未收录。<Link href="/products">从商品拆解继续探索 →</Link></p>}
  </div></SiteShell>;
}
