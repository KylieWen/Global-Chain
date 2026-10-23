import Link from "next/link";
import type { ReactNode } from "react";
import { isPreviewData } from "../lib/runtime";
import { SiteNavigation } from "./site-navigation";

export function SiteShell({ children }: { children: ReactNode }) {
  const preview = isPreviewData();

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Global Chain 首页">
            <span className="brand-mark" aria-hidden="true">G</span>
            <span>
              <strong>Global Chain</strong>
              <small>全球商品供应链与贸易可视化</small>
            </span>
          </Link>
          <SiteNavigation />
          <form className="global-search" action="/search" role="search">
            <label className="sr-only" htmlFor="global-search-input">搜索商品、国家或企业</label>
            <input id="global-search-input" name="q" placeholder="搜索商品 / 国家 / 企业" />
            <button type="submit">搜索</button>
          </form>
          {preview ? <span className="mode-pill mode-preview">开发预览</span> : null}
        </div>
      </header>
      {preview ? (
        <div className="preview-banner" role="status">
          开发预览 · 合成样例
        </div>
      ) : null}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <span>Global Chain · 全球商品供应链与贸易数据可视化</span>
        <Link href="/help">使用帮助与数据说明 ↗</Link>
      </footer>
    </div>
  );
}

export function Breadcrumbs({
  items
}: {
  items: ReadonlyArray<{ label: string; href?: string }>;
}) {
  const breadcrumbItems = items[0]?.label === "首页" ? items : [{ label: "首页", href: "/" }, ...items];
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      {breadcrumbItems.map((item, index) => (
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
    <details className={`context-banner${mismatches.length ? " context-banner-warning" : ""}`} open={mismatches.length > 0} aria-label="研究上下文">
      <summary>{period} · 资料详情{mismatches.length ? " · 请检查所选版本" : ""}</summary>
      <span>数据版本 {datasetVersion}{contentVersion ? ` · 路线版本 ${contentVersion}` : ""}</span>
      {mismatches.length ? <ul>{mismatches.map((message) => <li key={message}>{message}</li>)}</ul> : null}
    </details>
  );
}
