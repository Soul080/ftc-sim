/**
 * Nominal BIOBUZZ numbers used by the simulator.
 * Citations refer to the 2026–2027 FIRST Tech Challenge Competition Manual
 * and the Event Field Setup Guide Rev 1.0 (12 Sep 2026), as published on
 * firstinspires.org. Values marked ESTIMATE are not printed as text callouts
 * (they live in figures or are derived) and are called out in the README.
 */

export type Alliance = "red" | "blue";
export type PieceKind = "pollen" | "nectar";

export const INCH = 0.0254;
export const m = (inches: number): number => inches * INCH;
export const inches = (meters: number): number => meters / INCH;

/** §9.2 — inside face of the perimeter, nominal. */
export const FIELD_IN = 144;
export const HALF_IN = FIELD_IN / 2;
/** §9.2 — 36 tiles, each nominally 24 in square. */
export const TILE_IN = 24;
export const TILE_THICKNESS_IN = 0.59;

/**
 * AndyMark am-0481 perimeter height is 12.3 in (product page). Tiles are
 * 0.59 in thick and sit inside the walls, so the wall rises about 11.7 in
 * above the playing surface. The manual does not print this height.
 */
export const WALL_ABOVE_TILE_IN = 11.7;

/** §9.3 / glossary — loading zone, includes the tape. */
export const LOADING_ZONE_DEEP_IN = 11;
/**
 * Setup guide §8.3 puts the side boundaries on the tile seams (24 in apart).
 * The manual calls the width "approximately 23 in" (§9.3). The sim uses the
 * seam-to-seam construction width.
 */
export const LOADING_ZONE_ALONG_IN = TILE_IN;

/** §9.3 / glossary — garden. */
export const GARDEN_ALONG_IN = 23;
export const GARDEN_DEEP_IN = 2;

/** §9.5 — alliance area outside the field. */
export const ALLIANCE_AREA_WIDE_IN = 97;
export const ALLIANCE_AREA_DEEP_IN = 54;

/** §9.6.1 */
export const HIVE_FRAME_WIDTH_IN = 49.46;
export const HIVE_FRAME_DEPTH_IN = 38.95;
export const HIVE_PIVOT_HEIGHT_IN = 43.95;
/**
 * ESTIMATE from Figure 10-3 (center-to-center of the two hive pivots).
 * Not a text callout in §9.6.
 */
export const HIVE_PIVOT_SEPARATION_IN = 25.5;
/** §9.6.2 — cells "approximately 18.8 in apart" (the gap, see README). */
export const CELL_GAP_IN = 18.8;
/** §9.6.2 / §9.7 figures — cell opening and body. */
export const CELL_OPENING_W_IN = 20;
export const CELL_OPENING_H_IN = 14;
export const CELL_DEPTH_IN = 12;
/**
 * ESTIMATE. Beam half-length to the cell center:
 * (CELL_GAP_IN + CELL_DEPTH_IN) / 2, matching the §9.6 "18.8 in apart" gap
 * plus the 12 in cell depth. Figure 9-9 is the drawing of record.
 */
export const CELL_CENTER_ARM_IN = (CELL_GAP_IN + CELL_DEPTH_IN) / 2;
/**
 * ESTIMATE. Stable seesaw angle. Figure 10-3 shows the opening plane about
 * 30° above horizontal; 28° puts the audience/far cell clearly up or down
 * while leaving a drive-under gap.
 */
export const STABLE_TILT_DEG = 28;

/** §9.7 */
export const FLOWER_TOP_IN = 21.5;
export const FLOWER_MOUTH_DIAMETER_IN = 4;
export const FLOWER_BACKSTOP_IN = 1.25;
export const FLOWER_RETRIEVAL_H_IN = 3.55;
export const FLOWER_RETRIEVAL_D_IN = 3.57;
export const FLOWER_LOWER_HOLE_DIAMETER_IN = 2.79;
export const FLOWER_LOWER_RING_H_IN = 0.4;
/**
 * ESTIMATE. Figure 9-12 does not survive text extraction. 10 in sits above a
 * zig-zag stack of 4 pollen (setup guide §11.2) so staged pollen are not in
 * the scoring volume, and it leaves an 11.5 in basket up to the 21.5 in opening.
 */
export const FLOWER_MIDDLE_IN = 10;
/** ESTIMATE. Axis inset from the inner wall so the bottom ring sits on the tiles. */
export const FLOWER_INSET_IN = 6.5;

/** §9.8 */
export const POLLEN_DIAMETER_IN = 2.8;
export const NECTAR_DIAMETER_IN = 3.6;
export const POLLEN_COUNT = 40;
export const NECTAR_PER_ALLIANCE = 8;
/**
 * Masses are not in the manual. 26 g and 42 g satisfy the setup guide §12
 * statement that 3 pollen + 3 nectar has less mass than 8 pollen, and they
 * put the tip threshold between the "must not tip" and "must tip" rows
 * in §12.3 (7 vs 8 pollen, and 3 nectar + 2 pollen vs 3 nectar + 3 pollen).
 */
export const POLLEN_MASS_KG = 0.026;
export const NECTAR_MASS_KG = 0.042;
/** Strictly above 7 pollen (0.182 kg) and 3N+2P (0.178 kg); at or under 8P (0.208) and 3N+3P (0.204). */
export const HIVE_TIP_MASS_KG = 0.2;

/**
 * ESTIMATE quadratic drag coefficient k in a = -k |v| v, from Cd ≈ 0.55,
 * sea-level air, and the masses above. Not in the manual. Can be disabled.
 */
export const BALL_DRAG_K = 0.05;

/** §10.4 */
export const AUTO_SEC = 30;
export const TRANSITION_SEC = 8;
export const TELEOP_SEC = 120;
/** Table 9-1 — flower ownership unlock / G410. */
export const FLOWER_UNLOCK_REMAINING_SEC = 60;
/** Table 9-1 — endgame warning. */
export const ENDGAME_REMAINING_SEC = 20;

/** Table 10-2 */
export const POINTS = {
  leave: 3,
  park: 5,
  hiveTip: 20,
  cell: 2,
  flowerElement: 2,
  bottomNectar: 5,
  garden: 1,
  minorFoul: 5,
  majorFoul: 20,
} as const;

/** Table 10-3 — "all other events". Championship thresholds are TBA. */
export const RP_THRESHOLD = {
  swarmPoints: 16,
  pollinator1Tips: 4,
  pollinator2Tips: 7,
  win: 3,
  tie: 1,
} as const;

/** §12 / R102 — starting configuration. R104 — no weight limit. */
export const ROBOT_MAX_IN = 18;
/** R105.A — expansion envelope. The sim keeps the robot inside the starting cube. */
export const ROBOT_EXPAND_LENGTH_IN = 24;
export const ROBOT_EXPAND_HEIGHT_IN = 29;

/** G304 — each robot preloads exactly 4 pollen. */
export const PRELOAD_POLLEN = 4;
/** §10.3.1 — 4 pollen in each flower, 4 in each garden, 3 nectar in each raised cell, 5 nectar in each alliance area. */
export const POLLEN_PER_FLOWER = 4;
export const POLLEN_PER_GARDEN = 4;
export const NECTAR_IN_CELL = 3;
export const NECTAR_IN_TRAY = 5;

/** G407 */
export const MAX_CONTROLLED = 4;
/** G421 */
export const PIN_SECONDS = 3;

export const GRAVITY = 9.81;

export function opponent(alliance: Alliance): Alliance {
  return alliance === "red" ? "blue" : "red";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
