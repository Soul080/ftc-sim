export type IntakeEnds = "front" | "both";

/**
 * True when a piece on the floor is in front of the robot, or also behind it
 * when the robot has a rear intake. Positions are inches. Yaw 0 faces +Z.
 */
export function reachesIntake(
  ends: IntakeEnds,
  x: number,
  z: number,
  yaw: number,
  lengthIn: number,
  pieceX: number,
  pieceZ: number,
): boolean {
  const half = lengthIn / 2;
  const front = { fx: Math.sin(yaw), fz: Math.cos(yaw) };
  const mouths = [front];
  if (ends === "both") mouths.push({ fx: -front.fx, fz: -front.fz });
  for (const mouth of mouths) {
    const dx = pieceX - (x + mouth.fx * half);
    const dz = pieceZ - (z + mouth.fz * half);
    const ahead = dx * mouth.fx + dz * mouth.fz;
    if (Math.hypot(dx, dz) < 12 && ahead > -2) return true;
  }
  return false;
}
