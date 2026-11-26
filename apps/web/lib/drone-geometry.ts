/**
 * Generic procedural geometry for the rebuilt Mini-style quadcopter workstation.
 *
 * Pure builders over the installed `three` namespace: no external model, no
 * BOM addition, no priced part. The hull is a low-slung streamlined white shell
 * in the XZ plane (Y up); arms, motors, props and the front gimbal are generic
 * stand-ins aligned to the real 16-node BOM slots. Decorative detail (sticks,
 * vents, sensor dots) never maps to a separate catalog node.
 */
import type * as Three from "three";
import type { DronePartKind, Vec3 } from "./drone-workspace-layout";

export type DronePalette = {
  hull: string;
  hullLight: string;
  sensorDark: string;
  arm: string;
  motor: string;
  prop: string;
  pod: string;
  glass: string;
  module: string;
  board: string;
  chip: string;
  metal: string;
  remote: string;
};

type Ns = typeof import("three");

function roundedRectShape(ns: Ns, w: number, h: number, r: number): Three.Shape {
  const shape = new ns.Shape();
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
 * Streamlined plan-view outline: wide rounded rear tapering to a rounded nose
 * toward +Z (front). Used for the continuous low-slung fuselage instead of a
 * stacked rounded-rect plate.
 */
function fuselagePlanShape(ns: Ns, rearHalf: number, noseHalf: number, rearZ: number, noseZ: number): Three.Shape {
  const s = new ns.Shape();
  s.moveTo(0, noseZ);
  s.quadraticCurveTo(noseHalf + 0.07, noseZ - 0.14, rearHalf, -0.04);
  s.quadraticCurveTo(rearHalf + 0.02, rearZ, rearHalf * 0.72, rearZ);
  s.lineTo(-rearHalf * 0.72, rearZ);
  s.quadraticCurveTo(-rearHalf - 0.02, rearZ, -rearHalf, -0.04);
  s.quadraticCurveTo(-noseHalf - 0.07, noseZ - 0.14, 0, noseZ);
  return s;
}

function extrudePlan(
  ns: Ns,
  shape: Three.Shape,
  thickness: number,
  bevel: number,
  color: string,
  opts: Parameters<typeof stdMaterial>[2] = {}
): Three.Mesh {
  const geo = new ns.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2);
  return new ns.Mesh(geo, stdMaterial(ns, color, opts));
}

function stdMaterial(ns: Ns, color: string, opts: { metalness?: number; roughness?: number; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}): Three.MeshStandardMaterial {
  return new ns.MeshStandardMaterial({
    color: new ns.Color(color),
    metalness: opts.metalness ?? 0.15,
    roughness: opts.roughness ?? 0.6,
    emissive: opts.emissive ? new ns.Color(opts.emissive) : new ns.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1
  });
}

function extrudePlate(ns: Ns, w: number, d: number, thickness: number, radius: number, color: string, opts: Parameters<typeof stdMaterial>[2] = {}): Three.Mesh {
  const geo = new ns.ExtrudeGeometry(roundedRectShape(ns, w, d, radius), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: Math.min(thickness * 0.35, 0.03),
    bevelSize: Math.min(thickness * 0.35, 0.03),
    bevelSegments: 2,
    curveSegments: 10
  });
  geo.translate(0, 0, -thickness / 2);
  // Shape lives in XY with extrusion along Z; rotate so footprint is XZ and
  // thickness runs along Y (body-up).
  geo.rotateX(-Math.PI / 2);
  return new ns.Mesh(geo, stdMaterial(ns, color, opts));
}

function cylinder(ns: Ns, radius: number, height: number, color: string, opts: Parameters<typeof stdMaterial>[2] = {}, segments = 24): Three.Mesh {
  return new ns.Mesh(new ns.CylinderGeometry(radius, radius, height, segments), stdMaterial(ns, color, opts));
}

