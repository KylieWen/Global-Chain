"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapTransform } from "../lib/map-geometry";
import {
  allocateParticles,
  LEVEL_GLOW_SCALE,
  LEVEL_PARTICLE_SCALE,
  LEVEL_TRAIL_SCALE,
  type AdaptiveLevel
} from "../lib/flow-encoding";
import { BUNDLE_BAND_FULL_CSS_PX, type FlowSettings } from "../lib/flow-config";
import type { BeamDiagnostics, BeamFlow } from "./beam-types";

/**
 * WebGL (three.js) primary beam renderer.
 *
 * Each trade flow renders as a packed bundle of thin static filaments (merged
 * triangle strips), moving lit particle heads with short trails, and additive
 * endpoint glow scaled by the aggregated flow strength. The overlay shares the
 * 1000×540 map coordinate space with the SVG; a slice-fit group reproduces the
 * SVG `preserveAspectRatio="xMidYMid slice"` framing so strands, hit targets
 * and endpoints stay aligned through pan, zoom, narrow framing and focus mode.
 *
 * Dark schemes use additive blending so filaments read as bright strands on
 * the ocean; light schemes switch to normal alpha compositing with a raised
 * alpha boost, so saturated filaments stay legible on a pale map without
 * compounding into dark bands.
 *
 * This module is dynamically imported by the orchestrator, so three stays out
 * of the SSR bundle and out of pages that do not render the map.
 */

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 540;
const STRIP_SAMPLES = 22;

type WebGLProps = {
  flows: readonly BeamFlow[];
  transform: MapTransform;
  settings: FlowSettings;
  level: AdaptiveLevel;
  nodeColor: string;
  scheme?: "dark" | "light";
  onDiagnostics?: (info: BeamDiagnostics) => void;
  onFrameSample?: (frameMs: number) => void;
  /** Called when the GL context is lost or cannot be initialised; the orchestrator falls back to Canvas2D. */
  onFallback?: () => void;
};

/** Probe whether a usable WebGL context can be created in this browser. */
export function probeWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Parse a #rrggbb color into sRGB 0..1 channels (shaders write straight to the sRGB framebuffer). */
function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    const color = new THREE.Color(hex);
    return [color.r, color.g, color.b];
  }
  return [
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255
  ];
}

type PreparedFlow = {
  flow: BeamFlow;
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  color: [number, number, number];
  bandWidth: number;
  /** Bundle silhouette full width in CSS px, driven by the amount-band profile. */
  bundleCssFull: number;
  factor: number;
  alpha: number;
};

type PreparedEndpoint = { x: number; y: number; degree: number; strength: number };

function prepareFlows(flows: readonly BeamFlow[], beamWidth: number): PreparedFlow[] {
  return flows.map(flow => {
    const bandIndex = flow.band ?? 0;
    const bundleCssFull = BUNDLE_BAND_FULL_CSS_PX[Math.max(0, Math.min(BUNDLE_BAND_FULL_CSS_PX.length - 1, bandIndex))];
    return {
      flow,
      p0: new THREE.Vector3(flow.from[0], flow.from[1], 0),
      p1: new THREE.Vector3(flow.control[0], flow.control[1], 0),
      p2: new THREE.Vector3(flow.to[0], flow.to[1], 0),
      color: hexToRgb(flow.color),
      bandWidth: flow.width * beamWidth,
      bundleCssFull,
      factor: flow.factor,
      alpha: flow.state === "active" ? 1 : flow.state === "muted" ? 0.18 : 0.9
    };
  });
}

