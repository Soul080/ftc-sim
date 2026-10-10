import {
  ALLIANCE_AREA_DEEP_IN,
  ALLIANCE_AREA_WIDE_IN,
  CELL_CENTER_ARM_IN,
  FIELD_IN,
  FLOWER_INSET_IN,
  FLOWER_MIDDLE_IN,
  GARDEN_ALONG_IN,
  GARDEN_DEEP_IN,
  HALF_IN,
  HIVE_PIVOT_HEIGHT_IN,
  HIVE_PIVOT_SEPARATION_IN,
  LOADING_ZONE_ALONG_IN,
  LOADING_ZONE_DEEP_IN,
  NECTAR_IN_CELL,
  NECTAR_IN_TRAY,
  POLLEN_COUNT,
  POLLEN_DIAMETER_IN,
  POLLEN_PER_FLOWER,
  POLLEN_PER_GARDEN,
  PRELOAD_POLLEN,
  TILE_IN,
  type Alliance,
} from "./constants";

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FlowerSpec {
  id: string;
  x: number;
  z: number;
  /** Horizontal unit vector from the flower toward the field interior. */
  openX: number;
  openZ: number;
  wall: "far" | "audience" | "red" | "blue";
}

export interface HiveSpec {
  alliance: Alliance;
  /** Pivot X, inches. Red is on the audience-left side. */
  pivotX: number;
  /** Starting tilt in degrees. Positive raises the audience cell. */
  startTiltDeg: number;
}

export interface RobotStart {
  id: string;
  alliance: Alliance;
  slot: 1 | 2;
  x: number;
  z: number;
  /** Yaw in radians. 0 faces +Z (far). Positive yaw turns toward +X (blue). */
  yaw: number;
}

export type SpawnKind =
  | { mode: "free" }
  | { mode: "held"; robotId: string }
  | { mode: "hive"; alliance: Alliance }
  | { mode: "lower-flower"; flowerId: string };

export interface PieceSpawn {
  id: string;
  kind: "pollen" | "nectar";
  alliance: Alliance | null;
  x: number;
  y: number;
  z: number;
  spawn: SpawnKind;
}

/**
 * Axes, inches. +Z is the far wall, −Z is the audience. A driver looking from
 * the audience toward the far wall has +X on the left, so red lives at +X
 * (manual §9.2: red alliance area on the left from the primary audience).
 */
export const RED_GARDEN: Aabb = {
  minX: HALF_IN - GARDEN_ALONG_IN,
  maxX: HALF_IN,
  minZ: HALF_IN - GARDEN_DEEP_IN,
  maxZ: HALF_IN,
};

export const BLUE_GARDEN: Aabb = {
  minX: -HALF_IN,
  maxX: -HALF_IN + GARDEN_ALONG_IN,
  minZ: -HALF_IN,
  maxZ: -HALF_IN + GARDEN_DEEP_IN,
};

/** Tile A5, red wall. Rows count from the far side: row 1 is +Z. */
export const RED_LOADING_ZONE: Aabb = {
  minX: HALF_IN - LOADING_ZONE_DEEP_IN,
  maxX: HALF_IN,
  minZ: -HALF_IN + TILE_IN,
  maxZ: -HALF_IN + TILE_IN + LOADING_ZONE_ALONG_IN,
};

/** Tile F2, blue wall. 180° from the red zone (z 24 in to 48 in). */
export const BLUE_LOADING_ZONE: Aabb = {
  minX: -HALF_IN,
  maxX: -HALF_IN + LOADING_ZONE_DEEP_IN,
  minZ: HALF_IN - 2 * TILE_IN,
  maxZ: HALF_IN - TILE_IN,
};

export const RED_ALLIANCE_AREA: Aabb = {
  minX: HALF_IN,
  maxX: HALF_IN + ALLIANCE_AREA_DEEP_IN,
  minZ: -ALLIANCE_AREA_WIDE_IN / 2,
  maxZ: ALLIANCE_AREA_WIDE_IN / 2,
};

export const BLUE_ALLIANCE_AREA: Aabb = {
  minX: -HALF_IN - ALLIANCE_AREA_DEEP_IN,
  maxX: -HALF_IN,
  minZ: -ALLIANCE_AREA_WIDE_IN / 2,
  maxZ: ALLIANCE_AREA_WIDE_IN / 2,
};

/**
 * One flower on each wall, centered. The field-reset guide says the cells
 * that start facing down point at flowers on the audience and far walls,
 * and the setup guide mounts four flowers at perimeter-pin locations.
 * Exact station offsets are in the CAD, not the manual text.
 */
