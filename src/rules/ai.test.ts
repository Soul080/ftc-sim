import { describe, expect, it } from "vitest";
import { aimYaw, decide, gardenSpot, hiveMouthInches, shootingSpot, type AiInput, type AiRobot } from "./ai";
import { FLOWERS } from "./layout";
import { presetSpeed, strafePenaltyPercent, turnDegPerSec, wheelSpeedMps } from "./garage";

function robot(partial: Partial<AiRobot> = {}): AiRobot {
  return {
    x: -30,
    z: 0,
    yaw: 0,
    hood: 50,
    turretYaw: 0,
    held: [],
    ...partial,
  };
}

function input(partial: Partial<AiInput> = {}): AiInput {
  return {
    alliance: "blue",
    difficulty: "standard",
    phase: "teleop",
    teleopRemaining: 90,
    flowerOpen: false,
    nectarLegal: false,
    lengthIn: 16,
    collects: "both",
    intakeEnds: "front",
    hiveTilt: (-28 * Math.PI) / 180,
    stuck: false,
    robot: robot(),
    pieces: [],
    opponents: [],
    ...partial,
  };
}

describe("match AI", () => {
  it("returns zeros through transition", () => {
    const cmd = decide(input({ phase: "transition", robot: robot({ held: [{ kind: "pollen", alliance: null }] }) }));
    expect(cmd.forward).toBe(0);
    expect(cmd.strafe).toBe(0);
    expect(cmd.turn).toBe(0);
    expect(cmd.launch).toBe(false);
    expect(cmd.intake).toBe(false);
    expect(cmd.deposit).toBe(false);
    expect(cmd.eject).toBe(false);
    expect(cmd.nectar).toBe(false);
    expect(cmd.hood).toBeNull();
    expect(cmd.status).toMatch(/Disabled/);
  });

  it("parks in the loading zone at endgame and stays earlier on a harder pace", () => {
    const parking = decide(input({ teleopRemaining: 18, robot: robot({ x: -20, z: 0 }) }));
    expect(parking.status).toMatch(/Park/);
    expect(parking.forward).toBeGreaterThan(0.2);
    expect(parking.strafe).toBeGreaterThan(0.2);
    expect(parking.launch).toBe(false);
    expect(parking.deposit).toBe(false);

    const early = decide(input({ difficulty: "gentle", teleopRemaining: 25, robot: robot({ x: -20, z: 0 }) }));
    expect(early.status).toMatch(/Park/);

    const stillPlaying = decide(input({ difficulty: "challenging", teleopRemaining: 18 }));
    expect(stillPlaying.status).not.toMatch(/Park/);
  });

  it("ejects opponent nectar instead of scoring it", () => {
    const cmd = decide(
      input({
        robot: robot({ held: [{ kind: "nectar", alliance: "red" }] }),
        flowerOpen: true,
        teleopRemaining: 10,
      }),
    );
    expect(cmd.eject).toBe(true);
    expect(cmd.launch).toBe(false);
    expect(cmd.deposit).toBe(false);
    expect(cmd.intake).toBe(false);
  });

  it("intakes pollen that is just in front of the mouth", () => {
    const cmd = decide(
      input({
        robot: robot({ x: -40, z: 0, yaw: 0 }),
        pieces: [{ kind: "pollen", alliance: null, x: -40, z: 14, spill: false }],
      }),
    );
    expect(cmd.intake).toBe(true);
    expect(cmd.forward).toBeGreaterThan(0);
    expect(cmd.launch).toBe(false);
  });

  it("stands in front of the cell that is actually raised", () => {
    const audience = shootingSpot("red", (28 * Math.PI) / 180);
    const far = shootingSpot("red", (-28 * Math.PI) / 180);
    expect(audience.z).toBeLessThan(-40);
    expect(audience.aimZ).toBeLessThan(0);
    expect(far.z).toBeGreaterThan(40);
    expect(far.aimZ).toBeGreaterThan(0);
  });

  it("launches a full hopper when the turret is on the hive, even if the chassis faces elsewhere", () => {
    const spot = shootingSpot("blue");
    const mouth = hiveMouthInches("blue", (-28 * Math.PI) / 180);
    const turretYaw = aimYaw(spot.x, spot.z, mouth.x, mouth.z);
    const held = [0, 1, 2, 3].map(() => ({ kind: "pollen" as const, alliance: null }));
    const cmd = decide(
      input({
        robot: robot({
          x: spot.x,
          z: spot.z,
          yaw: 0,
          turretYaw,
          held,
        }),
      }),
    );
    expect(cmd.launch).toBe(true);
    expect(cmd.deposit).toBe(false);
    expect(cmd.intake).toBe(false);
    expect(cmd.forward).toBe(0);
    expect(cmd.strafe).toBe(0);
    expect(cmd.status).toMatch(/Shooting/);

    const missed = decide(
      input({
        robot: robot({
          x: spot.x,
          z: spot.z,
          yaw: turretYaw,
          turretYaw: turretYaw + Math.PI,
          held,
        }),
      }),
    );
    expect(missed.launch).toBe(false);
  });

  it("does not deposit nectar before the flower window", () => {
    const flower = FLOWERS.find((item) => item.wall === "blue");
    expect(flower).toBeTruthy();
    const x = -50;
    const z = 0;
    const cmd = decide(
      input({
        flowerOpen: false,
        robot: robot({
          x,
          z,
          yaw: aimYaw(x, z, flower!.x, flower!.z),
          held: [{ kind: "nectar", alliance: "blue" }],
        }),
      }),
    );
    expect(cmd.deposit).toBe(false);

    const open = decide(
      input({
        flowerOpen: true,
        robot: robot({
          x,
          z,
          yaw: aimYaw(x, z, flower!.x, flower!.z),
          held: [{ kind: "nectar", alliance: "blue" }],
        }),
      }),
    );
    expect(open.deposit).toBe(true);
  });

  it("will not chase a piece across the midline in auto", () => {
    const cmd = decide(
      input({
        phase: "auto",
        robot: robot({ x: -30, z: 0, yaw: Math.PI / 2 }),
        pieces: [{ kind: "pollen", alliance: null, x: 40, z: 0, spill: false }],
      }),
    );
    expect(cmd.status).toMatch(/Waiting/);
    expect(cmd.strafe).toBeGreaterThanOrEqual(-0.05);
    expect(cmd.intake).toBe(false);
  });

  it("keeps a gentle stick inside the pace cap", () => {
    const cmd = decide(
      input({
        difficulty: "gentle",
        robot: robot({ x: -40, z: 0, yaw: Math.PI }),
        pieces: [{ kind: "pollen", alliance: null, x: -40, z: 48, spill: false }],
      }),
    );
    expect(Math.abs(cmd.forward)).toBeLessThanOrEqual(0.55);
    expect(Math.abs(cmd.strafe)).toBeLessThanOrEqual(0.55);
    expect(Math.abs(cmd.turn)).toBeLessThanOrEqual(0.55);
    expect(Math.hypot(cmd.forward, cmd.strafe)).toBeGreaterThan(0.2);
  });

  it("ejects pollen into the garden when that tape is the closer score", () => {
    const spot = gardenSpot("blue");
    const cmd = decide(
      input({
        robot: robot({
          x: spot.x,
          z: spot.z,
          yaw: 0,
          held: [{ kind: "pollen", alliance: null }],
        }),
      }),
    );
    expect(cmd.eject).toBe(true);
    expect(cmd.status).toMatch(/garden/i);
    expect(cmd.deposit).toBe(false);
  });

  it("ignores a spilled piece and opponent nectar on the ground", () => {
    const spilled = decide(
      input({
        pieces: [{ kind: "pollen", alliance: null, x: -40, z: 14, spill: true }],
        robot: robot({ x: -40, z: 0 }),
      }),
    );
    expect(spilled.intake).toBe(false);
    const foreign = decide(
      input({
        collects: "both",
        pieces: [{ kind: "nectar", alliance: "red", x: -40, z: 14, spill: false }],
        robot: robot({ x: -40, z: 0 }),
      }),
    );
    expect(foreign.intake).toBe(false);
  });
});

describe("garage presets", () => {
  it("turns catalogue rpm and a 4 in wheel into ground speed", () => {
    const hex20 = wheelSpeedMps(300, 4);
    expect(hex20).toBeGreaterThan(1.5);
    expect(hex20).toBeLessThan(1.7);
    expect(presetSpeed("stock", 4, 2)).toBe(1.6);
    expect(presetSpeed("hex40", 4, 2)).toBeCloseTo(hex20 / 2, 5);
    expect(presetSpeed("measured", 4, 1.25)).toBe(1.25);
    expect(strafePenaltyPercent(0.9)).toBe(10);
    expect(turnDegPerSec(2)).toBe(180);
  });
});
