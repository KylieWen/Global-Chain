"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { geoCentroid, geoEqualEarth, geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { ledgerPath, mapPath, nodePath, supplyChainPath, type MapFilters } from "../lib/paths";
import { useMapWheel } from "./use-map-wheel";
import type { MapCountry, MapViewModel } from "../lib/map-view-model";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { layoutMapLabels, tradeAmountBands, tradeAmountWidth } from "../lib/map-presentation";
import { MapRecordDetails, mapEvidenceLabel, mapMappingLabel, mapRecordTitle, mapValue } from "./map-record-details";

const mapWidth = 1000;
const mapHeight = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[25, 25], [975, 515]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const coordinate = (value: number) => Number(value.toFixed(3));

type Props = { view: MapViewModel; filters: MapFilters & { product: string }; products: readonly { id: string; name: string }[]; regionalLinks?: readonly {entityId:string;label:string;href:string}[] };

export function WorldCountryMap({ view, filters, products, regionalLinks=[] }: Props) {
  const { countries, records, lines, nodes, items, years, scope, scopeCounts, selectedItemName, relatedMaterials, datasetVersion, hasFocusTradeCoverage } = view;
  const router = useRouter();
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [hoveredRecordId, setHoveredRecordId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [uncoveredCountry, setUncoveredCountry] = useState<string | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(mapWidth);
  const svgRef = useRef<SVGSVGElement>(null);
  useMapWheel(svgRef,setTransform,mapWidth,mapHeight);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => setRenderedWidth(entries[0].contentRect.width || mapWidth));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const byM49 = useMemo(() => new Map(countries.filter(country => country.m49).map(country => [country.m49!, country])), [countries]);
  const byId = useMemo(() => new Map(countries.map(country => [country.id, country])), [countries]);
  const centers = useMemo(() => new Map(features.map(item => [String(item.id).padStart(3, "0"), projection(geoCentroid(item))])), []);
  const selectedCountry = byId.get(filters.country ?? "");
  const activeCountry = byId.get(hoveredCountryId ?? filters.country ?? "");
  const selectedRecord = records.find(record => record.id === selectedRecordId);
  const activeRecord = records.find(record => record.id === hoveredRecordId) ?? selectedRecord;
  const isTrade = filters.layer === "trade";
  const isWorld = isTrade && scope === "world";
  const context = { datasetVersion, contentVersion: filters.contentVersion };
  const endpoints = new Set(isWorld
    ? records.flatMap(record => record.reporterM49 ?? [])
    : [...lines.flatMap(line => [line.fromM49, line.toM49]), ...nodes.filter(node => !filters.country || node.countryId === filters.country).flatMap(node => byId.get(node.countryId)?.m49 ?? [])]);
  const activeNodes = nodes.filter(node => node.countryId === activeCountry?.id);
  const hasLayerRecords = (country: MapCountry) => isTrade ? country.hasTradeRecords : country.hasRouteNodes;
  const coverageLabel = (country: MapCountry) => hasLayerRecords(country) ? (isTrade ? "有统计" : "参与供应链") : country.hasTradeLedger ? "仅有账本" : "尚未收录";
  const navigate = (patch: Partial<MapFilters>) => { setUncoveredCountry(null); router.push(mapPath({ ...filters, ...patch }), { scroll: false }); };
  const chooseCountry = (country: MapCountry | undefined, name: string) => {
    if (suppressClick.current) return;
    if (country) navigate({ country: country.id });
    else setUncoveredCountry(name);
  };
  const chooseRecord = (id: string) => { if (!suppressClick.current) setSelectedRecordId(id); };
  const clearFilters = () => navigate({ country: undefined, year: undefined, direction: undefined });
  const toProductStatistics = () => navigate({ focus: undefined, country: undefined, year: undefined, direction: undefined, scope: undefined });
  const productName = products.find(product => product.id === filters.product)?.name ?? "整件商品";
  const currencies = [...new Set(lines.filter(line => line.kind === "trade").map(line => line.currency))];
  const tradeCurrency = currencies.length === 1 ? currencies[0] : null;
  const labelFontSize = (renderedWidth < 600 ? 12 : 13) * mapWidth / renderedWidth;
  const priorityCodes = new Set([activeCountry?.m49, activeRecord?.fromM49, activeRecord?.toM49].filter(Boolean));
  const labelCodes = [...new Set([...priorityCodes, ...endpoints])].filter((code): code is string => Boolean(code));
  const labels = layoutMapLabels(labelCodes.flatMap(code => {
    const country = byM49.get(code); const point = centers.get(code);
    if (!country || !point || (renderedWidth < 600 && !priorityCodes.has(code))) return [];
    return [{ id: code, name: country.name, x: point[0] * transform.scale + transform.x, y: point[1] * transform.scale + transform.y }];
  }), labelFontSize);
  const selectedIndex = selectedRecord ? records.indexOf(selectedRecord) : -1;
  const selectAdjacentRecord = (offset: number) => { const next = records[selectedIndex + offset]; if (next) setSelectedRecordId(next.id); };
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
    <div className="atlas-compact-filters">
      <label>商品<select aria-label="选择商品" value={filters.product} onChange={event => navigate({ product: event.target.value, focus: undefined, year: undefined, country: undefined, direction: undefined, scope: undefined, datasetVersion: undefined, contentVersion: undefined })}>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <label>{isTrade ? "统计对象" : "部件 / 材料"}<select aria-label="选择部件或材料" value={filters.focus === filters.product ? "" : filters.focus ?? ""} onChange={event => navigate({ focus: event.target.value || undefined, year: undefined, country: undefined, scope: undefined })}><option value="">整件商品</option>{items.filter(item => item.id !== filters.product && (!isTrade || item.relatedTradeCount > 0 || item.id === filters.focus)).map(item => <option key={item.id} value={item.id}>{`${"　".repeat(Math.max(0, item.depth - 1))}${item.name}${isTrade && item.directTradeCount === 0 && item.relatedTradeCount > 0 ? " · 相关材料" : ""}`}</option>)}</select></label>
      <label>年份<select aria-label="选择记录年度" value={filters.year ?? ""} onChange={event => navigate({ year: event.target.value || undefined })}><option value="">全部年份</option>{filters.year && !years.includes(filters.year) && <option value={filters.year}>{filters.year} · 无记录</option>}{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <label>国家<select aria-label="选择国家" value={filters.country ?? ""} onChange={event => navigate({ country: event.target.value || undefined })}><option value="">全部国家</option>{countries.map(country => <option key={country.id} value={country.id}>{country.name}{hasLayerRecords(country) ? "" : ` · ${coverageLabel(country)}`}</option>)}</select></label>
      {isTrade && <label>报告方向<select aria-label="报告方向" value={filters.direction ?? ""} onChange={event => navigate({ direction: event.target.value === "import" || event.target.value === "export" ? event.target.value : undefined })}><option value="">进出口</option><option value="export">出口</option><option value="import">进口</option></select></label>}
      <div className="map-zoom-controls" aria-label="地图缩放"><button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button><button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button><button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>复位</button></div>
    </div>
    <div className="atlas-layout"><div className="atlas-canvas">
      <div className="map-viewport"><svg ref={svgRef} className="world-country-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="group" aria-labelledby="world-country-map-title" aria-describedby="world-country-map-description" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <title id="world-country-map-title">{isTrade ? isWorld ? "国家世界贸易总计地图" : "官方双边贸易统计地图" : "代表性供应链地图"}</title>
        <desc id="world-country-map-description">选择国家查看相关记录。连线与列表均可通过鼠标或键盘打开详情。</desc>
        <defs>{[{id:"atlas-selected-arrow",fill:"#aee9db"},{id:"atlas-export-arrow",fill:"#8be4c4"},{id:"atlas-import-arrow",fill:"#d7b880"}].map(marker => <marker key={marker.id} id={marker.id} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth={9 / transform.scale} markerHeight={9 / transform.scale} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={marker.fill} /></marker>)}</defs>
        <rect className="map-ocean" width={mapWidth} height={mapHeight} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          <path className="atlas-graticule" d={pathGenerator(geoGraticule10()) ?? undefined} />
          {features.map((item, index) => {
            const country = byM49.get(String(item.id).padStart(3, "0"));
            const recordActive = activeRecord?.partnerScope === "world_total" && activeRecord.reporterId === country?.id;
            const name = country?.name ?? (item.properties as {name?:string} | null)?.name ?? "该国家或地区";
            return <path key={item.id ?? index} d={pathGenerator(item as GeoPermissibleObjects) ?? undefined} className={`map-country-shape${country ? " has-data" : ""}${country && !hasLayerRecords(country) ? " atlas-country-limited" : ""}${country && country.id === filters.country ? " selected" : ""}${country?.id === hoveredCountryId ? " hovered" : ""}${recordActive ? " atlas-record-country" : ""}`} role="button" aria-label={`${name} · ${country ? coverageLabel(country) : "当前商品未收录"}`} aria-pressed={Boolean(country && country.id === filters.country)} tabIndex={country ? 0 : -1} onMouseEnter={() => country && setHoveredCountryId(country.id)} onMouseLeave={() => setHoveredCountryId(null)} onFocus={() => country && setHoveredCountryId(country.id)} onBlur={() => setHoveredCountryId(null)} onClick={() => chooseCountry(country, name)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); suppressClick.current = false; chooseCountry(country, name); } }}><title>{`${name} · ${country ? coverageLabel(country) : "当前商品未收录"}`}</title></path>;
          })}
          {!isWorld && <g className="map-trade-layer" aria-label={isTrade ? "双边贸易观察" : "代表性路线连接"}>{lines.map((line, index) => {
            const from = centers.get(line.fromM49); const to = centers.get(line.toM49);
            if (!from || !to) return null;
            const dx = to[0] - from[0]; const dy = to[1] - from[1]; const length = Math.hypot(dx, dy);
            const bend = 35 + index % 4 * 17;
            const d = length < 1
              ? `M${coordinate(from[0])},${coordinate(from[1])} c${20 + index % 3 * 8},-48 ${-45 - index % 3 * 8},-48 0,0`
              : `M${coordinate(from[0])},${coordinate(from[1])} Q${coordinate((from[0] + to[0]) / 2 - dy / length * bend)},${coordinate((from[1] + to[1]) / 2 + dx / length * bend)} ${coordinate(to[0])},${coordinate(to[1])}`;
            const label = `${mapRecordTitle(line, countries)}，${line.itemName}，${line.periodLabel}${isTrade ? `，${mapValue(line.value, line.valueDataStatus, line.currency, true)}` : ""}`;
            const amountWidth = isTrade && tradeCurrency ? tradeAmountWidth(line.value, line.valueDataStatus) : null;
            return <g key={line.id} className={`country-trade-line country-trade-${line.direction ?? "route"}${activeRecord?.id === line.id ? " is-active" : ""}${activeRecord && activeRecord.id !== line.id ? " is-muted" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selectedRecordId === line.id} onMouseEnter={() => setHoveredRecordId(line.id)} onMouseLeave={() => setHoveredRecordId(null)} onFocus={() => setHoveredRecordId(line.id)} onBlur={() => setHoveredRecordId(null)} onClick={() => chooseRecord(line.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); suppressClick.current = false; chooseRecord(line.id); } }}><path className="atlas-line-hit" d={d} vectorEffect="non-scaling-stroke" /><path className="atlas-line-visible" d={d} vectorEffect="non-scaling-stroke" style={isTrade ? {strokeWidth: amountWidth ?? 1.4} : undefined} markerEnd={isTrade ? `url(#atlas-${line.direction}-arrow)` : activeRecord?.id === line.id ? "url(#atlas-selected-arrow)" : undefined}><title>{label}</title></path></g>;
          })}</g>}
          {[...endpoints].map(code => { const point = centers.get(code); const country = byM49.get(code); if (!point || !country) return null; return <g className="atlas-endpoint" key={code} transform={`translate(${coordinate(point[0])},${coordinate(point[1])})`}><circle r={5 / transform.scale} /></g>; })}
        </g>
        <g className="atlas-country-labels" aria-hidden="true">{labels.map(label => <text key={label.id} x={label.x + 3} y={label.y + labelFontSize + 2} style={{fontSize:labelFontSize}}>{label.name}</text>)}</g>
      </svg><div className="atlas-map-caption"><span>{isTrade ? isWorld ? "世界总计 · 圆点表示报告国" : "双边贸易 · 连线表示统计联系" : "代表性路线 · 连接原料、生产与市场"}</span><span>放大后可拖动</span></div></div>
      <div className="atlas-below-map"><div className="map-legend">{isTrade && !isWorld ? <><span><i className="legend-trade-export" />出口报告</span><span><i className="legend-trade-import" />进口报告</span></> : null}<span><i className="legend-country-covered" />{isTrade ? "有统计" : "参与供应链"}</span><span><i className="legend-country-limited" />仅有账本</span></div><Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>展开供应链 →</Link></div>
      {isTrade && !isWorld && lines.length > 0 && <details className="atlas-amount-key"><summary>{tradeCurrency ? `线宽按记录金额分档 · ${tradeCurrency}` : "含不同币种 · 线宽不比较金额"}</summary>{tradeCurrency && <div>{tradeAmountBands.map(band => <span key={band.minimum}><i style={{borderTopWidth:band.width}} />{band.label} {tradeCurrency}</span>)}</div>}<p>箭头表示货物流向；每条记录保留原年度、报告方和商品分类，不合并加总。未收录金额使用细线，具体金额与状态见记录。</p></details>}
      {uncoveredCountry && <p className="atlas-filter-notice" role="status">{uncoveredCountry} · {productName}的资料尚未收录，可切换商品继续探索。<button type="button" onClick={() => setUncoveredCountry(null)}>关闭</button></p>}
      {activeCountry && <div className="atlas-country-context"><strong>{activeCountry.name}</strong>{activeCountry.roles.length > 0 && <span>{activeCountry.roles.slice(0, 2).join(" / ")}</span>}{regionalLinks.filter(link=>link.entityId===activeCountry.id).map(link=><Link key={link.href} className="button button-primary" href={link.href}>{link.label} →</Link>)}{activeCountry.hasTradeLedger && <Link href={ledgerPath(filters.product, activeCountry.id, context)}>国家账本 →</Link>}{filters.country && <button type="button" onClick={() => navigate({ country: undefined })}>清除国家</button>}</div>}
      {activeNodes.length > 0 && <details className="atlas-country-nodes"><summary>{activeCountry?.name}的生产环节 · {activeNodes.length}</summary><div>{activeNodes.map(node => <Link key={node.id} href={nodePath(filters.product, node.id, { ...context, period: node.periodLabel })}><strong>{node.itemName} · {node.stageLabel}</strong><span>{node.periodLabel}</span></Link>)}</div></details>}
    </div><aside className="atlas-records" aria-label={isTrade ? "贸易记录" : "路线连接记录"}>
      <div className="atlas-records-heading"><h2>{isTrade && relatedMaterials.length ? `${selectedItemName}相关材料` : selectedItemName} <small>{records.length}</small></h2>
        {isTrade ? <div className="atlas-scope-switch" aria-label="统计范围"><button type="button" aria-pressed={!isWorld} onClick={() => navigate({ scope: "bilateral" })}>双边 <small>{scopeCounts.bilateral}</small></button><button type="button" aria-pressed={isWorld} onClick={() => navigate({ scope: "world" })}>世界总计 <small>{scopeCounts.world}</small></button></div> : <p>{filters.focus ? "上下游分支" : "原料、部件与市场"} · {filters.year ?? years.join(" / ")}</p>}
      </div>
      {selectedRecord ? <><div className="atlas-detail-navigation"><button type="button" onClick={() => setSelectedRecordId(null)}>← 返回记录</button><span>{selectedIndex + 1} / {records.length}</span><button type="button" aria-label="上一条记录" disabled={selectedIndex <= 0} onClick={() => selectAdjacentRecord(-1)}>←</button><button type="button" aria-label="下一条记录" disabled={selectedIndex >= records.length - 1} onClick={() => selectAdjacentRecord(1)}>→</button></div><MapRecordDetails record={selectedRecord} countries={countries} productId={filters.product} context={context} /></> : <>
        {isTrade && relatedMaterials.length > 0 && <div className="atlas-related-items">{relatedMaterials.map(item => <button type="button" key={item.id} onClick={() => navigate({ focus: item.id, year: undefined, country: undefined, scope: undefined })}>{item.name}</button>)}</div>}
        <div className="atlas-record-list">{records.map(record => <button type="button" key={record.id} className={`atlas-record atlas-record-${record.direction ?? "route"}`} aria-label={`${mapRecordTitle(record, countries)}，${record.itemName}，${record.periodLabel}`} onClick={() => { suppressClick.current = false; chooseRecord(record.id); }} onMouseEnter={() => setHoveredRecordId(record.id)} onMouseLeave={() => setHoveredRecordId(null)} onFocus={() => setHoveredRecordId(record.id)} onBlur={() => setHoveredRecordId(null)}><span className="atlas-record-route">{mapRecordTitle(record, countries)}</span><span className="atlas-record-item">{record.itemName}{record.stageLabel ? ` · ${record.stageLabel}` : ""}{record.classificationCode ? ` · HS ${record.classificationCode}` : ""}{mapMappingLabel(record.classificationMappingType) ? ` · ${mapMappingLabel(record.classificationMappingType)}` : ""}</span>{isTrade ? <strong>{mapValue(record.value, record.valueDataStatus, record.currency, true)}</strong> : null}<small>{record.periodLabel}{isTrade && record.partnerScope === "entity" ? ` · ${record.reporterName}${record.direction === "export" ? "出口" : "进口"}报告` : !isTrade && record.evidenceCode !== "representative" ? ` · ${mapEvidenceLabel(record.evidenceCode)}` : ""}</small></button>)}
          {records.length === 0 && <div className="atlas-empty"><strong>{isTrade && !hasFocusTradeCoverage ? `${selectedItemName}暂无贸易统计` : "当前筛选没有记录"}</strong><p>{!isTrade && nodes.length ? "可点击高亮国家查看已有供应链环节。" : isTrade && !hasFocusTradeCoverage ? "可查看整件商品，或选择已收录统计的材料。" : `${selectedCountry?.name ?? selectedItemName}${filters.year ? ` · ${filters.year}` : ""}的${isTrade ? isWorld ? "世界总计" : "双边统计" : "路线"}尚未收录。`}</p>
            {isTrade && filters.focus && <button type="button" onClick={toProductStatistics}>查看{productName}统计</button>}
            {(filters.country || filters.year || filters.direction) && <button type="button" onClick={clearFilters}>清除国家、年份与方向</button>}
            {isTrade && (isWorld ? scopeCounts.bilateral : scopeCounts.world) > 0 && <button type="button" onClick={() => navigate({ scope: isWorld ? "bilateral" : "world" })}>查看{isWorld ? "双边记录" : "世界总计"}</button>}
            <Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>查看供应链 →</Link>
          </div>}
        </div>
        {isTrade && filters.focus && hasFocusTradeCoverage && <button className="atlas-to-product" type="button" onClick={toProductStatistics}>查看整件商品统计 →</button>}
      </>}
    </aside></div>
  </section>;
}
