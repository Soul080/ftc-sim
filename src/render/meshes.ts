import * as THREE from "three";
import {
  CELL_CENTER_ARM_IN,
  CELL_DEPTH_IN,
  CELL_OPENING_H_IN,
  CELL_OPENING_W_IN,
  FLOWER_BACKSTOP_IN,
  FLOWER_MIDDLE_IN,
  FLOWER_MOUTH_DIAMETER_IN,
  FLOWER_TOP_IN,
  HALF_IN,
  HIVE_FRAME_DEPTH_IN,
  HIVE_FRAME_WIDTH_IN,
  HIVE_PIVOT_HEIGHT_IN,
  HIVE_PIVOT_SEPARATION_IN,
  NECTAR_DIAMETER_IN,
  POLLEN_DIAMETER_IN,
  WALL_ABOVE_TILE_IN,
  m,
  type Alliance,
} from "../rules/constants";
import type { FlowerSpec } from "../rules/layout";

const pollenGeo = new THREE.SphereGeometry(m(POLLEN_DIAMETER_IN / 2), 24, 18);
const nectarGeo = new THREE.SphereGeometry(m(NECTAR_DIAMETER_IN / 2), 24, 18);

function ballTexture(fill: string, hole: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = hole;
    for (let y = 16; y < 128; y += 28) {
      for (let x = 12 + ((y / 28) % 2) * 14; x < 128; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(46, 40, 18, 10, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const pollenMat = new THREE.MeshStandardMaterial({
  color: 0xffe08a,
  map: ballTexture("#f0c43a", "#8a5a12"),
  roughness: 0.38,
  metalness: 0.08,
  emissive: 0x3a2a08,
  emissiveIntensity: 0.22,
});
const nectarMats: Record<Alliance, THREE.MeshStandardMaterial> = {
  red: new THREE.MeshStandardMaterial({
    color: 0xffb0b0,
    map: ballTexture("#e23b3b", "#6d1218"),
    roughness: 0.32,
    metalness: 0.12,
    emissive: 0x3a0808,
    emissiveIntensity: 0.2,
  }),
  blue: new THREE.MeshStandardMaterial({
    color: 0xc5d8ff,
    map: ballTexture("#2f74f0", "#0c2c66"),
    roughness: 0.32,
    metalness: 0.12,
    emissive: 0x061838,
    emissiveIntensity: 0.2,
  }),
};

export function makeBall(kind: "pollen" | "nectar", alliance: Alliance | null): THREE.Mesh {
  const mesh = new THREE.Mesh(
    kind === "pollen" ? pollenGeo : nectarGeo,
    kind === "pollen" ? pollenMat : nectarMats[alliance ?? "red"],
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeWalls(): THREE.Group {
  const group = new THREE.Group();
  const height = m(WALL_ABOVE_TILE_IN);
  const thick = m(1.1);
  const span = m(HALF_IN) + thick;
  const panel = new THREE.MeshStandardMaterial({
    color: 0xd5dde4,
    transparent: true,
    opacity: 0.16,
    roughness: 0.05,
    metalness: 0.15,
    depthWrite: false,
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2c3134, roughness: 0.45, metalness: 0.6 });
  const specs = [
    { x: 0, z: m(HALF_IN) + thick / 2, w: span * 2, d: thick },
    { x: 0, z: -m(HALF_IN) - thick / 2, w: span * 2, d: thick },
    { x: m(HALF_IN) + thick / 2, z: 0, w: thick, d: span * 2 },
    { x: -m(HALF_IN) - thick / 2, z: 0, w: thick, d: span * 2 },
  ];
  for (const spec of specs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, height, spec.d), panel);
    mesh.position.set(spec.x, height / 2, spec.z);
    group.add(mesh);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(spec.w, m(1.15), spec.d), railMat);
    rail.position.set(spec.x, height - m(0.4), spec.z);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}

export function makeFlower(spec: FlowerSpec): THREE.Group {
  const group = new THREE.Group();
  group.position.set(m(spec.x), 0, m(spec.z));
  const yaw = Math.atan2(spec.openX, spec.openZ);
  group.rotation.y = yaw;

  const stem = new THREE.MeshStandardMaterial({ color: 0x3e7d49, roughness: 0.7 });
  const petal = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.55 });
  const center = new THREE.MeshStandardMaterial({
    color: 0xf0c14d,
    roughness: 0.4,
    emissive: 0x5a3e08,
    emissiveIntensity: 0.25,
  });
  const radius = m(FLOWER_MOUTH_DIAMETER_IN / 2 + 0.55);
  for (const height of [m(0.5), m(FLOWER_MIDDLE_IN), m(FLOWER_TOP_IN)]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, m(0.28), 8, 20), height === m(FLOWER_TOP_IN) ? center : petal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    ring.castShadow = true;
    group.add(ring);
  }
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(m(0.28), m(0.28), m(FLOWER_TOP_IN), 8), stem);
    pipe.position.set(Math.sin(angle) * radius, m(FLOWER_TOP_IN) / 2, Math.cos(angle) * radius);
    pipe.castShadow = true;
    group.add(pipe);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(m(6), m(FLOWER_BACKSTOP_IN), m(0.4)), petal);
  back.position.set(0, m(FLOWER_TOP_IN + FLOWER_BACKSTOP_IN / 2), -radius);
  group.add(back);
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(m(1.7), m(1.55), m(FLOWER_MIDDLE_IN - 0.4), 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe7f2df, roughness: 0.6, side: THREE.DoubleSide }),
  );
  cup.position.y = m((FLOWER_MIDDLE_IN - 0.4) / 2);
  group.add(cup);
  return group;
}

