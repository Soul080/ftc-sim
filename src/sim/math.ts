export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function quatX(angle: number): Quat {
  const half = angle * 0.5;
  return { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) };
}

export function quatY(yaw: number): Quat {
  const half = yaw * 0.5;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

export function yawOf(q: Quat): number {
  const siny = 2 * (q.w * q.y - q.z * q.x);
  const cosy = 1 - 2 * (q.y * q.y + q.x * q.x);
  return Math.atan2(siny, cosy);
}

export function wrapPi(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
