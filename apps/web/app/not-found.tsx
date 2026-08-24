import Link from "next/link";
import { SiteShell } from "../components/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <div className="content-column narrow-column">
        <section className="empty-state large-empty" aria-labelledby="not-found-title">
          <p className="eyebrow">404 / Not found</p>
          <h1 id="not-found-title">没有找到这条数据</h1>
          <p>商品、节点或国家可能尚未发布，也可能不属于当前数据集。GlobeChain 不会用默认值补齐缺失事实。</p>
          <Link className="button button-primary" href="/products">返回商品目录</Link>
        </section>
      </div>
    </SiteShell>
  );
}
