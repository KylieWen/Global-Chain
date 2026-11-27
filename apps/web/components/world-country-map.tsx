"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { geoCentroid, geoEqualEarth, geoGraticule10, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import smallCountries from "../../../content/geography/world-small-country-geometry.json";
import { ledgerPath, mapPath, nodePath, supplyChainPath, type MapFilters } from "../lib/paths";
import { useMapWheel } from "./use-map-wheel";
import { MapFocus, MapFocusButton } from "./map-focus";
import type { MapCountry, MapViewModel } from "../lib/map-view-model";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { layoutMapLabels, tradeAmountBands, tradeAmountWidth } from "../lib/map-presentation";
import { MapRecordDetails, mapEvidenceLabel, mapMappingLabel, mapRecordTitle, mapValue } from "./map-record-details";
import { useThemePreference } from "./theme-preference";
import { settingsFromMapTokens, type FlowMode, type FlowSettings } from "../lib/flow-config";
import {
  beamWidthFor,
  initialAdaptiveLevel,
  massFactor,
  nextAdaptiveLevel,
  recordMass,
  type AdaptiveHint,
  type AdaptiveLevel
} from "../lib/flow-encoding";
import { type BeamFlow } from "./beam-flow-layer";
import { StraightFlowLayer } from "./straight-flow-layer";
import { MapFocusFilters } from "./map-focus-filters";
import { defaultFocusFilters, filterFocusLines, type FocusFilterState } from "../lib/trade-focus-filters";
import { FlowSettingsDrawer } from "./flow-settings-drawer";

const mapWidth = 1000;
const mapHeight = 540;
const atlas = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const coarseFeatures = feature(atlas, atlas.objects.countries).features;
const features = [...coarseFeatures, ...(smallCountries.features as unknown as typeof coarseFeatures)];
const projection = geoEqualEarth().fitExtent([[25, 70], [975, 530]], { type: "Sphere" });
const pathGenerator = geoPath(projection);
const coordinate = (value: number) => Number(value.toFixed(3));

/**
 * Default framing centres the selected flow envelope. On narrow screens the
 * whole envelope (every endpoint, not just the strongest cluster) fits the
 * first screen; wide screens keep the full world with a modest zoom. The
 * slice-fit SVG crops whichever axis overflows, so the fit scale accounts for
 * the visible viewBox rectangle under the current viewport aspect.
 */
function focusTransformForLines(
  lines: readonly { fromM49: string | null; toM49: string | null }[],
  centerMap: Map<string, [number, number] | null>,
  narrow: boolean,
  viewport: { width: number; height: number }
): MapTransform {
  const points: Array<[number, number]> = [];
  lines.forEach(line => {
    const from = line.fromM49 ? centerMap.get(line.fromM49) : null;
    const to = line.toM49 ? centerMap.get(line.toM49) : null;
    if (from) points.push([from[0], from[1]]);
    if (to) points.push([to[0], to[1]]);
  });
  if (points.length === 0) return { x: 0, y: 0, scale: 1 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  }
  const bboxWidth = Math.max(1, maxX - minX);
  const bboxHeight = Math.max(1, maxY - minY);

  const viewportAspect = viewport.height > 0 ? viewport.width / viewport.height : 1;
  const mapAspect = mapWidth / mapHeight;
  const visibleWidth = viewportAspect < mapAspect ? mapWidth * (viewportAspect / mapAspect) : mapWidth;
  const visibleHeight = viewportAspect > mapAspect ? mapHeight * (mapAspect / viewportAspect) : mapHeight;

  // Wide: centre the flow envelope in both axes with balanced top/bottom
  // margins. A thin full-width mid-latitude band leaves even ocean above and
  // below instead of pushing the world into the lower frame.
  if (!narrow) {
    const scale = Math.max(1, Math.min(2.4, (visibleHeight * 0.9) / bboxHeight, (visibleWidth * 0.92) / bboxWidth));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { scale, x: mapWidth / 2 - cx * scale, y: mapHeight / 2 - cy * scale };
  }
  // Narrow: fit the entire envelope with a small inset, capped so distant
  // geography stays reachable by dragging.
  const scale = Math.min((visibleWidth * 0.92) / bboxWidth, (visibleHeight * 0.9) / bboxHeight, 2.4);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { scale, x: mapWidth / 2 - cx * scale, y: mapHeight / 2 - cy * scale };
}

/**
 * Shared control point for the SVG guide line and the WebGL/Canvas beam.
 * Straight form: the control point sits on the chord itself, so the rendered
 * path is a straight line between the two country centres. Same-pair flows
 * still fan out by a few pixels per lane so parallel items stay separable.
 */
function arcControl(
  from: readonly [number, number],
  to: readonly [number, number],
  lane: number
): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const side = lane % 2 === 0 ? 1 : -1;
  const displacement = lane === 0 ? 0 : side * (6 + Math.floor(lane / 2) * 5);
  const nx = -dy / length;
  const ny = dx / length;
  return [(from[0] + to[0]) / 2 + nx * displacement, (from[1] + to[1]) / 2 + ny * displacement];
}

type Props = { view: MapViewModel; filters: MapFilters & { product: string }; products: readonly { id: string; name: string }[]; regionalLinks?: readonly {entityId:string;label:string;href:string}[] };

