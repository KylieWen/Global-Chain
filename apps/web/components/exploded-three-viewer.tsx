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
  isBodyAligned,
  materialPBR,
  resolveNodeRole,
  schemeMaterials,
  shapeRadius,
  viewerConfig,
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

type SilBox = { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number; depth: number };
type LabelRect = { left: number; top: number; right: number; bottom: number; cx: number; cy: number };

const VIEWER = viewerConfig();
const DEFAULT_YAW = (VIEWER.camera.yawDeg * Math.PI) / 180;
const DEFAULT_PITCH = (VIEWER.camera.pitchDeg * Math.PI) / 180;
const MIN_PITCH = -0.5;
const MAX_PITCH = 1.1;
const FOV = VIEWER.camera.fov;
const FIT_MARGIN = VIEWER.fitMargin;
const LABEL_OFFSET = 16;
const LABEL_SIL_PAD = 2;
const LABEL_RECT_PAD = 4;
const ROT_YAW_FACTOR = VIEWER.orbit.damping * 0.075;
const ROT_PITCH_FACTOR = VIEWER.orbit.damping * 0.0625;
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

/**
 * Decorative two-blade rotor: a hub cylinder plus one crossed blade pair. This is
 * non-node presentation geometry attached to an arm/body mesh; it never adds a
 * BOM node or a priced part.
 */
function addRotorDecoration(
  THREE: typeof import("three"),
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  bladeScale: number
): void {
  const hubMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a465c), metalness: 0.6, roughness: 0.35 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2a323d), metalness: 0.1, roughness: 0.8 });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 20), hubMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(x, y, z);
  const bladeGeo = new THREE.BoxGeometry(0.4 * bladeScale, 0.055 * bladeScale, 0.025);
  const bladeOne = new THREE.Mesh(bladeGeo, bladeMat);
  bladeOne.position.set(x, y, z + 0.045);
  const bladeTwo = new THREE.Mesh(bladeGeo.clone(), bladeMat);
  bladeTwo.rotation.z = Math.PI / 2;
  bladeTwo.position.set(x, y, z + 0.045);
  parent.add(hub, bladeOne, bladeTwo);
}

