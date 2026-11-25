"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import type * as THREE from "three";
import type { ExplodedModel, ExplodedNode } from "../lib/exploded-model";
import { layoutExplodedBoxes, type ExplodedBox } from "../lib/exploded-layout";
import {
  materialPBR,
  resolveNodeRole,
  schemeMaterials,
  shapeRadius,
  type ResolvedRole
} from "../lib/exploded-appearance";

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
  onFallback?: (reason: string) => void;
};

type MeshRecord = {
  mesh: THREE.Mesh;
  node: ExplodedNode;
  role: ResolvedRole;
  box: ExplodedBox;
};

type LabelRecord = {
  nodeId: string;
  side: "top" | "right" | "left" | "bottom";
  el: HTMLDivElement;
  line: SVGLineElement;
};

const DEFAULT_YAW = 0.78;
const DEFAULT_PITCH = 0.38;
const MIN_PITCH = -0.5;
const MAX_PITCH = 1.1;
const FOV = 35;
const FIT_MARGIN = 0.97;
const LABEL_MIN_GAP = 10;
const LABEL_OFFSET = 16;
const MATERIAL_GROUP_ORDER = ["copper", "aluminum", "rare", "ceramic", "carbon", "polymer", "material", "glass-mat", "chip"];
const MATERIAL_BAND_X = 1.12;
const MATERIAL_COL_GAP = 0.18;
const MATERIAL_ROW_GAP = 0.18;
const MATERIAL_NARROW_COLS = 3;

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

function roundedRectShape(THREE: typeof import("three"), w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + h - radius);
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  shape.lineTo(x + radius, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function buildGeometry(
  THREE: typeof import("three"),
  shape: ResolvedRole["shape"],
  size: readonly [number, number, number],
  group: string
): THREE.BufferGeometry {
  const [w, h, d] = size;
  const radius = shapeRadius(shape) * Math.min(w, h);
  const groupDepth: Record<string, number> = {
    metal: 0.03,
    "glass-mat": 0.035,
    polymer: 0.09,
    carbon: 0.06,
    ceramic: 0.04,
    material: 0.05
  };
  const depth = groupDepth[group] ?? d;
  const flatExtrude = new Set<ResolvedRole["shape"]>([
    "frame",
    "frame-part",
    "glass",
    "screen",
    "panel",
    "rear",
    "battery-pack",
    "pcb",
    "board-small",
    "chip",
    "wafer",
    "camera-bump",
    "sheet",
    "note"
  ]);
  if (flatExtrude.has(shape)) {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, w, h, radius), {
      depth: Math.max(depth, 0.03),
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 10
    });
    geo.translate(0, 0, -Math.max(depth, 0.03) / 2);
    return geo;
  }
  if (shape === "lens" || shape === "motor" || shape === "wheel") {
    return new THREE.CylinderGeometry(w / 2, w / 2, d, 24);
  }
  return new THREE.BoxGeometry(w, h, d);
}

