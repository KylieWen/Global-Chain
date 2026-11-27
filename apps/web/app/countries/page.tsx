import Link from "next/link";
import { getQueryService } from "../../lib/data";
import { PageIntro, SiteShell } from "../../components/site-shell";
import { ledgerPath, productPath, tradeGuidePath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function CountriesPage() {
  const queries = await getQueryService();
  const products = queries.listProducts();
  const countries = queries.listCountries();
  const product = products[0];
  return <SiteShell><div className="content-column wide-column">
    <PageIntro eyebrow="国家探索" title="从国家，看见世界分工" description="查看各国的商品生产环节、进出口与贸易伙伴。" actions={product ? <Link className="button button-secondary" href={productPath(product.productId)}>从商品开始</Link> : null} />
    <section className="section-block"><div className="section-heading"><h2>选择国家</h2><span className="section-caption">{countries.length} 个国家与地区 · {products.length} 个商品</span></div>
      <div className="country-grid">{countries.map(({ entity, productIds, ledgerProductIds, relatedNodeCount, hasTradeLedger, roles }) => {
        const targetProduct = ledgerProductIds[0] ?? productIds[0] ?? product?.productId;
        const guideProduct = productIds.find((productId) => queries.getTradeGuides(productId, { jurisdictionEntityId: entity.id }).length > 0);
        return <article className="country-card" key={entity.id}>
          <div className="country-card-top"><span className="iso-chip">{entity.iso3 ?? entity.name}</span></div>
          <h3>{entity.name}</h3>
          {roles.length > 0 && <div className="country-role-list">{roles.slice(0, 3).map((role) => <span className="role-chip" key={role}>{role}</span>)}</div>}
          <div className="country-card-meta">{relatedNodeCount > 0 && <span>{relatedNodeCount} 个路线环节</span>}<span>{productIds.length} 个相关商品</span></div>
          {targetProduct ? <div className="country-card-actions">
            <Link className="card-footer" href={hasTradeLedger ? ledgerPath(targetProduct, entity.id) : productPath(targetProduct)}>{hasTradeLedger ? "打开贸易账本" : "探索相关商品"} <span>→</span></Link>
            {guideProduct && <Link className="text-link" href={tradeGuidePath({ product: guideProduct, jurisdiction: entity.id })}>进出口指南</Link>}
          </div> : null}
        </article>;
      })}</div>
    </section>
  </div></SiteShell>;
}
