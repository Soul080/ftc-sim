import type { Alliance } from "./constants";

export type DriveMode = "field" | "robot";
export type DriveTrain = "mecanum" | "tank";

export interface Stick {
  /**
   * +1 is forward. Robot mode follows the yellow bumper (local +Z).
   * Field mode drives away from this alliance’s driver wall: red −X, blue +X.
   */
  forward: number;
  /**
   * +1 is right. Robot mode is the robot’s right. Field mode is that
   * driver’s right: red −Z (toward the audience), blue +Z (toward the far wall).
   */
  strafe: number;
  /** +1 increases yaw (toward +X when the robot faces far). */
  turn: number;
}

export interface ChassisCommand {
  vx: number;
  vz: number;
  yawRate: number;
}

const STRAFE_EFFICIENCY = 0.9;

export function chassisCommand(
  stick: Stick,
  yaw: number,
  mode: DriveMode,
  train: DriveTrain,
  maxSpeed: number,
  maxYawRate: number,
  strafeEfficiency = STRAFE_EFFICIENCY,
  alliance: Alliance = "red",
): ChassisCommand {
  const forward = clampAxis(stick.forward);
  const strafe = train === "tank" ? 0 : clampAxis(stick.strafe) * strafeEfficiency;
  const turn = clampAxis(stick.turn);
  if (mode === "field") {
    // Driver stations sit outside the alliance walls, not the audience.
    // Red looks toward −X; blue looks toward +X. +strafe is that driver's right.
    const sign = alliance === "blue" ? 1 : -1;
    return {
      vx: sign * forward * maxSpeed,
      vz: sign * strafe * maxSpeed,
      yawRate: turn * maxYawRate,
    };
  }
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return {
    vx: (forward * fx + strafe * rx) * maxSpeed,
    vz: (forward * fz + strafe * rz) * maxSpeed,
    yawRate: turn * maxYawRate,
  };
}

function clampAxis(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}
