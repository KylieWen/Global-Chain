"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { geoCentroid, geoEqualEarth, geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { ledgerPath, mapPath, nodePath, supplyChainPath, type MapFilters } from "../lib/paths";
import type { MapCountry, MapLine, MapNode } from "../lib/map-view-model";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { MapRecordDetails, mapValue } from "./map-record-details";

const mapWidth = 1000;
const mapHeight = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[25, 25], [975, 515]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const coordinate = (value: number) => Number(value.toFixed(3));

type Props = {
  countries: readonly MapCountry[];
  lines: readonly MapLine[];
  nodes: readonly MapNode[];
  items: readonly { id: string; name: string; depth: number }[];
  years: readonly string[];
  filters: MapFilters & { product: string };
  datasetVersion: string;
};

export function WorldCountryMap({ countries, lines, nodes, items, years, filters, datasetVersion }: Props) {
  const router = useRouter();
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const recordButtons = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const byM49 = useMemo(() => new Map(countries.filter(country => country.m49).map(country => [country.m49!, country])), [countries]);
  const byId = useMemo(() => new Map(countries.map(country => [country.id, country])), [countries]);
  const centers = useMemo(() => new Map(features.map(item => [String(item.id).padStart(3, "0"), projection(geoCentroid(item))])), []);
  const selectedCountry = byId.get(filters.country ?? "");
  const activeCountry = byId.get(hoveredCountryId ?? filters.country ?? "");
  const selectedLine = lines.find(line => line.id === selectedLineId);
  const activeLineId = (hoveredLineId && lines.some(line => line.id === hoveredLineId) ? hoveredLineId : null) ?? selectedLine?.id ?? null;
  const isTrade = filters.layer === "trade";
  const context = { datasetVersion, contentVersion: filters.contentVersion };
  const endpoints = new Set([...lines.flatMap(line => [line.fromM49, line.toM49]), ...nodes.filter(node => !filters.country || node.countryId === filters.country).flatMap(node => byId.get(node.countryId)?.m49 ?? [])]);
  const activeNodes = nodes.filter(node => node.countryId === activeCountry?.id);
  const hasLayerRecords = (country: MapCountry) => isTrade ? country.hasTradeRecords : country.hasRouteNodes;
  const coverageLabel = (country: MapCountry) => hasLayerRecords(country) ? (isTrade ? "有双边统计" : "有路线节点") : country.hasTradeLedger ? "仅有账本 / 当前图层未收录" : "当前图层未收录";
  const navigate = (patch: Partial<MapFilters>) => router.push(mapPath({ ...filters, ...patch }), { scroll: false });
  const chooseLine = (id: string, fromMap = false) => {
    if (suppressClick.current) return;
    setSelectedLineId(id);
    if (fromMap) recordButtons.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    suppressClick.current = false;
    if (transform.scale === 1 || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    const screen = event.currentTarget.getScreenCTM();
    const ratio = screen ? 1 / screen.a : 1;
    if (start.moved) setTransform(current => clampMapTransform({ ...current, x: start.originX + dx * ratio, y: start.originY + dy * ratio }));
  };
  const stopDrag = () => { suppressClick.current = drag.current?.moved ?? false; drag.current = null; };

  return <section className="country-map-workspace atlas-workspace" aria-label="可交互世界国家地图">
    <div className="atlas-data-filters">
      <label>部件 / 材料<select aria-label="选择部件或材料" value={filters.focus === filters.product ? "" : filters.focus ?? ""} onChange={event => navigate({ focus: event.target.value || undefined, year: undefined, country: undefined })}><option value="">整件商品</option>{items.filter(item => item.id !== filters.product).map(item => <option key={item.id} value={item.id}>{`${"　".repeat(Math.max(0, item.depth - 1))}${item.name}`}</option>)}</select></label>
      <label>记录年度<select aria-label="选择记录年度" value={filters.year ?? ""} onChange={event => navigate({ year: event.target.value || undefined })}><option value="">全部已收录年份</option>{filters.year && !years.includes(filters.year) && <option value={filters.year}>{filters.year} · 未收录</option>}{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <span>{lines.length} 条{isTrade ? "统计观察" : "代表性连接"} · {countries.filter(hasLayerRecords).length} 个国家有{isTrade ? "双边记录" : "节点"}</span>
    </div>
    {!isTrade && filters.focus && <p className="atlas-focus-scope">当前范围：{items.find(item => item.id === filters.focus)?.name}及已发布的上游、下游分支。各分支并非必经步骤，现有资料不代表完整覆盖。</p>}
    <div className="map-toolbar">
      <div><strong>{selectedCountry?.name ?? "全球视野"}</strong><span>{isTrade ? "点击连线或记录，核对单条统计" : "点击国家或连接，逐层查看生产环节"}</span></div>
      <div className="atlas-controls"><select aria-label="选择国家" value={filters.country ?? ""} onChange={event => navigate({ country: event.target.value || undefined })}><option value="">全部国家</option>{countries.map(country => <option key={country.id} value={country.id}>{country.name} · {coverageLabel(country)}</option>)}</select><div className="map-zoom-controls" aria-label="地图缩放"><button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button><button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button><button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>重置</button></div></div>
    </div>
    <div className="atlas-layout"><div className="atlas-canvas">
      <div className="map-viewport"><svg className="world-country-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="group" aria-labelledby="world-country-map-title" aria-describedby="world-country-map-description" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <title id="world-country-map-title">{isTrade ? "官方双边贸易统计地图" : "代表性供应链地图"}</title>
        <desc id="world-country-map-description">高亮国家可选择，连线可通过鼠标或键盘打开记录详情。连线不是实际运输轨迹。</desc>
        <defs><marker id="atlas-selected-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={isTrade ? "#e6cc91" : "#aee9db"} /></marker></defs>
        <rect className="map-ocean" width={mapWidth} height={mapHeight} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          <path className="atlas-graticule" d={pathGenerator(geoGraticule10()) ?? undefined} />
          {features.map((item, index) => {
            const country = byM49.get(String(item.id).padStart(3, "0"));
            return <path key={item.id ?? index} d={pathGenerator(item as GeoPermissibleObjects) ?? undefined} className={`map-country-shape${country ? " has-data" : ""}${country && !hasLayerRecords(country) ? " atlas-country-limited" : ""}${country?.id === filters.country ? " selected" : ""}${country?.id === hoveredCountryId ? " hovered" : ""}`} role={country ? "button" : undefined} aria-label={country ? `${country.name} · ${coverageLabel(country)}` : undefined} aria-pressed={country ? country.id === filters.country : undefined} tabIndex={country ? 0 : undefined} onMouseEnter={() => country && setHoveredCountryId(country.id)} onMouseLeave={() => setHoveredCountryId(null)} onFocus={() => country && setHoveredCountryId(country.id)} onBlur={() => setHoveredCountryId(null)} onClick={() => country && !suppressClick.current && navigate({ country: country.id })} onKeyDown={event => { if (country && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate({ country: country.id }); } }} />;
          })}
          <g className="map-trade-layer" aria-label={isTrade ? "双边贸易观察" : "代表性路线连接"}>{lines.map((line, index) => {
            const from = centers.get(line.fromM49); const to = centers.get(line.toM49);
            if (!from || !to) return null;
            const dx = to[0] - from[0]; const dy = to[1] - from[1]; const length = Math.hypot(dx, dy);
            const bend = 35 + index % 4 * 17;
            const d = length < 1
              ? `M${coordinate(from[0])},${coordinate(from[1])} c${20 + index % 3 * 8},-48 ${-45 - index % 3 * 8},-48 0,0`
              : `M${coordinate(from[0])},${coordinate(from[1])} Q${coordinate((from[0] + to[0]) / 2 - dy / length * bend)},${coordinate((from[1] + to[1]) / 2 + dx / length * bend)} ${coordinate(to[0])},${coordinate(to[1])}`;
            const label = `${byId.get(line.fromCountryId)?.name}到${byId.get(line.toCountryId)?.name}，${line.itemName}，${line.periodLabel}，${line.evidenceLabel}`;
            return <g key={line.id} className={`country-trade-line country-trade-${line.direction ?? "route"}${activeLineId === line.id ? " is-active" : ""}${activeLineId && activeLineId !== line.id ? " is-muted" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selectedLineId === line.id} onMouseEnter={() => setHoveredLineId(line.id)} onMouseLeave={() => setHoveredLineId(null)} onFocus={() => setHoveredLineId(line.id)} onBlur={() => setHoveredLineId(null)} onClick={() => chooseLine(line.id, true)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); suppressClick.current = false; chooseLine(line.id, true); } }}><path className="atlas-line-hit" d={d} vectorEffect="non-scaling-stroke" /><path className="atlas-line-visible" d={d} vectorEffect="non-scaling-stroke" markerEnd={activeLineId === line.id ? "url(#atlas-selected-arrow)" : undefined}><title>{label}</title></path></g>;
          })}</g>
          {[...endpoints].map(code => { const point = centers.get(code); const country = byM49.get(code); if (!point || !country) return null; return <g className="atlas-endpoint" key={code} transform={`translate(${coordinate(point[0])},${coordinate(point[1])})`}><circle r={5 / transform.scale} /><text x={9 / transform.scale} y={-9 / transform.scale} style={{ fontSize: 12 / transform.scale }}>{country.name}</text></g>; })}
        </g>
      </svg><div className="atlas-map-caption"><span>{isTrade ? "OFFICIAL TRADE OBSERVATIONS" : "REPRESENTATIVE SUPPLY CHAIN"}</span><span>使用 ＋ / − 缩放 · 放大后拖动</span></div></div>
      <div className="map-legend">{isTrade ? <><span><i className="legend-trade-export" />出口报告</span><span><i className="legend-trade-import" />进口报告</span></> : <span><i className="legend-route" />代表性连接 · 非实际运输轨迹</span>}<span><i className="legend-country-covered" />当前图层有记录</span><span><i className="legend-country-limited" />仅有账本或角色背景</span></div>
      <aside className="map-selection-summary" aria-live="polite">{activeCountry ? <><div><h2>{activeCountry.name}</h2><p>{coverageLabel(activeCountry)}{activeCountry.roles.length ? ` · ${activeCountry.roles.slice(0, 2).join(" · ")}` : ""}</p></div><div className="map-selection-actions">{activeCountry.hasTradeLedger && <Link className="button button-secondary" href={ledgerPath(filters.product, activeCountry.id, context)}>国家账本 →</Link>}{filters.country && <button type="button" className="atlas-clear-country" onClick={() => navigate({ country: undefined })}>清除国家筛选</button>}</div></> : <><div><h2>从国家、部件或一条连接开始</h2><p>有记录与未收录分别呈现，未收录不表示为零。</p></div><Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>供应链全貌 →</Link></>}</aside>
      {activeNodes.length > 0 && <section className="atlas-country-nodes"><h3>{activeCountry?.name}的生产环节 · {activeNodes.length}</h3><div>{activeNodes.map(node => <Link key={node.id} href={nodePath(filters.product, node.id, { ...context, period: node.periodLabel })}><strong>{node.itemName} · {node.stageLabel}</strong><span>{node.periodLabel} · {node.evidenceLabel}</span></Link>)}</div></section>}
      {selectedLine ? <MapRecordDetails line={selectedLine} countries={countries} productId={filters.product} context={context} /> : <div className="atlas-detail-placeholder">选择地图上的连线或右侧记录，查看期间、来源、方法与数据状态。</div>}
    </div><aside className="atlas-records" aria-label={isTrade ? "贸易记录" : "路线连接记录"}><div className="atlas-records-heading"><span className="eyebrow">{isTrade ? "TRADE OBSERVATIONS" : "SUPPLY CHAIN CONNECTIONS"}</span><h2>{isTrade ? "贸易观察" : "路线连接"} <small>{lines.length}</small></h2><p>{filters.year ?? "各记录实际年度"} · 点击查看详情</p></div><div className="atlas-record-list">{lines.map(line => <button type="button" ref={element => { if (element) recordButtons.current.set(line.id, element); else recordButtons.current.delete(line.id); }} key={line.id} className={`atlas-record atlas-record-${line.direction ?? "route"}${selectedLineId === line.id ? " is-selected" : ""}`} aria-pressed={selectedLineId === line.id} onClick={() => { suppressClick.current = false; chooseLine(line.id); }} onMouseEnter={() => setHoveredLineId(line.id)} onMouseLeave={() => setHoveredLineId(null)} onFocus={() => setHoveredLineId(line.id)} onBlur={() => setHoveredLineId(null)}><span className="atlas-record-route">{byId.get(line.fromCountryId)?.name} <i>→</i> {byId.get(line.toCountryId)?.name}</span><span className="atlas-record-item">{line.itemName}{line.stageLabel ? ` · ${line.stageLabel}` : ""}</span>{isTrade ? <strong>{mapValue(line.value, line.valueDataStatus, line.currency, true)}</strong> : <strong className="atlas-route-evidence">{line.evidenceLabel}</strong>}<small>{line.reporterName ? `${line.reporterName} · ${line.direction === "export" ? "出口" : "进口"}报告 · ` : ""}{line.periodLabel}</small></button>)}{lines.length === 0 && <div className="atlas-empty"><strong>当前筛选暂无{isTrade ? "双边统计" : "路线连接"}</strong><p>{nodes.length && !isTrade ? "当前仍有国家角色节点，可点击国家查看；节点不能自动连接成双边关系。" : "该商品、期间或国家的记录尚未收录，不表示贸易或产量为零。"}</p><button type="button" onClick={() => navigate({ country: undefined, year: undefined })}>清除国家与年份筛选</button><Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>查看供应链与证据缺口 →</Link></div>}</div></aside></div>
    <p className="atlas-version">数据集版本：{datasetVersion} · 记录详情保留各自期间与内容版本</p>
  </section>;
}