export const ExplodedThreeViewer = forwardRef<ExplodedViewerHandle, Props>(
  function ExplodedThreeViewer(
    { model, productId, scheme, tokens, selectedId, onSelect, explosion, reducedMotion, onFallback },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const labelLayerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const stateRef = useRef<{
      renderer: THREE.WebGLRenderer | null;
      scene: THREE.Scene | null;
      camera: THREE.PerspectiveCamera | null;
      meshes: Map<string, MeshRecord>;
      labels: LabelRecord[];
      raf: number;
      yaw: number;
      pitch: number;
      distance: number;
      baseDistance: number;
      center: THREE.Vector3 | null;
      interaction: number;
      drag: { x: number; y: number; moved: boolean } | null;
      disposed: boolean;
      frameTimes: number[];
      warmupFrames: number;
      lastFrameTime: number | null;
      degraded: boolean;
      narrow: boolean;
      cleanup?: () => void;
      THREE: typeof import("three") | null;
    }>({
      renderer: null,
      scene: null,
      camera: null,
      meshes: new Map(),
      labels: [],
      raf: 0,
      yaw: DEFAULT_YAW,
      pitch: DEFAULT_PITCH,
      distance: 1,
      baseDistance: 1,
      center: null,
      interaction: Date.now(),
      drag: null,
      disposed: false,
      frameTimes: [],
      warmupFrames: 20,
      lastFrameTime: null,
      degraded: false,
      narrow: false,
      THREE: null
    });

    const selectedRef = useRef(selectedId);
    selectedRef.current = selectedId;
    const hoveredRef = useRef(hoveredId);
    hoveredRef.current = hoveredId;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onFallbackRef = useRef(onFallback);
    onFallbackRef.current = onFallback;

    const materials = useMemo(() => schemeMaterials(scheme), [scheme]);

    const placeMaterials = (boxes: Map<string, ExplodedBox>, narrow: boolean, rootBox: ExplodedBox | undefined) => {
      const materialBoxes = [...boxes.values()].filter((box) => box.lane === "material");
      if (materialBoxes.length === 0) return;
      const rootH = rootBox?.size[1] ?? 3;
      // Group material inputs by their physical material so the cluster reads as
      // grouped PBR samples instead of an even square grid.
      const groups = new Map<string, ExplodedBox[]>();
      materialBoxes.forEach((box) => {
        const node = model.nodes.find((n) => n.id === box.id);
        if (!node) return;
        const group = resolveNodeRole(productId, node).material;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(box);
      });
      const ordered = [...groups.keys()].sort(
        (a, b) => MATERIAL_GROUP_ORDER.indexOf(a) - MATERIAL_GROUP_ORDER.indexOf(b)
      );
      ordered.forEach((group, groupIndex) => {
        const list = groups.get(group)!;
        const groupH = (list.length - 1) * MATERIAL_ROW_GAP;
        list.forEach((box, rowIndex) => {
          if (narrow) {
            const col = rowIndex % MATERIAL_NARROW_COLS;
            const row = Math.floor(rowIndex / MATERIAL_NARROW_COLS);
            box.anchor = [
              (col - (MATERIAL_NARROW_COLS - 1) / 2) * 0.24,
              -(rootH / 2 + 0.28) - row * MATERIAL_ROW_GAP,
              0.12
            ];
          } else {
            box.anchor = [
              MATERIAL_BAND_X + groupIndex * MATERIAL_COL_GAP,
              (rootH / 2 - 0.18) - groupH / 2 + rowIndex * MATERIAL_ROW_GAP,
              -0.05 - groupIndex * 0.03
            ];
          }
        });
      });
    };

    const refreshPositions = () => {
      const state = stateRef.current;
      if (!state.scene) return;
      const host = hostRef.current;
      const narrow = host ? host.clientWidth < 600 : false;
      state.narrow = narrow;
      const boxes = layoutExplodedBoxes(model, explosion, productId);
      const rootBox = boxes.get(model.root.id);
      placeMaterials(boxes, narrow, rootBox);
      boxes.forEach((box, id) => {
        const record = state.meshes.get(id);
        if (record) {
          record.box = box;
          record.mesh.position.set(box.anchor[0], box.anchor[1], box.anchor[2]);
          // In narrow mode the material samples move to the DOM strip below
          // the stage; hide the 3D chips so the body cannot cover them.
          record.mesh.visible = !(box.lane === "material" && narrow);
        }
      });
    };

    useImperativeHandle(ref, () => ({
      resetView: () => {
        const state = stateRef.current;
        state.yaw = DEFAULT_YAW;
        state.pitch = DEFAULT_PITCH;
        state.distance = state.baseDistance;
        state.interaction = Date.now();
      }
    }), []);

    // Main WebGL bootstrap. Runs once on mount; three is dynamically imported so
    // it never enters the server-rendered bundle.
    useEffect(() => {
      const state = stateRef.current;
      const host = hostRef.current;
      if (!host) return;
      state.disposed = false;

      if (!webglAvailable()) {
        onFallbackRef.current?.("webgl-unavailable");
        return;
      }

      let cancelled = false;

      const bootstrap = async () => {
        let THREE: typeof import("three");
        try {
          THREE = await import("three");
        } catch {
          if (!cancelled && !state.disposed) onFallbackRef.current?.("import-failed");
          return;
        }
        if (cancelled || state.disposed) return;
        state.THREE = THREE;

        const width = host.clientWidth || 640;
        const height = host.clientHeight || 420;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);

        const hemisphere = new THREE.HemisphereLight(
          scheme === "dark" ? 0xbfd0e6 : 0xffffff,
          scheme === "dark" ? 0x1a2436 : 0xd8e0ea,
          scheme === "dark" ? 0.9 : 1.1
        );
        const key = new THREE.DirectionalLight(0xffffff, scheme === "dark" ? 1.9 : 2.1);
        key.position.set(2.5, 3.5, 4);
        const fill = new THREE.DirectionalLight(0x9fb6d8, scheme === "dark" ? 0.5 : 0.7);
        fill.position.set(-2.5, -1, -3);
        scene.add(hemisphere, key, fill);

        state.renderer = renderer;
        state.scene = scene;
        state.camera = camera;

        // Build meshes from the deterministic layout.
        const boxes = layoutExplodedBoxes(model, explosion, productId);
        const narrow = host ? host.clientWidth < 600 : false;
        state.narrow = narrow;
        placeMaterials(boxes, narrow, boxes.get(model.root.id));

        boxes.forEach((box, id) => {
          const node = model.nodes.find((n) => n.id === id);
          if (!node) return;
          const role = resolveNodeRole(productId, node);
          const pbr = materialPBR(role.material);
          const color = materials[role.material] ?? materials.material;
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            metalness: pbr.metalness,
            roughness: pbr.roughness,
            emissive: pbr.emissive ? new THREE.Color(pbr.emissive) : new THREE.Color(0x000000),
            emissiveIntensity: pbr.emissiveIntensity ?? 0,
            transparent: Boolean(pbr.transparent),
            opacity: pbr.opacity ?? 1
          });
          const geometry = buildGeometry(THREE, role.shape, box.size, role.material);
          const mesh = new THREE.Mesh(geometry, material);
          if (box.lane === "material") {
            mesh.scale.setScalar(0.75);
            mesh.visible = !narrow;
          }
          mesh.position.set(box.anchor[0], box.anchor[1], box.anchor[2]);
          mesh.userData.nodeId = id;
          mesh.userData.materialGroup = role.material;
          scene.add(mesh);
          state.meshes.set(id, { mesh, node, role, box });

          // Camera island: raised rounded bump with concentric bezel + glass lens.
          if (role.shape === "camera-bump" || role.shape === "rear") {
            const plateSize: [number, number, number] = role.shape === "rear" ? [0.52, 0.52, 0.05] : [0.5, 0.5, 0.13];
            const plateGeo = new THREE.ExtrudeGeometry(
              roundedRectShape(THREE, plateSize[0], plateSize[1], 0.1),
              { depth: plateSize[2], bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, curveSegments: 10 }
            );
            plateGeo.translate(0, 0, -plateSize[2] / 2);
            const plate = new THREE.Mesh(
              plateGeo,
              new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2a3446), metalness: 0.5, roughness: 0.35 })
            );
            const face = role.shape === "rear" ? -1 : 1;
            plate.position.set(role.shape === "rear" ? 0.28 : 0, role.shape === "rear" ? 0.72 : 0, face * (box.size[2] / 2 + 0.02));
            const bezelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.035, 24);
            const glassGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.042, 24);
            const bezelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a465c), metalness: 0.7, roughness: 0.25 });
            const glassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x0b1424), metalness: 0.2, roughness: 0.1 });
            for (const [dx, dy] of [[-0.09, 0.07], [0.09, -0.07]] as const) {
              const bezel = new THREE.Mesh(bezelGeo.clone(), bezelMat);
              bezel.rotation.x = face * Math.PI / 2;
              bezel.position.set(plate.position.x + dx, plate.position.y + dy, face * (box.size[2] / 2 + 0.045));
              const glass = new THREE.Mesh(glassGeo.clone(), glassMat);
              glass.rotation.x = face * Math.PI / 2;
              glass.position.set(plate.position.x + dx, plate.position.y + dy, face * (box.size[2] / 2 + 0.06));
              mesh.add(bezel, glass);
            }
            mesh.add(plate);
          }
        });

        // Decorative root details: speaker slit and front camera dot.
        const rootRecord = state.meshes.get(model.root.id);
        if (rootRecord) {
          const slit = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.03, 0.02),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(0x0b1220), roughness: 0.5 })
          );
          slit.position.set(0, rootRecord.box.size[1] / 2 - 0.18, rootRecord.box.size[2] / 2 + 0.01);
          rootRecord.mesh.add(slit);
          const dot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(0x0b1220), roughness: 0.4 })
          );
          dot.rotation.x = Math.PI / 2;
          dot.position.set(0.28, rootRecord.box.size[1] / 2 - 0.18, rootRecord.box.size[2] / 2 + 0.01);
          rootRecord.mesh.add(dot);
        }

        // Fit the whole assembled bounding box by projecting its eight corners
        // at the default orientation, so every layer and the side clusters stay
        // inside the viewport with a margin reserved for labels.
        const bbox = new THREE.Box3();
        state.meshes.forEach((record) => {
          if (record.mesh.visible) bbox.expandByObject(record.mesh);
        });
        const center = bbox.getCenter(new THREE.Vector3());
        state.center = center;

        const dir = new THREE.Vector3(
          Math.sin(DEFAULT_YAW) * Math.cos(DEFAULT_PITCH),
          Math.sin(DEFAULT_PITCH),
          Math.cos(DEFAULT_YAW) * Math.cos(DEFAULT_PITCH)
        ).normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();
        const tanV = Math.tan((FOV / 2) * Math.PI / 180);
        const tanH = tanV * camera.aspect;

        const corners = [
          new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
          new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
          new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
          new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
          new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
          new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
          new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
          new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
        ];
        let required = 0.6;
        for (const corner of corners) {
          const offset = corner.clone().sub(center);
          const depthAlong = Math.max(0.1, offset.dot(dir));
          const xReq = Math.abs(offset.dot(right)) / (tanH * FIT_MARGIN) + depthAlong;
          const yReq = Math.abs(offset.dot(up)) / (tanV * FIT_MARGIN) + depthAlong;
          required = Math.max(required, xReq, yReq);
        }
        state.baseDistance = required * 0.72;
        state.distance = state.baseDistance;

        // Build label DOM nodes.
        const labelLayer = labelLayerRef.current;
        const svg = svgRef.current;
        if (labelLayer && svg) {
          state.meshes.forEach((record, id) => {
            if (record.node.depth > 1 && record.node.lane !== "material") return;
            const side: LabelRecord["side"] = record.role.layer === "rear"
              ? "right"
              : record.node.lane === "material"
                ? "bottom"
                : record.box.anchor[0] < -0.2
                  ? "left"
                  : record.box.anchor[0] > 0.2
                    ? "right"
                    : "top";
            const el = document.createElement("div");
            el.className = "exploded-three-label";
            el.textContent = record.node.name;
            labelLayer.appendChild(el);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "exploded-three-label-line");
            svg.appendChild(line);
            state.labels.push({ nodeId: id, side, el, line });
          });
        }

        const onContextLost = (event: Event) => {
          event.preventDefault();
          if (!state.degraded) {
            state.degraded = true;
            onFallbackRef.current?.("context-lost");
          }
        };
        renderer.domElement.addEventListener("webglcontextlost", onContextLost);

        const projectLabel = () => {
          if (!state.scene || !state.camera || !state.center) return;
          const rect = renderer.domElement.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          const active = new Set<string>();
          state.labels.forEach((label) => {
            const record = state.meshes.get(label.nodeId);
            if (!record) return;
            const isActive = selectedRef.current === label.nodeId || hoveredRef.current === label.nodeId;
            // Left-flank modules project onto the body plate at the default
            // angle; keep their labels hidden until selected or hovered so
            // they never sit on the shell silhouette.
            const flankHidden = label.side === "left" && record.node.depth === 1 && record.role.layer === "mid";
            if ((record.node.depth > 1 || flankHidden) && !isActive) {
              label.el.style.display = "none";
              label.line.style.display = "none";
              return;
            }
            active.add(label.nodeId);
            label.el.style.display = "";
            label.line.style.display = "";
          });

          const projected = new Map<string, { x: number; y: number }>();
          const sb = { minX: width, minY: height, maxX: 0, maxY: 0 };
          const projectMesh = (record: MeshRecord) => {
            const world = record.mesh.position.clone();
            world.y += record.box.size[1] / 2;
            const v = world.project(state.camera!);
            return {
              x: (v.x * 0.5 + 0.5) * width,
              y: (-v.y * 0.5 + 0.5) * height
            };
          };
          state.meshes.forEach((record) => {
            if (!record.mesh.visible || record.box.lane === "material") return;
            const p = projectMesh(record);
            sb.minX = Math.min(sb.minX, p.x);
            sb.minY = Math.min(sb.minY, p.y);
            sb.maxX = Math.max(sb.maxX, p.x);
            sb.maxY = Math.max(sb.maxY, p.y);
          });
          state.labels.forEach((label) => {
            const record = state.meshes.get(label.nodeId);
            if (!record || label.el.style.display === "none") return;
            projected.set(label.nodeId, projectMesh(record));
          });

          // Collision avoidance per label side: push overlapping labels apart.
          const bySide: Record<LabelRecord["side"], LabelRecord[]> = { top: [], right: [], left: [], bottom: [] };
          state.labels.forEach((label) => bySide[label.side].push(label));
          (Object.keys(bySide) as LabelRecord["side"][]).forEach((side) => {
            const list = bySide[side];
            const ordered = list
              .filter((label) => projected.has(label.nodeId))
              .sort((a, b) => {
                const pa = projected.get(a.nodeId)!;
                const pb = projected.get(b.nodeId)!;
                return side === "left" || side === "right" ? pa.x - pb.x : pa.y - pb.y;
              });
            let lastEdge = -Infinity;
            ordered.forEach((label) => {
              const p = projected.get(label.nodeId)!;
              const el = label.el;
              const lw = el.offsetWidth || 60;
              const lh = el.offsetHeight || 16;
              let x = 0;
              let y = 0;
              if (side === "top") {
                x = p.x - lw / 2;
                y = p.y - lh - LABEL_OFFSET;
                y = Math.max(y, lastEdge + LABEL_MIN_GAP);
                lastEdge = y + lh;
              } else if (side === "bottom") {
                x = p.x - lw / 2;
                y = p.y + LABEL_OFFSET;
                y = Math.max(y, lastEdge + LABEL_MIN_GAP);
                lastEdge = y + lh;
              } else if (side === "left") {
                x = sb.minX - 12 - lw;
                y = p.y - lh / 2;
                y = Math.max(y, lastEdge + LABEL_MIN_GAP);
                lastEdge = y + lh;
              } else {
                x = sb.maxX + 12;
                y = p.y - lh / 2;
                y = Math.max(y, lastEdge + LABEL_MIN_GAP);
                lastEdge = y + lh;
              }
              x = Math.min(Math.max(x, 8), width - lw - 8);
              y = Math.min(Math.max(y, 6), height - lh - 6);
              el.style.transform = `translate(${x}px, ${y}px)`;
              label.line.setAttribute("x1", String(p.x));
              label.line.setAttribute("y1", String(p.y));
              const edgeX = side === "left" ? x + lw : side === "right" ? x : x + lw / 2;
              const edgeY = side === "top" ? y + lh : side === "bottom" ? y : y + lh / 2;
              label.line.setAttribute("x2", String(edgeX));
              label.line.setAttribute("y2", String(edgeY));
              el.classList.toggle("selected", selectedRef.current === label.nodeId);
            });
          });
        };

        const renderFrame = () => {
          if (state.disposed) return;
          const now = performance.now();
          if (state.lastFrameTime) {
            const delta = now - state.lastFrameTime;
            if (state.warmupFrames > 0) state.warmupFrames -= 1;
            else state.frameTimes.push(delta);
          }
          state.lastFrameTime = now;
          if (state.frameTimes.length > 40) state.frameTimes.shift();

          if (!reducedMotion && Date.now() - state.interaction > 2600) {
            state.yaw += 0.0012;
          }
          if (state.center && state.camera) {
            const dir = new THREE.Vector3(
              Math.sin(state.yaw) * Math.cos(state.pitch),
              Math.sin(state.pitch),
              Math.cos(state.yaw) * Math.cos(state.pitch)
            );
            state.camera.position.copy(state.center).addScaledVector(dir, state.distance);
            state.camera.lookAt(state.center);
          }
          state.renderer?.render(scene, camera);
          projectLabel();

          // Low-frame-rate auto degrade after a stable sample.
          if (!state.degraded && state.frameTimes.length >= 25) {
            const median = [...state.frameTimes].sort((a, b) => a - b)[Math.floor(state.frameTimes.length / 2)];
            if (median > 50) {
              state.degraded = true;
              onFallbackRef.current?.("low-frame-rate");
              return;
            }
          }
          state.raf = requestAnimationFrame(renderFrame);
        };
        state.raf = requestAnimationFrame(renderFrame);

        // Pointer interaction: drag orbit, wheel zoom, click pick.
        const pick = (clientX: number, clientY: number): string | null => {
          if (!state.camera || !state.renderer) return null;
          const rect = renderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, state.camera);
          const meshes = [...state.meshes.values()].map((record) => record.mesh);
          const hits = raycaster.intersectObjects(meshes, false);
          return hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
        };

        const onPointerDown = (event: PointerEvent) => {
          state.drag = { x: event.clientX, y: event.clientY, moved: false };
          state.interaction = Date.now();
        };
        const onPointerMove = (event: PointerEvent) => {
          const current = state.drag;
          if (current) {
            const dx = event.clientX - current.x;
            const dy = event.clientY - current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) current.moved = true;
            if (current.moved) {
              state.yaw -= dx * 0.006;
              state.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, state.pitch + dy * 0.005));
              state.interaction = Date.now();
              state.drag = { x: event.clientX, y: event.clientY, moved: true };
              return;
            }
          }
          const hit = pick(event.clientX, event.clientY);
          setHoveredId(hit);
          renderer.domElement.style.cursor = hit ? "pointer" : "grab";
        };
        const onPointerUp = (event: PointerEvent) => {
          const current = state.drag;
          state.drag = null;
          if (current && !current.moved) {
            const hit = pick(event.clientX, event.clientY);
            if (hit) onSelectRef.current(hit);
          }
        };
        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          state.interaction = Date.now();
          const next = state.distance * (event.deltaY < 0 ? 0.92 : 1.08);
          state.distance = Math.min(state.baseDistance * 2.4, Math.max(state.baseDistance * 0.6, next));
        };
        const onResize = () => {
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          refreshPositions();
        };

        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointerleave", () => setHoveredId(null));
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        const observer = new ResizeObserver(onResize);
        observer.observe(host);

        state.cleanup = () => {
          observer.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        };
      };

      void bootstrap();

      return () => {
        cancelled = true;
        state.disposed = true;
        cancelAnimationFrame(state.raf);
        state.cleanup?.();
        if (state.scene) {
          state.scene.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(material)) material.forEach((m) => m.dispose());
            else if (material) material.dispose();
          });
        }
        state.labels.forEach((label) => {
          label.el.remove();
          label.line.remove();
        });
        state.renderer?.dispose();
        if (state.renderer?.domElement.parentElement === host) {
          host.removeChild(state.renderer.domElement);
        }
        state.meshes.clear();
        state.labels = [];
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync explosion-driven positions without rebuilding the scene.
    useEffect(() => {
      if (stateRef.current.scene) refreshPositions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [explosion, model, productId]);

    // Refresh material colors when the scheme changes.
    useEffect(() => {
      const state = stateRef.current;
      if (!state.scene || !state.THREE) return;
      state.meshes.forEach((record) => {
        const group = record.mesh.userData.materialGroup as string;
        const color = materials[group] ?? materials.material;
        const material = record.mesh.material as THREE.MeshStandardMaterial;
        material.color.set(color);
      });
    }, [materials]);

    // Selection / hover emphasis.
    useEffect(() => {
      const state = stateRef.current;
      if (!state.scene) return;
      state.meshes.forEach((record) => {
        const material = record.mesh.material as THREE.MeshStandardMaterial;
        const selected = selectedId === record.node.id;
        const hovered = hoveredId === record.node.id;
        material.emissive.set(selected ? tokens.accent : hovered ? tokens.line : 0x000000);
        material.emissiveIntensity = selected ? 0.45 : hovered ? 0.25 : materialPBR(record.role.material).emissiveIntensity ?? 0;
        material.opacity = selectedId && !selected && !hovered ? 0.55 : 1;
        material.transparent = Boolean(material.opacity < 1) || material.transparent;
      });
    }, [selectedId, hoveredId, tokens]);

    return (
      <div className="exploded-canvas-wrap exploded-three-wrap" ref={hostRef} data-renderer="webgl">
        <svg ref={svgRef} className="exploded-three-lines" aria-hidden="true" />
        <div ref={labelLayerRef} className="exploded-three-labels" />
      </div>
    );
  }
);