export const FLOWERS: FlowerSpec[] = [
  { id: "far", x: 0, z: HALF_IN - FLOWER_INSET_IN, openX: 0, openZ: -1, wall: "far" },
  { id: "audience", x: 0, z: -HALF_IN + FLOWER_INSET_IN, openX: 0, openZ: 1, wall: "audience" },
  { id: "red", x: HALF_IN - FLOWER_INSET_IN, z: 0, openX: -1, openZ: 0, wall: "red" },
  { id: "blue", x: -HALF_IN + FLOWER_INSET_IN, z: 0, openX: 1, openZ: 0, wall: "blue" },
];

export const HIVES: HiveSpec[] = [
  {
    alliance: "red",
    pivotX: HIVE_PIVOT_SEPARATION_IN / 2,
    startTiltDeg: 28,
  },
  {
    alliance: "blue",
    pivotX: -HIVE_PIVOT_SEPARATION_IN / 2,
    startTiltDeg: -28,
  },
];

export function tileAabb(column: number, row: number): Aabb {
  const x1 = HALF_IN - column * TILE_IN;
  const z1 = HALF_IN - row * TILE_IN;
  return { minX: x1 - TILE_IN, maxX: x1, minZ: z1 - TILE_IN, maxZ: z1 };
}

export function tileLabel(column: number, row: number): string {
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

export function loadingZone(alliance: Alliance): Aabb {
  return alliance === "red" ? RED_LOADING_ZONE : BLUE_LOADING_ZONE;
}

export function garden(alliance: Alliance): Aabb {
  return alliance === "red" ? RED_GARDEN : BLUE_GARDEN;
}

export function robotStarts(count: 2 | 4, lengthIn: number): RobotStart[] {
  const gap = 0.15;
  const red1: RobotStart = {
    id: "red-1",
    alliance: "red",
    slot: 1,
    x: HALF_IN - lengthIn / 2 - gap,
    z: 34,
    yaw: -Math.PI / 2,
  };
  const blue1: RobotStart = {
    id: "blue-1",
    alliance: "blue",
    slot: 1,
    x: -HALF_IN + lengthIn / 2 + gap,
    z: -34,
    yaw: Math.PI / 2,
  };
  const starts = [red1, blue1];
  if (count === 4) {
    starts.push(
      {
        id: "red-2",
        alliance: "red",
        slot: 2,
        x: 36,
        z: HALF_IN - lengthIn / 2 - gap,
        yaw: Math.PI,
      },
      {
        id: "blue-2",
        alliance: "blue",
        slot: 2,
        x: -36,
        z: -HALF_IN + lengthIn / 2 + gap,
        yaw: 0,
      },
    );
  }
  return starts;
}

export interface Footprint {
  x: number;
  z: number;
  lengthIn: number;
  widthIn: number;
  yaw: number;
}

export function robotCorners(foot: Footprint): Array<{ x: number; z: number }> {
  const hl = foot.lengthIn / 2;
  const hw = foot.widthIn / 2;
  const fx = Math.sin(foot.yaw);
  const fz = Math.cos(foot.yaw);
  const rx = Math.cos(foot.yaw);
  const rz = -Math.sin(foot.yaw);
  const corners: Array<{ x: number; z: number }> = [];
  for (const sF of [-1, 1]) {
    for (const sR of [-1, 1]) {
      corners.push({
        x: foot.x + fx * sF * hl + rx * sR * hw,
        z: foot.z + fz * sF * hl + rz * sR * hw,
      });
    }
  }
  return corners;
}

const TOUCH_EPS_IN = 0.8;

export function touchingPerimeter(foot: Footprint): boolean {
  for (const corner of robotCorners(foot)) {
    if (
      corner.x <= -HALF_IN + TOUCH_EPS_IN ||
      corner.x >= HALF_IN - TOUCH_EPS_IN ||
      corner.z <= -HALF_IN + TOUCH_EPS_IN ||
      corner.z >= HALF_IN - TOUCH_EPS_IN
    ) {
      return true;
    }
  }
  return false;
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b1 && b0 <= a1;
}

/** Oriented robot footprint against an axis-aligned zone. Partial overlap counts (§10.5.4). */
export function footprintHitsZone(foot: Footprint, zone: Aabb): boolean {
  const corners = robotCorners(foot);
  const axes = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: Math.sin(foot.yaw), z: Math.cos(foot.yaw) },
    { x: Math.cos(foot.yaw), z: -Math.sin(foot.yaw) },
  ];
  const zoneCorners = [
    { x: zone.minX, z: zone.minZ },
    { x: zone.maxX, z: zone.minZ },
    { x: zone.maxX, z: zone.maxZ },
    { x: zone.minX, z: zone.maxZ },
  ];
  for (const axis of axes) {
    let aMin = Infinity;
    let aMax = -Infinity;
    for (const corner of corners) {
      const p = corner.x * axis.x + corner.z * axis.z;
      aMin = Math.min(aMin, p);
      aMax = Math.max(aMax, p);
    }
    let bMin = Infinity;
    let bMax = -Infinity;
    for (const corner of zoneCorners) {
      const p = corner.x * axis.x + corner.z * axis.z;
      bMin = Math.min(bMin, p);
      bMax = Math.max(bMax, p);
    }
    if (!intervalsOverlap(aMin, aMax, bMin, bMax)) return false;
  }
  return true;
}

