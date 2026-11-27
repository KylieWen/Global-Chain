"use client";

/**
 * Straight-lane pulse renderer (lab variant M, user-selected).
 *
 * Each trade flow is a thin straight chord between two country centres. The
 * amount drives three things through explicit functions: lane width, pulse
 * count and pulse speed. Pulses travel in trains of three, so a heavy lane
 * reads as a fast, dense stream and a thin lane as a slow trickle.
 *
 * Deliberately Canvas2D rather than additive WebGL: 60+ lanes meeting at one
 * hub would saturate into a white blob under additive blending.
 */
import { useEffect, useRef } from "react";
import type { MapTransform } from "../lib/map-geometry";
import { particleSpeed } from "../lib/flow-encoding";
import type { BeamFlow } from "./beam-flow-layer";

type Props = {
  flows: readonly BeamFlow[];
  transform: MapTransform;
  mapWidth: number;
  renderedWidth: number;
  reducedMotion?: boolean;
  onDiagnostics?: (info: { particleCount: number; level: number; cap: number }) => void;
  onFrameSample?: (frameMs: number) => void;
};

type Pulse = { t: number; speed: number; train: number };

type Lane = {
  flow: BeamFlow;
  pulses: Pulse[];
};

const TRAIN = 3;
const TRAIN_GAP = 0.022;

/** Lane half-width in map units, a pure function of the mass factor. */
export function laneWidthFor(factor: number, zoomDamp: number): number {
  return (0.45 + factor * 1.5) * zoomDamp;
}

/** Pulse count, a pure function of the mass factor. */
export function pulseCountFor(factor: number): number {
  return Math.max(1, Math.round(1 + Math.pow(Math.max(0, factor), 1.5) * 5));
}

function buildLanes(flows: readonly BeamFlow[]): Lane[] {
  return flows.map(flow => {
    const count = pulseCountFor(flow.factor) * TRAIN;
    const trains = Math.max(1, Math.ceil(count / TRAIN));
    const speed = particleSpeed(flow.factor);
    const pulses: Pulse[] = Array.from({ length: count }, (_, index) => ({
      t: (Math.floor(index / TRAIN) + Math.random() * 0.12) / trains + (index % TRAIN) * TRAIN_GAP,
      speed,
      train: Math.floor(index / TRAIN)
    }));
    return { flow, pulses };
  });
}

export function StraightFlowLayer({ flows, transform, mapWidth, renderedWidth, reducedMotion, onDiagnostics, onFrameSample }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lanesRef = useRef<Lane[]>([]);
  const flowsKeyRef = useRef("");
  const diagnosticsRef = useRef(onDiagnostics);
  const frameSampleRef = useRef(onFrameSample);
  diagnosticsRef.current = onDiagnostics;
  frameSampleRef.current = onFrameSample;

  useEffect(() => {
    const key = flows.map(flow => `${flow.id}:${flow.factor}`).join("|");
    if (key !== flowsKeyRef.current) {
      flowsKeyRef.current = key;
      lanesRef.current = buildLanes(flows);
      const particleCount = lanesRef.current.reduce((sum, lane) => sum + lane.pulses.length, 0);
      diagnosticsRef.current?.({ particleCount, level: 0, cap: particleCount });
    }
  }, [flows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let sampleTick = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      sampleTick += 1;
      if (sampleTick % 30 === 0) frameSampleRef.current?.(now - last);
      last = now;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? canvas.clientWidth;
      const height = parent?.clientHeight ?? canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const unit = (renderedWidth || width) / mapWidth;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      const zoomDamp = 1 / Math.max(1, Math.pow(transform.scale, 0.55));
      context.setTransform(
        unit * transform.scale * dpr, 0, 0, unit * transform.scale * dpr,
        unit * transform.x * dpr, unit * transform.y * dpr
      );

      lanesRef.current.forEach(lane => {
        const { flow } = lane;
        const faded = flow.state === "muted" ? 0.18 : 1;
        const alpha = Math.min(0.92, (0.18 + flow.factor * 0.5) * faded);
        const half = laneWidthFor(flow.factor, zoomDamp);
        const [fx, fy] = flow.from;
        const [tx, ty] = flow.to;
        const dx = tx - fx;
        const dy = ty - fy;
        const span = Math.hypot(dx, dy) || 1;

        // Base lane: a thin, straight ribbon whose width follows the amount.
        context.globalAlpha = alpha * 0.45;
        context.strokeStyle = flow.color;
        context.lineWidth = Math.max(0.7, half * 0.9);
        context.beginPath();
        context.moveTo(fx, fy);
        context.lineTo(tx, ty);
        context.stroke();

        // Pulse trains.
        const trailLen = (6 + flow.factor * 30) / (unit * transform.scale);
        context.globalAlpha = Math.min(1, alpha + 0.15);
        lane.pulses.forEach(pulse => {
          if (!reducedMotion) pulse.t += pulse.speed * dt * 0.22;
          if (pulse.t > 1.04) pulse.t -= 1.04;
          const t = Math.max(0, Math.min(1, pulse.t));
          const x = fx + dx * t;
          const y = fy + dy * t;
          // Fade pulses in and out near both endpoints, otherwise 60 lanes
          // meeting at one hub stack into a white smear.
          const edge = Math.min(t, 1 - t);
          const edgeAlpha = edge < 0.06 ? Math.max(0.12, edge / 0.06) : 1;
          // Short trail behind the head, brightest at the tip.
          const tailX = x - (dx / span) * Math.min(trailLen, span * 0.4);
          const tailY = y - (dy / span) * Math.min(trailLen, span * 0.4);
          context.strokeStyle = flow.color;
          context.lineWidth = Math.max(0.6, half * 0.8);
          context.globalAlpha = alpha * 0.5 * edgeAlpha;
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(x, y);
          context.stroke();
          context.globalAlpha = Math.min(1, (alpha + 0.25) * edgeAlpha);
          const radius = Math.max(0.9, (0.9 + flow.factor * 2.2) * zoomDamp);
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = "#f2fffb";
          context.fill();
        });
        context.globalAlpha = 1;
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [transform, mapWidth, renderedWidth, reducedMotion]);

  return <canvas ref={canvasRef} className="beams-canvas" aria-hidden="true" />;
}
