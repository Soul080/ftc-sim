export type DriveMode = "field" | "robot";
export type DriveTrain = "mecanum" | "tank";

export interface Stick {
  /** +1 is forward. Field mode: +Z, toward the far wall. */
  forward: number;
  /** +1 is right. Field mode: +X, toward blue. */
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
): ChassisCommand {
  const forward = clampAxis(stick.forward);
  const strafe = train === "tank" ? 0 : clampAxis(stick.strafe) * STRAFE_EFFICIENCY;
  const turn = clampAxis(stick.turn);
  if (mode === "field") {
    return {
      vx: strafe * maxSpeed,
      vz: forward * maxSpeed,
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