export function inLoadingZone(foot: Footprint, alliance: Alliance): boolean {
  return footprintHitsZone(foot, loadingZone(alliance));
}

function lineOfPollen(
  originX: number,
  originZ: number,
  stepX: number,
  stepZ: number,
  count: number,
  idPrefix: string,
): PieceSpawn[] {
  const radius = POLLEN_DIAMETER_IN / 2;
  const spawns: PieceSpawn[] = [];
  for (let i = 0; i < count; i += 1) {
    spawns.push({
      id: `${idPrefix}-${i}`,
      kind: "pollen",
      alliance: null,
      x: originX + stepX * i,
      y: radius,
      z: originZ + stepZ * i,
      spawn: { mode: "free" },
    });
  }
  return spawns;
}

export function pieceSpawns(robotCount: 2 | 4): PieceSpawn[] {
  const radius = POLLEN_DIAMETER_IN / 2;
  const pieces: PieceSpawn[] = [];

  for (const flower of FLOWERS) {
    for (let i = 0; i < POLLEN_PER_FLOWER; i += 1) {
      const jitter = i % 2 === 0 ? 0.35 : -0.35;
      pieces.push({
        id: `pollen-${flower.id}-${i}`,
        kind: "pollen",
        alliance: null,
        x: flower.x + flower.openZ * jitter,
        y: radius + i * 1.85,
        z: flower.z - flower.openX * jitter,
        spawn: { mode: "lower-flower", flowerId: flower.id },
      });
    }
  }

  pieces.push(
    ...lineOfPollen(HALF_IN - radius - 0.2, HALF_IN - radius - 0.15, -POLLEN_DIAMETER_IN, 0, POLLEN_PER_GARDEN, "pollen-garden-red"),
    ...lineOfPollen(-HALF_IN + radius + 0.2, -HALF_IN + radius + 0.15, POLLEN_DIAMETER_IN, 0, POLLEN_PER_GARDEN, "pollen-garden-blue"),
  );

  const present = new Set(robotStarts(robotCount, 16).map((robot) => robot.id));
  for (const id of ["red-1", "red-2", "blue-1", "blue-2"]) {
    if (present.has(id)) {
      for (let i = 0; i < PRELOAD_POLLEN; i += 1) {
        pieces.push({
          id: `pollen-preload-${id}-${i}`,
          kind: "pollen",
          alliance: null,
          x: 0,
          y: 8,
          z: 0,
          spawn: { mode: "held", robotId: id },
        });
      }
    }
  }

  if (robotCount === 2) {
    const zoneCenter = (zone: Aabb): { x: number; z: number } => ({
      x: zone.minX < 0 ? zone.minX + radius : zone.maxX - radius,
      z: (zone.minZ + zone.maxZ) / 2 - 1.5 * POLLEN_DIAMETER_IN,
    });
    for (const [alliance, zone] of [
      ["red", RED_LOADING_ZONE],
      ["blue", BLUE_LOADING_ZONE],
    ] as const) {
      const origin = zoneCenter(zone);
      pieces.push(
        ...lineOfPollen(origin.x, origin.z, 0, POLLEN_DIAMETER_IN, PRELOAD_POLLEN, `pollen-absent-${alliance}`),
      );
    }
  }

  for (const hive of HIVES) {
    const audienceUp = hive.startTiltDeg > 0;
    for (let i = 0; i < NECTAR_IN_CELL; i += 1) {
      const along = (i - 1) * 3.2;
      const arm = CELL_CENTER_ARM_IN - 2;
      const z = audienceUp ? -arm : arm;
      pieces.push({
        id: `nectar-cell-${hive.alliance}-${i}`,
        kind: "nectar",
        alliance: hive.alliance,
        x: hive.pivotX + along,
        y: HIVE_PIVOT_HEIGHT_IN,
        z,
        spawn: { mode: "hive", alliance: hive.alliance },
      });
    }
  }

  return pieces;
}

export function trayNectar(alliance: Alliance): number {
  void alliance;
  return NECTAR_IN_TRAY;
}

export function countPieces(spawns: PieceSpawn[]): { pollen: number; nectarOnField: number } {
  let pollen = 0;
  let nectarOnField = 0;
  for (const spawn of spawns) {
    if (spawn.kind === "pollen") pollen += 1;
    else nectarOnField += 1;
  }
  return { pollen, nectarOnField };
}

export function expectedPollenCount(): number {
  return POLLEN_COUNT;
}

export function fieldInches(): number {
  return FIELD_IN;
}

export function flowerMiddleInches(): number {
  return FLOWER_MIDDLE_IN;
}
