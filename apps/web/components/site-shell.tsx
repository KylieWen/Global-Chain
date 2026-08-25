import Link from "next/link";
import type { ReactNode } from "react";
import { isPreviewData } from "../lib/runtime";

export function SiteShell({ children }: { children: ReactNode }) {
  const preview = isPreviewData();

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="GlobeChain 首页">
            <span className="brand-mark" aria-hidden="true">G</span>
            <span>
              <strong>GlobeChain</strong>
              <small>全球商品链路观察</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="主导航">
            <Link href="/products">商品目录</Link>
            <Link href="/categories">商品门类</Link>
            <Link href="/countries">国家目录</Link>
            <Link href="/versions">数据版本</Link>
          </nav>
          <span className={`mode-pill ${preview ? "mode-preview" : "mode-published"}`}>
            {preview ? "预览数据" : "已发布数据"}
          </span>
        </div>
      </header>
      {preview ? (
        <div className="preview-banner" role="status">
          当前展示的是人工编写的 draft 演示数据，不代表官方统计或唯一真实供应链。
        </div>
      ) : null}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <span>GlobeChain · 被动式全球供应链与贸易数据可视化</span>
        <span>未知值保持未知，代表性路线不等于唯一事实</span>
      </footer>
    </div>
  );
}

export function Breadcrumbs({
  items
}: {
  items: ReadonlyArray<{ label: string; href?: string }>;
}) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      {items.map((item, index) => (
        <span className="breadcrumb-item" key={`${item.label}-${index}`}>
          {index > 0 ? <span className="breadcrumb-separator">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="intro-copy">{description}</p> : null}
      </div>
      {actions ? <div className="intro-actions">{actions}</div> : null}
    </div>
  );
}

export function ContextBanner({
  period,
  datasetVersion,
  contentVersion,
  mismatches = []
}: {
  period: string;
  datasetVersion: string;
  contentVersion?: string | null;
  mismatches?: readonly string[];
}) {
  return (
    <section className={`context-banner${mismatches.length ? " context-banner-warning" : ""}`} aria-label="研究上下文">
      <span><strong>研究上下文</strong> · 期间 {period} · 数据集 {datasetVersion} · 内容 {contentVersion ?? "未提供"}</span>
      {mismatches.length ? <ul>{mismatches.map((message) => <li key={message}>{message}</li>)}</ul> : null}
    </section>
  );
}
