import Link from "next/link";
import type { ProductCatalogView } from "@globe-chain/domain";
import { PageIntro, SiteShell } from "./site-shell";
import { PublicationBadge, WarningList } from "./data-display";
import { productPath } from "../lib/paths";


export function ProductCatalogPage({ products }: { products: readonly ProductCatalogView[] }) {
  const warnings = [...new Set(products.flatMap((product) => product.warnings))];
  return (
    <SiteShell>
      <div className="content-column">
        <PageIntro
          eyebrow="从身边开始"
          title="从商品拆解开始"
          description="看看它由什么组成、在哪里生产，又如何进入贸易。"
        />

        <section className="section-block" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Explore products</p>
              <h2 id="catalog-heading">商品目录</h2>
            </div>
            <span className="section-caption">{products.length} 个商品</span>
          </div>
          {products.length === 0 ? (
            <div className="empty-state large-empty">
              <strong>当前没有已发布商品</strong>
              <p>新商品正在整理中，请稍后查看。</p>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((product) => (
                <Link className="product-card" href={productPath(product.productId)} key={product.productId}>
                  <div className="product-card-top">
                    <span className="product-glyph" aria-hidden="true">{product.item.name.slice(0, 1)}</span>
                    <PublicationBadge status={product.datasetVersion.status} />
                  </div>
                  <p className="card-kicker">{product.item.category}</p>
                  <h3>{product.item.name}</h3>
                  {product.item.description && <p>{product.item.description.split("。")[0]}。</p>}
                  <span className="card-footer">{product.directChildCount} 个部件 <span>→</span></span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <WarningList warnings={warnings} />
      </div>
    </SiteShell>
  );
}
