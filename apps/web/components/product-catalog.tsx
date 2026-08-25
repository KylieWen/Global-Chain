import Link from "next/link";
import type { ProductCatalogView } from "@globe-chain/domain";
import { PageIntro, SiteShell } from "./site-shell";
import { PublicationBadge, StatCard, WarningList } from "./data-display";
import { productPath } from "../lib/paths";

export function ProductCatalogPage({ products }: { products: readonly ProductCatalogView[] }) {
  const warnings = [...new Set(products.flatMap((product) => product.warnings))];
  return (
    <SiteShell>
      <div className="content-column">
        <PageIntro
          eyebrow="商品目录 / Product catalog"
          title="从一件商品开始，沿着世界的链路走下去"
          description="GlobeChain 将商品拆解、代表性供应链内容和国家贸易事实放在同一套可追溯维度中；数据状态与发布模式会在页面中明确标识。"
          actions={
            products[0] ? (
              <Link className="button button-primary" href={productPath(products[0].productId)}>
                打开第一个商品
              </Link>
            ) : undefined
          }
        />

        <section className="hero-panel">
          <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">Passive data atlas</p>
            <h2>看见商品，不替你下结论</h2>
            <p>每条路线都标记期间、来源、方法和不确定性。贸易金额不是利润，代表性路线也不是唯一真实路线。</p>
          </div>
          <div className="hero-facts">
            <StatCard label="当前商品" value={products.length} detail="个 fixture" />
            <StatCard label="数据模式" value="只读" detail="页面不生成事实" />
          </div>
        </section>

        <section className="section-block" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Explore products</p>
              <h2 id="catalog-heading">选择一个商品</h2>
            </div>
            <span className="section-caption">新增商品只需增加数据与配置</span>
          </div>
          {products.length === 0 ? (
            <div className="empty-state large-empty">
              <strong>当前没有已发布商品</strong>
              <p>生产模式默认只读取 published 数据集。开发预览可以显式开启 draft。</p>
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
                  <p>{product.item.description ?? "暂无商品说明"}</p>
                  <span className="card-footer">{product.directChildCount} 个直接子节点 <span>→</span></span>
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
