import { describe, expect, it } from "vitest";
import { aimHood, predictArc, shotVelocity } from "./ballistics";
import { reachesIntake } from "./intake";
import { appendFrame, frameAt, idleFrame, type DriveFrame } from "./recording";
import { hiveMouthInches, stepTurret } from "./turret";

describe("turret", () => {
  it("puts the red mouth on the audience side and the blue mouth on the far side", () => {
    const red = hiveMouthInches("red", (28 * Math.PI) / 180);
    const blue = hiveMouthInches("blue", (-28 * Math.PI) / 180);
    expect(red.z).toBeLessThan(0);
    expect(blue.z).toBeGreaterThan(0);
    expect(red.x).toBeGreaterThan(0);
    expect(blue.x).toBeLessThan(0);
    expect(red.y).toBeGreaterThan(30);
  });

  it("slews toward the target without overshooting or exceeding the rate", () => {
    expect(stepTurret(0, 1, 2, 0.1)).toBeCloseTo(0.2, 5);
    expect(stepTurret(0, 0.05, 2, 0.1)).toBeCloseTo(0.05, 5);
    const wrapped = stepTurret(3, -3, 2, 0.1);
    expect(Math.abs(wrapped)).toBeLessThan(Math.PI);
    expect(angleBetween(wrapped, -3)).toBeLessThan(angleBetween(3, -3));
  });

  it("picks a hood whose arc reaches a high target", () => {
    const hood = aimHood(1.05, 0.7, 6.6, 0);
    expect(hood).toBeGreaterThanOrEqual(30);
    expect(hood).toBeLessThanOrEqual(74);
    const arcError = closest(hood);
    expect(arcError).toBeLessThan(0.2);
  });
});

describe("intake sides", () => {
  it("takes from the front only, unless the robot has a rear intake", () => {
    const front = { x: 0, z: 14 };
    const back = { x: 0, z: -14 };
    expect(reachesIntake("front", 0, 0, 0, 16, front.x, front.z)).toBe(true);
    expect(reachesIntake("front", 0, 0, 0, 16, back.x, back.z)).toBe(false);
    expect(reachesIntake("both", 0, 0, 0, 16, front.x, front.z)).toBe(true);
    expect(reachesIntake("both", 0, 0, 0, 16, back.x, back.z)).toBe(true);
  });
});

describe("auto recording", () => {
  it("samples at 20 Hz, ignores a double tap, and stops after the recording", () => {
    let frames: DriveFrame[] = [];
    frames = appendFrame(frames, { ...idleFrame(0), forward: 1 });
    frames = appendFrame(frames, { ...idleFrame(0.02), forward: -1 });
    frames = appendFrame(frames, { ...idleFrame(0.05), strafe: 0.5, intake: true, hood: 48, turret: 0.4 });
    frames = appendFrame(frames, { ...idleFrame(31), forward: 1 });
    expect(frames).toHaveLength(2);
    expect(frames[1]?.intake).toBe(true);

    const mid = frameAt(frames, 0.07);
    expect(mid.strafe).toBe(0.5);
    expect(mid.intake).toBe(true);

    const done = frameAt(frames, 2);
    expect(done.forward).toBe(0);
    expect(done.strafe).toBe(0);
    expect(done.intake).toBe(false);
    expect(done.hood).toBe(48);
    expect(done.turret).toBeCloseTo(0.4, 5);
  });
});

function angleBetween(a: number, b: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

function closest(hood: number): number {
  const arc = predictArc({ x: 0, y: 0, z: 0 }, shotVelocity(0, hood, 6.6), 0, 96, 1 / 60);
  let err = Infinity;
  for (const point of arc) err = Math.min(err, Math.hypot(point.z - 1.05, point.y - 0.7));
  return err;
}
