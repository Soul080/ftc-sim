/**
 * Drive presets in the spirit of Pandara's garage.
 * REV HD Hex free speeds are the catalogue no-load figures at 12 V
 * (20:1 ≈ 300 rpm, 40:1 ≈ 150 rpm). NeveRest 40 is ≈ 160 rpm.
 * Stock mecanum stays at 1.6 m/s so it matches the original field tune.
 */

export type MotorPreset = "stock" | "hex20" | "hex40" | "neverest40" | "measured";

export const MOTOR_FREE_RPM: Record<Exclude<MotorPreset, "stock" | "measured">, number> = {
  hex20: 300,
  hex40: 150,
  neverest40: 160,
};

/** Ground speed of a wheel, metres per second, ignoring slip. */
export function wheelSpeedMps(rpm: number, wheelDiameterIn: number): number {
  return (rpm / 60) * Math.PI * wheelDiameterIn * 0.0254;
}

export function presetSpeed(motor: MotorPreset, wheelDiameterIn: number, measuredMps: number): number {
  if (motor === "stock") return 1.6;
  if (motor === "measured") return measuredMps;
  return wheelSpeedMps(MOTOR_FREE_RPM[motor], wheelDiameterIn);
}

/** Percent of forward speed lost while strafing. 0.9 efficiency → 10. */
export function strafePenaltyPercent(efficiency: number): number {
  return Math.round((1 - efficiency) * 100);
}

/** Degrees per second from a measured full-spin time. */
export function turnDegPerSec(fullSpinSec: number): number {
  if (fullSpinSec <= 0) return 0;
  return 360 / fullSpinSec;
}
