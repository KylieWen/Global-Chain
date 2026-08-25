import Link from "next/link";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Breadcrumbs, PageIntro, SiteShell } from "../../components/site-shell";
import { getQueryService } from "../../lib/data";
import { ledgerPath } from "../../lib/paths";

type Position = { longitude: number; latitude: number };

export const dynamic = "force-dynamic";

function project(position: Position) {
  return { x: ((position.longitude + 180) / 360) * 900 + 20, y: ((90 - position.latitude) / 180) * 400 + 20 };
}

export default async function MapPage() {
  const queries = await getQueryService();
  const countries = queries.listCountries();
  const network = queries.getTradeNetwork("generic-smartphone");
  const positions = JSON.parse(await readFile(resolve(process.cwd(), "content/geo/country-positions.json"), "utf8")) as { positions: Record<string, Position>; limitations: string[] };
  return <SiteShell><div className="content-column wide-column">
    <Breadcrumbs items={[{ label: "商品目录", href: "/products" }, { label: "世界地图" }]} />
    <PageIntro eyebrow="Global view" title="世界节点图" description="国家级示意地图：把当前 published 数据中的国家放回世界空间，作为供应链和国家账本的导航入口。" actions={<Link className="button button-secondary" href="/countries">国家目录</Link>} />
    <div className="map-shell"><svg className="world-map" viewBox="0 0 940 440" role="img" aria-label="当前数据覆盖国家与具体伙伴贸易观察的世界节点图"><rect x="20" y="20" width="900" height="400" rx="18" /><path className="map-graticule" d="M20 120H920M20 220H920M20 320H920M245 20V420M470 20V420M695 20V420" />{network?.observations.map(({ observation, reporter, partner }) => { const from = reporter ? positions.positions[reporter.id] : null; const to = partner ? positions.positions[partner.id] : null; if (!from || !to) return null; const a = project(from); const b = project(to); return <line key={observation.id} className={`map-trade-edge map-trade-${observation.direction}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}{countries.map(({ entity, relatedNodeCount, hasTradeLedger }) => { const position = positions.positions[entity.id]; if (!position) return null; const point = project(position); return <g key={entity.id} className="map-country-node"><circle cx={point.x} cy={point.y} r={relatedNodeCount > 0 ? 9 : 6} /><text x={point.x + 12} y={point.y + 4}>{entity.name}</text><title>{entity.name} · 供应链节点 {relatedNodeCount} · {hasTradeLedger ? "有账本观察" : "暂无账本观察"}</title></g>; })}</svg><p className="map-note">当前地图是国家级示意图，不是边界地图。节点大小表示当前数据中是否有供应链节点；连线只来自具体伙伴观察，不包含 partnerCode=0 世界总计。</p></div>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Mapped countries</p><h2>当前数据覆盖</h2></div><span className="section-caption">{countries.length} 个国家/地区</span></div><div className="map-country-list">{countries.map(({ entity, relatedNodeCount, hasTradeLedger }) => <Link className="map-country-row" href={ledgerPath("generic-smartphone", entity.id)} key={entity.id}><strong>{entity.name}</strong><span>{relatedNodeCount} 个供应链节点 · {hasTradeLedger ? "有贸易账本观察" : "账本观察未知"}</span><span>查看 →</span></Link>)}</div></section>
    <section className="hierarchy-card"><strong>地图限制</strong><span>{positions.limitations.join(" ")}</span></section>
  </div></SiteShell>;
}
