export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="status-card" aria-labelledby="project-title">
        <p className="eyebrow">工程状态</p>
        <h1 id="project-title">GlobeChain</h1>
        <p>第 1 阶段最小工程骨架已初始化。</p>
        <p className="muted">当前仅提供基础 Web、共享包和数据管线边界。</p>
      </section>
    </main>
  );
}
