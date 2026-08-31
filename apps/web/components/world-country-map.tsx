"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { geoCentroid, geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { ledgerPath, mapPath } from "../lib/paths";
import type { PageContext } from "../lib/context";

type MapCountry = {
  id: string;
  name: string;
  m49: string | null;
  roles: readonly string[];
  relatedNodeCount: number;
  hasTradeLedger: boolean;
};

type MapTradeLine = {
  id: string;
  reporterM49: string;
  partnerM49: string;
  direction: "import" | "export";
  value: number | null;
  currency: string | null;
  valueDataStatus: string;
};

type Transform = { x: number; y: number; scale: number };

const mapWidth = 1000;
const mapHeight = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const countryFeatures = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[18, 18], [mapWidth - 18, mapHeight - 18]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const stableCoordinate = (value: number) => Number(value.toFixed(4));

export function WorldCountryMap({ countries, tradeLines, productId, selectedCountryId, direction, context }: { countries: readonly MapCountry[]; tradeLines: readonly MapTradeLine[]; productId: string; selectedCountryId?: string; direction?: "import" | "export"; context: PageContext }) {
  const router = useRouter();
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const countryByM49 = useMemo(() => new Map(countries.filter((country) => country.m49).map((country) => [country.m49 as string, country])), [countries]);
  const featureByM49 = useMemo(() => new Map(countryFeatures.map((country) => [String(country.id).padStart(3, "0"), country])), []);
  const activeCountry = countries.find((country) => country.id === (hoveredId ?? selectedCountryId)) ?? null;
  const visibleTradeLines = selectedCountryId ? tradeLines.filter((line) => line.reporterM49 === countries.find((country) => country.id === selectedCountryId)?.m49 || line.partnerM49 === countries.find((country) => country.id === selectedCountryId)?.m49) : tradeLines;
  const maxTradeValue = Math.max(...visibleTradeLines.map((line) => typeof line.value === "number" && line.value > 0 ? line.value : 0), 1);

  const changeZoom = (factor: number) => setTransform((current) => ({ ...current, scale: Math.min(6, Math.max(1, current.scale * factor)) }));
  const reset = () => setTransform({ x: 0, y: 0, scale: 1 });
  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1.18 : 0.85);
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (transform.scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    setTransform((current) => ({ ...current, x: drag.current!.originX + event.clientX - drag.current!.x, y: drag.current!.originY + event.clientY - drag.current!.y }));
  };
  const stopDrag = () => { drag.current = null; };
  const selectCountry = (country: MapCountry) => router.push(mapPath({ ...context, product: productId, country: country.id, direction }));

  return <section className="country-map-workspace" aria-label="可交互世界国家地图">
    <div className="map-toolbar">
      <div><strong>世界国家地图</strong><span>点击有数据的国家查看；滚轮缩放，放大后拖拽地图。</span></div>
      <div className="map-zoom-controls" aria-label="地图缩放">
        <button type="button" onClick={() => changeZoom(1.25)} aria-label="放大地图">＋</button>
        <button type="button" onClick={() => changeZoom(0.8)} aria-label="缩小地图">－</button>
        <button type="button" onClick={reset}>重置</button>
      </div>
    </div>
    <div className="map-legend" aria-label="地图图例">
      <span><i className="legend-country-covered" />有当前数据</span>
      <span><i className="legend-country-selected" />当前选中</span>
      <span><i className="legend-trade-export" />出口观察</span>
      <span><i className="legend-trade-import" />进口观察</span>
      <span><i className="legend-trade-node" />贸易线交汇点</span>
    </div>
    <div className="map-viewport">
      <svg className="world-country-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="img" aria-labelledby="world-country-map-title world-country-map-description" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <title id="world-country-map-title">世界国家轮廓与贸易观察地图</title>
        <desc id="world-country-map-description">采用 Equal Earth 等积投影。蓝色国家表示当前数据集有记录，点击国家可以查看贸易账本；贸易线连接国家质心节点。</desc>
        <rect className="map-ocean" width={mapWidth} height={mapHeight} rx="16" />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {countryFeatures.map((countryFeature, featureIndex) => {
            const m49 = countryFeature.id == null ? null : String(countryFeature.id).padStart(3, "0");
            const country = m49 ? countryByM49.get(m49) : undefined;
            const selected = country?.id === selectedCountryId;
            const hovered = country?.id === hoveredId;
            const d = pathGenerator(countryFeature as GeoPermissibleObjects) ?? undefined;
            return <path key={m49 ?? `unidentified-${featureIndex}`} d={d} className={`map-country-shape${country ? " has-data" : ""}${selected ? " selected" : ""}${hovered ? " hovered" : ""}`} role={country ? "button" : undefined} aria-label={country ? `${country.name}，${country.roles.slice(0, 2).join("，") || "有当前数据"}` : undefined} tabIndex={country ? 0 : undefined} onMouseEnter={() => country && setHoveredId(country.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => country && setHoveredId(country.id)} onBlur={() => setHoveredId(null)} onClick={() => country && selectCountry(country)} onKeyDown={(event) => { if (country && (event.key === "Enter" || event.key === " ")) selectCountry(country); }} />;
          })}
          <g className="map-trade-layer" aria-label="双边贸易观察">
            <defs>
              <marker id="trade-arrow-export" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker>
              <marker id="trade-arrow-import" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker>
            </defs>
            {visibleTradeLines.map((line) => {
              const fromFeature = featureByM49.get(line.reporterM49);
              const toFeature = featureByM49.get(line.partnerM49);
              if (!fromFeature || !toFeature) return null;
              const from = projection(geoCentroid(fromFeature));
              const to = projection(geoCentroid(toFeature));
              if (!from || !to) return null;
              const x1 = stableCoordinate(from[0]); const y1 = stableCoordinate(from[1]); const x2 = stableCoordinate(to[0]); const y2 = stableCoordinate(to[1]);
              const width = typeof line.value === "number" && line.value > 0 ? 1.5 + 6 * Math.sqrt(line.value / maxTradeValue) : 1.5;
              const statusLabel = line.valueDataStatus === "unknown" ? "金额未知" : line.valueDataStatus === "estimated" ? "金额为估算" : "金额已观察";
              return <g key={line.id} className={`country-trade-line country-trade-${line.direction}`}><line x1={x1} y1={y1} x2={x2} y2={y2} style={{ strokeWidth: width }} markerEnd={`url(#trade-arrow-${line.direction})`}><title>{`${line.direction === "export" ? "出口" : "进口"} · ${line.value === null ? "金额未知" : `${line.currency ?? ""} ${line.value.toLocaleString()}`} · ${statusLabel}`}</title></line><circle cx={x1} cy={y1} r={3.2 / transform.scale} /><circle cx={x2} cy={y2} r={3.2 / transform.scale} /></g>;
            })}
          </g>
        </g>
      </svg>
    </div>
    <aside className="map-selection-summary" aria-live="polite">
      {activeCountry ? <><div><span className="iso-chip">{activeCountry.m49 ?? "—"}</span><h2>{activeCountry.name}</h2><p>{activeCountry.roles.slice(0, 3).join(" · ") || "当前数据集中有国家记录"}</p></div><div className="map-selection-actions"><span>{activeCountry.relatedNodeCount} 个供应链节点 · {visibleTradeLines.length} 条相关贸易观察</span><Link className="button button-primary" href={ledgerPath(productId, activeCountry.id, context)}>打开国家账本 →</Link></div></> : <><div><h2>选择一个国家</h2><p>有当前数据的国家以蓝色轮廓显示。点击国家整体，而不是地图节点。</p></div></>}
    </aside>
  </section>;
}
