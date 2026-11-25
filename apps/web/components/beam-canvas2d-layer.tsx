"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MapTransform } from "../lib/map-geometry";
import { allocateParticles, LEVEL_GLOW_SCALE, LEVEL_PARTICLE_SCALE, LEVEL_TRAIL_SCALE, type AdaptiveLevel } from "../lib/flow-encoding";
import type { FlowSettings } from "../lib/flow-config";
import type { BeamDiagnostics, BeamFlow } from "./beam-types";

type Particle = {
  t: number;
  speed: number;
  /** Perpendicular offset as a fraction of the bundle width (-0.5…0.5). */
  laneFraction: number;
  prevX: number;
  prevY: number;
  started: boolean;
};

type Pool = {
  flow: BeamFlow;
  particles: Particle[];
  /** Evenly spaced filament offsets, fractions of the bundle width. */
  filaments: number[];
};

type Endpoint = {
  x: number;
  y: number;
  degree: number;
  /** Summed mass factor of the flows meeting here, drives glow strength. */
  strength: number;
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 540;
const TAU = Math.PI * 2;
const BEZIER_SAMPLES = 22;

function bezier(point: BeamFlow, t: number, lane: number): [number, number] {
  const [x0, y0] = point.from;
  const [x2, y2] = point.to;
  const [cx, cy] = point.control;
  const u = 1 - t;
  const x = u * u * x0 + 2 * u * t * cx + t * t * x2;
  const y = u * u * y0 + 2 * u * t * cy + t * t * y2;
  const dx = x2 - x0;
  const dy = y2 - y0;
  const length = Math.hypot(dx, dy) || 1;
  return [x + (-dy / length) * lane, y + (dx / length) * lane];
}

/** Append an alpha channel to a #rrggbb color; pass other colors through. */
function withAlpha(color: string, alpha: number): string {
  const clamped = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  const hex = clamped.toString(16).padStart(2, "0");
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${hex}` : color;
}

function traceBezier(context: CanvasRenderingContext2D, flow: BeamFlow): void {
  context.beginPath();
  for (let index = 0; index <= BEZIER_SAMPLES; index += 1) {
    const [x, y] = bezier(flow, index / BEZIER_SAMPLES, 0);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
}

/** Evenly spaced filament fractions across a bundle, -0.5…0.5. */
function filamentOffsets(factor: number): number[] {
  const count = Math.max(3, Math.min(12, Math.round(4 + factor * 8)));
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => index / (count - 1) - 0.5);
}

/**
 * Canvas2D fallback beam layer. Kept as the degradation path when WebGL is
 * unavailable, disabled by the force-fallback switch, or the adaptive level
 * drops past the WebGL tier. Same 1000×540 map coordinate space as the SVG.
 */
export function BeamCanvas2DLayer({
  flows,
  transform,
  settings,
  level,
  nodeColor,
  scheme = "dark",
  onDiagnostics,
  onFrameSample
}: {
  flows: readonly BeamFlow[];
  transform: MapTransform;
  settings: FlowSettings;
  level: AdaptiveLevel;
  nodeColor: string;
  scheme?: "dark" | "light";
  onDiagnostics?: (info: BeamDiagnostics) => void;
  onFrameSample?: (frameMs: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ flows, transform, settings, level, nodeColor, scheme });
  stateRef.current = { flows, transform, settings, level, nodeColor, scheme };

  const pools = useMemo<Pool[]>(() => {
    const scale = LEVEL_PARTICLE_SCALE[level];
    const cap = Math.max(0, Math.round(settings.maxParticles * scale));
    const counts = allocateParticles(flows, settings.density, cap);
    return flows.map(flow => {
      const count = counts.get(flow.id) ?? 0;
      const filaments = filamentOffsets(flow.factor);
      const particles: Particle[] = Array.from({ length: count }, (_, index) => {
        const filament = filaments[index % filaments.length] ?? 0;
        return {
          t: (index / Math.max(1, count)) + Math.random() * 0.2,
          speed: 0.75 + Math.random() * 0.5,
          laneFraction: filament + (Math.random() - 0.5) * 0.08,
          prevX: 0,
          prevY: 0,
          started: false
        };
      });
      return { flow, particles, filaments };
    });
  }, [flows, settings.density, settings.maxParticles, level]);

  const endpoints = useMemo<Endpoint[]>(() => {
    const map = new Map<string, Endpoint>();
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
  }, [flows]);

  const poolsRef = useRef(pools);
  poolsRef.current = pools;
  const endpointsRef = useRef(endpoints);
  endpointsRef.current = endpoints;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let raf = 0;
    let lastTime = 0;
    let frameEma = 16;
    let lastDiagnostics = 0;
    let disposed = false;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();

    const draw = (time: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      const { transform: mapTransform, settings: current, level: currentLevel, flows: currentFlows, nodeColor: currentNodeColor, scheme: currentScheme } = stateRef.current;
      const hidden = document.hidden;
      if (hidden) { lastTime = time; return; }

      const dt = lastTime ? Math.min(50, time - lastTime) : 16;
      lastTime = time;
      frameEma = frameEma * 0.9 + dt * 0.1;
      onFrameSample?.(frameEma);

      const scaleX = canvas.width / MAP_WIDTH;
      const scaleY = canvas.height / MAP_HEIGHT;
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      context.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      context.translate(mapTransform.x, mapTransform.y);
      context.scale(mapTransform.scale, mapTransform.scale);

      const glowScale = LEVEL_GLOW_SCALE[currentLevel];
      const trailScale = LEVEL_TRAIL_SCALE[currentLevel];
      const filamentScale = currentLevel === 0 ? 1 : currentLevel === 1 ? 0.75 : currentLevel === 2 ? 0.45 : 0;
      const baseSpeed = current.speed / 6;
      const mutedActive = currentFlows.some(flow => flow.state !== "normal");
      const light = currentScheme === "light";

      let particleCount = 0;
      for (const pool of poolsRef.current) {
        const { flow, particles, filaments } = pool;
        if (flow.state === "muted" && mutedActive) continue;

        const alpha = flow.state === "active" ? 1 : flow.state === "muted" ? 0.18 : 0.9;
        const bandWidth = flow.width * current.beamWidth;

        if (particles.length > 0 || flow.state !== "muted") {
          context.lineJoin = "round";
          context.lineCap = "round";

          const haloAlpha = light ? 0.08 : 0.11;
          context.strokeStyle = withAlpha(flow.color, haloAlpha * alpha);
          context.lineWidth = bandWidth * 1.9;
          traceBezier(context, flow);
          context.stroke();

          const visibleFilaments = Math.max(1, Math.round(filaments.length * filamentScale));
          const filamentAlpha = light ? 0.13 : 0.2;
          for (let index = 0; index < visibleFilaments; index += 1) {
            const fraction = filaments[index];
            const lane = fraction * bandWidth;
            context.strokeStyle = withAlpha(flow.color, filamentAlpha * alpha);
            context.lineWidth = 0.7;
            context.beginPath();
            for (let sample = 0; sample <= BEZIER_SAMPLES; sample += 1) {
              const [x, y] = bezier(flow, sample / BEZIER_SAMPLES, lane);
              if (sample === 0) context.moveTo(x, y);
              else context.lineTo(x, y);
            }
            context.stroke();
          }

          const coreAlpha = light ? 0.42 : 0.5;
          context.strokeStyle = withAlpha(flow.color, coreAlpha * alpha);
          context.lineWidth = Math.max(0.5, bandWidth * 0.18);
          traceBezier(context, flow);
          context.stroke();
        }

        if (particles.length === 0) continue;

        const radius = Math.min(0.7, Math.max(0.4, 0.42 + flow.factor * 0.24));
        const trailAlpha = ((light ? 0.26 : 0.32) + current.trail * (light ? 0.45 : 0.5)) * trailScale;

        for (const particle of particles) {
          particle.t += baseSpeed * particle.speed * (dt / 1000);
          if (particle.t >= 1) {
            particle.t -= 1;
            particle.started = false;
          }
          const lane = particle.laneFraction * bandWidth;
          const [x, y] = bezier(flow, particle.t, lane);
          const prev: readonly [number, number] = particle.started ? [particle.prevX, particle.prevY] : [x, y];

          context.strokeStyle = withAlpha(flow.color, trailAlpha * alpha);
          context.lineWidth = radius * 0.7;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(prev[0], prev[1]);
          context.lineTo(x, y);
          context.stroke();

          context.fillStyle = withAlpha(flow.color, (light ? 0.38 : 0.44) * alpha);
          context.beginPath();
          context.arc(x, y, radius, 0, TAU);
          context.fill();
          context.fillStyle = withAlpha(flow.color, Math.min(1, alpha * 0.96));
          context.beginPath();
          context.arc(x, y, radius * 0.6, 0, TAU);
          context.fill();

          particle.prevX = x;
          particle.prevY = y;
          particle.started = true;
          particleCount += 1;
        }
      }

      if (glowScale > 0) {
        const breathe = currentLevel === 3 ? 1 : 1 + 0.07 * Math.sin(time / 620);
        for (const endpoint of endpointsRef.current) {
          const degree = Math.min(endpoint.degree, 6);
          const strength = Math.min(1, endpoint.strength / 6);
          const baseRadius = (light ? 4.5 + degree * 1.4 + strength * 4.5 : 5.5 + degree * 1.6 + strength * 6) * current.glow * glowScale;
          const radius = baseRadius * breathe;
          if (radius <= 0.2) continue;
          const glowAlpha = (light
            ? Math.min(0.5, 0.08 + degree * 0.06 + strength * 0.18)
            : Math.min(0.55, 0.12 + degree * 0.07 + strength * 0.26)) * current.glow * glowScale;
          const gradient = context.createRadialGradient(endpoint.x, endpoint.y, 0, endpoint.x, endpoint.y, radius);
          gradient.addColorStop(0, withAlpha(currentNodeColor, glowAlpha));
          gradient.addColorStop(1, withAlpha(currentNodeColor, 0));
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(endpoint.x, endpoint.y, radius, 0, TAU);
          context.fill();

          context.fillStyle = currentNodeColor;
          context.beginPath();
          context.arc(endpoint.x, endpoint.y, 2.2 + glowScale * 0.6, 0, TAU);
          context.fill();
        }
      }

      if (time - lastDiagnostics > 500) {
        lastDiagnostics = time;
        onDiagnostics?.({ particleCount, level: currentLevel, cap: current.maxParticles });
      }
    };

    raf = requestAnimationFrame(draw);
    const onVisibility = () => { lastTime = 0; };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onDiagnostics, onFrameSample]);

  return <div ref={wrapperRef} className="beam-layer" aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
