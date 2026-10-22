import Link from "next/link";
import { SiteShell } from "../components/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="content-column narrow-column">
        <section className="empty-state large-empty" aria-labelledby="not-found-title">
          <p className="eyebrow">页面未找到</p>
          <h1 id="not-found-title">没有找到这条数据</h1>
          <p>这个链接可能已失效，或所选版本尚未收录这条资料。可以返回商品目录，重新选择商品继续探索。</p>
          <Link className="button button-primary" href="/products">返回商品目录</Link>
        </section>
      </div>
    </SiteShell>
  );
}
