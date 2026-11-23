"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { geoCentroid, geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import type { MapCountry, MapViewModel } from "../lib/map-view-model";
import { mapPath } from "../lib/paths";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";

const mapWidth = 760;
const mapHeight = 410;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[12, 20], [748, 390]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const centers = new Map(features.map(country => [String(country.id).padStart(3, "0"), projection(geoCentroid(country))]));
const itemColors = ["#68e4c1", "#ffbb66", "#86baff", "#f3a8db", "#cfe381", "#ff9a93", "#c9b4ff", "#83dce9"];

/**
 * Compact, operable map sample for the homepage. It renders the same read-only
 * view model as the full /map page (no fabricated records); pan / zoom / hover
 * are local preview interactions, and every deep link carries the product
 * context into the full map.
 */
export function HomeAtlasPreview({ view, productId }: { view: MapViewModel; productId: string }) {
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const byM49 = useMemo(() => new Map(view.countries.filter(country => country.m49).map(country => [country.m49!, country])), [view.countries]);
  const byId = useMemo(() => new Map(view.countries.map(country => [country.id, country])), [view.countries]);
  const coveredCodes = useMemo(
    () => new Set(view.countries.filter(country => country.hasRouteNodes || country.hasTradeRecords).map(country => country.m49)),
    [view.countries]
  );
  const coloredItems = useMemo(() => {
    const ids = [...new Set(view.lines.map(line => line.itemId).filter(Boolean))];
    return new Map(ids.map((id, index) => [id, itemColors[index % itemColors.length]]));
  }, [view.lines]);
  const colorFor = (id: string | null) => coloredItems.get(id ?? "") ?? itemColors[0];

  const activeCountry = byId.get(hoveredCountryId ?? selectedCountryId ?? "");
  const visibleLines = view.lines.slice(0, 22);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch" || transform.scale === 1 || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      start.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const screen = event.currentTarget.getScreenCTM();
    const ratio = screen ? 1 / screen.a : 1;
    if (start.moved) setTransform(current => clampMapTransform({ ...current, x: start.originX + dx * ratio, y: start.originY + dy * ratio }, mapWidth, mapHeight));
  };
  const stopDrag = () => { drag.current = null; };

  const chooseCountry = (country: MapCountry | undefined) => {
    setSelectedCountryId(country?.id ?? null);
  };

  return (
    <div className="home-atlas-map">
      <div className="home-atlas-map-heading">
        <span>一件商品的全球连接</span>
        <Link href={mapPath({ product: productId })}>打开交互地图 ↗</Link>
      </div>
      <div className="map-viewport">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          role="group"
          aria-label="由已收录生产环节生成的世界供应链预览，可缩放与选择国家"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <rect className="map-ocean" width={mapWidth} height={mapHeight} fill="var(--map-ocean)" />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            {features.map((feature, index) => {
              const code = String(feature.id).padStart(3, "0");
              const country = byM49.get(code);
              const isSelected = Boolean(country && country.id === selectedCountryId);
              const isHovered = Boolean(country && country.id === hoveredCountryId);
              return (
                <path
                  key={feature.id ?? index}
                  d={pathGenerator(feature as GeoPermissibleObjects) ?? undefined}
                  className={`home-atlas-country${coveredCodes.has(code) ? " has-data" : ""}${isSelected ? " selected" : ""}${isHovered ? " hovered" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={country?.name ?? "该国家或地区"}
                  aria-pressed={isSelected}
                  onMouseEnter={() => country && setHoveredCountryId(country.id)}
                  onMouseLeave={() => setHoveredCountryId(null)}
                  onFocus={() => country && setHoveredCountryId(country.id)}
                  onBlur={() => setHoveredCountryId(null)}
                  onClick={() => chooseCountry(country)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      chooseCountry(country);
                    }
                  }}
                />
              );
            })}
            {visibleLines.map((line, index) => {
              const from = centers.get(line.fromM49);
              const to = centers.get(line.toM49);
              if (!from || !to || line.fromM49 === line.toM49) return null;
              const bend = 28 + index % 4 * 12;
              const dx = to[0] - from[0];
              const dy = to[1] - from[1];
              const length = Math.hypot(dx, dy);
              const d = length < 1
                ? `M${from[0]},${from[1]} c20,-48 -45,-48 0,0`
                : `M${from[0]},${from[1]} Q${(from[0] + to[0]) / 2 - dy / length * bend},${(from[1] + to[1]) / 2 + dx / length * bend} ${to[0]},${to[1]}`;
              return <path className="home-atlas-line" key={line.id} d={d} stroke={colorFor(line.itemId)} />;
            })}
            {[...new Set(visibleLines.flatMap(line => [line.fromM49, line.toM49]))].filter(Boolean).map(code => {
              const point = centers.get(code!);
              if (!point) return null;
              return <g className="home-atlas-endpoint" key={code} transform={`translate(${point[0]},${point[1]})`}><circle r={4 / transform.scale} /></g>;
            })}
          </g>
        </svg>
        <div className="map-zoom-controls" aria-label="地图缩放">
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25, mapWidth, mapHeight))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button>
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8, mapWidth, mapHeight))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button>
          <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>复位</button>
        </div>
      </div>
      <div className="home-atlas-map-footer">
        <span>{activeCountry ? activeCountry.name : "原料 · 部件 · 制造 · 市场"}</span>
        <Link href={mapPath({ product: productId, country: selectedCountryId ?? undefined })}>继续向内探索 →</Link>
      </div>
    </div>
  );
}
