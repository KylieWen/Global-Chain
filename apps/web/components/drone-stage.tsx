"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type * as Three from "three";
import type { ExplodedModel, ExplodedNode } from "../lib/exploded-model";
import { resolveNodeRole, schemeMaterials } from "../lib/exploded-appearance";
import { droneSlotsForNode, slotPosition, type DroneSlot } from "../lib/drone-workspace-layout";
import { buildDronePart, type DronePalette } from "../lib/drone-geometry";

type Ns = typeof import("three");

export type DroneStageHandle = {
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
  onFallback: (reason: string) => void;
};

type PartRecord = {
  node: ExplodedNode;
  slots: DroneSlot[];
  groups: Three.Group[];
  materials: Three.MeshStandardMaterial[];
};

type LabelRecord = {
  nodeId: string;
  side: DroneSlot["labelSide"];
  el: HTMLDivElement;
  line: SVGLineElement;
};

const DEFAULT_YAW = 0.66;
const DEFAULT_PITCH = 0.44;
const MIN_PITCH = -0.12;
const MAX_PITCH = 1.1;
const FOV = 30;
/** Share of the stage half-extent the model should occupy on screen. */
const FRAME_FILL = 0.8;
const BASE_DISTANCE = 3.2;
const ROT_YAW_FACTOR = 0.075;
const ROT_PITCH_FACTOR = 0.0625;
const LABEL_GAP = 10;
const LABEL_NUDGE = 18;
const LABEL_NUDGE_TRIES = 5;
const REMOTE_IDS = new Set([
  "drone-remote",
  "drone-remote-core-board",
  "drone-remote-antenna",
  "drone-remote-battery"
]);

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

function circlePoints(ns: Ns, radius: number, segments = 64): Three.Vector3[] {
  const points: Three.Vector3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new ns.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return points;
}

