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
              <small>进出口贸易指南针</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="主导航">
            <Link className="site-nav-primary" href="/trade-guide">开始查询</Link>
            <Link href="/products">商品背景</Link>
            <Link href="/countries">国家与地区</Link>
            <Link href="/help">数据依据</Link>
            <details className="site-nav-more">
              <summary>更多</summary>
              <div className="site-nav-more-menu">
                <Link href="/demo">3 分钟演示</Link>
                <Link href="/map">世界地图</Link>
                <Link href="/versions">数据版本</Link>
              </div>
            </details>
          </nav>
          <form className="global-search" action="/search" role="search">
            <label className="sr-only" htmlFor="global-search-input">搜索商品或国家</label>
            <input id="global-search-input" name="q" placeholder="搜索商品 / 国家" />
            <button type="submit">搜索</button>
          </form>
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
        <span>GlobeChain · 全球商品与进出口信息查询</span>
        <span>指南是研究起点；具体规则请以官方系统和专业意见为准</span>
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
    <section className={`context-banner${mismatches.length ? " context-banner-warning" : ""}`} aria-label="研究上下文">
      <span><strong>研究上下文</strong> · 期间 {period} · 数据集 {datasetVersion} · 内容 {contentVersion ?? "未提供"}</span>
      {mismatches.length ? <ul>{mismatches.map((message) => <li key={message}>{message}</li>)}</ul> : null}
    </section>
  );
}
