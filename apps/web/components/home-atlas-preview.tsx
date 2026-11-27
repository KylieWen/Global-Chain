"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { geoCentroid, geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { mapPath } from "../lib/paths";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { useThemePreference } from "./theme-preference";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const features = feature(atlas, atlas.objects.countries).features;
const projection = geoEqualEarth().fitExtent([[25, 25], [975, 515]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const centers = new Map(
  features.map(country => [String(country.id).padStart(3, "0"), projection(geoCentroid(country))])
);
/** Lightweight real-data summary passed from the server; no fabricated figures. */
export type HomeLine = {
  from: string;
  to: string;
  itemId: string;
  value: number | null;
  valueStatus: string;
  year: string;
  kind: "trade" | "route";
};

export type HomeSummary = {
  id: string;
  name: string;
  recordCount: number;
  countryCount: number;
  entryCount: number;
  componentCount: number;
  yearLabel: string;
  lines: HomeLine[];
};

/** Statuses that mean "no reportable amount"; unknown is never ranked as 0. */
const AMOUNT_MISSING = new Set(["unknown", "withheld", "invalid"]);

function hasReportableAmount(line: HomeLine): boolean {
  return line.value != null && Number.isFinite(line.value) && !AMOUNT_MISSING.has(line.valueStatus);
}

/**
 * Main flows are ranked by reportable amount, descending. Lines without a
 * reportable amount keep their original content order after the ranked block;
 * missing amounts are not coerced to zero.
 */
function sortByAmount(lines: readonly HomeLine[]): HomeLine[] {
  const reportable = lines.filter(hasReportableAmount)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const missing = lines.filter(line => !hasReportableAmount(line));
  return [...reportable, ...missing];
}

/** Default number of main flows shown in the hero preview; the rest expand on demand. */
const HERO_DEFAULT_LIMIT = 8;

type Point = readonly [number, number];

function controlPoint(from: Point, to: Point, bend: number): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  return [(from[0] + to[0]) / 2 - (dy / length) * bend, (from[1] + to[1]) / 2 + (dx / length) * bend];
}

/**
 * Curvature scales with chord length and alternates sides by index, so arcs
 * sharing a converging endpoint fan out on both sides instead of bunching
 * into a one-sided bundle over East Asia.
 */
function bendFor(index: number, from: Point, to: Point): number {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const magnitude = Math.min(44, Math.max(16, length * 0.16));
  return index % 2 === 0 ? magnitude : -magnitude;
}

function arcD(from: Point, to: Point, bend: number): string {
  const [cx, cy] = controlPoint(from, to, bend);
  return `M${from[0].toFixed(3)},${from[1].toFixed(3)} Q${cx.toFixed(3)},${cy.toFixed(3)} ${to[0].toFixed(3)},${to[1].toFixed(3)}`;
}

/**
 * On narrow screens the initial view centres the endpoint that participates in
 * the most current-product lines, so the converging flow is visible on first
 * paint; the user can still pan afterwards. Wide screens keep the full world.
 */
function focusTransformFor(lines: HomeSummary["lines"], centerMap: Map<string, Point | null>, wide: boolean): MapTransform {
  if (wide) return { x: 0, y: 0, scale: 1 };
  const degree = new Map<string, number>();
  lines.forEach(line => {
    if (line.from) degree.set(line.from, (degree.get(line.from) ?? 0) + 1);
    if (line.to) degree.set(line.to, (degree.get(line.to) ?? 0) + 1);
  });
  let bestDegree = 0;
  degree.forEach(count => { if (count > bestDegree) bestDegree = count; });
  if (bestDegree === 0) return { x: 0, y: 0, scale: 1 };
  // Average the most-connected endpoints (degree at least half the top), so the
  // camera lands on the converging cluster rather than a single transit node.
  const heavy = [...degree.entries()].filter(([, count]) => count >= Math.max(2, Math.ceil(bestDegree / 2)));
  const coords = heavy.map(([code]) => centerMap.get(code)).filter((p): p is Point => Boolean(p));
  if (!coords.length) return { x: 0, y: 0, scale: 1 };
  const point: Point = [
    coords.reduce((sum, p) => sum + p[0], 0) / coords.length,
    coords.reduce((sum, p) => sum + p[1], 0) / coords.length
  ];
  // A tall phone viewport already crops the sliced world map, so the old 1.5x
  // zoom pushed both ends of every flow off screen. Keep the map at 1x and
  // centre the converging endpoint instead, so lines from China stay in frame.
  const scale = 1;
  const x = MAP_WIDTH * 0.5 - point[0] * scale;
  const y = MAP_HEIGHT / 2 - point[1] * scale;
  return { scale, x, y };
}

function useItemColorMap(products: HomeSummary[], palette: readonly string[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    products.forEach(product => product.lines.forEach(line => {
      if (line.itemId && !map.has(line.itemId)) {
        map.set(line.itemId, palette[map.size % palette.length] ?? palette[0]);
      }
    }));
    return map;
  }, [products, palette]);
}

