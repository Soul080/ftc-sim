import * as THREE from "three";
import {
  FIELD_IN,
  GARDEN_ALONG_IN,
  GARDEN_DEEP_IN,
  HALF_IN,
  TILE_IN,
  m,
} from "../rules/constants";
import {
  BLUE_ALLIANCE_AREA,
  BLUE_GARDEN,
  BLUE_LOADING_ZONE,
  RED_ALLIANCE_AREA,
  RED_GARDEN,
  RED_LOADING_ZONE,
  tileLabel,
  type Aabb,
} from "../rules/layout";

const X0 = -126;
const X1 = 126;
const Z0 = -96;
const Z1 = 84;

export function floorSize(): { width: number; depth: number } {
  return { width: m(X1 - X0), depth: m(Z1 - Z0) };
}

export function paintFloor(canvas: HTMLCanvasElement): void {
  const pxPerIn = 8;
  canvas.width = (X1 - X0) * pxPerIn;
  canvas.height = (Z1 - Z0) * pxPerIn;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const toX = (inches: number) => (inches - X0) * pxPerIn;
  const toY = (zInches: number) => (Z1 - zInches) * pxPerIn;

  ctx.fillStyle = "#2a322c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  fillZone(ctx, toX, toY, RED_ALLIANCE_AREA, "rgba(180, 40, 40, 0.16)");
  fillZone(ctx, toX, toY, BLUE_ALLIANCE_AREA, "rgba(36, 78, 180, 0.16)");

  for (let column = 0; column < 6; column += 1) {
    for (let row = 0; row < 6; row += 1) {
      const x = -HALF_IN + column * TILE_IN;
      const z = HALF_IN - row * TILE_IN;
      const shade = (column + row) % 2 === 0 ? "#7d827c" : "#737870";
      ctx.fillStyle = shade;
      ctx.fillRect(toX(x), toY(z), TILE_IN * pxPerIn, TILE_IN * pxPerIn);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.font = "600 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tileLabel(column, row), toX(x + TILE_IN / 2), toY(z - TILE_IN / 2));
    }
  }

  ctx.strokeStyle = "rgba(20, 24, 20, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 6; i += 1) {
    const x = toX(-HALF_IN + i * TILE_IN);
    ctx.beginPath();
    ctx.moveTo(x, toY(HALF_IN));
    ctx.lineTo(x, toY(-HALF_IN));
    ctx.stroke();
    const y = toY(HALF_IN - i * TILE_IN);
    ctx.beginPath();
    ctx.moveTo(toX(-HALF_IN), y);
    ctx.lineTo(toX(HALF_IN), y);
    ctx.stroke();
  }

  paintTape(ctx, toX, toY, RED_LOADING_ZONE, "#d21f2a");
  paintTape(ctx, toX, toY, BLUE_LOADING_ZONE, "#1d4ed8");
  paintTape(ctx, toX, toY, RED_GARDEN, "#d21f2a");
  paintTape(ctx, toX, toY, BLUE_GARDEN, "#1d4ed8");

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(toX(-HALF_IN), toY(HALF_IN), FIELD_IN * pxPerIn, FIELD_IN * pxPerIn);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RED ALLIANCE", toX((RED_ALLIANCE_AREA.minX + RED_ALLIANCE_AREA.maxX) / 2), toY(0));
  ctx.fillText("BLUE ALLIANCE", toX((BLUE_ALLIANCE_AREA.minX + BLUE_ALLIANCE_AREA.maxX) / 2), toY(0));
  ctx.font = "700 22px sans-serif";
  ctx.fillText("AUDIENCE", toX(0), toY(-84));
  ctx.fillText("FAR / SCORING", toX(0), toY(78));

  ctx.font = "600 13px sans-serif";
  ctx.fillStyle = "rgba(255,220,220,0.85)";
  ctx.fillText("GARDEN", toX(-HALF_IN + GARDEN_ALONG_IN / 2), toY(HALF_IN - GARDEN_DEEP_IN - 3));
  ctx.fillStyle = "rgba(210,225,255,0.9)";
  ctx.fillText("GARDEN", toX(HALF_IN - GARDEN_ALONG_IN / 2), toY(-HALF_IN + GARDEN_DEEP_IN + 3));
  ctx.fillStyle = "rgba(255,220,220,0.85)";
  ctx.fillText("LOAD", toX(-HALF_IN + 6), toY((RED_LOADING_ZONE.minZ + RED_LOADING_ZONE.maxZ) / 2));
  ctx.fillStyle = "rgba(210,225,255,0.9)";
  ctx.fillText("LOAD", toX(HALF_IN - 6), toY((BLUE_LOADING_ZONE.minZ + BLUE_LOADING_ZONE.maxZ) / 2));
}

function fillZone(
  ctx: CanvasRenderingContext2D,
  toX: (inches: number) => number,
  toY: (z: number) => number,
  zone: Aabb,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(toX(zone.minX), toY(zone.maxZ), (zone.maxX - zone.minX) * 8, (zone.maxZ - zone.minZ) * 8);
}

function paintTape(
  ctx: CanvasRenderingContext2D,
  toX: (inches: number) => number,
  toY: (z: number) => number,
  zone: Aabb,
  color: string,
): void {
  ctx.fillStyle = color;
  const x = toX(zone.minX);
  const y = toY(zone.maxZ);
  const w = (zone.maxX - zone.minX) * 8;
  const h = (zone.maxZ - zone.minZ) * 8;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(x, y, w, h);
}

export function makeFloorMesh(): THREE.Mesh {
  const canvas = document.createElement("canvas");
  paintFloor(canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // Plane +Y (texture top, flipY on) lands on world −Z after rotateX(−π/2).
  // The painted canvas puts the far wall at the top, so leave the image unflipped.
  texture.flipY = false;
  const size = floorSize();
  const geometry = new THREE.PlaneGeometry(size.width, size.depth);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(m((X0 + X1) / 2), 0.001, m((Z0 + Z1) / 2));
  mesh.receiveShadow = true;
  return mesh;
}
