"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { geoCentroid, geoEqualEarth, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { mapPath } from "../lib/paths";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { settingsFromMapTokens } from "../lib/flow-config";
import { beamWidthFor } from "../lib/flow-encoding";
import { BeamFlowLayer, type BeamFlow } from "./beam-flow-layer";
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
export type HomeSummary = {
  id: string;
  name: string;
  recordCount: number;
  countryCount: number;
  yearLabel: string;
  lines: { from: string; to: string; itemId: string }[];
};

type Point = readonly [number, number];

function controlPoint(from: Point, to: Point, bend: number): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  return [(from[0] + to[0]) / 2 - (dy / length) * bend, (from[1] + to[1]) / 2 + (dx / length) * bend];
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
  const scale = 1.5;
  const x = MAP_WIDTH * 0.56 - point[0] * scale;
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
  const { tokens, reducedMotion } = useThemePreference();
  const settings = settingsFromMapTokens(tokens.map);
  const [wide, setWide] = useState(true);

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

  const beamOn = wide && !reducedMotion;
  const palette = tokens.map.palette.itemColors;
  const colorMap = useItemColorMap(products, palette);

  const endpointCodes = useMemo(
    () => [...new Set(product.lines.flatMap(line => [line.from, line.to]).filter(Boolean))],
    [product]
  );

  const flows = useMemo<BeamFlow[]>(() => {
    if (!beamOn) return [];
    return product.lines.flatMap((line, i) => {
      const from = centers.get(line.from);
      const to = centers.get(line.to);
      if (!from || !to || line.from === line.to) return [];
      const control = controlPoint(from, to, 26 + (i % 4) * 14);
      const width = beamWidthFor(0.25, tokens.map.line.minWidth, tokens.map.line.maxWidth, settings.beamWidth);
      return [{
        id: `${line.from}-${line.to}-${i}`,
        from,
        to,
        control,
        color: colorMap.get(line.itemId) ?? palette[0],
        factor: 0.25,
        width,
        state: "normal" as const
      }];
    });
  }, [product, beamOn, colorMap, palette, tokens.map.line.minWidth, tokens.map.line.maxWidth, settings.beamWidth]);

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
          preserveAspectRatio="xMidYMid slice"
          role="group"
          aria-label="由已收录生产环节生成的世界供应链预览，可缩放与选择国家"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <rect className="map-ocean" width={MAP_WIDTH} height={MAP_HEIGHT} />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            {features.map((feature, featureIndex) => (
              <path
                key={feature.id ?? featureIndex}
                d={pathGenerator(feature as GeoPermissibleObjects) ?? undefined}
                className="home-hero-country"
              />
            ))}
            {product.lines.map((line, index) => {
              const from = centers.get(line.from);
              const to = centers.get(line.to);
              if (!from || !to || line.from === line.to) return null;
              return <path className="home-hero-line" key={`${line.from}-${line.to}-${index}`} d={arcD(from, to, 26 + (index % 4) * 14)} stroke={colorMap.get(line.itemId) ?? palette[0]} />;
            })}
            {endpointCodes.map(code => {
              const point = centers.get(code);
              if (!point) return null;
              return <g className="home-hero-endpoint" key={code} transform={`translate(${point[0]},${point[1]})`}><circle r={4 / transform.scale} /></g>;
            })}
          </g>
        </svg>
        {beamOn && <BeamFlowLayer flows={flows} transform={transform} settings={settings} level={reducedMotion ? 3 : 0} nodeColor={tokens.palette.accent} scheme={tokens.scheme} />}
        <div className="home-hero-zoom" aria-label="地图缩放">
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25, MAP_WIDTH, MAP_HEIGHT))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button>
          <button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8, MAP_WIDTH, MAP_HEIGHT))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button>
          <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>复位</button>
        </div>
      </div>
      <nav className="home-hero-switcher" aria-label="切换主打卡商品">
        {products.map((option, optionIndex) => (
          <button key={option.id} type="button" aria-pressed={optionIndex === index} onClick={() => setIndex(optionIndex)}>{option.name}</button>
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
  return (
    <svg className="home-product-thumb" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${product.name} 的全球流向缩略图`}>
      {features.map((feature, featureIndex) => (
        <path key={feature.id ?? featureIndex} d={pathGenerator(feature as GeoPermissibleObjects) ?? undefined} className="home-thumb-country" />
      ))}
      {product.lines.map((line, index) => {
        const from = centers.get(line.from);
        const to = centers.get(line.to);
        if (!from || !to || line.from === line.to) return null;
        return <path className="home-thumb-line" key={`${line.from}-${line.to}-${index}`} d={arcD(from, to, 22 + (index % 4) * 12)} stroke={colorMap.get(line.itemId) ?? palette[0]} />;
      })}
      {[...new Set(product.lines.flatMap(line => [line.from, line.to]).filter(Boolean))].map(code => {
        const point = centers.get(code);
        if (!point) return null;
        return <g className="home-thumb-endpoint" key={code} transform={`translate(${point[0]},${point[1]})`}><circle r={3} /></g>;
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
              {product.recordCount} 条路线与记录 · {product.countryCount} 个国家与地区{product.yearLabel ? ` · ${product.yearLabel}` : ""}
            </span>
            <span className="home-product-link">在世界地图上探索 ↗</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
