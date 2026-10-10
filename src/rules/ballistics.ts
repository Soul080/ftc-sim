import { GRAVITY } from "./constants";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Semi-implicit Euler with quadratic drag a = -k |v| v. k = 0 disables drag. */
export function stepBallistic(pos: Vec3, vel: Vec3, dt: number, dragK: number): { pos: Vec3; vel: Vec3 } {
  const speed = Math.hypot(vel.x, vel.y, vel.z);
  const scale = dragK * speed;
  const nextVel = {
    x: vel.x + -scale * vel.x * dt,
    y: vel.y + (-GRAVITY - scale * vel.y) * dt,
    z: vel.z + -scale * vel.z * dt,
  };
  return {
    vel: nextVel,
    pos: {
      x: pos.x + nextVel.x * dt,
      y: pos.y + nextVel.y * dt,
      z: pos.z + nextVel.z * dt,
    },
  };
}

export function predictArc(origin: Vec3, velocity: Vec3, dragK: number, steps = 48, dt = 1 / 60): Vec3[] {
  const points: Vec3[] = [{ ...origin }];
  let pos = { ...origin };
  let vel = { ...velocity };
  for (let i = 0; i < steps; i += 1) {
    const next = stepBallistic(pos, vel, dt, dragK);
    pos = next.pos;
    vel = next.vel;
    points.push({ ...pos });
    if (pos.y <= 0) break;
  }
  return points;
}

export function shotVelocity(yaw: number, hoodDeg: number, speed: number): Vec3 {
  const hood = (hoodDeg * Math.PI) / 180;
  const horizontal = Math.cos(hood) * speed;
  return {
    x: Math.sin(yaw) * horizontal,
    y: Math.sin(hood) * speed,
    z: Math.cos(yaw) * horizontal,
  };
}
