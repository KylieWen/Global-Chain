"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ExplodedModel, ExplodedNode } from "../lib/exploded-model";
import { explodedColorIndex } from "../lib/exploded-model";
import { layoutExplodedBoxes, type ExplodedBox } from "../lib/exploded-layout";

type Tokens = {
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  surface: string;
  accent: string;
};

type Props = {
  model: ExplodedModel;
  palette: readonly string[];
  tokens: Tokens;
  selectedId: string | null;
  onSelect: (id: string) => void;
  explosion: number;
  reducedMotion: boolean;
};

type ProjectedBox = {
  box: ExplodedBox;
  node: ExplodedNode;
  screen: { x: number; y: number; w: number; h: number };
  depth: number;
  color: string;
};

const DEFAULT_YAW = -0.62;
const DEFAULT_PITCH = 0.42;
const MIN_PITCH = -0.6;
const MAX_PITCH = 1.15;

// Padding fraction kept around the fitted model; larger value leaves more margin.
const FIT_PAD_X = 0.08;
const FIT_PAD_Y = 0.1;
// Per-face brightness so the top / side / front read as separate planes.
const FACE_SHADE = [1, 0.74, 0.55] as const;

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((ch) => ch + ch).join("") : normalized;
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) return hex;
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ExplodedCanvasViewer({ model, palette, tokens, selectedId, onSelect, explosion, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });
  const camera = useRef({ yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const projectedRef = useRef<ProjectedBox[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const interaction = useRef<number>(0);

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const project = useCallback(() => {
    const boxes = layoutExplodedBoxes(model, explosion);
    const { yaw, pitch, zoom } = camera.current;
    const cx = size.width / 2;
    const cy = size.height / 2;

    // Fit the real projected bounding box into the viewport; zoom multiplies the fit.
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const toCamera = (x: number, y: number, z: number) => {
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosP - z1 * sinP;
      const z2 = y * sinP + z1 * cosP;
      return { x1, y2, z2 };
    };

    let minX = Infinity; let maxX = -Infinity;
    let minY = Infinity; let maxY = -Infinity;
    boxes.forEach((box) => {
      const [w, h, d] = box.size;
      const [ax, ay, az] = box.anchor;
      const corners = [
        toCamera(ax - w / 2, ay - h / 2, az - d / 2),
        toCamera(ax + w / 2, ay - h / 2, az - d / 2),
        toCamera(ax + w / 2, ay - h / 2, az + d / 2),
        toCamera(ax - w / 2, ay - h / 2, az + d / 2),
        toCamera(ax - w / 2, ay + h / 2, az - d / 2),
        toCamera(ax + w / 2, ay + h / 2, az - d / 2),
        toCamera(ax + w / 2, ay + h / 2, az + d / 2),
        toCamera(ax - w / 2, ay + h / 2, az + d / 2)
      ];
      for (const corner of corners) {
        minX = Math.min(minX, corner.x1); maxX = Math.max(maxX, corner.x1);
        minY = Math.min(minY, corner.y2); maxY = Math.max(maxY, corner.y2);
      }
    });
    const rawW = Math.max(maxX - minX, 1);
    const rawH = Math.max(maxY - minY, 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const fit = Math.min(
      (size.width - size.width * FIT_PAD_X * 2) / rawW,
      (size.height - size.height * FIT_PAD_Y * 2) / rawH
    );
    const scale = fit * zoom;

    const projectPoint = (x: number, y: number, z: number) => {
      const cam = toCamera(x, y, z);
      return { sx: cx + (cam.x1 - midX) * scale, sy: cy - (cam.y2 - midY) * scale, depth: cam.z2 };
    };

    const projected: ProjectedBox[] = [];
    boxes.forEach((box, id) => {
      const node = nodeById.get(id);
      if (!node) return;
      const [w, h, d] = box.size;
      const [ax, ay, az] = box.anchor;
      const corners = [
        projectPoint(ax - w / 2, ay - h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay - h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay - h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay - h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay + h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay + h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay + h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay + h / 2, az + d / 2)
      ];
      const xs = corners.map((c) => c.sx);
      const ys = corners.map((c) => c.sy);
      const depth = corners.reduce((sum, c) => sum + c.depth, 0) / corners.length;
      const color = palette[explodedColorIndex(model.nodes, id) % palette.length] ?? palette[0];
      projected.push({
        box,
        node,
        screen: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys)
        },
        depth,
        color
      });
    });
    projected.sort((a, b) => b.depth - a.depth);
    projectedRef.current = projected;
    return { projected, projectPoint };
  }, [model, explosion, nodeById, palette, size]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const { projected, projectPoint } = project();

    // Parent-to-child guide lines, drawn under the boxes.
    ctx.lineWidth = 1;
    for (const item of projected) {
      if (!item.box.parentId) continue;
      const parent = projected.find((candidate) => candidate.box.id === item.box.parentId);
      if (!parent) continue;
      const a = projectPoint(...parent.box.anchor);
      const b = projectPoint(...item.box.anchor);
      ctx.strokeStyle = tokens.line;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const item of projected) {
      const { box, node, screen, color } = item;
      const [w, h, d] = box.size;
      const [ax, ay, az] = box.anchor;
      const corners = [
        projectPoint(ax - w / 2, ay - h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay - h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay - h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay - h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay + h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay + h / 2, az - d / 2),
        projectPoint(ax + w / 2, ay + h / 2, az + d / 2),
        projectPoint(ax - w / 2, ay + h / 2, az + d / 2)
      ];
      const selected = selectedId === node.id;
      const hovered = hoveredId === node.id;
      const stroke = selected ? tokens.accent : hexToRgba(color, 0.95);
      const baseAlpha = selected ? 0.97 : hovered ? 0.94 : 0.9;

      // Top face (0,1,2,3), right face (1,2,6,5), left/front face (0,3,7,4).
      const faces = [
        [corners[0], corners[1], corners[2], corners[3]],
        [corners[1], corners[2], corners[6], corners[5]],
        [corners[0], corners[3], corners[7], corners[4]]
      ];
      faces.forEach((face, faceIndex) => {
        ctx.beginPath();
        ctx.moveTo(face[0].sx, face[0].sy);
        for (let i = 1; i < face.length; i += 1) ctx.lineTo(face[i].sx, face[i].sy);
        ctx.closePath();
        const shade = FACE_SHADE[faceIndex];
        ctx.fillStyle = hexToRgba(color, baseAlpha * shade);
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 2 : 1.2;
        ctx.stroke();
      });

      if (node.depth <= 1 || selected || hovered) {
        ctx.fillStyle = selected ? tokens.accent : tokens.inkSoft;
        ctx.font = `${selected ? 600 : 500} 11px var(--font-base)`;
        ctx.textAlign = "center";
        ctx.fillText(node.name, screen.x + screen.w / 2, screen.y - 6);
      }
    }
  }, [project, size, selectedId, hoveredId, tokens]);

  // Redraw on state/theme/size changes; reduced motion skips the idle animation loop.
  useEffect(() => {
    draw();
  }, [draw, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    const loop = () => {
      const idle = Date.now() - interaction.current > 2600;
      if (idle) camera.current.yaw += 0.0016;
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [draw, reducedMotion]);

  const pick = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hits = projectedRef.current.filter((item) =>
      x >= item.screen.x - 4 && x <= item.screen.x + item.screen.w + 4 &&
      y >= item.screen.y - 10 && y <= item.screen.y + item.screen.h + 4
    );
    return hits.length > 0 ? hits[0].box.id : null;
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    interaction.current = Date.now();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (current) {
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) current.moved = true;
      if (current.moved) {
        camera.current.yaw += dx * 0.008;
        camera.current.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, camera.current.pitch + dy * 0.006));
        interaction.current = Date.now();
        drag.current = { x: event.clientX, y: event.clientY, moved: true };
        draw();
        return;
      }
    }
    const hit = pick(event.clientX, event.clientY);
    setHoveredId(hit);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.moved) {
      const hit = pick(event.clientX, event.clientY);
      if (hit) onSelect(hit);
    }
  };

  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    interaction.current = Date.now();
    const next = camera.current.zoom * (event.deltaY < 0 ? 1.1 : 0.9);
    camera.current.zoom = Math.min(2.6, Math.max(0.55, next));
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const resetView = () => {
    camera.current = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1 };
    interaction.current = Date.now();
    draw();
  };

  return (
    <div className="exploded-canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: size.width, height: size.height }}
        role="img"
        aria-label="程序化拆解爆炸图：拖动旋转，滚轮缩放，点击部件查看详情"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoveredId(null)}
      />
      <div className="exploded-view-controls">
        <button type="button" className="button button-secondary exploded-reset" onClick={resetView}>重置视角</button>
        <span className="exploded-hint">拖动旋转 · 滚轮缩放 · 点击部件</span>
      </div>
    </div>
  );
}
