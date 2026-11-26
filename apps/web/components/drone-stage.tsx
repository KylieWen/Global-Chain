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

const DEFAULT_YAW = 0.55;
const DEFAULT_PITCH = 0.1;
const MIN_PITCH = -0.15;
const MAX_PITCH = 1.1;
const FOV = 34;
const FIT_MARGIN = 0.2;
const BASE_DISTANCE = 4.3;
const ROT_YAW_FACTOR = 0.075;
const ROT_PITCH_FACTOR = 0.0625;
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
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      host.appendChild(renderer.domElement);

      const scene = new ns.Scene();
      scene.fog = new ns.Fog(0x0b1220, 6, 15);
      const camera = new ns.PerspectiveCamera(FOV, width / height, 0.1, 100);

      // Cool workstation lighting: soft hemisphere, key with shadow, cyan-blue rim.
      const hemisphere = new ns.HemisphereLight(0xbfd0e6, 0x14202f, 0.85);
      const key = new ns.DirectionalLight(0xffffff, 1.7);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 14;
      key.shadow.camera.left = -3;
      key.shadow.camera.right = 3;
      key.shadow.camera.top = 3;
      key.shadow.camera.bottom = -3;
      const rim = new ns.DirectionalLight(0x5ec8e6, 1.4);
      rim.position.set(-3, 2.5, -4);
      const fill = new ns.DirectionalLight(0x9fb6d8, 0.4);
      fill.position.set(-2, 1, 3);
      scene.add(hemisphere, key, rim, fill);

      // Ground: soft shadow catcher plus circular刻度 rings, ticks and a faint grid.
      const ground = new ns.Mesh(
        new ns.PlaneGeometry(12, 12),
        new ns.ShadowMaterial({ opacity: 0.32 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.28;
      ground.receiveShadow = true;
      scene.add(ground);

      const ringMat = new ns.LineBasicMaterial({ color: 0x2e4b63, transparent: true, opacity: 0.55 });
      for (const radius of [0.85, 1.25, 1.65, 2.05]) {
        const ringPoints = circlePoints(ns, radius);
        const ringGeo = new ns.BufferGeometry();
        ringGeo.setAttribute(
          "position",
          new ns.BufferAttribute(new Float32Array(ringPoints.flatMap((p) => [p.x, p.y, p.z])), 3)
        );
        const ring = new ns.LineLoop(ringGeo, ringMat);
        ring.position.y = -0.275;
        scene.add(ring);
      }
      const tickMat = new ns.LineBasicMaterial({ color: 0x38597a, transparent: true, opacity: 0.5 });
      const tickCount = 24;
      for (let i = 0; i < tickCount; i += 1) {
        const angle = (i / tickCount) * Math.PI * 2;
        const inner = 1.95;
        const outer = i % 6 === 0 ? 2.15 : 2.05;
        const positions = new Float32Array([
          Math.cos(angle) * inner, -0.274, Math.sin(angle) * inner,
          Math.cos(angle) * outer, -0.274, Math.sin(angle) * outer
        ]);
        const geo = new ns.BufferGeometry();
        geo.setAttribute("position", new ns.BufferAttribute(positions, 3));
        scene.add(new ns.Line(geo, tickMat));
      }
      const grid = new ns.GridHelper(4.4, 22, 0x26344a, 0x1c2a3d);
      grid.position.y = -0.278;
      const gridMat = grid.material as Three.LineBasicMaterial;
      gridMat.transparent = true;
      gridMat.opacity = 0.12;
      scene.add(grid);

      const root = new ns.Group();
      scene.add(root);

      const materials = schemeMaterials(scheme);
      const palette: DronePalette = {
        hull: "#e9eef2",
        hullLight: "#c7d2da",
        sensorDark: "#10161f",
        arm: "#b7c4cd",
        motor: "#3a4656",
        prop: "#39434f",
        pod: "#8fa0ae",
        glass: "#0b1424",
        module: materials.module ?? "#8fa0ae",
        board: materials.pcb ?? "#3f6b58",
        chip: materials.chip ?? "#b6c2d4",
        metal: "#6b7c90",
        remote: "#c2cdd5"
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

      const projectLabel = () => {
        if (!state.scene || !state.camera) return;
        const activeCamera = state.camera;
        const rect = renderer.domElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        state.labels.forEach((label) => {
          const record = state.records.get(label.nodeId);
          if (!record) return;
          const remoteHidden = REMOTE_IDS.has(label.nodeId) && explosionRef.current < 0.3;
          const active = selectedRef.current === label.nodeId || hoveredRef.current === label.nodeId;
          const persistent = record.node.depth === 1;
          if (remoteHidden || (!active && !persistent)) {
            label.el.style.display = "none";
            label.line.style.display = "none";
            return;
          }
          label.el.style.display = "";
          label.line.style.display = "";

          const anchor = record.groups[0].getWorldPosition(new ns.Vector3());
          const p = anchor.project(activeCamera);
          const sx = (p.x * 0.5 + 0.5) * width;
          const sy = (-p.y * 0.5 + 0.5) * height;

          const lw = label.el.offsetWidth || 64;
          const lh = label.el.offsetHeight || 16;
          let left = sx - lw / 2;
          let top = sy - lh / 2 - 14;
          if (label.side === "left") left = sx - lw - 14;
          if (label.side === "right") left = sx + 14;
          if (label.side === "bottom") top = sy + 14;
          left = Math.min(Math.max(left, 6), width - lw - 6);
          top = Math.min(Math.max(top, 6), height - lh - 6);
          label.el.style.transform = `translate(${left}px, ${top}px)`;
          label.el.classList.toggle("selected", selectedRef.current === label.nodeId);

          const edge = {
            top: { x: left + lw / 2, y: top + lh },
            bottom: { x: left + lw / 2, y: top },
            left: { x: left + lw, y: top + lh / 2 },
            right: { x: left, y: top + lh / 2 }
          }[label.side];
          label.line.setAttribute("x1", String(sx));
          label.line.setAttribute("y1", String(sy));
          label.line.setAttribute("x2", String(edge.x));
          label.line.setAttribute("y2", String(edge.y));
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

        // Auto-fit: frame the current assembly/explosion bounding sphere with a
        // fixed safety margin; manual wheel zoom multiplies the fit distance.
        const fitBox = new ns.Box3();
        const excludeRemote = explosionRef.current < 0.3;
        state.records.forEach((record, nodeId) => {
          if (excludeRemote && REMOTE_IDS.has(nodeId)) return;
          record.groups.forEach((group) => fitBox.expandByObject(group));
        });
        if (!fitBox.isEmpty() && state.camera) {
          const sphere = fitBox.getBoundingSphere(new ns.Sphere());
          const vFov = (FOV * Math.PI) / 180;
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * state.camera.aspect);
          const fitRadius = sphere.radius / Math.max(Math.sin(vFov / 2), Math.sin(hFov / 2));
          state.fitDistance = fitRadius / (1 - FIT_MARGIN);
          const dir = new ns.Vector3(
            Math.sin(state.yaw) * Math.cos(state.pitch),
            Math.sin(state.pitch),
            Math.cos(state.yaw) * Math.cos(state.pitch)
          ).normalize();
          const dist = state.fitDistance * state.zoom;
          state.camera.position.copy(sphere.center).addScaledVector(dir, dist);
          state.camera.lookAt(sphere.center);
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
