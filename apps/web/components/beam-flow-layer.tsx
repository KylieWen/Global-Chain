"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MapTransform } from "../lib/map-geometry";
import { allocateParticles, LEVEL_GLOW_SCALE, LEVEL_PARTICLE_SCALE, LEVEL_TRAIL_SCALE, type AdaptiveLevel } from "../lib/flow-encoding";
import type { FlowSettings } from "../lib/flow-config";

export type BeamFlowState = "active" | "muted" | "normal";

export type BeamFlow = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  control: readonly [number, number];
  color: string;
  factor: number;
  width: number;
  state: BeamFlowState;
};

export type BeamDiagnostics = {
  particleCount: number;
  level: AdaptiveLevel;
  cap: number;
};

type Particle = {
  t: number;
  speed: number;
  lane: number;
  prevX: number;
  prevY: number;
  started: boolean;
};

type Pool = {
  flow: BeamFlow;
  particles: Particle[];
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 540;
const TAU = Math.PI * 2;

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

/**
 * Canvas2D particle beam layer. The SVG keeps country geometry, hit targets,
 * labels and the classic static arcs; this overlay only draws moving particles.
 * It is pointer-transparent and stays in the same 1000×540 map coordinate space,
 * so panning and zooming transform the particles exactly like the SVG group.
 */
export function BeamFlowLayer({
  flows,
  transform,
  settings,
  level,
  nodeColor,
  onDiagnostics,
  onFrameSample
}: {
  flows: readonly BeamFlow[];
  transform: MapTransform;
  settings: FlowSettings;
  level: AdaptiveLevel;
  nodeColor: string;
  onDiagnostics?: (info: BeamDiagnostics) => void;
  onFrameSample?: (frameMs: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ flows, transform, settings, level, nodeColor });
  stateRef.current = { flows, transform, settings, level, nodeColor };

  const pools = useMemo<Pool[]>(() => {
    const scale = LEVEL_PARTICLE_SCALE[level];
    const cap = Math.max(0, Math.round(settings.maxParticles * scale));
    const counts = allocateParticles(flows, settings.density, cap);
    return flows.map(flow => {
      const count = counts.get(flow.id) ?? 0;
      const particles: Particle[] = Array.from({ length: count }, (_, index) => ({
        t: (index / Math.max(1, count)) + Math.random() * 0.2,
        speed: 0.75 + Math.random() * 0.5,
        lane: (Math.random() - 0.5) * flow.width,
        prevX: 0,
        prevY: 0,
        started: false
      }));
      return { flow, particles };
    });
  }, [flows, settings.density, settings.maxParticles, level]);

  const poolsRef = useRef(pools);
  poolsRef.current = pools;

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
      const { transform: mapTransform, settings: current, level: currentLevel, flows: currentFlows, nodeColor: currentNodeColor } = stateRef.current;
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
      const baseSpeed = current.speed / 6;
      const mutedActive = currentFlows.some(flow => flow.state !== "normal");

      let particleCount = 0;
      for (const pool of poolsRef.current) {
        const { flow, particles } = pool;
        if (flow.state === "muted" && mutedActive) continue;
        if (particles.length === 0) continue;

        const alpha = flow.state === "active" ? 1 : flow.state === "muted" ? 0.16 : 0.78;
        const radius = Math.max(0.6, flow.width * 0.5 * current.beamWidth);
        const trailAlpha = (0.22 + current.trail * 0.5) * trailScale;

        // Node convergence glow at both endpoints uses the neutral accent,
        // not the item flow color.
        if (glowScale > 0) {
          const glowRadius = flow.width * 1.7 * glowScale;
          const glowAlpha = Math.round(alpha * glowScale * 90).toString(16).padStart(2, "0");
          const glow = context.createRadialGradient(flow.from[0], flow.from[1], 0, flow.from[0], flow.from[1], glowRadius);
          glow.addColorStop(0, `${currentNodeColor}${glowAlpha}`);
          glow.addColorStop(1, `${currentNodeColor}00`);
          context.fillStyle = glow;
          context.beginPath();
          context.arc(flow.from[0], flow.from[1], glowRadius, 0, TAU);
          context.fill();
          const glowTo = context.createRadialGradient(flow.to[0], flow.to[1], 0, flow.to[0], flow.to[1], glowRadius);
          glowTo.addColorStop(0, `${currentNodeColor}${glowAlpha}`);
          glowTo.addColorStop(1, `${currentNodeColor}00`);
          context.fillStyle = glowTo;
          context.beginPath();
          context.arc(flow.to[0], flow.to[1], glowRadius, 0, TAU);
          context.fill();
        }

        for (const particle of particles) {
          particle.t += baseSpeed * particle.speed * (dt / 1000);
          if (particle.t >= 1) {
            particle.t -= 1;
            particle.started = false;
          }
          const [x, y] = bezier(flow, particle.t, particle.lane);
          const prev: readonly [number, number] = particle.started ? [particle.prevX, particle.prevY] : [x, y];

          context.strokeStyle = `${flow.color}${Math.round(trailAlpha * 255).toString(16).padStart(2, "0")}`;
          context.lineWidth = radius * 0.8;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(prev[0], prev[1]);
          context.lineTo(x, y);
          context.stroke();

          context.fillStyle = `${flow.color}${Math.round(alpha * 235).toString(16).padStart(2, "0")}`;
          context.beginPath();
          context.arc(x, y, radius * 0.6, 0, TAU);
          context.fill();

          particle.prevX = x;
          particle.prevY = y;
          particle.started = true;
          particleCount += 1;
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
