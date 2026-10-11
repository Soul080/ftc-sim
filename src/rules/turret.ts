import {
  CELL_CENTER_ARM_IN,
  CELL_DEPTH_IN,
  HIVE_PIVOT_HEIGHT_IN,
  HIVE_PIVOT_SEPARATION_IN,
  type Alliance,
} from "./constants";

/** World yaw that looks from (x, z) toward (aimX, aimZ). 0 faces +Z. */
export function aimYaw(x: number, z: number, aimX: number, aimZ: number): number {
  return Math.atan2(aimX - x, aimZ - z);
}

/**
 * Opening of the cell that is currently up, in inches.
 * Positive hive angle raises the audience cell (−Z). This matches the simulator muzzle math.
 */
export function hiveMouthInches(alliance: Alliance, angleRad: number): { x: number; y: number; z: number } {
  const pivotX = (alliance === "red" ? 1 : -1) * (HIVE_PIVOT_SEPARATION_IN / 2);
  const sign = angleRad >= 0 ? -1 : 1;
  const localZ = sign * (CELL_CENTER_ARM_IN + CELL_DEPTH_IN / 2);
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: pivotX,
    y: HIVE_PIVOT_HEIGHT_IN + c - localZ * s,
    z: s + localZ * c,
  };
}

/** Slew the shortest way toward `target`, never faster than `maxRate` rad/s, without overshooting. */
export function stepTurret(current: number, target: number, maxRate: number, dt: number): number {
  const err = wrap(target - current);
  const limit = Math.max(0, maxRate) * Math.max(0, dt);
  const step = Math.max(-limit, Math.min(limit, err));
  return wrap(current + step);
}

function wrap(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