export const DroneStage = forwardRef<DroneStageHandle, Props>(function DroneStage(
  { model, productId, scheme, tokens, selectedId, onSelect, explosion, reducedMotion, onFallback },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const stateRef = useRef<{
    renderer: Three.WebGLRenderer | null;
    scene: Three.Scene | null;
    camera: Three.PerspectiveCamera | null;
    root: Three.Group | null;
    records: Map<string, PartRecord>;
    labels: LabelRecord[];
    raf: number;
    yaw: number;
    pitch: number;
    fitDistance: number;
    zoom: number;
    interaction: number;
    drag: { x: number; y: number; moved: boolean } | null;
    disposed: boolean;
    degraded: boolean;
    cleanup?: () => void;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    records: new Map(),
    labels: [],
    raf: 0,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    fitDistance: BASE_DISTANCE,
    zoom: 1,
    interaction: Date.now(),
    drag: null,
    disposed: false,
    degraded: false
  });

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const hoveredRef = useRef(hoveredId);
  hoveredRef.current = hoveredId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;
  const explosionRef = useRef(explosion);
  explosionRef.current = explosion;

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const state = stateRef.current;
      state.yaw = DEFAULT_YAW;
      state.pitch = DEFAULT_PITCH;
      state.zoom = 1;
      state.interaction = Date.now();
    }
  }), []);

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
      let ns: Ns;
      try {
        ns = await import("three");
      } catch {
        if (!cancelled && !state.disposed) onFallbackRef.current?.("import-failed");
        return;
      }
      if (cancelled || state.disposed) return;

      const width = host.clientWidth || 640;
      const height = host.clientHeight || 420;
      const renderer = new ns.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = ns.PCFShadowMap;
      // Filmic tone mapping keeps white shells from clipping to flat paper.
      renderer.toneMapping = ns.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      host.appendChild(renderer.domElement);

      const scene = new ns.Scene();
      scene.fog = new ns.Fog(0x0b1220, 4.2, 12);
      const camera = new ns.PerspectiveCamera(FOV, width / height, 0.1, 100);

      // Studio reflections: a procedural room environment makes the white shell
      // and the metal arms read as product renders rather than flat plastic.
      // Purely generated in-browser; no external HDR or asset is fetched.
      try {
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        const pmrem = new ns.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
        scene.environmentIntensity = 0.45;
        pmrem.dispose();
      } catch {
        /* environment is optional; directional lights still carry the shot */
      }

      // Cool workstation lighting: soft hemisphere, key with shadow, cyan-blue rim.
      const hemisphere = new ns.HemisphereLight(0xc6d6e8, 0x16222f, 0.9);
      const key = new ns.DirectionalLight(0xffffff, 1.55);
      key.position.set(1.4, 4.4, 1.9);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 10;
      key.shadow.camera.left = -1.6;
      key.shadow.camera.right = 1.6;
      key.shadow.camera.top = 1.6;
      key.shadow.camera.bottom = -1.6;
      const rim = new ns.DirectionalLight(0x6fc6de, 0.95);
      rim.position.set(-2.6, 1.8, -2.8);
      const fill = new ns.DirectionalLight(0xa8bcd8, 0.45);
      fill.position.set(-1.6, 0.8, 2.4);
      scene.add(hemisphere, key, rim, fill);

      // Ground: soft shadow catcher plus circular刻度 rings, ticks and a faint grid.
      const GROUND_Y = -0.145;
      const ground = new ns.Mesh(
        new ns.PlaneGeometry(9, 9),
        new ns.ShadowMaterial({ opacity: 0.34 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = GROUND_Y;
      ground.receiveShadow = true;
      scene.add(ground);

      const ringMat = new ns.LineBasicMaterial({ color: 0x33566f, transparent: true, opacity: 0.62 });
      for (const radius of [0.62, 0.95, 1.28, 1.62]) {
        const ringPoints = circlePoints(ns, radius);
        const ringGeo = new ns.BufferGeometry();
        ringGeo.setAttribute(
          "position",
          new ns.BufferAttribute(new Float32Array(ringPoints.flatMap((p) => [p.x, p.y, p.z])), 3)
        );
        const ring = new ns.LineLoop(ringGeo, ringMat);
        ring.position.y = GROUND_Y + 0.001;
        scene.add(ring);
      }
      const tickMat = new ns.LineBasicMaterial({ color: 0x3d6485, transparent: true, opacity: 0.55 });
      const tickCount = 24;
      for (let i = 0; i < tickCount; i += 1) {
        const angle = (i / tickCount) * Math.PI * 2;
        const inner = 1.55;
        const outer = i % 6 === 0 ? 1.78 : 1.66;
        const positions = new Float32Array([
          Math.cos(angle) * inner, GROUND_Y + 0.001, Math.sin(angle) * inner,
          Math.cos(angle) * outer, GROUND_Y + 0.001, Math.sin(angle) * outer
        ]);
        const geo = new ns.BufferGeometry();
        geo.setAttribute("position", new ns.BufferAttribute(positions, 3));
        scene.add(new ns.Line(geo, tickMat));
      }
      const grid = new ns.GridHelper(3.6, 24, 0x2a3a4e, 0x1f2c3d);
      grid.position.y = GROUND_Y - 0.001;
      const gridMat = grid.material as Three.LineBasicMaterial;
      gridMat.transparent = true;
      gridMat.opacity = 0.14;
      scene.add(grid);

      const root = new ns.Group();
      scene.add(root);

      const materials = schemeMaterials(scheme);
      const palette: DronePalette = {
        hull: "#e3e9ed",
        hullLight: "#c2ccd4",
        sensorDark: "#0f151d",
        arm: "#b6c1ca",
        motor: "#39434f",
        prop: "#2e3742",
        propTip: "#d9b552",
        pod: "#3f4855",
        glass: "#071019",
        module: materials.module ?? "#8fa0ae",
        board: materials.pcb ?? "#3f6b58",
        chip: materials.chip ?? "#b6c2d4",
        metal: "#78889a",
        remote: "#c8d2da"
      };

      const collectMeshes = (object: Three.Object3D, nodeId: string, into: Three.Mesh[]) => {
        object.traverse((child) => {
          const mesh = child as Three.Mesh;
          if (mesh.isMesh) {
            mesh.userData.nodeId = nodeId;
            mesh.castShadow = true;
            into.push(mesh);
          }
        });
      };

      model.nodes.forEach((node) => {
        const slots = droneSlotsForNode(node.id);
        if (slots.length === 0) return;
        const role = resolveNodeRole(productId, node);
        const moduleColor = materials[role.material] ?? materials.module;
        const groups: Three.Group[] = [];
        const partMaterials: Three.MeshStandardMaterial[] = [];
        const wrapper = new ns.Group();

        slots.forEach((slot) => {
          const armRoot = [slot.home[0], slot.home[1], slot.home[2]] as const;
          const armTip = slot.tip
            ? [slot.tip[0], slot.tip[1], slot.tip[2]] as const
            : [slot.spread[0], slot.spread[1], slot.spread[2]] as const;
          const part = buildDronePart(ns, slot.kind, palette, {
            armRoot: slot.kind === "arm" ? armRoot : undefined,
            armTip: slot.kind === "arm" ? armTip : undefined,
            moduleColor
          });
          const group = new ns.Group();
          group.position.set(...slotPosition(slot, explosionRef.current));
          group.add(part);
          const meshes: Three.Mesh[] = [];
          collectMeshes(group, node.id, meshes);
          meshes.forEach((mesh) => {
            const mat = mesh.material as Three.MeshStandardMaterial;
            if (!partMaterials.includes(mat)) partMaterials.push(mat);
          });
          wrapper.add(group);
          groups.push(group);
        });

        root.add(wrapper);
        state.records.set(node.id, { node, slots, groups, materials: partMaterials });
      });

      state.renderer = renderer;
      state.scene = scene;
      state.camera = camera;
      state.root = root;

      // Label DOM nodes.
      const labelLayer = labelLayerRef.current;
      const svg = svgRef.current;
      if (labelLayer && svg) {
        state.records.forEach((record, nodeId) => {
          // The product name already sits in the header and the module tree;
          // a floating root tag on top of the fuselage only adds clutter.
          if (nodeId === model.root.id) return;
          const slot = record.slots[0];
          const el = document.createElement("div");
          el.className = "exploded-three-label";
          el.textContent = record.node.name;
          labelLayer.appendChild(el);
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("class", "exploded-three-label-line");
          svg.appendChild(line);
          state.labels.push({ nodeId, side: slot.labelSide, el, line });
        });
      }

      const scratchBox = new ns.Box3();
      const corner = new ns.Vector3();
      const placed: Array<{ left: number; top: number; right: number; bottom: number }> = [];
      const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

      const projectLabel = () => {
        if (!state.scene || !state.camera) return;
        const activeCamera = state.camera;
        const rect = renderer.domElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        placed.length = 0;

        // Screen bounds of the whole aircraft, used as the callout envelope so
        // tags land around the silhouette (workstation style) instead of on it.
        scratchBox.makeEmpty();
        state.records.forEach((record, nodeId) => {
          if (REMOTE_IDS.has(nodeId) && explosionRef.current < 0.3) return;
          record.groups.forEach((group) => {
            if (group.visible) scratchBox.expandByObject(group);
          });
        });
        let envMinX = Infinity;
        let envMinY = Infinity;
        let envMaxX = -Infinity;
        let envMaxY = -Infinity;
        if (!scratchBox.isEmpty()) {
          for (let i = 0; i < 8; i += 1) {
            corner
              .set(
                i & 1 ? scratchBox.max.x : scratchBox.min.x,
                i & 2 ? scratchBox.max.y : scratchBox.min.y,
                i & 4 ? scratchBox.max.z : scratchBox.min.z
              )
              .project(activeCamera);
            const px = (corner.x * 0.5 + 0.5) * width;
            const py = (-corner.y * 0.5 + 0.5) * height;
            if (px < envMinX) envMinX = px;
            if (px > envMaxX) envMaxX = px;
            if (py < envMinY) envMinY = py;
            if (py > envMaxY) envMaxY = py;
          }
        }
        const envCX = (envMinX + envMaxX) / 2;
        const envCY = (envMinY + envMaxY) / 2;

        const rayBoxDistance = (x: number, y: number, dx: number, dy: number) => {
          let t = Infinity;
          if (dx > 0.0001) t = Math.min(t, (envMaxX - x) / dx);
          if (dx < -0.0001) t = Math.min(t, (envMinX - x) / dx);
          if (dy > 0.0001) t = Math.min(t, (envMaxY - y) / dy);
          if (dy < -0.0001) t = Math.min(t, (envMinY - y) / dy);
          return Number.isFinite(t) ? Math.max(t, 0) : 0;
        };

        state.labels.forEach((label) => {
          const record = state.records.get(label.nodeId);
          if (!record) return;
          const explosionNow = explosionRef.current;
          const remoteHidden = REMOTE_IDS.has(label.nodeId) && explosionNow < 0.3;
          const active = selectedRef.current === label.nodeId || hoveredRef.current === label.nodeId;
          // Module callouts stay on at rest; part callouts only once the
          // assembly has visibly opened up. Narrow stages have no room for a
          // full label ring, so only the active part and its modules show.
          const narrow = width < 640;
          const persistent = record.node.depth === 1 || (!narrow && record.node.depth === 2 && explosionNow >= 0.32);
          if (remoteHidden || (!active && !persistent)) {
            label.el.style.display = "none";
            label.line.style.display = "none";
            return;
          }

          // Screen-space bounds of the part itself, so the callout can sit
          // outside the silhouette instead of on top of it.
          scratchBox.makeEmpty();
          record.groups.forEach((group) => {
            if (group.visible) scratchBox.expandByObject(group);
          });
          if (scratchBox.isEmpty()) {
            label.el.style.display = "none";
            label.line.style.display = "none";
            return;
          }
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let i = 0; i < 8; i += 1) {
            corner
              .set(
                i & 1 ? scratchBox.max.x : scratchBox.min.x,
                i & 2 ? scratchBox.max.y : scratchBox.min.y,
                i & 4 ? scratchBox.max.z : scratchBox.min.z
              )
              .project(activeCamera);
            const px = (corner.x * 0.5 + 0.5) * width;
            const py = (-corner.y * 0.5 + 0.5) * height;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
          if (maxX < -20 || minX > width + 20 || maxY < -20 || minY > height + 20) {
            label.el.style.display = "none";
            label.line.style.display = "none";
            return;
          }

          const lw = label.el.offsetWidth || 64;
          const lh = label.el.offsetHeight || 18;
          const side = label.side;
          const anchorX = (minX + maxX) / 2;
          const anchorY = (minY + maxY) / 2;

          // Direction from the aircraft centre through this part. Centred parts
          // fall back to their configured side.
          let dirX = anchorX - envCX;
          let dirY = anchorY - envCY;
          const dirLen = Math.hypot(dirX, dirY);
          if (dirLen < 26) {
            dirX = side === "left" ? -1 : side === "right" ? 1 : 0;
            dirY = side === "top" ? -1 : side === "bottom" ? 1 : 0;
            if (dirX === 0 && dirY === 0) dirY = -1;
          } else {
            dirX /= dirLen;
            dirY /= dirLen;
          }
          const reach = rayBoxDistance(anchorX, anchorY, dirX, dirY);
          const halfDiag = Math.hypot(lw, lh) / 2;
          // Assembled shot: tags sit on the aircraft envelope so they clear the
          // silhouette. Exploded shot: tags hug their own part, which keeps the
          // many leaders short and readable instead of crossing the stage.
          const nearPart = explosionNow >= 0.32;
          const partReach = nearPart
            ? Math.min(
                dirX > 0.0001 ? (maxX - anchorX) / dirX : Infinity,
                dirX < -0.0001 ? (minX - anchorX) / dirX : Infinity,
                dirY > 0.0001 ? (maxY - anchorY) / dirY : Infinity,
                dirY < -0.0001 ? (minY - anchorY) / dirY : Infinity
              )
            : reach;
          const baseReach = Number.isFinite(partReach) ? Math.max(partReach, 0) : reach;

          let left = 0;
          let top = 0;
          let settled = false;
          for (let attempt = 0; attempt <= LABEL_NUDGE_TRIES; attempt += 1) {
            const push = baseReach + LABEL_GAP + halfDiag + (nearPart ? 6 : 10) + attempt * LABEL_NUDGE;
            left = anchorX + dirX * push - lw / 2;
            top = anchorY + dirY * push - lh / 2;
            left = clamp(left, 6, width - lw - 6);
            top = clamp(top, 4, height - lh - 4);
            const box = { left, top, right: left + lw, bottom: top + lh };
            const hitsLabel = placed.some(
              (other) => !(box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom)
            );
            const coversPart = !(box.right <= minX || box.left >= maxX || box.bottom <= minY || box.top >= maxY);
            if (!hitsLabel && (!coversPart || active)) {
              settled = true;
              break;
            }
          }
          if (!settled && !active) {
            label.el.style.display = "none";
            label.line.style.display = "none";
            return;
          }

          placed.push({ left, top, right: left + lw, bottom: top + lh });
          label.el.style.display = "";
          label.line.style.display = "";
          label.el.style.transform = `translate(${left}px, ${top}px)`;
          label.el.classList.toggle("selected", selectedRef.current === label.nodeId);

          // Leader starts on the part edge facing the tag and ends on the tag's
          // back edge, so the line never runs through the part itself.
          const partT = rayBoxDistance(anchorX, anchorY, dirX, dirY) * 0.62;
          const startX = clamp(anchorX + dirX * partT, minX, maxX);
          const startY = clamp(anchorY + dirY * partT, minY, maxY);
          const endX = clamp(left + lw / 2 - dirX * (lw / 2), left, left + lw);
          const endY = clamp(top + lh / 2 - dirY * (lh / 2), top, top + lh);
          label.line.setAttribute("x1", String(startX));
          label.line.setAttribute("y1", String(startY));
          label.line.setAttribute("x2", String(endX));
          label.line.setAttribute("y2", String(endY));
        });
      };

      const onContextLost = (event: Event) => {
        event.preventDefault();
        if (!state.degraded) {
          state.degraded = true;
          onFallbackRef.current?.("context-lost");
        }
      };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      const renderFrame = () => {
        if (state.disposed) return;
        if (!reducedMotion && Date.now() - state.interaction > 2600) {
          state.yaw += 0.0012;
        }
        // Interpolate part positions toward the current explosion factor.
        state.records.forEach((record) => {
          record.slots.forEach((slot, index) => {
            const group = record.groups[index];
            if (!group) return;
            group.position.set(...slotPosition(slot, explosionRef.current));
          });
        });

        // Internal boards sit inside the closed hull; showing them at rest only
        // produces stray slivers through the shell, so they appear with the
        // explosion (or when explicitly selected from the tree).
        const showInternal = explosionRef.current > 0.08;
        state.records.forEach((record, nodeId) => {
          const kind = record.slots[0]?.kind;
          if (kind !== "board" && kind !== "esc" && kind !== "chip" && kind !== "sensor") return;
          const forceShow = selectedRef.current === nodeId || hoveredRef.current === nodeId;
          record.groups.forEach((group) => {
            group.visible = showInternal || forceShow;
          });
        });

        // Remote cluster stays out of the assembled shot; fades in with the
        // exploded side cluster instead of competing with the fuselage.
        const remoteFade = Math.min(1, explosionRef.current / 0.3);
        state.records.forEach((record, nodeId) => {
          if (!REMOTE_IDS.has(nodeId)) return;
          record.groups.forEach((group) => {
            group.visible = remoteFade > 0.02;
          });
          record.materials.forEach((mat) => {
            mat.opacity = 0.03 + 0.97 * remoteFade;
            mat.transparent = true;
          });
        });

        // Frame by projecting the actual bounds: a flat aircraft needs a closer
        // camera than a bounding-sphere fit allows, and the exploded spread
        // still has to stay fully inside the stage.
        const fitBox = new ns.Box3();
        const excludeRemote = explosionRef.current < 0.3;
        state.records.forEach((record, nodeId) => {
          if (excludeRemote && REMOTE_IDS.has(nodeId)) return;
          record.groups.forEach((group) => fitBox.expandByObject(group));
        });
        if (!fitBox.isEmpty() && state.camera) {
          const activeCamera = state.camera;
          const sphere = fitBox.getBoundingSphere(new ns.Sphere());
          // Exploded view reads better from higher up: at the assembled pitch the
          // two shells flatten into a pair of pancakes and the parts between them
          // disappear. Lift the camera with the slider without touching user orbit.
          const explodeLift = explosionRef.current * 0.26;
          const viewPitch = Math.min(MAX_PITCH, state.pitch + explodeLift);
          const dir = new ns.Vector3(
            Math.sin(state.yaw) * Math.cos(viewPitch),
            Math.sin(viewPitch),
            Math.cos(state.yaw) * Math.cos(viewPitch)
          ).normalize();
          let dist = Math.max(sphere.radius * 1.05, 1.2);
          const probe = new ns.Vector3();
          for (let pass = 0; pass < 3; pass += 1) {
            activeCamera.position.copy(sphere.center).addScaledVector(dir, dist);
            activeCamera.lookAt(sphere.center);
            activeCamera.updateMatrixWorld();
            let fill = 0;
            for (let i = 0; i < 8; i += 1) {
              probe
                .set(
                  i & 1 ? fitBox.max.x : fitBox.min.x,
                  i & 2 ? fitBox.max.y : fitBox.min.y,
                  i & 4 ? fitBox.max.z : fitBox.min.z
                )
                .project(activeCamera);
              fill = Math.max(fill, Math.abs(probe.x), Math.abs(probe.y));
            }
            if (fill < 0.001) break;
            dist *= fill / (explosionRef.current > 0.3 ? 0.87 : FRAME_FILL);
          }
          state.fitDistance = dist;
          const finalDist = dist * state.zoom;
          activeCamera.position.copy(sphere.center).addScaledVector(dir, finalDist);
          activeCamera.lookAt(sphere.center);
        }
        renderer.render(scene, camera);
        projectLabel();
        state.raf = requestAnimationFrame(renderFrame);
      };
      state.raf = requestAnimationFrame(renderFrame);

      const pick = (clientX: number, clientY: number): string | null => {
        if (!state.camera || !state.renderer) return null;
        const activeCamera = state.camera;
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new ns.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new ns.Raycaster();
        raycaster.setFromCamera(ndc, activeCamera);
        const meshes: Three.Mesh[] = [];
        state.records.forEach((record) => {
          record.groups.forEach((group) => {
            group.traverse((child) => {
              const mesh = child as Three.Mesh;
              if (mesh.isMesh) meshes.push(mesh);
            });
          });
        });
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
        const next = state.zoom * (event.deltaY < 0 ? 0.92 : 1.08);
        state.zoom = Math.min(1.8, Math.max(0.7, next));
      };
      const onDblClick = () => {
        state.yaw = DEFAULT_YAW;
        state.pitch = DEFAULT_PITCH;
        state.zoom = 1;
        state.interaction = Date.now();
      };
      const onResize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(onResize);
      observer.observe(host);

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointerleave", () => setHoveredId(null));
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      renderer.domElement.addEventListener("dblclick", onDblClick);

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
          const mesh = object as Three.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const material = mesh.material as Three.Material | Three.Material[] | undefined;
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
      state.records.clear();
      state.labels = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selection emphasis without rebuilding the scene.
  useEffect(() => {
    const state = stateRef.current;
    if (!state.scene) return;
    state.records.forEach((record, nodeId) => {
      const selected = selectedId === nodeId;
      const hovered = hoveredId === nodeId;
      record.materials.forEach((mat) => {
        mat.emissive.set(selected ? tokens.accent : hovered ? tokens.line : 0x000000);
        mat.emissiveIntensity = selected ? 0.45 : hovered ? 0.22 : 0;
        mat.opacity = selectedId && !selected && !hovered ? 0.55 : 1;
        mat.transparent = mat.opacity < 1 || mat.transparent;
      });
    });
  }, [selectedId, hoveredId, tokens]);

  return (
    <div className="drone-stage-wrap" ref={hostRef} data-renderer="webgl">
      <svg ref={svgRef} className="exploded-three-lines" aria-hidden="true" />
      <div ref={labelLayerRef} className="exploded-three-labels" />
    </div>
  );
});