export function WorldCountryMap({ view, filters, products, regionalLinks=[] }: Props) {
  const { countries, records, lines, nodes, items, years, scope, scopeCounts, selectedItemName, relatedMaterials, datasetVersion, hasFocusTradeCoverage } = view;
  const router = useRouter();
  const { tokens, flowMode, reducedMotion, setFlowMode, updateFlowSettings, resetFlowSettings, exportConfig, importConfig } = useThemePreference();
  const mapTokens = tokens.map;
  const settings: FlowSettings = settingsFromMapTokens(mapTokens);
  const [isPending, startTransition] = useTransition();
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [focusFilters, setFocusFilters] = useState<FocusFilterState>(defaultFocusFilters);
  useEffect(() => { setFocusFilters(defaultFocusFilters); }, [filters.country]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredRecordId, setHoveredRecordId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [uncoveredCountry, setUncoveredCountry] = useState<{name:string;featureKey:string} | null>(null);
  const [renderedWidth, setRenderedWidth] = useState(mapWidth);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedRecordId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRecordId(null);
    };
    document.addEventListener("keydown", onKey);
    drawerPanelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedRecordId]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => setRenderedWidth(svg.getScreenCTM() ? Math.abs(svg.getScreenCTM()!.a) * mapWidth : entries[0].contentRect.width || mapWidth));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [narrow, setNarrow] = useState(false);
  // Immediate local year for the range input: arrow keys update this right
  // away, while the URL write-back settles via transition. The local value
  // is re-synced whenever the year changes from outside (select, autoplay,
  // direct URL entry, product switch).
  const [timelineYear, setTimelineYear] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRecordsOpen(false);
    setFiltersOpen(false);
    const mq = window.matchMedia("(max-width: 759px)");
    const updateNarrow = () => setNarrow(mq.matches);
    updateNarrow();
    mq.addEventListener("change", updateNarrow);
    return () => mq.removeEventListener("change", updateNarrow);
  }, []);
  useMapWheel(svgRef, setTransform, mapWidth, mapHeight, transform, suppressClick);
  // Country focus: picking a country eases the camera onto its outline and dims
  // the rest of the world, so "this country" reads as a place, not a dot.
  const focusRaf = useRef<number | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  useEffect(() => {
    if (focusRaf.current !== null) {
      cancelAnimationFrame(focusRaf.current);
      focusRaf.current = null;
    }
    if (!filters.country || reducedMotion) return;
    const country = countries.find(item => item.id === filters.country);
    const feature = country?.m49 ? features.find(item => String(item.id).padStart(3, "0") === country.m49) : undefined;
    if (!feature) return;
    const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature as GeoPermissibleObjects);
    const width = Math.max(1, x1 - x0);
    const height = Math.max(1, y1 - y0);
    const centre = projection(geoCentroid(feature as GeoPermissibleObjects)) ?? [mapWidth / 2, mapHeight / 2];
    const scale = Math.max(1.35, Math.min(3.2, (mapWidth * 0.34) / width, (mapHeight * 0.42) / height));
    const target = clampMapTransform({ x: mapWidth / 2 - centre[0] * scale, y: mapHeight / 2 - centre[1] * scale, scale }, mapWidth, mapHeight);
    const from = transformRef.current;
    const startedAt = performance.now();
    const duration = 520;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const k = ease(t);
      setTransform({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, scale: from.scale + (target.scale - from.scale) * k });
      focusRaf.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    focusRaf.current = requestAnimationFrame(step);
    return () => {
      if (focusRaf.current !== null) cancelAnimationFrame(focusRaf.current);
      focusRaf.current = null;
    };
  }, [filters.country, countries, reducedMotion]);

  const byM49 = useMemo(() => new Map(countries.filter(country => country.m49).map(country => [country.m49!, country])), [countries]);
  const byId = useMemo(() => new Map(countries.map(country => [country.id, country])), [countries]);
  const centers = useMemo(() => new Map(features.map(item => [String(item.id).padStart(3, "0"), projection(geoCentroid(item))])), []);
  const selectedCountry = byId.get(filters.country ?? "");
  const activeCountry = byId.get(hoveredCountryId ?? filters.country ?? "");
  const selectedRecord = records.find(record => record.id === selectedRecordId);
  const activeRecord = records.find(record => record.id === hoveredRecordId) ?? selectedRecord;
  const isTrade = filters.layer === "trade";
  const isWorld = isTrade && scope === "world";
  const captionDescription = isTrade ? isWorld ? "世界总计 · 圆点表示报告国" : "双边贸易 · 连线表示统计联系" : "代表性路线 · 连接原料、生产与市场";
  const { compareTrade, selectedItemIds, selectedYear, currencies, selectedCurrency } = view;
  const timelineYears = years.filter(year => /^\d{4}$/.test(year)).sort();
  const timeIndex = selectedYear ? timelineYears.indexOf(selectedYear) : -1;
  const localIndexRaw = timelineYear != null ? timelineYears.indexOf(timelineYear) : timeIndex;
  const timelineIndex = localIndexRaw >= 0 ? localIndexRaw : timeIndex;
  const activeTimelineYear = timelineYear && timelineIndex >= 0 ? timelineYear : selectedYear;
  const selectableItems = items.filter(item => item.directTradeCount > 0 || selectedItemIds.includes(item.id));
  const paletteColors = mapTokens.palette.itemColors;
  const coloredItems = useMemo(() => items.filter(item => item.directTradeCount > 0 || item.relatedTradeCount > 0), [items]);
  const colors = useMemo(() => new Map(coloredItems.map((item, index) => [item.id, paletteColors[index] ?? `hsl(${index * 137.508 % 360} 85% 73%)`])), [coloredItems, paletteColors]);
  const colorFor = (id: string | null) => colors.get(id ?? "") ?? paletteColors[0];
  const context = { datasetVersion, contentVersion: filters.contentVersion };
  const lineCurrencies = [...new Set(lines.map(line => line.currency))];
  const tradeCurrency = compareTrade ? selectedCurrency : lineCurrencies.length === 1 && new Set(lines.map(line => line.periodLabel)).size === 1 ? lineCurrencies[0] : null;
  const parallelLines = new Map<string, number>();
  const quantityUnits = [...new Set(lines.flatMap(line => line.unit && tradeAmountWidth(line.quantity, line.quantityDataStatus) !== null ? [line.unit] : []))].sort();
  const selectedUnit = filters.unit && quantityUnits.includes(filters.unit) ? filters.unit : quantityUnits[0];
  const quantityMode = compareTrade && filters.measure === "quantity";
  const widthUnit = quantityMode ? selectedUnit : tradeCurrency;
  const visibleLines = quantityMode ? lines.filter(line => line.unit === selectedUnit && selectedUnit) : lines;
  const focusedCountryName = countries.find(country => country.id === filters.country)?.name ?? "该国";
  const displayLines = useMemo(() => {
    if (!filters.country) return visibleLines;
    return filterFocusLines(visibleLines, focusFilters, filters.country, line => line.value);
  }, [visibleLines, focusFilters, filters.country]);
  const defaultTransform = useMemo(() => {
    const viewport = typeof window === "undefined"
      ? { width: 1440, height: 960 }
      : { width: window.innerWidth, height: window.innerHeight };
    return focusTransformForLines(visibleLines, centers, narrow, viewport);
  }, [visibleLines, centers, narrow]);
  const prevNarrowRef = useRef<boolean | null>(null);

  // Re-apply the default view only when the breakpoint crosses; line/filter
  // changes must not wipe the user's current pan/zoom.
  useEffect(() => {
    if (prevNarrowRef.current === narrow) return;
    prevNarrowRef.current = narrow;
    setTransform(defaultTransform);
  }, [narrow, defaultTransform]);

  const adaptiveHint: AdaptiveHint = useMemo(() => ({
    reducedMotion,
    hardwareConcurrency: typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null,
    deviceMemory: typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null : null,
    flowCount: visibleLines.length
  }), [reducedMotion, visibleLines.length]);
  const [adaptiveLevel, setAdaptiveLevel] = useState<AdaptiveLevel>(0);
  const adaptiveRef = useRef(adaptiveLevel);
  adaptiveRef.current = adaptiveLevel;
  const frameEmaRef = useRef(16);

  useEffect(() => {
    setAdaptiveLevel(initialAdaptiveLevel(adaptiveHint).level);
  }, [adaptiveHint]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const { level } = nextAdaptiveLevel(adaptiveRef.current, frameEmaRef.current, adaptiveHint);
      setAdaptiveLevel(prev => (prev === level ? prev : level));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [adaptiveHint]);

  const fallbackStatic = reducedMotion || adaptiveLevel === 3;
  const effectiveMode: FlowMode = fallbackStatic ? "classic" : flowMode;
  const beamActive = effectiveMode === "beam" && !isWorld;

  const beamFlows = useMemo<BeamFlow[]>(() => {
    if (!beamActive) return [];
    const laneIndex = new Map<string, number>();
    const result: BeamFlow[] = [];
    displayLines.forEach((line) => {
      const from = centers.get(line.fromM49);
      const to = centers.get(line.toM49);
      if (!from || !to) return;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const pair = `${line.fromM49}:${line.toM49}`;
      const lane = laneIndex.get(pair) ?? 0;
      laneIndex.set(pair, lane + 1);
      const control: [number, number] = length < 1
        ? [from[0] - 20, from[1] - 48]
        : arcControl(from, to, lane);
      const band = recordMass({
        value: line.value,
        valueStatus: line.valueDataStatus,
        quantity: line.quantity,
        quantityStatus: line.quantityDataStatus,
        measure: quantityMode ? "quantity" : "amount"
      });
      const factor = massFactor(band);
      // Zoom multiplies map-unit widths; damp them so the focused view does not
      // blow out into a white starburst at the origin.
      const zoomDamp = 1 / Math.max(1, Math.pow(transform.scale, 0.55));
      const width = beamWidthFor(factor, mapTokens.line.minWidth, mapTokens.line.maxWidth, settings.beamWidth) * zoomDamp;
      const state = activeRecord?.id === line.id ? "active" : activeRecord ? "muted" : "normal";
      // Direction is a first-class read: inbound lanes warm, outbound lanes cool,
      // so a dense hub still shows which way the goods move.
      const directionColor = line.direction === "import" ? "#d8bb84" : "#8be4c4";
      result.push({ id: line.id, from, to, control, color: compareTrade ? colors.get(line.itemId ?? "") ?? mapTokens.palette.itemColors[0] : directionColor, factor, band, width, state });
    });
    return result;
  }, [beamActive, displayLines, centers, quantityMode, mapTokens.line.minWidth, mapTokens.line.maxWidth, mapTokens.palette.itemColors, settings.beamWidth, activeRecord, colors, compareTrade, transform.scale]);

  const diagnosticsRef = useRef<{ particleCount: number; level: number; cap: number }>({ particleCount: 0, level: adaptiveLevel, cap: settings.maxParticles });
  const handleDiagnostics = useCallback((info: { particleCount: number; level: number; cap: number }) => {
    diagnosticsRef.current = info;
    const root = workspaceRef.current;
    if (root) {
      root.dataset.particleCount = String(info.particleCount);
      root.dataset.adaptiveLevel = String(info.level);
      root.dataset.flowCap = String(info.cap);
    }
  }, []);
  const handleFrameSample = useCallback((frameMs: number) => { frameEmaRef.current = frameMs; }, []);

  useEffect(() => {
    if (timelineYears.length < 2) setPlaying(false);
  }, [timelineYears.length]);

  // Re-sync the local range value when the year changes outside the input
  // itself (year select, autoplay, direct URL, product/filter switch).
  useEffect(() => {
    setTimelineYear(selectedYear ?? null);
  }, [selectedYear]);

  useEffect(() => {
    if (!playing || timeIndex < 0 || timelineYears.length < 2) return;
    const timer = window.setInterval(() => {
      const next = timeIndex + 1;
      if (next >= timelineYears.length) { setPlaying(false); return; }
      navigateRef.current({ year: timelineYears[next] });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [playing, timeIndex, timelineYears]);

  const endpoints = new Set(isWorld
    ? records.flatMap(record => record.reporterM49 ?? [])
    : [...visibleLines.flatMap(line => [line.fromM49, line.toM49]), ...nodes.filter(node => !filters.country || node.countryId === filters.country).flatMap(node => byId.get(node.countryId)?.m49 ?? [])]);
  const activeNodes = nodes.filter(node => node.countryId === activeCountry?.id);
  const hasLayerRecords = (country: MapCountry) => isTrade ? country.hasTradeRecords : country.hasRouteNodes;
  const coverageLabel = (country: MapCountry) => hasLayerRecords(country) ? (isTrade ? "有统计" : "参与代表性路线") : country.hasTradeLedger ? "仅有账本" : "尚未收录";
  const navigate = (patch: Partial<MapFilters>) => { setUncoveredCountry(null); startTransition(() => router.push(mapPath({ ...filters, ...patch }), { scroll: false })); };
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const chooseCountry = (country: MapCountry | undefined, name: string, featureKey: string) => {
    if (suppressClick.current) return;
    if (country) navigate({ country: country.id });
    else { setSelectedRecordId(null); setUncoveredCountry({name,featureKey}); }
  };
  const chooseRecord = (id: string) => { if (!suppressClick.current) setSelectedRecordId(id); };
  const clearFilters = () => navigate({ country: undefined, year: undefined, direction: undefined });
  const toProductStatistics = () => navigate({ focus: undefined, items: filters.product, country: undefined, year: undefined, direction: undefined, scope: undefined });
  const toggleItem = (id: string, checked: boolean) => {
    const next = checked ? [...selectedItemIds, id] : selectedItemIds.filter(item => item !== id);
    navigate({ items: next.join(","), focus: undefined });
  };
  const productName = products.find(product => product.id === filters.product)?.name ?? "整件商品";
  const labelFontSize = (renderedWidth < 600 ? 12 : 13) * mapWidth / renderedWidth;
  const priorityCodes = new Set([activeCountry?.m49, activeRecord?.fromM49, activeRecord?.toM49].filter(Boolean));
  const labelCodes = [...new Set([...priorityCodes, ...endpoints])].filter((code): code is string => Boolean(code));
  const labels = layoutMapLabels(labelCodes.flatMap(code => {
    const country = byM49.get(code); const point = centers.get(code);
    if (!country || !point || (renderedWidth < 600 && !priorityCodes.has(code))) return [];
    return [{ id: code, name: country.name, x: point[0] * transform.scale + transform.x, y: point[1] * transform.scale + transform.y }];
  }), labelFontSize);
  const renderLabels = () => labels.map(label => <text key={label.id} x={coordinate(label.x + 3)} y={coordinate(label.y + labelFontSize + 2)} style={{fontSize:labelFontSize}}>{label.name}</text>);
  const flowLabels = useMemo(() => {
    if (!filters.country) return [] as { id: string; x: number; y: number; text: string }[];
    return [...displayLines]
      .sort((left, right) => Math.abs(right.value ?? 0) - Math.abs(left.value ?? 0))
      .slice(0, 5)
      .flatMap((line, index) => {
        const from = centers.get(line.fromM49); const to = centers.get(line.toM49);
        if (!from || !to) return [];
        const control = arcControl(from, to, 0);
        // Straight lanes converge at the origin, so labels belong near the
        // destination end where the partners are already spread apart.
        const t = Math.min(0.92, 0.84 + index * 0.015);
        const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * control[0] + t * t * to[0];
        const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * control[1] + t * t * to[1];
        const partnerId = line.fromCountryId === filters.country ? line.toCountryId : line.fromCountryId;
        const partner = (partnerId ? byId.get(partnerId) : undefined) ?? byM49.get(line.fromCountryId === filters.country ? line.toM49 ?? "" : line.fromM49 ?? "");
        return [{
          id: line.id, x, y,
          text: `${partner?.name ?? ""} ${mapValue(line.value, line.valueDataStatus, line.currency, true)}`.trim()
        }];
      });
  }, [filters.country, displayLines, centers, byId, byM49]);
  const renderFlowLabels = () => flowLabels.map(label => <text key={label.id} className="atlas-flow-label" x={coordinate(label.x * transform.scale + transform.x)} y={coordinate(label.y * transform.scale + transform.y)} style={{fontSize:labelFontSize * 0.92}}>{label.text}</text>);
  const selectedIndex = selectedRecord ? records.indexOf(selectedRecord) : -1;
  const selectAdjacentRecord = (offset: number) => { const next = records[selectedIndex + offset]; if (next) setSelectedRecordId(next.id); };
  const closeDetail = () => setSelectedRecordId(null);
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") return;
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
  const stopDrag = () => { if (drag.current) suppressClick.current = drag.current.moved; drag.current = null; };

  return <MapFocus title="世界地图" onZoom={factor => setTransform(current => zoomMap(current, factor))} onReset={() => setTransform(defaultTransform)}><section ref={workspaceRef} className={`country-map-workspace atlas-workspace${beamActive ? " beam-mode" : ""}`} data-flow-mode={effectiveMode} data-adaptive-level={adaptiveLevel} data-particle-count={diagnosticsRef.current.particleCount} data-flow-cap={settings.maxParticles} aria-label="可交互世界国家地图" aria-busy={isPending}>
    {isPending && <div className="map-pending" role="status" aria-live="polite">正在更新地图…</div>}
    <div className="atlas-compact-filters">
      <button type="button" className="atlas-filters-toggle" aria-expanded={filtersOpen} aria-controls="atlas-filters-body" onClick={() => setFiltersOpen(value => !value)}>筛选条件</button>
      <div className="atlas-compact-filters-body" id="atlas-filters-body" data-open={filtersOpen}>
      <label>商品<select aria-label="选择商品" value={filters.product} onChange={event => navigate({ product: event.target.value, items: isTrade ? event.target.value : undefined, focus: undefined, year: undefined, country: undefined, direction: undefined, scope: undefined, currency: undefined, measure: undefined, unit: undefined, datasetVersion: undefined, contentVersion: undefined })}>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      {isTrade ? <details className="atlas-item-picker"><summary>选择统计物品 · {selectedItemIds.length}</summary><fieldset disabled={isPending}><legend>成品与上下游</legend>{selectableItems.map(item => <label key={item.id}><input type="checkbox" value={item.id} checked={selectedItemIds.includes(item.id)} disabled={selectedItemIds.length === 1 && selectedItemIds.includes(item.id)} onChange={event => toggleItem(item.id, event.target.checked)} /><i style={{backgroundColor:colorFor(item.id)}} aria-hidden="true" />{item.name}</label>)}</fieldset></details> : <label>部件 / 材料<select aria-label="选择部件或材料" value={filters.focus === filters.product ? "" : filters.focus ?? ""} onChange={event => navigate({ focus: event.target.value || undefined, items: undefined, year: undefined, country: undefined, scope: undefined })}><option value="">整件商品</option>{items.filter(item => item.id !== filters.product).map(item => <option key={item.id} value={item.id}>{`${"　".repeat(Math.max(0, item.depth - 1))}${item.name}`}</option>)}</select></label>}
      <label>年份<select aria-label="选择记录年度" value={selectedYear ?? ""} onChange={event => navigate({ year: event.target.value || undefined })}>{(!compareTrade || !selectedYear) && <option value="">{compareTrade ? "暂无年份" : "全部年份"}</option>}{selectedYear && !years.includes(selectedYear) && <option value={selectedYear}>{selectedYear} · 无记录</option>}{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      {compareTrade && currencies.length > 1 && <label>币种<select value={selectedCurrency} onChange={event => navigate({ currency: event.target.value })}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>}
      {compareTrade && !isWorld && <label>箭头粗细<select value={filters.measure ?? "amount"} onChange={event => navigate({ measure: event.target.value === "quantity" ? "quantity" : undefined, unit: undefined })}><option value="amount">金额</option><option value="quantity">数量</option></select></label>}
      {quantityMode && quantityUnits.length > 1 && <label>数量单位<select value={selectedUnit} onChange={event => navigate({ unit: event.target.value })}>{quantityUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label>}
      <label>国家<select aria-label="选择国家" value={filters.country ?? ""} onChange={event => navigate({ country: event.target.value || undefined })}><option value="">全部国家</option>{countries.map(country => <option key={country.id} value={country.id}>{country.name}{hasLayerRecords(country) ? "" : ` · ${coverageLabel(country)}`}</option>)}</select></label>
      {isTrade && <label>报告方向<select aria-label="报告方向" value={filters.direction ?? ""} onChange={event => navigate({ direction: event.target.value === "import" || event.target.value === "export" ? event.target.value : undefined })}><option value="">进出口</option><option value="export">出口</option><option value="import">进口</option></select></label>}
      <button type="button" className="flow-settings-open flow-settings-open--mobile" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>调节流动</button>
      </div>
      <div className="atlas-compact-filters-actions">
      <div className="flow-mode-controls" role="group" aria-label="流向渲染模式">
        <button type="button" aria-pressed={effectiveMode === "beam"} onClick={() => setFlowMode("beam")}>粒子流</button>
        <button type="button" aria-pressed={effectiveMode === "classic"} onClick={() => setFlowMode("classic")}>经典箭头</button>
        <button type="button" className="flow-settings-open" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>调节流动</button>
      </div>
      <button type="button" className="atlas-records-reopen--mobile" aria-label={`展开${isTrade ? "贸易" : "路线"}记录列表，共 ${records.length} 条`} onClick={() => setRecordsOpen(true)}><span>记录</span><strong>{records.length}</strong></button>
      <div className="map-zoom-controls" aria-label="地图缩放"><button type="button" onClick={() => setTransform(current => zoomMap(current, 1.25))} aria-label="放大地图" disabled={transform.scale >= 4}>＋</button><button type="button" onClick={() => setTransform(current => zoomMap(current, 0.8))} aria-label="缩小地图" disabled={transform.scale <= 1}>－</button><button type="button" aria-label="复位地图" onClick={() => setTransform(defaultTransform)}>复位</button><MapFocusButton label="世界地图"/></div>
      </div>
    </div>
    <div className="atlas-layout"><div className="atlas-canvas">
      <div className="map-viewport"><svg ref={svgRef} className="world-country-map" data-zoomed={transform.scale > 1} viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="xMidYMid slice" role="group" aria-labelledby="world-country-map-title" aria-describedby="world-country-map-description" onPointerDown={onPointerDown} onPointerMove={event => { onPointerMove(event); setPointer({ x: event.clientX, y: event.clientY }); }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onPointerLeave={() => setPointer(null)}>
        <title id="world-country-map-title">{isTrade ? isWorld ? "国家世界贸易总计地图" : "官方双边贸易统计地图" : "代表性路线地图"}</title>
        <desc id="world-country-map-description">选择国家查看相关记录。连线与列表均可通过鼠标或键盘打开详情。</desc>
        <defs>{[{id:"atlas-selected-arrow",fill:"#aee9db"},{id:"atlas-export-arrow",fill:"#8be4c4"},{id:"atlas-import-arrow",fill:"#d7b880"}].map(marker => <marker key={marker.id} id={marker.id} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth={9 / transform.scale} markerHeight={9 / transform.scale} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={marker.fill} /></marker>)}</defs>
        {compareTrade && <defs>{[...new Set(lines.map(line => line.itemId))].map(id => <marker key={id} id={`atlas-item-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth={9 / transform.scale} markerHeight={9 / transform.scale} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={colorFor(id)} /></marker>)}</defs>}
        {/* Oversized ocean fill: at country-zoom the 1:1 rect would end inside
            the viewport and leave a visible rectangle edge. */}
        <rect className="map-ocean" x={-mapWidth} y={-mapHeight} width={mapWidth * 3} height={mapHeight * 3} />
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`} data-country-focus={filters.country ? "on" : "off"}>
          <path className="atlas-graticule" d={pathGenerator(geoGraticule10()) ?? undefined} />
          {features.map((item, index) => {
            const code = String(item.id).padStart(3, "0");
            const featureKey = `${item.id ?? "unassigned"}:${index}`;
            const country = byM49.get(code);
            const isSelected = uncoveredCountry ? uncoveredCountry.featureKey === featureKey : Boolean(country && country.id === filters.country);
            const recordActive = activeRecord?.partnerScope === "world_total" && activeRecord.reporterId === country?.id;
            const name = country?.name ?? (item.properties as {name?:string} | null)?.name ?? "该国家或地区";
            return <path key={featureKey} d={pathGenerator(item as GeoPermissibleObjects) ?? undefined} className={`map-country-shape${country ? " has-data" : ""}${country && !hasLayerRecords(country) ? " atlas-country-limited" : ""}${isSelected ? " selected" : ""}${country && country.id === hoveredCountryId ? " hovered" : ""}${recordActive ? " atlas-record-country" : ""}`} role="button" aria-label={`${name} · ${country ? coverageLabel(country) : "当前商品未收录"}`} aria-pressed={isSelected} tabIndex={0} onMouseEnter={() => country && setHoveredCountryId(country.id)} onMouseLeave={() => setHoveredCountryId(null)} onFocus={() => country && setHoveredCountryId(country.id)} onBlur={() => setHoveredCountryId(null)} onClick={() => chooseCountry(country, name, featureKey)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); suppressClick.current = false; chooseCountry(country, name, featureKey); } }}><title>{`${name} · ${country ? coverageLabel(country) : "当前商品未收录"}`}</title></path>;
          })}
          {!isWorld && <g className="map-trade-layer" aria-label={isTrade ? "双边贸易观察" : "代表性路线连接"}>{displayLines.map((line, index) => {
            const from = centers.get(line.fromM49); const to = centers.get(line.toM49);
            if (!from || !to) return null;
            const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
            const pair = `${line.fromM49}:${line.toM49}`;
            const lane = parallelLines.get(pair) ?? 0;
            parallelLines.set(pair, lane + 1);
            const [cx, cy] = length < 1 ? [from[0] - 20, from[1] - 48] : arcControl(from, to, lane);
            const d = length < 1
              ? `M${coordinate(from[0])},${coordinate(from[1])} c${20 + index % 3 * 8},-48 ${-45 - index % 3 * 8},-48 0,0`
              : `M${coordinate(from[0])},${coordinate(from[1])} Q${coordinate(cx)},${coordinate(cy)} ${coordinate(to[0])},${coordinate(to[1])}`;
            const label = `${mapRecordTitle(line, countries)}，${line.itemName}，${line.periodLabel}${isTrade ? `，${mapValue(line.value, line.valueDataStatus, line.currency, true)}` : ""}`;
            const amountWidth = isTrade && widthUnit ? quantityMode ? tradeAmountWidth(line.quantity, line.quantityDataStatus) : tradeAmountWidth(line.value, line.valueDataStatus) : null;
            return <g key={line.id} className={`country-trade-line country-trade-${line.direction ?? "route"}${filters.country && (line.fromCountryId === filters.country || line.toCountryId === filters.country) ? " is-focus" : ""}${activeRecord?.id === line.id ? " is-active" : ""}${activeRecord && activeRecord.id !== line.id ? " is-muted" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selectedRecordId === line.id} onMouseEnter={() => setHoveredRecordId(line.id)} onMouseLeave={() => setHoveredRecordId(null)} onFocus={() => setHoveredRecordId(line.id)} onBlur={() => setHoveredRecordId(null)} onClick={() => chooseRecord(line.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); suppressClick.current = false; chooseRecord(line.id); } }}><path className="atlas-line-hit" d={d} vectorEffect="non-scaling-stroke" /><path className="atlas-line-visible" d={d} vectorEffect="non-scaling-stroke" style={isTrade ? {strokeWidth: amountWidth ?? 1.4, stroke: compareTrade ? colorFor(line.itemId) : undefined, strokeDasharray: compareTrade ? amountWidth === null ? "4 4" : "none" : undefined} : undefined} markerEnd={beamActive ? undefined : compareTrade ? `url(#atlas-item-${line.itemId})` : isTrade ? `url(#atlas-${line.direction}-arrow)` : activeRecord?.id === line.id ? "url(#atlas-selected-arrow)" : undefined}><title>{label}</title></path></g>;
          })}</g>}
          {[...endpoints].map(code => { const point = centers.get(code); const country = byM49.get(code); if (!point || !country) return null; return <g className="atlas-endpoint" key={code} transform={`translate(${coordinate(point[0])},${coordinate(point[1])})`}><circle r={5 / transform.scale} /></g>; })}
        </g>
        {!beamActive && <g className="atlas-country-labels" aria-hidden="true">{renderLabels()}{renderFlowLabels()}</g>}
      </svg>
      {beamActive && <StraightFlowLayer flows={beamFlows} transform={transform} mapWidth={mapWidth} renderedWidth={renderedWidth} reducedMotion={reducedMotion} onDiagnostics={handleDiagnostics} onFrameSample={handleFrameSample} />}
      {beamActive && <svg className="atlas-label-overlay" viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g className="atlas-country-labels">{renderLabels()}{renderFlowLabels()}</g></svg>}
      {filters.country && <MapFocusFilters state={focusFilters} onChange={setFocusFilters} kept={displayLines.length} total={visibleLines.length} countryName={focusedCountryName} />}
      <div className="atlas-map-caption"><span>{beamActive ? "粒子沿货物流向移动 · 双指缩放与移动" : "双指缩放与移动 · 放大后鼠标拖动"}</span></div>
      {activeCountry && hoveredCountryId && pointer && (
        <div className="atlas-hover-tip" style={{ left: pointer.x + 14, top: pointer.y + 16 }} role="status">
          <strong>{activeCountry.name}</strong>
          <em>{coverageLabel(activeCountry)}</em>
          {lines.filter(line => line.fromCountryId === activeCountry.id || line.toCountryId === activeCountry.id).sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0)).slice(0, 2).map(line => (
            <span key={line.id}>{mapRecordTitle(line, countries)} · {mapValue(line.value, line.valueDataStatus, line.currency, true)}</span>
          ))}
          <small>点击聚焦该国</small>
        </div>
      )}</div>
      {isTrade && timelineYears.length > 1 && timeIndex >= 0 && (
        <div className="trade-timeline">
          <span className="trade-timeline-head">
            <button type="button" className="trade-play" aria-pressed={playing} aria-label={playing ? "暂停年份播放" : "播放年份变化"} disabled={timelineYears.length < 2} onClick={() => setPlaying(value => !value)}>{playing ? "❚❚" : "▶"}</button>
            <span>贸易时间轴 <strong>{activeTimelineYear}</strong></span>
          </span>
          <span className="trade-timeline-track">
            <small>{timelineYears[0]}</small>
            <input type="range" aria-label="贸易年份" aria-valuetext={activeTimelineYear + " 年"} min={0} max={timelineYears.length - 1} step={1} value={timelineIndex}
              onChange={event => { setPlaying(false); const year = timelineYears[event.currentTarget.valueAsNumber]; if (!year) return; setTimelineYear(year); navigate({ year }); }} />
            <small>{timelineYears[timelineYears.length - 1]}</small>
          </span>
        </div>
      )}
      {isTrade && timelineYears.length === 1 && (
        <p className="trade-timeline trade-timeline--single"><span>{captionDescription}</span><span>该商品仅收录 {timelineYears[0]} 年</span></p>
      )}
      <div className="atlas-below-map">{!(isTrade && timelineYears.length === 1) && <p className="atlas-caption-note">{captionDescription}</p>}<div className="map-legend">{compareTrade ? selectedItemIds.map(id => <button type="button" className="atlas-item-chip" disabled={selectedItemIds.length === 1 || isPending} key={id} onClick={() => toggleItem(id, false)} aria-label={`移除${items.find(item => item.id === id)?.name ?? id}`}><i style={{backgroundColor: colorFor(id), border: "1px solid #576978"}} />{items.find(item => item.id === id)?.name ?? id}{selectedItemIds.length > 1 ? " ×" : ""}</button>) : isTrade && !isWorld ? <><span><i className="legend-trade-export" />出口报告</span><span><i className="legend-trade-import" />进口报告</span></> : null}<span><i className="legend-country-covered" />{isTrade ? "有统计" : "参与代表性路线"}</span><span><i className="legend-country-limited" />仅有账本</span></div><Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>展开代表性路线 →</Link></div>
      {isTrade && !isWorld && lines.length > 0 && <details className="atlas-amount-key"><summary>{widthUnit ? `线宽按${quantityMode ? "数量" : "金额"}分档 · ${widthUnit}` : quantityMode ? "所选记录暂无同单位数量" : "选择同年同币种查看金额线宽"}</summary>{widthUnit && <div>{tradeAmountBands.map(band => <span key={band.minimum}><i style={{borderTopWidth:band.width}} />{band.label} {widthUnit}</span>)}</div>}<p>箭头表示货物流向；每条记录保留原年度、报告方和商品分类，不合并加总。未收录数值使用细线或虚线，具体金额与状态见记录。</p></details>}

      {!uncoveredCountry && activeCountry && <div className="atlas-country-context"><strong>{activeCountry.name}</strong>{activeCountry.roles.length > 0 && <span>{activeCountry.roles.slice(0, 2).join(" / ")}</span>}{regionalLinks.filter(link=>link.entityId===activeCountry.id).map(link=><Link key={link.href} className="button button-primary" href={link.href}>{link.label} →</Link>)}{activeCountry.hasTradeLedger && <Link href={ledgerPath(filters.product, activeCountry.id, context)}>国家账本 →</Link>}{filters.country && <button type="button" onClick={() => navigate({ country: undefined })}>清除国家</button>}</div>}
      {!uncoveredCountry && activeNodes.length > 0 && <details className="atlas-country-nodes"><summary>{activeCountry?.name}的生产环节 · {activeNodes.length}</summary><div>{activeNodes.map(node => <Link key={node.id} href={nodePath(filters.product, node.id, { ...context, period: node.periodLabel })}><strong>{node.itemName} · {node.stageLabel}</strong><span>{node.periodLabel}</span></Link>)}</div></details>}
    </div><aside className={`atlas-records records-drawer${recordsOpen ? " is-open" : " is-closed"}`} data-open={recordsOpen} aria-label={isTrade ? "贸易记录" : "路线连接记录"}>
      <div className="atlas-records-bar">
        <button type="button" className="atlas-records-toggle" aria-expanded={recordsOpen} aria-controls="atlas-records-panel" onClick={() => setRecordsOpen(value => !value)}><span>{recordsOpen ? "收起记录" : "展开记录"}</span><small>{records.length}</small></button>
      </div>
      <div id="atlas-records-panel" className="atlas-records-panel">
      <button type="button" className="mobile-map-return" onClick={() => svgRef.current?.scrollIntoView({ block: "center" })}>↑ 返回地图</button>
      <div className="atlas-records-heading"><h2>{compareTrade && selectedItemIds.length > 1 ? "所选物品" : compareTrade ? items.find(item => item.id === selectedItemIds[0])?.name ?? selectedItemName : isTrade && relatedMaterials.length ? `${selectedItemName}相关材料` : selectedItemName} <small>{records.length}</small></h2>
        {isTrade ? <div className="atlas-scope-switch" aria-label="统计范围"><button type="button" aria-pressed={!isWorld} onClick={() => navigate({ scope: "bilateral" })}>双边 <small>{scopeCounts.bilateral}</small></button><button type="button" aria-pressed={isWorld} onClick={() => navigate({ scope: "world" })}>世界总计 <small>{scopeCounts.world}</small></button></div> : <p>{filters.focus ? "上下游分支" : "原料、部件与市场"} · {filters.year ?? years.join(" / ")}</p>}
      </div>
      {uncoveredCountry ? <div className="atlas-empty" role="status"><strong>{uncoveredCountry.name}</strong><p>当前商品在此地区的资料尚未收录。</p><button type="button" onClick={() => setUncoveredCountry(null)}>返回已有记录</button></div> : <>
        {isTrade && relatedMaterials.length > 0 && <div className="atlas-related-items">{relatedMaterials.map(item => <button type="button" key={item.id} onClick={() => navigate({ focus: item.id, year: undefined, country: undefined, scope: undefined })}>{item.name}</button>)}</div>}
        <div className="atlas-record-list">{records.map(record => <button type="button" key={record.id} className={`atlas-record atlas-record-${record.direction ?? "route"}`} aria-label={`${mapRecordTitle(record, countries)}，${record.itemName}，${record.periodLabel}`} onClick={() => { suppressClick.current = false; chooseRecord(record.id); }} onMouseEnter={() => setHoveredRecordId(record.id)} onMouseLeave={() => setHoveredRecordId(null)} onFocus={() => setHoveredRecordId(record.id)} onBlur={() => setHoveredRecordId(null)}><span className="atlas-record-route">{mapRecordTitle(record, countries)}</span><span className="atlas-record-item">{record.itemName}{record.stageLabel ? ` · ${record.stageLabel}` : ""}{record.classificationCode ? ` · HS ${record.classificationCode}` : ""}{mapMappingLabel(record.classificationMappingType) ? ` · ${mapMappingLabel(record.classificationMappingType)}` : ""}</span>{isTrade ? <strong>{mapValue(record.value, record.valueDataStatus, record.currency, true)}</strong> : null}<small>{record.periodLabel}{isTrade && record.partnerScope === "entity" ? ` · ${record.reporterName}${record.direction === "export" ? "出口" : "进口"}报告` : !isTrade && record.evidenceCode !== "representative" ? ` · ${mapEvidenceLabel(record.evidenceCode)}` : ""}</small></button>)}
          {records.length === 0 && <div className="atlas-empty"><strong>{isTrade && !hasFocusTradeCoverage ? `${selectedItemName}暂无贸易统计` : "当前筛选没有记录"}</strong><p>{!isTrade && nodes.length ? "可点击高亮国家查看已有路线环节。" : isTrade && !hasFocusTradeCoverage ? "可查看整件商品，或选择已收录统计的材料。" : `${selectedCountry?.name ?? selectedItemName}${filters.year ? ` · ${filters.year}` : ""}的${isTrade ? isWorld ? "世界总计" : "双边统计" : "路线"}尚未收录。`}</p>
            {isTrade && filters.focus && <button type="button" onClick={toProductStatistics}>查看{productName}统计</button>}
            {(filters.country || filters.year || filters.direction) && <button type="button" onClick={clearFilters}>清除国家、年份与方向</button>}
            {isTrade && (isWorld ? scopeCounts.bilateral : scopeCounts.world) > 0 && <button type="button" onClick={() => navigate({ scope: isWorld ? "bilateral" : "world" })}>查看{isWorld ? "双边记录" : "世界总计"}</button>}
            <Link className="text-link" href={supplyChainPath(filters.product, filters.focus, context)}>查看代表性路线 →</Link>
          </div>}
        </div>
        {isTrade && filters.focus && hasFocusTradeCoverage && <button className="atlas-to-product" type="button" onClick={toProductStatistics}>查看整件商品统计 →</button>}
      </>}
      </div>
    </aside>
    {!recordsOpen && <button type="button" className="atlas-records-reopen" aria-label={`展开${isTrade ? "贸易" : "路线"}记录列表，共 ${records.length} 条`} onClick={() => setRecordsOpen(true)}><span>记录</span><strong>{records.length}</strong></button>}
  </div>
    {selectedRecord && !uncoveredCountry && (
      <div className="record-drawer-backdrop" onClick={closeDetail}>
        <div ref={drawerPanelRef} className="record-drawer" role="dialog" aria-modal="true" aria-label="连线详情" tabIndex={-1} onClick={event => event.stopPropagation()}>
          <header className="record-drawer-header">
            <div className="atlas-detail-navigation">
              <button type="button" onClick={closeDetail}>← 返回记录</button>
              <span>{selectedIndex + 1} / {records.length}</span>
              <button type="button" aria-label="上一条记录" disabled={selectedIndex <= 0} onClick={() => selectAdjacentRecord(-1)}>←</button>
              <button type="button" aria-label="下一条记录" disabled={selectedIndex >= records.length - 1} onClick={() => selectAdjacentRecord(1)}>→</button>
            </div>
            <button type="button" className="record-drawer-close" aria-label="关闭详情" onClick={closeDetail}>×</button>
          </header>
          <MapRecordDetails record={selectedRecord} countries={countries} productId={filters.product} context={context} />
        </div>
      </div>
    )}
    <FlowSettingsDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      settings={settings}
      flowMode={flowMode}
      reducedMotion={reducedMotion}
      onModeChange={setFlowMode}
      onSettingsChange={patch => updateFlowSettings(patch)}
      onReset={resetFlowSettings}
      onExport={exportConfig}
      onImport={importConfig}
    />
  </section></MapFocus>;
}
