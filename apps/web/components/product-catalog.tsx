import Link from "next/link";
import type { ProductCatalogView } from "@globe-chain/domain";
import { PageIntro, SiteShell } from "./site-shell";
import { PublicationBadge, StatCard, WarningList } from "./data-display";
import { productPath } from "../lib/paths";
import { tradeGuidePath } from "../lib/paths";

export function ProductCatalogPage({ products }: { products: readonly ProductCatalogView[] }) {
  const warnings = [...new Set(products.flatMap((product) => product.warnings))];
  return (
    <SiteShell>
      <div className="content-column">
        <PageIntro
          eyebrow="商品背景 / Product catalog"
          title="先确定商品，再进入进出口查询"
          description="商品页提供组成、供应链和贸易数据背景；如果你要做实际进出口调研，请先进入贸易指南，按国家和方向查看手续与官方入口。"
          actions={
            products[0] ? (
              <Link className="button button-primary" href={tradeGuidePath({ product: products[0].productId })}>
                查进出口要求
              </Link>
            ) : undefined
          }
        />

        <section className="hero-panel">
          <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">Research background</p>
            <h2>商品背景与贸易指南分开</h2>
            <p>商品路线帮助你理解产业结构；贸易指南帮助你整理进出口核验项。两者都保留来源和限制，不把示意路线当成交易撮合。</p>
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