function buildGeometry(
  THREE: typeof import("three"),
  shape: ResolvedRole["shape"],
  size: readonly [number, number, number],
  group: string,
  bodyThickness: number
): THREE.BufferGeometry {
  const [w, h, d] = size;
  const baseRadius = shapeRadius(shape) * Math.min(w, h);
  const radius = isBodyAligned(shape) ? baseRadius : Math.min(baseRadius, VIEWER.cornerRadius);
  const groupDepth: Record<string, number> = {
    metal: 0.03,
    "glass-mat": 0.035,
    polymer: 0.09,
    carbon: 0.06,
    ceramic: 0.04,
    material: 0.05
  };
  const minSheetDepth = VIEWER.partThicknessRatio * bodyThickness;
  const depth = Math.max(groupDepth[group] ?? d, minSheetDepth);
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
    "note",
    "drone-body",
    "drone-arm"
  ]);
  if (flatExtrude.has(shape)) {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, w, h, radius), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 10
    });
    geo.translate(0, 0, -depth / 2);
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
        const rootBoxForThickness = boxes.get(model.root.id);
        const bodyThickness = rootBoxForThickness?.size[2] ?? 0.42;
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
          const geometry = buildGeometry(THREE, role.shape, box.size, role.material, bodyThickness);
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
          if (role.shape === "drone-arm") {
            addRotorDecoration(THREE, mesh, box.size[0] / 2 - 0.08, 0, 0.05, 0.7);
          }
        });

        // Decorative root details, chosen by reusable silhouette role.
        const rootRecord = state.meshes.get(model.root.id);
        if (rootRecord && rootRecord.role.shape === "frame") {
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
        } else if (rootRecord && rootRecord.role.shape === "drone-body") {
          // Folded quad arms with decorative two-blade rotors and the under-body
          // camera pod. These mirror the real BOM arm/gimbal nodes; no extra part
          // or priced component is introduced here.
          const [bodyW, bodyH, bodyD] = rootRecord.box.size;
          const armMat = new THREE.MeshStandardMaterial({
            color: (rootRecord.mesh.material as THREE.MeshStandardMaterial).color.clone(),
            metalness: 0.2,
            roughness: 0.55
          });
          const armDirections: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
          for (const [sx, sy] of armDirections) {
            const hubX = sx * (bodyW / 2 - 0.06);
            const hubY = sy * (bodyH / 2 - 0.08);
            const beamLen = Math.hypot(hubX, hubY) - Math.min(bodyW, bodyH) * 0.16;
            const beam = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.13, 0.08), armMat);
            beam.position.set(hubX / 2, hubY / 2, 0);
            beam.rotation.z = Math.atan2(hubY, hubX);
            rootRecord.mesh.add(beam);
            addRotorDecoration(THREE, rootRecord.mesh, hubX, hubY, bodyD / 2, 1);
          }
          const podMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x5d6c88), metalness: 0.2, roughness: 0.55 });
          const lensMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x0b1424), metalness: 0.2, roughness: 0.1 });
          const podY = -bodyH / 2 - 0.05;
          const pod = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.18), podMat);
          pod.position.set(0, podY, bodyD / 2 + 0.02);
          const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 24), lensMat);
          lens.rotation.x = Math.PI / 2;
          lens.position.set(0, podY, bodyD / 2 + 0.13);
          rootRecord.mesh.add(pod, lens);
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
        // Per-product presentation override (content-driven; no id branch here).
        const cfg = viewerConfig(productId);
        // Body-height anchor: keep the main body at the configured share of
        // canvas height (spec range 62–72%) instead of zooming into a tight
        // exploded bounding box.
        const bodyRecord = state.meshes.get(model.root.id);
        let bodyDistance = 0;
        if (bodyRecord) {
          const halfY = bodyRecord.box.size[1] / 2;
          const topOffset = bodyRecord.mesh.position.clone().add(new THREE.Vector3(0, halfY, 0)).sub(center);
          const bottomOffset = bodyRecord.mesh.position.clone().add(new THREE.Vector3(0, -halfY, 0)).sub(center);
          const upExtent = Math.max(Math.abs(topOffset.dot(up)), Math.abs(bottomOffset.dot(up)));
          bodyDistance = upExtent / (tanV * cfg.fitBodyHeightRatio);
        }
        // Round-7 framing: fit the whole exploded bounding box, then apply the
        // closeness multiplier so the body reads at the manual-view scale
        // instead of sitting small inside a wide reserved box.
        const fittedRequired = required * cfg.fitZoom;
        state.baseDistance = Math.max(fittedRequired, bodyDistance);
        state.distance = state.baseDistance;

        // Build label DOM nodes.
        const labelLayer = labelLayerRef.current;
        const svg = svgRef.current;
        if (labelLayer && svg) {
          state.meshes.forEach((record, id) => {
            if (record.node.depth > 1 && record.node.lane !== "material") return;
            const side: LabelRecord["side"] = record.role.flank === "left"
              ? "left"
              : record.role.flank === "right"
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
          const persistent: LabelRecord[] = [];
          state.labels.forEach((label) => {
            const record = state.meshes.get(label.nodeId);
            if (!record) return;
            const isActive = selectedRef.current === label.nodeId || hoveredRef.current === label.nodeId;
            // Left-flank modules project onto the body plate at the default
            // angle; keep their labels hidden until selected or hovered so
            // they never sit on the shell silhouette.
            const flankHidden = label.side === "left" && record.node.depth === 1 && record.role.layer === "mid";
            if (isActive) {
              active.add(label.nodeId);
              label.el.style.display = "";
              label.line.style.display = "";
              return;
            }
            if (record.node.depth > 1 || flankHidden) {
              label.el.style.display = "none";
              label.line.style.display = "none";
              return;
            }
            persistent.push(label);
          });
          // Persistent label cap: keep the shallowest current-layer labels;
          // the rest stay hidden until hovered or selected.
          const cap = VIEWER.labelMaxPersistent;
          persistent
            .sort((a, b) => {
              const ra = state.meshes.get(a.nodeId);
              const rb = state.meshes.get(b.nodeId);
              return (ra?.node.depth ?? 0) - (rb?.node.depth ?? 0);
            })
            .forEach((label, index) => {
              const visible = index < cap;
              label.el.style.display = visible ? "" : "none";
              label.line.style.display = visible ? "" : "none";
              if (visible) active.add(label.nodeId);
            });

          // Projected silhouette (screen-space AABB) per visible non-material mesh.
          const silMap = new Map<string, SilBox>();
          const toScreen = (v: THREE.Vector3) => {
            const p = v.project(state.camera!);
            return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
          };
          const V = state.THREE!.Vector3;
          state.meshes.forEach((record) => {
            if (!record.mesh.visible || record.box.lane === "material") return;
            const [hw, hh, hd] = record.box.size.map((s) => s / 2);
            let minX = width; let minY = height; let maxX = 0; let maxY = 0;
            for (const dx of [-hw, hw]) {
              for (const dy of [-hh, hh]) {
                for (const dz of [-hd, hd]) {
                  const p = toScreen(new V(
                    record.mesh.position.x + dx,
                    record.mesh.position.y + dy,
                    record.mesh.position.z + dz
                  ));
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x);
                  maxY = Math.max(maxY, p.y);
                }
              }
            }
            silMap.set(record.node.id, { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, depth: record.node.depth });
          });

          const clampX = (v: number) => Math.min(Math.max(v, 6), width - 6);
          const clampY = (v: number) => Math.min(Math.max(v, 6), height - 6);
          const rectsOverlap = (
            a: LabelRect,
            b: { left: number; top: number; right: number; bottom: number },
            pad: number
          ) => !(a.right <= b.left + pad || b.right <= a.left + pad || a.bottom <= b.top + pad || b.bottom <= a.top + pad);

          const placedBySide: Record<LabelRecord["side"], LabelRect[]> = {
            top: [], right: [], left: [], bottom: []
          };
          const candidateRect = (side: LabelRecord["side"], sil: SilBox, lw: number, lh: number): LabelRect => {
            const stacked = placedBySide[side];
            if (side === "top") {
              const left = clampX(sil.cx - lw / 2);
              const above = stacked.length ? Math.min(...stacked.map((r) => r.top)) : Infinity;
              const top = Math.min(sil.minY - LABEL_OFFSET - lh, above - LABEL_RECT_PAD - lh);
              return { left, top, right: left + lw, bottom: top + lh, cx: left + lw / 2, cy: top + lh / 2 };
            }
            if (side === "bottom") {
              const left = clampX(sil.cx - lw / 2);
              const below = stacked.length ? Math.max(...stacked.map((r) => r.bottom)) : -Infinity;
              const top = Math.max(sil.maxY + LABEL_OFFSET, below + LABEL_RECT_PAD);
              return { left, top, right: left + lw, bottom: top + lh, cx: left + lw / 2, cy: top + lh / 2 };
            }
            if (side === "left") {
              const rightOf = stacked.length ? Math.min(...stacked.map((r) => r.left)) : Infinity;
              const right = Math.min(sil.minX - LABEL_OFFSET, rightOf - LABEL_RECT_PAD - lw);
              const left = right - lw;
              const top = clampY(sil.cy - lh / 2);
              return { left, top, right, bottom: top + lh, cx: left + lw / 2, cy: top + lh / 2 };
            }
            const leftOf = stacked.length ? Math.max(...stacked.map((r) => r.right)) : -Infinity;
            const left = Math.max(sil.maxX + LABEL_OFFSET, leftOf + LABEL_RECT_PAD);
            const top = clampY(sil.cy - lh / 2);
            return { left, top, right: left + lw, bottom: top + lh, cx: left + lw / 2, cy: top + lh / 2 };
          };

          const fitsOutside = (rect: LabelRect, ownId: string, placed: LabelRect[]) => {
            if (rect.left < 6 || rect.right > width - 6 || rect.top < 6 || rect.bottom > height - 6) return false;
            for (const [id, sil] of silMap) {
              if (id === ownId) continue;
              // Descendant sub-parts belong to the labeled assembly; their small
              // projected boxes do not count as a foreign part for label clearance.
              if (sil.depth > 1) continue;
              const silRect = { left: sil.minX, top: sil.minY, right: sil.maxX, bottom: sil.maxY };
              if (rectsOverlap(rect, silRect, LABEL_SIL_PAD)) return false;
            }
            return !placed.some((placedRect) => rectsOverlap(rect, placedRect, LABEL_RECT_PAD));
          };

          const edgeOnSil = (sil: SilBox, rect: LabelRect, side: LabelRecord["side"]) => {
            if (side === "top") return { x: Math.min(Math.max(rect.cx, sil.minX), sil.maxX), y: sil.minY };
            if (side === "bottom") return { x: Math.min(Math.max(rect.cx, sil.minX), sil.maxX), y: sil.maxY };
            if (side === "left") return { x: sil.minX, y: Math.min(Math.max(rect.cy, sil.minY), sil.maxY) };
            return { x: sil.maxX, y: Math.min(Math.max(rect.cy, sil.minY), sil.maxY) };
          };
          const facingEdge = (rect: LabelRect, side: LabelRecord["side"]) => {
            if (side === "top") return { x: rect.cx, y: rect.bottom };
            if (side === "bottom") return { x: rect.cx, y: rect.top };
            if (side === "left") return { x: rect.right, y: rect.cy };
            return { x: rect.left, y: rect.cy };
          };
          const leaderLength = (sil: SilBox, rect: LabelRect, side: LabelRecord["side"]) => {
            const s = edgeOnSil(sil, rect, side);
            const e = facingEdge(rect, side);
            return Math.hypot(e.x - s.x, e.y - s.y);
          };

          const placedRects: LabelRect[] = [];
          const visibleLabels = state.labels.filter((label) => label.el.style.display !== "none");
          visibleLabels.forEach((label) => {
            const record = state.meshes.get(label.nodeId);
            const sil = record ? silMap.get(record.node.id) : undefined;
            const el = label.el;
            if (!record || !sil) {
              el.style.display = "none";
              label.line.style.display = "none";
              return;
            }
            const lw = el.offsetWidth || 60;
            const lh = el.offsetHeight || 16;
            const emphasized = selectedRef.current === label.nodeId || hoveredRef.current === label.nodeId;
            const sideOrder = ([label.side, "top", "right", "bottom", "left"] as LabelRecord["side"][])
              .filter((s, i, arr) => arr.indexOf(s) === i);
            const candidates: { side: LabelRecord["side"]; rect: LabelRect; len: number }[] = [];
            for (const side of sideOrder) {
              const rect = candidateRect(side, sil, lw, lh);
              if (!emphasized && !fitsOutside(rect, label.nodeId, placedRects)) continue;
              const len = leaderLength(sil, rect, side);
              if (!emphasized && len > VIEWER.labelLeaderMax) continue;
              candidates.push({ side, rect, len });
            }
            if (!candidates.length) {
              // No clean side within the leader budget: drop the persistent
              // label instead of sitting it on another part's projection or
              // stretching a long leader across the stage.
              el.style.display = "none";
              label.line.style.display = "none";
              return;
            }
            candidates.sort((a, b) => a.len - b.len);
            const chosen = candidates[0];
            label.side = chosen.side;
            el.style.transform = `translate(${chosen.rect.left}px, ${chosen.rect.top}px)`;
            placedRects.push(chosen.rect);
            placedBySide[chosen.side].push(chosen.rect);
            const start = edgeOnSil(sil, chosen.rect, chosen.side);
            const end = facingEdge(chosen.rect, chosen.side);
            label.line.setAttribute("x1", String(start.x));
            label.line.setAttribute("y1", String(start.y));
            label.line.setAttribute("x2", String(end.x));
            label.line.setAttribute("y2", String(end.y));
            el.dataset.node = label.nodeId;
            el.dataset.sil = `${sil.minX},${sil.minY},${sil.maxX},${sil.maxY}`;
            el.dataset.rect = `${chosen.rect.left},${chosen.rect.top},${chosen.rect.right},${chosen.rect.bottom}`;
            el.dataset.leader = chosen.len.toFixed(1);
            el.classList.toggle("selected", selectedRef.current === label.nodeId);
          });

          if (hostRef.current) {
            (hostRef.current as unknown as { explodedSilhouettes: Record<string, SilBox> }).explodedSilhouettes =
              Object.fromEntries([...silMap].map(([id, s]) => [id, { ...s }]));
          }
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
              state.yaw -= dx * ROT_YAW_FACTOR;
              state.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, state.pitch + dy * ROT_PITCH_FACTOR));
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
          state.distance = Math.min(
            state.baseDistance * VIEWER.orbit.zoomMax,
            Math.max(state.baseDistance * VIEWER.orbit.zoomMin, next)
          );
        };
        const onDblClick = () => {
          state.yaw = DEFAULT_YAW;
          state.pitch = DEFAULT_PITCH;
          state.distance = state.baseDistance;
          state.interaction = Date.now();
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
        renderer.domElement.addEventListener("dblclick", onDblClick);
        const observer = new ResizeObserver(onResize);
        observer.observe(host);

        state.cleanup = () => {
          observer.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          renderer.domElement.removeEventListener("dblclick", onDblClick);
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