function buildPropeller(ns: Ns, palette: DronePalette, scale: number): Three.Group {
  const group = new ns.Group();
  const hub = cylinder(ns, 0.045 * scale, 0.03 * scale, palette.motor, { metalness: 0.5, roughness: 0.35 }, 18);
  hub.position.y = 0.015 * scale;
  group.add(hub);
  const bladeLen = 0.32 * scale;
  const bladeW = 0.085 * scale;
  const bladeGeo = new ns.ExtrudeGeometry(roundedRectShape(ns, bladeLen, bladeW, bladeW / 2), {
    depth: 0.012,
    bevelEnabled: false,
    curveSegments: 8
  });
  bladeGeo.translate(0, 0, -0.006);
  // Slightly lifted charcoal so dark blades stay readable against the dark stage.
  const bladeMat = stdMaterial(ns, palette.prop, { roughness: 0.5, metalness: 0.2 });
  for (const sign of [1, -1]) {
    const blade = new ns.Mesh(bladeGeo.clone(), bladeMat);
    blade.rotation.y = sign > 0 ? 0 : Math.PI;
    blade.position.x = (bladeLen / 2) * sign;
    blade.position.y = 0.03 * scale;
    group.add(blade);
  }
  return group;
}

function buildArm(ns: Ns, palette: DronePalette, localTip: Vec3): Three.Group {
  const group = new ns.Group();
  const [tx, ty, tz] = localTip;
  const dx = tx;
  const dz = tz;
  const len = Math.hypot(dx, dz);
  const beam = new ns.Mesh(
    new ns.BoxGeometry(len, 0.05, 0.07),
    stdMaterial(ns, palette.arm, { metalness: 0.1, roughness: 0.55 })
  );
  beam.position.set(tx / 2, ty / 2, tz / 2);
  beam.rotation.y = Math.atan2(-dz, dx);
  group.add(beam);

  const motor = cylinder(ns, 0.08, 0.09, palette.motor, { metalness: 0.45, roughness: 0.35 });
  motor.position.set(tx, ty + 0.045, tz);
  group.add(motor);

  const prop = buildPropeller(ns, palette, 0.9);
  prop.position.set(tx, ty + 0.1, tz);
  group.add(prop);
  return group;
}

function buildPod(ns: Ns, palette: DronePalette): Three.Group {
  const group = new ns.Group();
  // Compact camera body instead of an oversized cylindrical pod.
  const housing = extrudePlate(ns, 0.16, 0.14, 0.12, 0.045, palette.pod, { metalness: 0.2, roughness: 0.45 });
  group.add(housing);
  const bezel = cylinder(ns, 0.065, 0.035, palette.motor, { metalness: 0.6, roughness: 0.3 });
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 0, 0.085);
  const glass = cylinder(ns, 0.05, 0.045, palette.glass, { metalness: 0.2, roughness: 0.08 }, 24);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0, 0.105);
  group.add(bezel, glass);
  return group;
}

/**
 * Build one generic part group for a slot. `armRoot` / `armTip` are supplied for
 * the arm assembly (four corners share the single `drone-arm` node).
 */
