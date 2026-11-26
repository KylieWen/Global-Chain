/**
 * Generic procedural geometry for the rebuilt Mini-style quadcopter workstation.
 *
 * Pure builders over the installed `three` namespace: no external model, no
 * BOM addition, no priced part. Body space is Y-up with +Z as the nose; the
 * hull is a low-slung shell that is wide at the tail and narrows to a drooping
 * nose, with a separate rear deck, forward sensor eyes, four slim tube arms,
 * cylindrical motors, thin two-blade props and a small gimbal tucked under the
 * nose. Everything decorative (vents, lens rings, prop-tip marks) is geometry
 * only and never maps to a catalog node.
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
  propTip: string;
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
 * Fuselage plan outline in body space (+Z nose). Shape space uses (x, -z) so
 * the extruded slab lands with +Z as the nose after the X-axis rotation below.
 *
 * Real Mini-class bodies are widest just behind the mid-line and taper forward
 * into a narrow nose; the previous helper had it backwards (narrow tail, wide
 * blunt front face), which is why the old body read as a flying saucer.
 */
function bodyPlan(
  ns: Ns,
  rearHalf: number,
  noseHalf: number,
  zRear: number,
  zNose: number,
  widestZ = zRear + (zNose - zRear) * 0.28
): Three.Shape {
  const s = new ns.Shape();
  const v = (z: number) => -z;
  s.moveTo(0, v(zNose));
  s.quadraticCurveTo(noseHalf + 0.03, v(zNose - 0.055), noseHalf + 0.055, v(zNose - 0.12));
  s.quadraticCurveTo(rearHalf * 0.96, v(widestZ), rearHalf, v(widestZ - 0.02));
  s.quadraticCurveTo(rearHalf + 0.008, v(zRear + 0.05), rearHalf * 0.86, v(zRear + 0.012));
  s.quadraticCurveTo(rearHalf * 0.5, v(zRear), 0, v(zRear));
  s.quadraticCurveTo(-rearHalf * 0.5, v(zRear), -rearHalf * 0.86, v(zRear + 0.012));
  s.quadraticCurveTo(-rearHalf - 0.008, v(zRear + 0.05), -rearHalf, v(widestZ - 0.02));
  s.quadraticCurveTo(-rearHalf * 0.96, v(widestZ), -noseHalf - 0.055, v(zNose - 0.12));
  s.quadraticCurveTo(-noseHalf - 0.03, v(zNose - 0.055), 0, v(zNose));
  return s;
}

