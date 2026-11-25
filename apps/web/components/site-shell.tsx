import Link from "next/link";
import type { ReactNode } from "react";
import { isPreviewData } from "../lib/runtime";
import { SiteHeader } from "./site-header";
import { UsageInsights } from "./usage-insights";

export function SiteShell({ children }: { children: ReactNode }) {
  const preview = isPreviewData();

  return (
    <div className="app-frame">
      <SiteHeader preview={preview} />
      {preview ? (
        <div className="preview-banner" role="status">
          开发预览 · 合成样例
        </div>
      ) : null}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <span>Global Chain · 全球商品供应链与贸易数据可视化</span>
        <Link href="/help">使用帮助与数据说明 ↗</Link>
        <UsageInsights enabled={Boolean(process.env.GLOBECHAIN_USAGE_DIR)} />
      </footer>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  meta
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div className="page-intro-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="intro-copy">{description}</p> : null}
        {meta ? <div className="intro-meta">{meta}</div> : null}
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