/** Full-bleed interactive hero map: pan / zoom / switch featured product. */
export function HomeHeroMap({ products, featuredId }: { products: HomeSummary[]; featuredId: string }) {
  const initial = Math.max(0, products.findIndex(product => product.id === featuredId));
  const [index, setIndex] = useState(initial);
  const product = products[Math.min(index, products.length - 1)] ?? products[0];
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const { tokens } = useThemePreference();
  const [wide, setWide] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const sortedLines = useMemo(() => sortByAmount(product.lines), [product.lines]);
  const visibleLines = expanded ? sortedLines : sortedLines.slice(0, HERO_DEFAULT_LIMIT);
  const hiddenCount = Math.max(0, sortedLines.length - HERO_DEFAULT_LIMIT);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setTransform(focusTransformFor(product.lines, centers, wide));
  }, [product.id, product.lines, wide]);

  const palette = tokens.map.palette.itemColors;
  const colorMap = useItemColorMap(products, palette);

  const endpointCodes = useMemo(
    () => [...new Set(visibleLines.flatMap(line => [line.from, line.to]).filter(Boolean))],
    [visibleLines]
  );

  const selectProduct = (optionIndex: number) => {
    setIndex(optionIndex);
    setExpanded(false);
  };

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
    if (start.moved) {
      setTransform(current => clampMapTransform({ ...current, x: start.originX + dx * ratio, y: start.originY + dy * ratio }, MAP_WIDTH, MAP_HEIGHT));
    }
  };
  const stopDrag = () => { drag.current = null; };

  return (
    <div className="home-hero-map">
      <div className="home-hero-viewport">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio={wide ? "xMidYMid slice" : "xMidYMid meet"}
          role="group"
          aria-label="由已收录生产环节生成的世界供应链预览，可缩放与选择国家"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          {/* Tall phone viewports letterbox the map, so the ocean fill is
              extended past the viewBox to avoid a visible seam. */}
          <rect className="map-ocean" x={0} y={-MAP_HEIGHT * 3} width={MAP_WIDTH} height={MAP_HEIGHT * 5} />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            {features.map((feature, featureIndex) => (
              <path
                key={feature.id ?? featureIndex}
                d={pathGenerator(feature as GeoPermissibleObjects) ?? undefined}
                className="home-hero-country"
              />
            ))}
            {visibleLines.map((line, index) => {
              const from = centers.get(line.from);
              const to = centers.get(line.to);
              if (!from || !to || line.from === line.to) return null;
              return <path className="home-hero-line" key={`${line.from}-${line.to}-${index}`} d={arcD(from, to, bendFor(index, from, to))} stroke={colorMap.get(line.itemId) ?? palette[0]} />;
            })}
            {endpointCodes.map(code => {
              const point = centers.get(code);
              if (!point) return null;
              return <g className="home-hero-endpoint" key={code} transform={`translate(${point[0].toFixed(3)},${point[1].toFixed(3)})`}><circle r={4 / transform.scale} /></g>;
            })}
          </g>
        </svg>
        <div className="home-hero-zoom" aria-label="地图缩放">
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25, MAP_WIDTH, MAP_HEIGHT))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button>
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8, MAP_WIDTH, MAP_HEIGHT))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button>
          <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>复位</button>
        </div>
        {hiddenCount > 0 && (
          <button type="button" className="home-hero-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? "收起主流向" : `展开其余 ${hiddenCount} 条流向`}
          </button>
        )}
      </div>
      <nav className="home-hero-switcher" aria-label="切换主打卡商品">
        {products.map((option, optionIndex) => (
          <button key={option.id} type="button" aria-pressed={optionIndex === index} onClick={() => selectProduct(optionIndex)}>{option.name}</button>
        ))}
      </nav>
    </div>
  );
}

/** Static flow thumbnail for a product editorial entry (no canvas on mobile). */
function HomeProductThumb({ product }: { product: HomeSummary }) {
  const { tokens } = useThemePreference();
  const palette = tokens.map.palette.itemColors;
  const colorMap = useItemColorMap([product], palette);
  const lines = useMemo(() => sortByAmount(product.lines), [product.lines]);
  return (
    <svg className="home-product-thumb" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${product.name} 的全球流向缩略图`}>
      {features.map((feature, featureIndex) => (
        <path key={feature.id ?? featureIndex} d={pathGenerator(feature as GeoPermissibleObjects) ?? undefined} className="home-thumb-country" />
      ))}
      {lines.map((line, index) => {
        const from = centers.get(line.from);
        const to = centers.get(line.to);
        if (!from || !to || line.from === line.to) return null;
        return <path className="home-thumb-line" key={`${line.from}-${line.to}-${index}`} d={arcD(from, to, bendFor(index, from, to))} stroke={colorMap.get(line.itemId) ?? palette[0]} />;
      })}
      {[...new Set(lines.flatMap(line => [line.from, line.to]).filter(Boolean))].map(code => {
        const point = centers.get(code);
        if (!point) return null;
        return <g className="home-thumb-endpoint" key={code} transform={`translate(${point[0].toFixed(3)},${point[1].toFixed(3)})`}><circle r={3} /></g>;
      })}
    </svg>
  );
}

/** Editorial product entries: real flow thumbnail + name + facts. */
export function HomeProductStrip({ products }: { products: HomeSummary[] }) {
  return (
    <section className="home-product-strip" aria-label="按商品进入地图">
      {products.map(product => (
        <Link key={product.id} className="home-product-entry" href={mapPath({ product: product.id })}>
          <HomeProductThumb product={product} />
          <div className="home-product-entry-copy">
            <strong>{product.name}</strong>
            <span className="home-product-facts">
              {product.entryCount > 0 ? `拆解 ${product.entryCount} 个部件与材料条目 · ` : ""}{product.countryCount} 个国家与地区{product.yearLabel ? ` · ${product.yearLabel}` : ""}
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