export function makeFrame(): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc5ced6, roughness: 0.35, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x596068, roughness: 0.4, metalness: 0.5 });
  const halfW = m(HIVE_FRAME_WIDTH_IN / 2);
  const halfD = m(HIVE_FRAME_DEPTH_IN / 2);
  const pivotY = m(HIVE_PIVOT_HEIGHT_IN);
  const pivotXs = [-m(HIVE_PIVOT_SEPARATION_IN / 2), m(HIVE_PIVOT_SEPARATION_IN / 2)];
  for (const x of pivotXs) {
    addStrut(group, new THREE.Vector3(x, 0, -halfD), new THREE.Vector3(x, pivotY, 0), m(0.85), metal);
    addStrut(group, new THREE.Vector3(x, 0, halfD), new THREE.Vector3(x, pivotY, 0), m(0.85), metal);
  }
  addStrut(
    group,
    new THREE.Vector3(pivotXs[0]!, pivotY, 0),
    new THREE.Vector3(pivotXs[1]!, pivotY, 0),
    m(0.7),
    metal,
  );
  for (const z of [-halfD, halfD]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, m(0.7), m(1.3)), dark);
    rail.position.set(0, m(0.4), z);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  }
  return group;
}

function addStrut(
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  thickness: number,
  material: THREE.Material,
): void {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const length = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, length), material);
  mesh.position.copy(mid);
  mesh.lookAt(b);
  mesh.castShadow = true;
  group.add(mesh);
}

export function makeBeam(alliance: Alliance): THREE.Group {
  const beam = new THREE.Group();
  const color = alliance === "red" ? 0xc62828 : 0x1565c0;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.12 });
  const arm = m(CELL_CENTER_ARM_IN);
  beam.add(makeCell(mat, -1, -arm));
  beam.add(makeCell(mat, 1, arm));
  const axle = new THREE.Mesh(
    new THREE.BoxGeometry(m(2.2), m(1.2), arm * 2),
    new THREE.MeshStandardMaterial({ color: 0x88929a, metalness: 0.7, roughness: 0.35 }),
  );
  axle.castShadow = true;
  beam.add(axle);
  return beam;
}

function makeCell(material: THREE.Material, openingSign: number, centerZ: number): THREE.Group {
  const cell = new THREE.Group();
  cell.position.z = centerZ;
  const w = m(CELL_OPENING_W_IN);
  const h = m(CELL_OPENING_H_IN);
  const d = m(CELL_DEPTH_IN);
  const t = m(0.45);
  const panels: Array<[number, number, number, number, number, number]> = [
    [w, t, d, 0, -h / 2, 0],
    [w, t, d * 0.72, 0, h / 2, openingSign * d * 0.08],
    [t, h, d, -w / 2, 0, 0],
    [t, h, d, w / 2, 0, 0],
    [w, h, t, 0, 0, -openingSign * d / 2],
    [w, h * 0.28, t, 0, -h * 0.28, openingSign * d / 2],
  ];
  for (const [sx, sy, sz, x, y, z] of panels) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cell.add(mesh);
  }
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(m(3.2), m(3.2)),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 }),
  );
  tag.rotation.x = Math.PI / 2;
  tag.position.y = -h / 2 - 0.004;
  cell.add(tag);
  return cell;
}

