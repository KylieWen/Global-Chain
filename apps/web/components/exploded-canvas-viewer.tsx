"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ExplodedModel, ExplodedNode } from "../lib/exploded-model";
import { layoutExplodedBoxes, type ExplodedBox } from "../lib/exploded-layout";
import { resolveNodeRole, schemeMaterials, type ResolvedRole } from "../lib/exploded-appearance";

export type ExplodedViewerHandle = {
  resetView: () => void;
};

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
  productId: string;
  scheme: "dark" | "light";
  tokens: Tokens;
  selectedId: string | null;
  onSelect: (id: string) => void;
  explosion: number;
  reducedMotion: boolean;
};

type ProjectedPoint = { sx: number; sy: number; depth: number };

type ProjectedBox = {
  box: ExplodedBox;
  node: ExplodedNode;
  role: ResolvedRole;
  screen: { x: number; y: number; w: number; h: number };
  depth: number;
  closeness: number;
  baseColor: string;
};

const DEFAULT_YAW = 0.16;
const DEFAULT_PITCH = 0.14;
const MIN_PITCH = -0.6;
const MAX_PITCH = 1.15;

// Padding fraction kept around the fitted body; the main device fills most of
// the canvas height. Material chips are positioned beside the body and are
// excluded from the fit bounding box so they never shrink the device.
const FIT_PAD_X = 0.08;
const BODY_FIT_HEIGHT = 0.78;
// Per-face brightness so the top / side / front read as separate planes under one light.
const FACE_SHADE = [1.07, 0.82, 0.64] as const;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function shadeColor(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = factor >= 1 ? 255 : 0;
  const mix = Math.min(1, Math.abs(factor - 1));
  const channel = (value: number) => Math.round(value + (target - value) * mix);
  return `rgb(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)})`;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export const ExplodedCanvasViewer = forwardRef<ExplodedViewerHandle, Props>(function ExplodedCanvasViewer({ model, productId, scheme, tokens, selectedId, onSelect, explosion, reducedMotion }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });
  const camera = useRef({ yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const projectedRef = useRef<ProjectedBox[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const interaction = useRef<number>(0);

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
  const materials = useMemo(() => schemeMaterials(scheme), [scheme]);

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
    const boxes = layoutExplodedBoxes(model, explosion, productId);
    const { yaw, pitch, zoom } = camera.current;
    const cx = size.width / 2;
    const cy = size.height / 2;

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
    const fitBoxes = [...boxes.values()].filter((box) => box.lane !== "material");
    fitBoxes.forEach((box) => {
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
      (size.height * BODY_FIT_HEIGHT) / rawH
    );
    const scale = fit * zoom;

    const projectPoint = (x: number, y: number, z: number): ProjectedPoint => {
      const cam = toCamera(x, y, z);
      return { sx: cx + (cam.x1 - midX) * scale, sy: cy - (cam.y2 - midY) * scale, depth: cam.z2 };
    };

    const projected: ProjectedBox[] = [];
    let depthMin = Infinity; let depthMax = -Infinity;
    const temp: ProjectedBox[] = [];

    boxes.forEach((box, id) => {
      const node = nodeById.get(id);
      if (!node) return;
      const role = resolveNodeRole(productId, node);
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
      depthMin = Math.min(depthMin, depth);
      depthMax = Math.max(depthMax, depth);
      temp.push({
        box,
        node,
        role,
        screen: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys)
        },
        depth,
        closeness: 0,
        baseColor: materials[role.material] ?? materials.material
      });
    });

    const depthSpan = Math.max(depthMax - depthMin, 1e-6);
    for (const item of temp) {
      projected.push({ ...item, closeness: (item.depth - depthMin) / depthSpan });
    }
    projected.sort((a, b) => a.depth - b.depth);
    projectedRef.current = projected;
    return { projected, projectPoint };
  }, [model, explosion, productId, nodeById, materials, size]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cosY = Math.cos(camera.current.yaw);
    const sinY = Math.sin(camera.current.yaw);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const { projected, projectPoint } = project();

    // Soft contact shadows on a shared ground plane, drawn under the parts.
    for (const item of projected) {
      const [w, , d] = item.box.size;
      const [ax, ay, az] = item.box.anchor;
      const ground = projectPoint(ax, ay + item.box.size[1] / 2, az);
      const rx = (w / 2) * size.width * 0.12;
      const ry = Math.max(3, d * size.height * 0.05);
      ctx.beginPath();
      ctx.ellipse(ground.sx, ground.sy + 6, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = scheme === "dark" ? "rgba(0, 0, 0, 0.22)" : "rgba(23, 35, 59, 0.12)";
      ctx.fill();
    }

    // Parent-to-child guide lines, drawn under the boxes.
    ctx.lineWidth = 1;
    for (const item of projected) {
      if (!item.box.parentId) continue;
      const parent = projected.find((candidate) => candidate.box.id === item.box.parentId);
      if (!parent) continue;
      const a = projectPoint(...parent.box.anchor);
      const b = projectPoint(...item.box.anchor);
      ctx.strokeStyle = tokens.line;
      ctx.globalAlpha = 0.22;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    for (const item of projected) {
      const { box, node, role, screen, baseColor } = item;
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
      const dimmed = selectedId !== null && !selected && !hovered;

      // Air perspective: farther layers sit slightly quieter; nearer parts stay crisp.
      const perspective = 0.72 + 0.28 * item.closeness;
      const stateAlpha = selected ? 0.98 : hovered ? 0.95 : dimmed ? 0.6 : 0.9;
      const baseAlpha = stateAlpha * perspective;

      // Visible faces chosen from the camera azimuth: top plus one x-side and
      // one z-side corner, so every solid reads as a closed extruded part.
      const sideXFaces = cosY >= 0
        ? [corners[1], corners[2], corners[6], corners[5]]
        : [corners[0], corners[3], corners[7], corners[4]];
      const sideZFaces = sinY >= 0
        ? [corners[3], corners[2], corners[6], corners[7]]
        : [corners[0], corners[1], corners[5], corners[4]];
      const faces = [
        [corners[0], corners[1], corners[2], corners[3]],
        sideXFaces,
        sideZFaces
      ];
      const stroke = selected ? tokens.accent : shadeColor(baseColor, 0.72);
      if (selected) {
        ctx.shadowColor = tokens.accent;
        ctx.shadowBlur = 10;
      }
      faces.forEach((face, faceIndex) => {
        ctx.beginPath();
        ctx.moveTo(face[0].sx, face[0].sy);
        for (let i = 1; i < face.length; i += 1) ctx.lineTo(face[i].sx, face[i].sy);
        ctx.closePath();
        ctx.fillStyle = withAlpha(shadeColor(baseColor, FACE_SHADE[faceIndex]), baseAlpha);
        ctx.fill();
        ctx.strokeStyle = withAlpha(stroke, selected ? 1 : 0.85);
        ctx.lineWidth = selected ? 2.2 : 1;
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      drawDecoration(ctx, corners, role, baseColor, materials, selected, scheme, sideZFaces, node.depth === 0);

      // Labels stay on the top-level bands (body, front glass/screen, battery,
      // rear cover); deeper parts appear only when hovered or selected.
      const showLabel = node.depth <= 1 || selected || hovered;
      if (showLabel && screen.w >= 28) {
        const above = node.depth === 0 || role.layer === "front";
        const nudge = role.layer === "rear" ? 16 : node.depth === 1 && role.layer === "mid" ? -12 : 0;
        const cx = screen.x + screen.w / 2 + nudge;
        const labelY = above ? screen.y - 10 : screen.y + screen.h + 14;
        ctx.strokeStyle = tokens.line;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, above ? screen.y : screen.y + screen.h);
        ctx.lineTo(cx, above ? labelY + 3 : labelY - 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = selected ? tokens.accent : tokens.inkSoft;
        ctx.font = `${selected ? 600 : 500} 11px var(--font-base, sans-serif)`;
        ctx.textAlign = "center";
        ctx.fillText(node.name, cx, labelY);
      }
    }
  }, [project, size, selectedId, hoveredId, tokens, materials, scheme]);

  // Redraw on state/theme/size changes; reduced motion skips the idle animation loop.
  useEffect(() => {
    draw();
  }, [draw, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    const loop = () => {
      const idle = Date.now() - interaction.current > 2600;
      if (idle) camera.current.yaw += 0.0012;
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

  const resetView = useCallback(() => {
    camera.current = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1 };
    interaction.current = Date.now();
    draw();
  }, [draw]);

  useImperativeHandle(ref, () => ({ resetView }), [resetView]);

  return (
    <div className="exploded-canvas-wrap" ref={wrapRef} data-renderer="canvas2d">
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
    </div>
  );
});

/** Local 2D point on the top face: u,v run from -0.5 (left/back) to 0.5 (right/front). */
function topPoint(corners: ProjectedPoint[], u: number, v: number): ProjectedPoint {
  const p0 = corners[0];
  const p1 = corners[1];
  const p3 = corners[3];
  return {
    sx: p0.sx + (p1.sx - p0.sx) * (0.5 + u) + (p3.sx - p0.sx) * (0.5 + v),
    sy: p0.sy + (p1.sy - p0.sy) * (0.5 + u) + (p3.sy - p0.sy) * (0.5 + v),
    depth: p0.depth
  };
}

/** Bilinear point on a side face: u left→right, v top→bottom. */
function facePoint(face: ProjectedPoint[], u: number, v: number): ProjectedPoint {
  const tl = face[0];
  const tr = face[1];
  const bl = face[3];
  return {
    sx: tl.sx + (tr.sx - tl.sx) * u + (bl.sx - tl.sx) * v,
    sy: tl.sy + (tr.sy - tl.sy) * u + (bl.sy - tl.sy) * v,
    depth: tl.depth
  };
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  corners: ProjectedPoint[],
  role: ResolvedRole,
  baseColor: string,
  materials: Readonly<Record<string, string>>,
  selected: boolean,
  scheme: "dark" | "light",
  zFace: ProjectedPoint[],
  isRoot: boolean
): void {
  const top = (u: number, v: number) => topPoint(corners, u, v);
  const chipColor = materials.chip ?? baseColor;

  switch (role.shape) {
    case "screen":
    case "glass":
    case "panel": {
      // Diagonal glass sheen across the top face.
      const a = top(-0.45, -0.45);
      const b = top(0.45, 0.45);
      const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
      grad.addColorStop(0, scheme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.35)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.02)");
      grad.addColorStop(1, scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.18)");
      ctx.beginPath();
      corners.slice(0, 4).forEach((c, i) => (i === 0 ? ctx.moveTo(c.sx, c.sy) : ctx.lineTo(c.sx, c.sy)));
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      break;
    }
    case "pcb":
    case "board-small": {
      // Traces and small solder pads.
      ctx.strokeStyle = withAlpha(shadeColor(baseColor, 1.35), 0.7);
      ctx.lineWidth = 1;
      const traces: [number, number, number, number][] = [
        [-0.4, -0.2, 0.1, -0.2],
        [0.1, -0.2, 0.1, 0.2],
        [-0.3, 0.25, 0.35, 0.25]
      ];
      for (const [u1, v1, u2, v2] of traces) {
        const p1 = top(u1, v1);
        const p2 = top(u2, v2);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
      const pad = top(-0.15, 0.05);
      ctx.fillStyle = withAlpha(chipColor, 0.9);
      ctx.beginPath();
      ctx.arc(pad.sx, pad.sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "chip": {
      const c = top(0, 0);
      ctx.fillStyle = withAlpha(chipColor, 0.95);
      ctx.strokeStyle = withAlpha(shadeColor(chipColor, 0.7), 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "wafer":
    case "lens":
    case "motor": {
      const c = top(0, 0);
      ctx.fillStyle = withAlpha(shadeColor(baseColor, 0.7), 0.9);
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, 3.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "camera-bump": {
      const island = top(0, 0);
      ctx.fillStyle = withAlpha(shadeColor(baseColor, 1.15), 0.95);
      ctx.beginPath();
      ctx.arc(island.sx, island.sy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      for (const [du, dv] of [[-0.12, -0.1], [0.12, 0.1]] as const) {
        const lens = top(du, dv);
        ctx.fillStyle = withAlpha(scheme === "dark" ? "#0b1220" : "#233149", 0.95);
        ctx.beginPath();
        ctx.arc(lens.sx, lens.sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "rear": {
      // Camera island on the visible broad face of the rear cover; lenses map to
      // the real camera BOM nodes rather than being added as separate parts.
      if (zFace.length === 4) {
        const island = facePoint(zFace, 0.3, 0.26);
        ctx.fillStyle = withAlpha(shadeColor(baseColor, 1.14), 0.95);
        ctx.beginPath();
        ctx.arc(island.sx, island.sy, 7, 0, Math.PI * 2);
        ctx.fill();
        for (const [du, dv] of [[-0.12, -0.1], [0.12, 0.1]] as const) {
          const lens = facePoint(zFace, 0.3 + du, 0.26 + dv);
          ctx.fillStyle = withAlpha(scheme === "dark" ? "#0b1220" : "#233149", 0.95);
          ctx.beginPath();
          ctx.arc(lens.sx, lens.sy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "battery-pack":
    case "battery-cell": {
      const tab = top(0.32, -0.32);
      ctx.fillStyle = withAlpha(shadeColor(baseColor, 1.3), 0.9);
      ctx.beginPath();
      ctx.arc(tab.sx, tab.sy, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "speaker": {
      ctx.fillStyle = withAlpha(shadeColor(baseColor, 0.7), 0.7);
      for (const [du, dv] of [[-0.15, 0], [0, 0], [0.15, 0]] as const) {
        const dot = top(du, dv);
        ctx.beginPath();
        ctx.arc(dot.sx, dot.sy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "frame":
    case "frame-part": {
      // Thin metal highlight along the top perimeter.
      ctx.strokeStyle = withAlpha(scheme === "dark" ? "#c7d3e4" : "#ffffff", selected ? 0.95 : 0.55);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      corners.slice(0, 4).forEach((c, i) => (i === 0 ? ctx.moveTo(c.sx, c.sy) : ctx.lineTo(c.sx, c.sy)));
      ctx.closePath();
      ctx.stroke();

      if (isRoot && role.shape === "frame" && zFace.length === 4) {
        // Inset front glass on the visible broad face so the root body reads as a device.
        const panel = [
          facePoint(zFace, 0.1, 0.08),
          facePoint(zFace, 0.9, 0.08),
          facePoint(zFace, 0.9, 0.92),
          facePoint(zFace, 0.1, 0.92)
        ];
        ctx.beginPath();
        ctx.moveTo(panel[0].sx, panel[0].sy);
        for (let i = 1; i < panel.length; i += 1) ctx.lineTo(panel[i].sx, panel[i].sy);
        ctx.closePath();
        ctx.fillStyle = withAlpha(materials.screen ?? baseColor, 0.96);
        ctx.fill();
        const sheen = ctx.createLinearGradient(panel[0].sx, panel[0].sy, panel[2].sx, panel[2].sy);
        sheen.addColorStop(0, scheme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.3)");
        sheen.addColorStop(0.55, "rgba(255,255,255,0.02)");
        sheen.addColorStop(1, "rgba(255,255,255,0.05)");
        ctx.fillStyle = sheen;
        ctx.fill();
        // Speaker slit near the top edge.
        const slit = [
          facePoint(zFace, 0.42, 0.035),
          facePoint(zFace, 0.58, 0.035),
          facePoint(zFace, 0.58, 0.06),
          facePoint(zFace, 0.42, 0.06)
        ];
        ctx.beginPath();
        ctx.moveTo(slit[0].sx, slit[0].sy);
        for (let i = 1; i < slit.length; i += 1) ctx.lineTo(slit[i].sx, slit[i].sy);
        ctx.closePath();
        ctx.fillStyle = withAlpha(scheme === "dark" ? "#0b1220" : "#233149", 0.9);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
}