function extrudeShape(
  ns: Ns,
  shape: Three.Shape,
  thickness: number,
  bevel: number,
  color: string,
  opts: Parameters<typeof stdMaterial>[2] = {},
  curveSegments = 24
): Three.Mesh {
  const geo = new ns.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2);
  const mesh = new ns.Mesh(geo, stdMaterial(ns, color, opts));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stdMaterial(
  ns: Ns,
  color: string,
  opts: {
    metalness?: number;
    roughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  } = {}
): Three.MeshStandardMaterial {
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

function extrudePlate(
  ns: Ns,
  w: number,
  d: number,
  thickness: number,
  radius: number,
  color: string,
  opts: Parameters<typeof stdMaterial>[2] = {}
): Three.Mesh {
  const geo = new ns.ExtrudeGeometry(roundedRectShape(ns, w, d, radius), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: Math.min(thickness * 0.35, 0.03),
    bevelSize: Math.min(thickness * 0.35, 0.03),
    bevelSegments: 2,
    curveSegments: 12
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(-Math.PI / 2);
  const mesh = new ns.Mesh(geo, stdMaterial(ns, color, opts));
  mesh.castShadow = true;
  return mesh;
}

function cylinder(
  ns: Ns,
  radius: number,
  height: number,
  color: string,
  opts: Parameters<typeof stdMaterial>[2] = {},
  segments = 24
): Three.Mesh {
  const mesh = new ns.Mesh(new ns.CylinderGeometry(radius, radius, height, segments), stdMaterial(ns, color, opts));
  mesh.castShadow = true;
  return mesh;
}

/**
 * Two thin blades with a slight taper, a small pitch twist and a coloured tip
 * mark. Real props on this class are almost as wide as the arm reach, so the
 * blades are long and narrow rather than stubby paddles.
 */
function buildPropeller(ns: Ns, palette: DronePalette, phase = 0.35): Three.Group {
  const group = new ns.Group();
  const hub = cylinder(ns, 0.022, 0.018, palette.motor, { metalness: 0.5, roughness: 0.35 }, 18);
  hub.position.y = 0.012;
  group.add(hub);

  const bladeLen = 0.192;
  const bladeW = 0.056;
  const bladeShape = new ns.Shape();
  bladeShape.moveTo(0.014, -bladeW * 0.36);
  bladeShape.quadraticCurveTo(bladeLen * 0.55, -bladeW * 0.44, bladeLen, -bladeW * 0.22);
  bladeShape.quadraticCurveTo(bladeLen + 0.012, 0, bladeLen, bladeW * 0.22);
  bladeShape.quadraticCurveTo(bladeLen * 0.55, bladeW * 0.44, 0.014, bladeW * 0.36);
  bladeShape.quadraticCurveTo(-0.006, 0, 0.014, -bladeW * 0.36);

  const bladeGeo = new ns.ExtrudeGeometry(bladeShape, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 14 });
  bladeGeo.translate(0, 0, -0.0045);
  // Extrusion runs along Z; lay the blade flat in the XZ plane.
  bladeGeo.rotateX(-Math.PI / 2);

  const bladeMat = stdMaterial(ns, palette.prop, { roughness: 0.45, metalness: 0.15 });
  const tipMat = stdMaterial(ns, palette.propTip, { roughness: 0.5, metalness: 0.1 });
  for (const sign of [1, -1]) {
    const pivot = new ns.Group();
    pivot.rotation.y = sign > 0 ? phase : phase + Math.PI;
    // A touch of pitch so the blades are not coplanar with the body.
    pivot.rotation.x = sign > 0 ? 0.045 : 0.045;
    const blade = new ns.Mesh(bladeGeo.clone(), bladeMat);
    blade.castShadow = true;
    blade.position.y = 0.022;
    // Angle of attack: without a twist the blades are edge-on and vanish from
    // a low camera, which is what made the props read as bare sticks.
    blade.rotation.z = sign > 0 ? 0.13 : -0.13;
    pivot.add(blade);
    const tip = new ns.Mesh(new ns.BoxGeometry(0.018, 0.006, bladeW * 0.46), tipMat);
    tip.position.set(bladeLen - 0.012, 0.022, 0);
    pivot.add(tip);
    group.add(pivot);
  }
  return group;
}

function buildArm(ns: Ns, palette: DronePalette, armRoot: Vec3, armTip: Vec3): Three.Group {
  const group = new ns.Group();
  const [rx, ry, rz] = armRoot;
  const [tx, ty, tz] = armTip;
  const dx = tx - rx;
  const dy = ty - ry;
  const dz = tz - rz;
  const len = Math.hypot(dx, dz);

  // Slim tapered tube instead of a flat plank: the real arm is a rounded spar.
  const tube = new ns.Mesh(
    new ns.CylinderGeometry(0.019, 0.025, len, 14),
    stdMaterial(ns, palette.arm, { metalness: 0.25, roughness: 0.42 })
  );
  const dir = new ns.Vector3(dx, 0, dz).normalize();
  tube.quaternion.setFromUnitVectors(new ns.Vector3(0, 1, 0), dir);
  tube.position.set(dx / 2, dy / 2, dz / 2);
  tube.castShadow = true;
  group.add(tube);

  // Fold hinge: a small, dim collar at the body joint rather than a white box
  // that reads as an ear on the fuselage.
  const hinge = new ns.Mesh(
    new ns.CylinderGeometry(0.03, 0.032, 0.05, 12),
    stdMaterial(ns, palette.arm, { metalness: 0.3, roughness: 0.4 })
  );
  hinge.quaternion.setFromUnitVectors(new ns.Vector3(0, 1, 0), dir);
  hinge.position.set(0, 0.004, 0);
  group.add(hinge);

  const motorBase = cylinder(ns, 0.042, 0.05, palette.motor, { metalness: 0.55, roughness: 0.32 }, 22);
  motorBase.position.set(dx, dy + 0.02, dz);
  const motorCap = cylinder(ns, 0.033, 0.012, palette.metal, { metalness: 0.6, roughness: 0.3 }, 22);
  motorCap.position.set(dx, dy + 0.048, dz);
  group.add(motorBase, motorCap);

  const prop = buildPropeller(ns, palette, (dx > 0 ? 0.2 : 0.95) + (dz > 0 ? 0.35 : 1.15));
  prop.position.set(dx, dy + 0.058, dz);
  group.add(prop);

  // Thin folded landing leg under the motor.
  const leg = new ns.Mesh(
    new ns.CylinderGeometry(0.006, 0.005, 0.075, 10),
    stdMaterial(ns, palette.metal, { metalness: 0.5, roughness: 0.4 })
  );
  leg.position.set(dx, dy - 0.03, dz);
  leg.rotation.z = dx > 0 ? -0.16 : 0.16;
  leg.castShadow = true;
  group.add(leg);
  return group;
}

function buildPod(ns: Ns, palette: DronePalette): Three.Group {
  const group = new ns.Group();
  // Compact dark camera body: the real gimbal is a small pod under the nose,
  // not a head-sized block hanging in front of the aircraft. The lens itself
  // is the separate gimbal-camera node, so this housing stays lens-free.
  const housing = extrudePlate(ns, 0.085, 0.075, 0.082, 0.026, palette.pod, { metalness: 0.25, roughness: 0.4 });
  group.add(housing);
  const saddle = cylinder(ns, 0.03, 0.02, palette.motor, { metalness: 0.55, roughness: 0.3 }, 18);
  saddle.rotation.x = Math.PI / 2;
  saddle.position.set(0, 0.052, 0);
  group.add(saddle);
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
      // One continuous low fuselage: wide tail, narrow drooping nose. Kept thin
      // so the body reads as a low-slung airframe, not a capsule.
      const lower = extrudeShape(
        ns,
        bodyPlan(ns, 0.2, 0.07, -0.29, 0.3),
        0.042,
        0.009,
        palette.hullLight,
        { metalness: 0.1, roughness: 0.42 }
      );
      group.add(lower);

      // Nose brow: a thin, slightly narrower lip that carries the sensor strip
      // and sits just below the deck line, so the front visibly droops.
      const brow = extrudeShape(
        ns,
        bodyPlan(ns, 0.126, 0.065, 0.02, 0.307),
        0.014,
        0.005,
        palette.hull,
        { metalness: 0.1, roughness: 0.46 }
      );
      brow.position.y = 0.012;
      group.add(brow);

      // Dark sensor strip across the nose face with two forward eyes.
      const band = new ns.Mesh(
        new ns.BoxGeometry(0.156, 0.046, 0.024),
        stdMaterial(ns, palette.sensorDark, { roughness: 0.5 })
      );
      band.position.set(0, 0.004, 0.29);
      group.add(band);
      for (const sx of [-0.05, 0.05]) {
        const ring = cylinder(ns, 0.021, 0.016, palette.motor, { metalness: 0.6, roughness: 0.3 }, 18);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(sx, 0.006, 0.304);
        const eye = cylinder(ns, 0.015, 0.02, palette.glass, { metalness: 0.1, roughness: 0.08 }, 18);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(sx, 0.006, 0.312);
        group.add(ring, eye);
      }

      // Rear cooling vents and two dim status lights (decoration only).
      const ventMat = stdMaterial(ns, palette.sensorDark, { roughness: 0.6 });
      for (const sx of [-0.052, 0.052]) {
        const vent = new ns.Mesh(new ns.BoxGeometry(0.045, 0.026, 0.012), ventMat);
        vent.position.set(sx, 0.006, -0.292);
        group.add(vent);
      }

      // Four short folded struts so the frame reads as standing, not floating.
      const legMat = stdMaterial(ns, palette.metal, { metalness: 0.45, roughness: 0.42 });
      for (const sx of [-0.152, 0.152]) {
        for (const sz of [-0.1, 0.105]) {
          const strut = new ns.Mesh(new ns.CylinderGeometry(0.006, 0.005, 0.05, 8), legMat);
          strut.position.set(sx, -0.05, sz);
          strut.rotation.z = sx > 0 ? -0.3 : 0.3;
          strut.rotation.x = sz > 0 ? 0.12 : -0.12;
          strut.castShadow = true;
          group.add(strut);
        }
      }
      return group;
    }
    case "shell": {
      const coverGroup = new ns.Group();
      // Low rear deck only: leaves the nose low and creates the stepped profile
      // the real aircraft has. Narrower than the hull so a rim of grey shows.
      const deck = extrudeShape(
        ns,
        bodyPlan(ns, 0.182, 0.105, -0.285, 0.05, -0.05),
        0.024,
        0.008,
        palette.hull,
        { metalness: 0.1, roughness: 0.4 }
      );
      deck.position.y = 0.036;
      coverGroup.add(deck);

      // Thin dark seam so the deck reads as a separate cover instead of the
      // same blob as the lower hull.
      const seam = extrudeShape(
        ns,
        bodyPlan(ns, 0.183, 0.106, -0.286, 0.051, -0.05),
        0.005,
        0.002,
        palette.sensorDark,
        { roughness: 0.7 }
      );
      seam.position.y = 0.026;
      coverGroup.add(seam);

      // Dark top panel just behind the deck centre (battery/vent hatch).
      const hatch = extrudePlate(ns, 0.082, 0.092, 0.006, 0.018, palette.sensorDark, { roughness: 0.55 });
      hatch.position.set(0, 0.05, -0.16);
      coverGroup.add(hatch);

      const ventMat = stdMaterial(ns, palette.sensorDark, { roughness: 0.6 });
      for (let i = -1; i <= 1; i += 1) {
        const vent = new ns.Mesh(new ns.BoxGeometry(0.014, 0.004, 0.062), ventMat);
        vent.position.set(i * 0.05, 0.053, -0.055);
        coverGroup.add(vent);
      }
      return coverGroup;
    }
    case "board":
      return extrudePlate(ns, 0.138, 0.168, 0.032, 0.022, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "esc":
      return extrudePlate(ns, 0.108, 0.128, 0.028, 0.018, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "chip":
      return new ns.Mesh(new ns.BoxGeometry(0.075, 0.04, 0.075), stdMaterial(ns, extra?.moduleColor ?? palette.chip, { metalness: 0.3, roughness: 0.4 }));
    case "sensor": {
      const group = new ns.Group();
      for (const sx of [-0.034, 0.034]) {
        const lens = cylinder(ns, 0.02, 0.026, palette.glass, { metalness: 0.2, roughness: 0.1 }, 20);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(sx, 0, 0);
        group.add(lens);
      }
      const bracket = extrudePlate(ns, 0.092, 0.04, 0.012, 0.008, palette.module, { roughness: 0.5 });
      bracket.position.y = -0.014;
      group.add(bracket);
      return group;
    }
    case "arm": {
      if (!extra?.armRoot || !extra?.armTip) return new ns.Group();
      return buildArm(ns, palette, extra.armRoot, extra.armTip);
    }
    case "gimbal-bracket": {
      const group = new ns.Group();
      const plate = extrudePlate(ns, 0.085, 0.075, 0.022, 0.014, palette.hullLight, { metalness: 0.25, roughness: 0.42 });
      group.add(plate);
      const post = new ns.Mesh(new ns.CylinderGeometry(0.016, 0.016, 0.045, 12), stdMaterial(ns, palette.metal, { metalness: 0.55, roughness: 0.32 }));
      post.position.y = -0.03;
      group.add(post);
      return group;
    }
    case "pod":
      return buildPod(ns, palette);
    case "lens": {
      const group = new ns.Group();
      const bezel = cylinder(ns, 0.034, 0.03, palette.motor, { metalness: 0.6, roughness: 0.3 });
      bezel.rotation.x = Math.PI / 2;
      const glass = cylinder(ns, 0.026, 0.04, palette.glass, { metalness: 0.2, roughness: 0.08 }, 26);
      glass.rotation.x = Math.PI / 2;
      glass.position.z = 0.022;
      group.add(bezel, glass);
      return group;
    }
    case "axis-arm": {
      const arm = new ns.Mesh(new ns.BoxGeometry(0.042, 0.042, 0.14), stdMaterial(ns, palette.metal, { metalness: 0.5, roughness: 0.35 }));
      arm.rotation.y = -0.35;
      return arm;
    }
    case "gimbal-motor":
      return cylinder(ns, 0.04, 0.062, palette.motor, { metalness: 0.5, roughness: 0.35 });
    case "remote": {
      const group = new ns.Group();
      const body = extrudePlate(ns, 0.34, 0.22, 0.07, 0.06, palette.remote, { roughness: 0.55 });
      group.add(body);
      for (const sx of [-0.085, 0.085]) {
        const stick = cylinder(ns, 0.024, 0.06, palette.motor, { metalness: 0.5, roughness: 0.35 }, 16);
        stick.position.set(sx, 0.058, 0);
        group.add(stick);
      }
      return group;
    }
    case "remote-board":
      return extrudePlate(ns, 0.2, 0.15, 0.028, 0.025, extra?.moduleColor ?? palette.board, { metalness: 0.2, roughness: 0.55 });
    case "antenna": {
      const group = new ns.Group();
      for (const sx of [-0.07, 0.07]) {
        const rod = cylinder(ns, 0.012, 0.17, palette.motor, { metalness: 0.4, roughness: 0.4 }, 12);
        rod.position.set(sx, 0.09, -0.1);
        rod.rotation.x = -0.25;
        group.add(rod);
      }
      return group;
    }
    case "battery-pack":
      return extrudePlate(ns, 0.145, 0.18, 0.07, 0.035, extra?.moduleColor ?? palette.module, { roughness: 0.6 });
    default:
      return new ns.Group();
  }
}
