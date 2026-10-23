"use client";

import Link from "next/link";
import { SiteShell } from "../components/site-shell";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SiteShell><div className="content-column narrow-column"><section className="empty-state large-empty" role="alert"><h1>这页暂时没能打开</h1><p>可以重试一次，或回到地图继续探索。</p><div className="visitor-hero-actions"><button className="button button-primary" onClick={reset}>重新加载</button><Link className="button button-secondary" href="/map">返回世界地图</Link></div></section></div></SiteShell>;
}