export function buildDronePart(
  ns: Ns,
  kind: DronePartKind,
  palette: DronePalette,
  extra?: { armRoot?: Vec3; armTip?: Vec3; moduleColor?: string }
): Three.Object3D {
  switch (kind) {
    case "hull": {
      const group = new ns.Group();
      // Continuous low-slung lower fuselage: one thin streamlined plan shell,
      // not a stacked plate. Light gray lower body.
      const lower = extrudePlan(
        ns,
        fuselagePlanShape(ns, 0.32, 0.12, -0.4, 0.42),
        0.08,
        0.018,
        palette.hullLight,
        { metalness: 0.08, roughness: 0.45 }
      );
      lower.position.y = 0;
      group.add(lower);
      // Vertical black sensor band across the nose face (front, not a top panel).
      const band = new ns.Mesh(
        new ns.BoxGeometry(0.22, 0.11, 0.03),
        stdMaterial(ns, palette.sensorDark, { roughness: 0.5 })
      );
      band.position.set(0, 0.01, 0.4);
      group.add(band);
      for (const sx of [-0.065, 0.065]) {
        const lens = cylinder(ns, 0.034, 0.03, palette.glass, { metalness: 0.2, roughness: 0.1 }, 18);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(sx, 0.01, 0.422);
        group.add(lens);
      }
      // Two slim decorative landing struts under the body sides.
      const legMat = stdMaterial(ns, palette.metal, { metalness: 0.5, roughness: 0.4 });
      for (const sx of [-0.2, 0.2]) {
        const leg = new ns.Mesh(new ns.BoxGeometry(0.03, 0.12, 0.03), legMat);
        leg.position.set(sx, -0.08, -0.08);
        leg.rotation.z = sx > 0 ? -0.18 : 0.18;
        group.add(leg);
      }
      return group;
    }
    case "shell": {
      const coverGroup = new ns.Group();
      // Thin upper cover that lifts away in the exploded state; nearly flush
      // with the lower shell so the assembled body reads as one continuous
      // low fuselage with a fine seam, not two equal plates.
      const cover = extrudePlan(
        ns,
        fuselagePlanShape(ns, 0.28, 0.11, -0.36, 0.36),
        0.03,
        0.012,
        palette.hull,
        { metalness: 0.08, roughness: 0.42 }
      );
      cover.position.y = 0.048;
      coverGroup.add(cover);
      // A few recessed vent slots on the rear top cover (decorative, non-BOM).
      const ventMat = stdMaterial(ns, palette.sensorDark, { roughness: 0.6 });
      for (let i = -1; i <= 1; i += 1) {
        const vent = new ns.Mesh(new ns.BoxGeometry(0.02, 0.008, 0.12), ventMat);
        vent.position.set(i * 0.07, 0.066, -0.18);
        coverGroup.add(vent);
      }
      return coverGroup;
    }
    case "board":
      return extrudePlate(ns, 0.24, 0.26, 0.04, 0.03, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "esc":
      return extrudePlate(ns, 0.2, 0.22, 0.04, 0.03, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "chip": {
      return new ns.Mesh(new ns.BoxGeometry(0.12, 0.05, 0.12), stdMaterial(ns, extra?.moduleColor ?? palette.chip, { metalness: 0.3, roughness: 0.4 }));
    }
    case "sensor": {
      const group = new ns.Group();
      for (const sx of [-0.07, 0.07]) {
        const lens = cylinder(ns, 0.05, 0.04, palette.glass, { metalness: 0.2, roughness: 0.1 }, 18);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(sx, 0, 0);
        group.add(lens);
      }
      return group;
    }
    case "arm": {
      if (!extra?.armRoot || !extra?.armTip) return new ns.Group();
      const [rx, ry, rz] = extra.armRoot;
      const [tx, ty, tz] = extra.armTip;
      return buildArm(ns, palette, [tx - rx, ty - ry, tz - rz]);
    }
    case "gimbal-bracket": {
      return extrudePlate(ns, 0.16, 0.14, 0.12, 0.04, palette.metal, { metalness: 0.5, roughness: 0.35 });
    }
    case "pod":
      return buildPod(ns, palette);
    case "lens": {
      const group = new ns.Group();
      const bezel = cylinder(ns, 0.078, 0.04, palette.motor, { metalness: 0.6, roughness: 0.3 });
      bezel.rotation.x = Math.PI / 2;
      const glass = cylinder(ns, 0.058, 0.05, palette.glass, { metalness: 0.2, roughness: 0.08 }, 24);
      glass.rotation.x = Math.PI / 2;
      glass.position.z = 0.025;
      group.add(bezel, glass);
      return group;
    }
    case "axis-arm": {
      const arm = new ns.Mesh(new ns.BoxGeometry(0.05, 0.05, 0.18), stdMaterial(ns, palette.metal, { metalness: 0.5, roughness: 0.35 }));
      arm.rotation.y = -0.35;
      return arm;
    }
    case "gimbal-motor":
      return cylinder(ns, 0.055, 0.08, palette.motor, { metalness: 0.5, roughness: 0.35 });
    case "remote": {
      const group = new ns.Group();
      const body = extrudePlate(ns, 0.4, 0.25, 0.08, 0.07, palette.remote, { roughness: 0.55 });
      group.add(body);
      for (const sx of [-0.1, 0.1]) {
        const stick = cylinder(ns, 0.028, 0.07, palette.motor, { metalness: 0.5, roughness: 0.35 }, 16);
        stick.position.set(sx, 0.065, 0);
        group.add(stick);
      }
      return group;
    }
    case "remote-board":
      return extrudePlate(ns, 0.24, 0.18, 0.03, 0.03, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "antenna": {
      const group = new ns.Group();
      for (const sx of [-0.08, 0.08]) {
        const rod = cylinder(ns, 0.014, 0.2, palette.motor, { metalness: 0.4, roughness: 0.4 }, 12);
        rod.position.set(sx, 0.1, -0.12);
        rod.rotation.x = -0.25;
        group.add(rod);
      }
      return group;
    }
    case "battery-pack":
      return extrudePlate(ns, 0.16, 0.2, 0.08, 0.04, extra?.moduleColor ?? palette.module, { roughness: 0.6 });
    default:
      return new ns.Group();
  }
}