export function makeRobot(
  alliance: Alliance,
  label: string,
  lengthIn: number,
  widthIn: number,
  heightIn: number,
  colorHex?: number,
): THREE.Group {
  const group = new THREE.Group();
  const color = colorHex ?? (alliance === "red" ? 0xd64545 : 0x3a78ef);
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.42, metalness: 0.35 });
  const skirt = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.18 });
  skirt.name = "skirt";
  const body = new THREE.Mesh(new THREE.BoxGeometry(m(widthIn * 0.72), m(heightIn * 0.46), m(lengthIn * 0.78)), shell);
  body.name = "body";
  body.position.y = m(heightIn * 0.48);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(m(widthIn), m(heightIn * 0.16), m(lengthIn)), skirt);
  rail.name = "skirt";
  rail.position.y = m(heightIn * 0.22);
  rail.castShadow = true;
  group.add(rail);

  addBumper(group, "FRONT", m(widthIn * 0.86), m(2.1), m(0.55), 0, m(heightIn * 0.34), m(lengthIn / 2 + 0.15), 0xf6c445, "#1a1404");
  addBumper(group, "BACK", m(widthIn * 0.86), m(2.1), m(0.55), 0, m(heightIn * 0.34), -m(lengthIn / 2 + 0.15), 0x1c1f22, "#f4f1ea");
  addBumper(group, "LEFT", m(0.55), m(2.1), m(lengthIn * 0.62), -m(widthIn / 2 + 0.12), m(heightIn * 0.34), 0, color, "#f7f4ec");
  addBumper(group, "RIGHT", m(0.55), m(2.1), m(lengthIn * 0.62), m(widthIn / 2 + 0.12), m(heightIn * 0.34), 0, color, "#f7f4ec");

  const plate = labeledPlate(label, alliance === "red" ? "#8d1d1d" : "#163e86", true);
  plate.position.y = m(heightIn * 0.74);
  group.add(plate);

  const turret = new THREE.Group();
  turret.name = "turret";
  turret.position.y = m(heightIn * 0.78);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(m(1.7), m(1.9), m(1.1), 16),
    new THREE.MeshStandardMaterial({ color: 0x3a4146, roughness: 0.4, metalness: 0.55 }),
  );
  base.castShadow = true;
  turret.add(base);
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(m(widthIn * 0.28), m(1.5), m(lengthIn * 0.42)),
    new THREE.MeshStandardMaterial({ color: 0x1c2124, roughness: 0.32, metalness: 0.62 }),
  );
  hood.position.set(0, m(1.1), m(lengthIn * 0.12));
  hood.name = "hood";
  hood.castShadow = true;
  turret.add(hood);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(m(0.55), m(0.7), m(lengthIn * 0.34), 12),
    new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.25, metalness: 0.8 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, m(1.15), m(lengthIn * 0.32));
  barrel.castShadow = true;
  turret.add(barrel);
  group.add(turret);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d2,
    emissive: 0xffe7a8,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  for (const x of [-m(widthIn * 0.22), m(widthIn * 0.22)]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(m(0.55), 12, 10), lampMat);
    lamp.position.set(x, m(heightIn * 0.5), m(lengthIn / 2 + 0.2));
    group.add(lamp);
  }

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.72 });
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0xe2b034, roughness: 0.45, metalness: 0.15 });
  const wheelGeo = new THREE.CylinderGeometry(m(1.9), m(1.9), m(1.55), 16);
  const hx = m(widthIn / 2 - 1.5);
  const hz = m(lengthIn / 2 - 2.2);
  for (const x of [-hx, hx]) {
    for (const z of [-hz, hz]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, m(1.9), z);
      wheel.castShadow = true;
      const roller = new THREE.Mesh(new THREE.BoxGeometry(m(1.7), m(0.38), m(1.15)), rollerMat);
      roller.position.y = m(1.9);
      wheel.add(roller);
      group.add(wheel);
    }
  }
  return group;
}

function addBumper(
  group: THREE.Group,
  text: string,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  color: number,
  ink: string,
): void {
  const mesh = labeledPlate(text, `#${color.toString(16).padStart(6, "0")}`, false, ink);
  mesh.scale.set(width / m(4), height / m(1.4), depth / m(0.35));
  mesh.position.set(x, y, z);
  if (Math.abs(x) > Math.abs(z)) mesh.rotation.y = Math.PI / 2;
  group.add(mesh);
}

function labeledPlate(text: string, fill: string, arrow: boolean, ink = "#f7f4ec"): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 256, 128);
    if (arrow) {
      ctx.fillStyle = "#f6c445";
      ctx.beginPath();
      ctx.moveTo(128, 18);
      ctx.lineTo(168, 58);
      ctx.lineTo(88, 58);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = ink;
    ctx.font = "700 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, arrow ? 86 : 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(m(4), m(1.4), m(0.35)),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.05 }),
  );
  mesh.castShadow = true;
  mesh.userData.texture = texture;
  return mesh;
}

export function disposeRobotTextures(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const texture = obj.userData.texture as THREE.Texture | undefined;
    texture?.dispose();
  });
}

export function recolorRobot(group: THREE.Group, colorHex: number): void {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !(obj.material instanceof THREE.MeshStandardMaterial)) return;
    if (obj.name === "body" || obj.name === "skirt" || obj.material.name === "skirt") obj.material.color.setHex(colorHex);
  });
}