function aggregateEndpoints(flows: readonly BeamFlow[]): PreparedEndpoint[] {
  const map = new Map<string, PreparedEndpoint>();
  const add = (point: readonly [number, number], factor: number) => {
    const key = `${Math.round(point[0])},${Math.round(point[1])}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { x: point[0], y: point[1], degree: 0, strength: 0 };
      map.set(key, entry);
    }
    entry.degree += 1;
    entry.strength += factor;
  };
  flows.forEach(flow => {
    add(flow.from, flow.factor);
    add(flow.to, flow.factor);
  });
  return [...map.values()];
}

function bezierAt(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    0
  );
}

/* -------------------------------------------------------------------------- */
/* Static bundle: merged triangle strips for halo, filaments and core.         */
/* -------------------------------------------------------------------------- */

type BundleGeometry = {
  positions: number[];
  colors: number[];
  alphas: number[];
  sides: number[];
  indices: number[];
};

/** Evenly spaced filament fractions across a bundle, -0.5…0.5. */
function filamentOffsets(factor: number): number[] {
  const count = Math.max(6, Math.min(16, Math.round(6 + factor * 10)));
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => index / (count - 1) - 0.5);
}

function appendStrip(
  bundle: BundleGeometry,
  flow: PreparedFlow,
  lane: number,
  halfWidth: number,
  alpha: number,
  color: [number, number, number]
): void {
  const { p0, p1, p2 } = flow;
  const base = bundle.positions.length / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let sample = 0; sample <= STRIP_SAMPLES; sample += 1) {
    const t = sample / STRIP_SAMPLES;
    bezierAt(p0, p1, p2, t, a);
    bezierAt(p0, p1, p2, Math.min(1, t + 0.015), b);
    const tangent = b.sub(a);
    const tangentLength = tangent.length() + 1e-6;
    const normal = new THREE.Vector3(-tangent.y / tangentLength, tangent.x / tangentLength, 0);
    a.x += normal.x * lane;
    a.y += normal.y * lane;

    left.copy(a).addScaledVector(normal, halfWidth);
    right.copy(a).addScaledVector(normal, -halfWidth);

    bundle.positions.push(left.x, left.y, 0, right.x, right.y, 0);
    bundle.colors.push(...color, ...color);
    bundle.alphas.push(alpha, alpha);
    bundle.sides.push(-1, 1);
  }

  for (let sample = 0; sample < STRIP_SAMPLES; sample += 1) {
    const l0 = base + sample * 2;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    bundle.indices.push(l0, r0, l1, r0, r1, l1);
  }
}

function buildBundle(flows: PreparedFlow[], filamentScale: number, dark: boolean, pxPerUnit: number): BundleGeometry {
  const bundle: BundleGeometry = { positions: [], colors: [], alphas: [], sides: [], indices: [] };
  for (const flow of flows) {
    const { factor, alpha: flowAlpha, color } = flow;
    if (flow.flow.state === "muted") continue;

    // Bundle silhouette half-width in map units, converted from the CSS-px band
    // profile so weak bundles stay ≥3px and adjacent bands keep the ≥1.6 ratio.
    const halfMap = (flow.bundleCssFull / 2) / Math.max(1, pxPerUnit);

    // Dark additive field: raised halo / filament / core alpha so weak green
    // and blue strands stay readable; light scheme keeps its normal-composite
    // alphas unchanged.
    const haloAlpha = dark ? 0.18 : 0.13;
    const filamentAlpha = dark ? 0.34 : 0.24;
    const coreAlpha = dark ? 0.82 : 0.68;

    // Wide faint halo that defines the bundle silhouette.
    appendStrip(bundle, flow, 0, halfMap * 0.95, haloAlpha * flowAlpha, color);

    // Dense thin filaments fanned across the bundle.
    const offsets = filamentOffsets(factor);
    const visibleFilaments = Math.max(1, Math.round(offsets.length * filamentScale));
    for (let index = 0; index < visibleFilaments; index += 1) {
      const lane = offsets[index] * halfMap;
      appendStrip(bundle, flow, lane, 0.32, filamentAlpha * flowAlpha, color);
    }

    // Bright narrow core along the centre.
    appendStrip(bundle, flow, 0, Math.max(0.3, halfMap * 0.12), coreAlpha * flowAlpha, color);
  }
  return bundle;
}

const BUNDLE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aSide;
  uniform float uBoost;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSide;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha * uBoost;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BUNDLE_FRAGMENT = /* glsl */ `
  uniform float uMode;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSide;
  void main() {
    float edge = 1.0 - abs(vSide) * 0.3;
    float a = vAlpha * edge;
    if (uMode > 0.5) {
      gl_FragColor = vec4(vColor, a);
    } else {
      gl_FragColor = vec4(vColor * a, a);
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Moving particle heads with short trails.                                    */
/* -------------------------------------------------------------------------- */

const PARTICLE_VERTEX = /* glsl */ `
  attribute vec3 iP0;
  attribute vec3 iP1;
  attribute vec3 iP2;
  attribute vec3 iColor;
  attribute vec4 iData;
  attribute float iBand;
  attribute float iTrail;
  uniform float uTime;
  uniform float uPxPerUnit;
  varying vec3 vColor;
  varying vec2 vUv;

  vec3 bezier(vec3 a, vec3 b, vec3 c, float t) {
    float u = 1.0 - t;
    return u * u * a + 2.0 * u * t * b + t * t * c;
  }

  void main() {
    float phase = iData.z;
    float speed = iData.y;
    float t = fract(phase + uTime * speed * 0.16);
    vec3 head = bezier(iP0, iP1, iP2, t);
    vec3 tail = bezier(iP0, iP1, iP2, max(0.0, t - iTrail * 0.05));

    vec2 chord = iP2.xy - iP0.xy;
    float cl = length(chord) + 1e-5;
    vec2 cn = vec2(-chord.y, chord.x) / cl;
    head.xy += cn * iData.x * iBand;
    tail.xy += cn * iData.x * iBand;

    vec2 axis = head.xy - tail.xy;
    float al = length(axis) + 1e-6;
    axis /= al;
    vec2 across = vec2(-axis.y, axis.x);

    vec3 world = head + vec3(
      axis * position.x * 2.0 * iTrail + across * position.y * 2.0 * iData.w * uPxPerUnit,
      0.0
    );

    vColor = iColor;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  uniform float uTrailAlpha;
  uniform float uHeadAlpha;
  uniform float uBoost;
  uniform float uMode;
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    float along = vUv.x;
    float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
    float headDisc = smoothstep(0.5, 0.0, length(vUv - vec2(0.5, 0.5)) * 2.0);
    float hotspot = smoothstep(0.18, 0.0, length(vUv - vec2(0.5, 0.5)) * 2.0);
    float a = (across * along * uTrailAlpha + headDisc * uHeadAlpha + hotspot * uHeadAlpha * 0.8) * uBoost;
    vec3 outColor = uMode > 0.5 ? vColor : mix(vColor, vec3(1.0), hotspot * 0.55);
    if (uMode > 0.5) {
      gl_FragColor = vec4(outColor, a);
    } else {
      gl_FragColor = vec4(outColor * a, a);
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Endpoint glow: radial gradient sprite plus a solid bright core dot.         */
/* -------------------------------------------------------------------------- */

const GLOW_VERTEX = /* glsl */ `
  attribute vec2 iPos;
  attribute float iScale;
  attribute float iAlpha;
  uniform float uTime;
  uniform float uPxPerUnit;
  varying vec2 vLocal;
  varying float vAlpha;
  void main() {
    vAlpha = iAlpha;
    vLocal = position.xy;
    // 2.4s breathe, ±12% (within the ≤15% spec); iScale is a CSS half-size.
    float breathe = 1.0 + 0.12 * sin(6.2831853 * uTime / 2.4);
    vec3 world = vec3(iPos + position.xy * iScale * breathe * uPxPerUnit, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBoost;
  uniform float uMode;
  varying vec2 vLocal;
  varying float vAlpha;
  void main() {
    float d = length(vLocal) * 2.0;
    float a = smoothstep(1.0, 0.0, d) * vAlpha * uBoost;
    if (uMode > 0.5) {
      gl_FragColor = vec4(uColor, a);
    } else {
      gl_FragColor = vec4(uColor * a, a);
    }
  }
`;

const CORE_VERTEX = /* glsl */ `
  attribute vec2 iPos;
  attribute float iScale;
  attribute float iAlpha;
  varying vec2 vLocal;
  varying float vAlpha;
  void main() {
    vAlpha = iAlpha;
    vLocal = position.xy;
    vec3 world = vec3(iPos + position.xy * iScale, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;

export function BeamWebGLLayer(props: WebGLProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(props);
  stateRef.current = props;
  const onFallbackRef = useRef(props.onFallback);
  onFallbackRef.current = props.onFallback;
  const pxPerUnitRef = useRef(1);

  const prepared = useMemo(() => {
    const flows = prepareFlows(props.flows, props.settings.beamWidth);
    const endpoints = aggregateEndpoints(props.flows);
    const scale = LEVEL_PARTICLE_SCALE[props.level];
    const cap = Math.max(0, Math.round(props.settings.maxParticles * scale));
    const counts = allocateParticles(props.flows, props.settings.density, cap);
    return { flows, endpoints, counts };
  }, [props.flows, props.settings.beamWidth, props.settings.density, props.settings.maxParticles, props.level]);

  const preparedRef = useRef(prepared);
  preparedRef.current = prepared;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let disposed = false;
    let raf = 0;
    let lastTime = 0;
    let frameEma = 16;
    let lastDiagnostics = 0;
    const cleanupFns: Array<() => void> = [];

    const fallback = () => { if (!disposed) onFallbackRef.current?.(); };

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch {
      fallback();
      return;
    }
    if (!renderer.getContext()) { fallback(); return; }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, MAP_WIDTH, 0, MAP_HEIGHT, -100, 100);
    const sliceGroup = new THREE.Group();
    const mapGroup = new THREE.Group();
    sliceGroup.add(mapGroup);
    scene.add(sliceGroup);

    const disposables: Array<{ dispose: () => void }> = [];

    const { flows, endpoints, counts } = preparedRef.current;
    const filamentScale = stateRef.current.level === 0 ? 1 : stateRef.current.level === 1 ? 0.75 : stateRef.current.level === 2 ? 0.45 : 0;
    const trailScale = LEVEL_TRAIL_SCALE[stateRef.current.level];
    const glowScale = LEVEL_GLOW_SCALE[stateRef.current.level];

    // Measure the map viewport up front so bundle CSS-px widths convert to map
    // units before the static strip geometry is baked.
    const hostRect = host.getBoundingClientRect();
    const initialSvg = host.ownerDocument.querySelector(".world-country-map");
    const initialRect = initialSvg?.getBoundingClientRect() ?? hostRect;
    const pxPerUnit = Math.max(1, initialRect.width / MAP_WIDTH);
    pxPerUnitRef.current = pxPerUnit;

    /* ---- Static bundle strips ------------------------------------------ */
    const bundleData = buildBundle(flows, filamentScale, stateRef.current.scheme !== "light", pxPerUnit);
    const bundleGeometry = new THREE.BufferGeometry();
    bundleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(bundleData.positions, 3));
    bundleGeometry.setAttribute("aColor", new THREE.Float32BufferAttribute(bundleData.colors, 3));
    bundleGeometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(bundleData.alphas, 1));
    bundleGeometry.setAttribute("aSide", new THREE.Float32BufferAttribute(bundleData.sides, 1));
    bundleGeometry.setIndex(bundleData.indices);

    const bundleMaterial = new THREE.ShaderMaterial({
      vertexShader: BUNDLE_VERTEX,
      fragmentShader: BUNDLE_FRAGMENT,
      uniforms: { uBoost: { value: 1 }, uMode: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const bundleMesh = new THREE.Mesh(bundleGeometry, bundleMaterial);
    bundleMesh.frustumCulled = false;
    mapGroup.add(bundleMesh);
    disposables.push(bundleGeometry, bundleMaterial);

    /* ---- Moving particle heads + trails --------------------------------- */
    const p0: number[] = [];
    const p1: number[] = [];
    const p2: number[] = [];
    const pColor: number[] = [];
    const pData: number[] = [];
    const pBand: number[] = [];
    const pTrail: number[] = [];
    let particleTotal = 0;

    flows.forEach(pf => {
      const count = counts.get(pf.flow.id) ?? 0;
      for (let i = 0; i < count; i += 1) {
        p0.push(pf.p0.x, pf.p0.y, pf.p0.z);
        p1.push(pf.p1.x, pf.p1.y, pf.p1.z);
        p2.push(pf.p2.x, pf.p2.y, pf.p2.z);
        pColor.push(...pf.color);
        const laneFraction = (i / Math.max(1, count) - 0.5) + (Math.random() - 0.5) * 0.08;
        const speed = 0.75 + Math.random() * 0.5;
        const phase = i / Math.max(1, count) + Math.random() * 0.2;
        // Half-width in CSS px: head diameter lands in the 1.2–1.8px spec band.
        const headHalfCss = 0.6 + pf.flow.factor * 0.3;
        pData.push(laneFraction, speed, phase, headHalfCss);
        pBand.push(pf.bandWidth);
        pTrail.push((2.5 + stateRef.current.settings.trail * 5) * trailScale);
        particleTotal += 1;
      }
    });

    const plane = new THREE.PlaneGeometry(1, 1);
    const particleGeometry = new THREE.InstancedBufferGeometry();
    particleGeometry.index = plane.index;
    particleGeometry.setAttribute("position", plane.getAttribute("position"));
    particleGeometry.setAttribute("uv", plane.getAttribute("uv"));
    particleGeometry.setAttribute("iP0", new THREE.InstancedBufferAttribute(new Float32Array(p0), 3));
    particleGeometry.setAttribute("iP1", new THREE.InstancedBufferAttribute(new Float32Array(p1), 3));
    particleGeometry.setAttribute("iP2", new THREE.InstancedBufferAttribute(new Float32Array(p2), 3));
    particleGeometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(new Float32Array(pColor), 3));
    particleGeometry.setAttribute("iData", new THREE.InstancedBufferAttribute(new Float32Array(pData), 4));
    particleGeometry.setAttribute("iBand", new THREE.InstancedBufferAttribute(new Float32Array(pBand), 1));
    particleGeometry.setAttribute("iTrail", new THREE.InstancedBufferAttribute(new Float32Array(pTrail), 1));
    particleGeometry.instanceCount = particleTotal;

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPxPerUnit: { value: 1 },
        uTrailAlpha: { value: 0.22 },
        uHeadAlpha: { value: 0.3 },
        uBoost: { value: 1 },
        uMode: { value: 0 }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
    particleMesh.frustumCulled = false;
    mapGroup.add(particleMesh);
    disposables.push(plane, particleGeometry, particleMaterial);

    /* ---- Endpoint glow gradient + core dot ---------------------------- */
    const glowPos: number[] = [];
    const glowScaleArr: number[] = [];
    const glowAlphaArr: number[] = [];
    const corePos: number[] = [];
    const coreScaleArr: number[] = [];
    const coreAlphaArr: number[] = [];

    endpoints.forEach(endpoint => {
      const degree = Math.min(endpoint.degree, 6);
      const strength = Math.min(1, endpoint.strength / 6);
      const dark = stateRef.current.scheme !== "light";
      // Spec glow radius 10–14 CSS px; iScale is a CSS half-size converted in
      // the shader by uPxPerUnit.
      const radiusCss = (10 + Math.min(4, degree * 0.5 + strength * 3)) * glowScale;
      glowPos.push(endpoint.x, endpoint.y);
      // Sprite plane spans 1×1 (half extents 0.5), so the scale attribute
      // carries the diameter to land at the CSS radius after uPxPerUnit.
      glowScaleArr.push(radiusCss * 2);
      glowAlphaArr.push((dark
        ? Math.min(0.75, 0.2 + degree * 0.09 + strength * 0.62)
        : Math.min(0.7, 0.14 + degree * 0.08 + strength * 0.5)) * stateRef.current.settings.glow * glowScale);
      corePos.push(endpoint.x, endpoint.y);
      coreScaleArr.push(dark
        ? 2.2 + strength * 1.0 + glowScale * 0.6
        : 2.0 + strength * 0.9 + glowScale * 0.6);
      coreAlphaArr.push(Math.min(1, (dark ? 0.72 : 0.6) + strength * 0.35));
    });

    const glowGeometry = new THREE.InstancedBufferGeometry();
    glowGeometry.index = plane.index;
    glowGeometry.setAttribute("position", plane.getAttribute("position"));
    glowGeometry.setAttribute("uv", plane.getAttribute("uv"));
    glowGeometry.setAttribute("iPos", new THREE.InstancedBufferAttribute(new Float32Array(glowPos), 2));
    glowGeometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(new Float32Array(glowScaleArr), 1));
    glowGeometry.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(new Float32Array(glowAlphaArr), 1));
    glowGeometry.instanceCount = endpoints.length;

    const glowColor = new THREE.Color(...hexToRgb(stateRef.current.nodeColor));
    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: { uColor: { value: glowColor }, uTime: { value: 0 }, uPxPerUnit: { value: 1 }, uBoost: { value: 1 }, uMode: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.frustumCulled = false;
    mapGroup.add(glowMesh);
    disposables.push(glowGeometry, glowMaterial);

    const coreGeometry = new THREE.InstancedBufferGeometry();
    coreGeometry.index = plane.index;
    coreGeometry.setAttribute("position", plane.getAttribute("position"));
    coreGeometry.setAttribute("uv", plane.getAttribute("uv"));
    coreGeometry.setAttribute("iPos", new THREE.InstancedBufferAttribute(new Float32Array(corePos), 2));
    coreGeometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(new Float32Array(coreScaleArr), 1));
    coreGeometry.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(new Float32Array(coreAlphaArr), 1));
    coreGeometry.instanceCount = endpoints.length;
    const coreMaterial = new THREE.ShaderMaterial({
      vertexShader: CORE_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: { uColor: { value: glowColor }, uBoost: { value: 1 }, uMode: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.frustumCulled = false;
    mapGroup.add(coreMesh);
    disposables.push(coreGeometry, coreMaterial);

    const resize = () => {
      const hostRect = host.getBoundingClientRect();
      // The SVG viewport (flex:1) excludes the caption strip that the absolute
      // overlay host also covers; slice-fit against the SVG box so strands,
      // endpoints and hit targets stay aligned through pan and zoom.
      const svg = host.ownerDocument.querySelector(".world-country-map");
      const rect = svg?.getBoundingClientRect() ?? hostRect;
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      pxPerUnitRef.current = Math.max(1, w / MAP_WIDTH);
      const dx = rect.left - hostRect.left;
      const dy = rect.top - hostRect.top;
      renderer!.setSize(w, h, false);
      renderer!.domElement.style.width = `${w}px`;
      renderer!.domElement.style.height = `${h}px`;
      // Match the Canvas2D fallback: the ortho camera maps the 1000×540 map
      // space straight onto the SVG viewport; only the map transform pans/zooms.
      sliceGroup.position.set(dx, dy, 0);
      sliceGroup.scale.set(1, 1, 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      fallback();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    cleanupFns.push(() => renderer?.domElement.removeEventListener("webglcontextlost", onContextLost));

    const draw = (time: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      if (document.hidden) { lastTime = time; return; }
      const dt = lastTime ? Math.min(50, time - lastTime) : 16;
      lastTime = time;
      frameEma = frameEma * 0.9 + dt * 0.1;
      stateRef.current.onFrameSample?.(frameEma);

      const { transform, settings, level } = stateRef.current;
      const isLight = stateRef.current.scheme === "light";
      const targetBlending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
      const boost = isLight ? 1.7 : 1.5;
      const mode = isLight ? 1 : 0;

      mapGroup.position.set(transform.x, transform.y, 0);
      mapGroup.scale.set(transform.scale, transform.scale, 1);

      bundleMaterial.uniforms.uBoost.value = boost;
      bundleMaterial.uniforms.uMode.value = mode;
      if (bundleMaterial.blending !== targetBlending) {
        bundleMaterial.blending = targetBlending;
        bundleMaterial.needsUpdate = true;
      }

      particleMaterial.uniforms.uTime.value = time / 1000;
      particleMaterial.uniforms.uPxPerUnit.value = pxPerUnitRef.current;
      particleMaterial.uniforms.uBoost.value = boost;
      particleMaterial.uniforms.uMode.value = mode;
      particleMaterial.uniforms.uTrailAlpha.value = isLight ? 0.42 : 0.52;
      particleMaterial.uniforms.uHeadAlpha.value = isLight ? 0.88 : 0.95;
      if (particleMaterial.blending !== targetBlending) {
        particleMaterial.blending = targetBlending;
        particleMaterial.needsUpdate = true;
      }

      glowMaterial.uniforms.uTime.value = time / 1000;
      glowMaterial.uniforms.uPxPerUnit.value = pxPerUnitRef.current;
      glowMaterial.uniforms.uBoost.value = boost;
      glowMaterial.uniforms.uMode.value = mode;
      coreMaterial.uniforms.uBoost.value = boost;
      coreMaterial.uniforms.uMode.value = mode;
      if (glowMaterial.blending !== targetBlending) {
        glowMaterial.blending = targetBlending;
        glowMaterial.needsUpdate = true;
      }
      if (coreMaterial.blending !== targetBlending) {
        coreMaterial.blending = targetBlending;
        coreMaterial.needsUpdate = true;
      }

      renderer!.render(scene, camera);

      if (time - lastDiagnostics > 500) {
        lastDiagnostics = time;
        stateRef.current.onDiagnostics?.({ particleCount: particleTotal, level, cap: settings.maxParticles });
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      cleanupFns.forEach(fn => fn());
      disposables.forEach(d => d.dispose());
      renderer?.dispose();
      if (renderer?.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
    // Rebuild when the flow set or allocation changes; transform/settings flow through stateRef.
  }, [prepared]);

  return <div ref={hostRef} className="beam-webgl-host" aria-hidden="true" />;
}
