"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { geoCentroid, geoEqualEarth, geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { ledgerPath, mapPath } from "../lib/paths";
import type { PageContext } from "../lib/context";

type MapCountry = { id: string; name: string; m49: string | null; roles: readonly string[]; relatedNodeCount: number; hasTradeLedger: boolean };
type MapTradeLine = { id: string; reporterM49: string; partnerM49: string; direction: "import" | "export"; value: number | null; currency: string | null; valueDataStatus: string; periodLabel: string };
type Transform = { x: number; y: number; scale: number };
const mapWidth = 1000;
const mapHeight = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[25, 25], [975, 515]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const coordinate = (n: number) => Number(n.toFixed(3));
const compact = (value: number) => new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function WorldCountryMap({ countries, tradeLines, productId, selectedCountryId, direction, context }: { countries: readonly MapCountry[]; tradeLines: readonly MapTradeLine[]; productId: string; selectedCountryId?: string; direction?: "import" | "export"; context: PageContext }) {
  const router = useRouter();
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const byM49 = useMemo(() => new Map(countries.filter(c => c.m49).map(c => [c.m49!, c])), [countries]);
  const centers = useMemo(() => new Map(features.map(f => [String(f.id).padStart(3, "0"), projection(geoCentroid(f))])), []);
  const selectedCountry = countries.find(c => c.id === selectedCountryId);
  const activeCountry = countries.find(c => c.id === (hoveredId ?? selectedCountryId));
  const lines = tradeLines.filter(l => !selectedCountry || l.reporterM49 === selectedCountry.m49 || l.partnerM49 === selectedCountry.m49);
  const endpoints = new Set(lines.flatMap(l => [l.reporterM49, l.partnerM49]));
  const zoom = (factor: number) => setTransform(t => { const scale = Math.min(4, Math.max(1, t.scale * factor)); return { x: mapWidth / 2 - (mapWidth / 2 - t.x) * scale / t.scale, y: mapHeight / 2 - (mapHeight / 2 - t.y) * scale / t.scale, scale }; });
  const select = (id?: string) => router.push(mapPath({ ...context, product: productId, country: id, direction }), { scroll: false });
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => { suppressClick.current = false; if (transform.scale === 1) return; drag.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y, moved: false }; };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current; if (!start) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    const screen = event.currentTarget.getScreenCTM();
    const ratio = screen ? 1 / screen.a : 1;
    if (start.moved) setTransform(t => ({ ...t, x: start.originX + dx * ratio, y: start.originY + dy * ratio }));
  };
  const stopDrag = () => { suppressClick.current = drag.current?.moved ?? false; drag.current = null; };
  return <section className="country-map-workspace atlas-workspace" aria-label="可交互世界国家地图">
    <div className="map-toolbar">
      <div><strong>{selectedCountry?.name ?? "全球视野"}</strong><span>选择国家，探索贸易联系</span></div>
      <div className="atlas-controls"><select aria-label="选择国家" value={selectedCountryId ?? ""} onChange={e => select(e.target.value || undefined)}><option value="">全部国家</option>{countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="map-zoom-controls" aria-label="地图缩放"><button type="button" onClick={() => zoom(1.25)} aria-label="放大地图">＋</button><button type="button" onClick={() => zoom(0.8)} aria-label="缩小地图">－</button><button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>重置</button></div></div>
    </div>
    <div className="atlas-layout"><div className="atlas-canvas">
      <div className="map-viewport"><svg className="world-country-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="img" aria-labelledby="world-country-map-title" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <title id="world-country-map-title">世界贸易地图</title>
        <rect className="map-ocean" width={mapWidth} height={mapHeight} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          <path className="atlas-graticule" d={pathGenerator(geoGraticule10()) ?? undefined} />
          {features.map((f, i) => { const code = String(f.id).padStart(3, "0"); const c = byM49.get(code); return <path key={f.id ?? i} d={pathGenerator(f as GeoPermissibleObjects) ?? undefined} className={`map-country-shape${c ? " has-data" : ""}${c && c.id === selectedCountryId ? " selected" : ""}${c && c.id === hoveredId ? " hovered" : ""}`} role={c ? "button" : undefined} aria-label={c?.name} tabIndex={c ? 0 : undefined} onMouseEnter={() => c && setHoveredId(c.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => c && setHoveredId(c.id)} onBlur={() => setHoveredId(null)} onClick={() => c && !suppressClick.current && select(c.id)} onKeyDown={e => { if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(c.id); } }} />; })}
          <g className="map-trade-layer" aria-label="双边贸易观察">{lines.map((l, index) => {
            // An import moves from partner to reporter; each reporter observation stays separate.
            const a = centers.get(l.direction === "export" ? l.reporterM49 : l.partnerM49); const b = centers.get(l.direction === "export" ? l.partnerM49 : l.reporterM49); if (!a || !b) return null;
            const dx = b[0] - a[0]; const dy = b[1] - a[1]; const length = Math.hypot(dx, dy) || 1;
            const bend = 35 + index % 4 * 17;
            const cx = (a[0] + b[0]) / 2 - dy / length * bend; const cy = (a[1] + b[1]) / 2 + dx / length * bend;
            const d = `M${coordinate(a[0])},${coordinate(a[1])} Q${coordinate(cx)},${coordinate(cy)} ${coordinate(b[0])},${coordinate(b[1])}`;
            return <g key={l.id} className={`country-trade-line country-trade-${l.direction}${activeLine === l.id ? " is-active" : ""}${activeLine && activeLine !== l.id ? " is-muted" : ""}`}><path d={d} vectorEffect="non-scaling-stroke"><title>{`${byM49.get(l.reporterM49)?.name}报告 · ${l.direction === "export" ? "出口" : "进口"} · ${l.periodLabel} · ${l.value === null ? "未提供" : `${l.currency} ${l.value.toLocaleString()}`}`}</title></path></g>;
          })}</g>
          {[...endpoints].map(code => { const point = centers.get(code); const c = byM49.get(code); if (!point || !c) return null; return <g className="atlas-endpoint" key={code} transform={`translate(${coordinate(point[0])},${coordinate(point[1])})`}><circle r={5 / transform.scale} /><text x={9 / transform.scale} y={-9 / transform.scale} style={{ fontSize: 12 / transform.scale }}>{c.name}</text></g>; })}
        </g>
      </svg><div className="atlas-map-caption"><span>WORLD TRADE ATLAS</span><span>使用 ＋ / − 缩放 · 放大后拖动</span></div></div>
      <div className="map-legend"><span><i className="legend-trade-export" />出口报告</span><span><i className="legend-trade-import" />进口报告</span><span>各条记录保留实际年度</span></div>
      <aside className="map-selection-summary" aria-live="polite">{activeCountry ? <><div><h2>{activeCountry.name}</h2><p>{activeCountry.roles.slice(0, 2).join(" · ")}</p></div><div className="map-selection-actions"><Link className="button button-primary" href={ledgerPath(productId, activeCountry.id, context)}>打开国家账本 →</Link></div></> : <><div><h2>从一个国家开始</h2><p>点击地图中的高亮国家，查看它的进出口账本。</p></div><Link className="text-link" href="/countries">浏览国家 →</Link></>}</aside>
    </div><aside className="atlas-records" aria-label="贸易记录"><div className="atlas-records-heading"><span className="eyebrow">TRADE CONNECTIONS</span><h2>贸易联系 <small>{lines.length}</small></h2></div><div className="atlas-record-list">{lines.map(l => { const reporter = byM49.get(l.reporterM49); const partner = byM49.get(l.partnerM49); const from = l.direction === "export" ? reporter : partner; const to = l.direction === "export" ? partner : reporter; return <Link href={ledgerPath(productId, reporter!.id, context)} key={l.id} className={`atlas-record atlas-record-${l.direction}`} onMouseEnter={() => setActiveLine(l.id)} onMouseLeave={() => setActiveLine(null)} onFocus={() => setActiveLine(l.id)} onBlur={() => setActiveLine(null)}><span className="atlas-record-route">{from?.name} <i>→</i> {to?.name}</span><strong>{l.value === null ? "未提供" : `${l.valueDataStatus === "estimated" ? "约 " : ""}${compact(l.value)} ${l.currency ?? ""}`}</strong><small>{reporter?.name} · {l.direction === "export" ? "出口" : "进口"}报告 · {l.periodLabel}</small></Link>; })}{lines.length === 0 && <div className="atlas-empty"><strong>暂无双边记录</strong><p>仍可查看这个国家的贸易账本，或选择其他国家。</p><button type="button" onClick={() => select()}>显示全部国家</button></div>}</div></aside></div>
  </section>;
}
