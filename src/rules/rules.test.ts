import { describe, expect, it } from "vitest";
import { stepAuto, createRuntime, parseScript } from "./auto";
import { predictArc, shotVelocity, stepBallistic } from "./ballistics";
import { clockDisplay, flowerWindowOpen, nectarEntryLegal, tickClock, autoClock } from "./clock";
import {
  FIELD_IN,
  HIVE_TIP_MASS_KG,
  NECTAR_MASS_KG,
  POINTS,
  POLLEN_COUNT,
  POLLEN_MASS_KG,
  RP_THRESHOLD,
} from "./constants";
import { chassisCommand } from "./drive";
import {
  BLUE_GARDEN,
  BLUE_LOADING_ZONE,
  FLOWERS,
  RED_GARDEN,
  RED_LOADING_ZONE,
  countPieces,
  footprintHitsZone,
  inLoadingZone,
  pieceSpawns,
  robotStarts,
  tileAabb,
  tileLabel,
  touchingPerimeter,
} from "./layout";
import { pinningFoulCount, scoreMatch, type ScoreInput, type ScorePiece, type ScoreRobot } from "./scoring";

function robot(partial: Partial<ScoreRobot> & Pick<ScoreRobot, "id" | "alliance">): ScoreRobot {
  return {
    touchingWall: false,
    inLoadingZone: false,
    ...partial,
  };
}

function emptyInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    pieces: [],
    autoRobots: [],
    robots: [],
    tips: [],
    fouls: [],
    assessTeleopPark: true,
    assessFieldScores: true,
    ...overrides,
  };
}

describe("match clock", () => {
  it("runs auto, an 8 second transition, then a 2:00 teleop", () => {
    let clock = autoClock();
    let next = tickClock(clock, 30);
    expect(next.events).toContain("auto-end");
    expect(next.clock.phase).toBe("transition");
    expect(next.clock.remaining).toBeCloseTo(8);

    next = tickClock(next.clock, 8);
    expect(next.events).toContain("teleop-start");
    expect(next.clock.phase).toBe("teleop");
    expect(next.clock.remaining).toBeCloseTo(120);

    next = tickClock(next.clock, 60);
    expect(next.events).toContain("flower-unlock");
    expect(flowerWindowOpen(next.clock)).toBe(true);
    expect(next.clock.remaining).toBeCloseTo(60);

    next = tickClock(next.clock, 40);
    expect(next.events).toContain("endgame");
    next = tickClock(next.clock, 20);
    expect(next.events).toContain("match-end");
    expect(next.clock.phase).toBe("ended");
  });

  it("displays auto as 2:30 counting toward 2:00", () => {
    expect(clockDisplay(autoClock()).time).toBe("2:30");
    expect(clockDisplay(autoClock()).phaseLabel).toBe("AUTO");
    const later = tickClock(autoClock(), 10).clock;
    expect(clockDisplay(later).time).toBe("2:20");
  });

  it("opens nectar entry on a tip credit and again for the whole tray at 1:00", () => {
    const auto = autoClock();
    expect(nectarEntryLegal(0, 0, auto, false)).toBe(false);
    expect(nectarEntryLegal(1, 0, auto, false)).toBe(true);
    expect(nectarEntryLegal(1, 1, auto, false)).toBe(false);
    const teleop = tickClock(tickClock(auto, 30).clock, 8).clock;
    expect(flowerWindowOpen(teleop)).toBe(false);
    const open = tickClock(teleop, 60).clock;
    expect(nectarEntryLegal(0, 0, open, false)).toBe(true);
    expect(nectarEntryLegal(0, 0, auto, true)).toBe(true);
  });
});

describe("drive and shots", () => {
  it("maps field-centric sticks away from that alliance's driver, ignoring yaw", () => {
    const red = chassisCommand({ forward: 1, strafe: 1, turn: 0 }, 1.2, "field", "mecanum", 2, 3, 0.9, "red");
    expect(red.vx).toBeCloseTo(-2);
    expect(red.vz).toBeCloseTo(-2 * 0.9);
    expect(red.yawRate).toBe(0);
    const blue = chassisCommand({ forward: 1, strafe: 1, turn: 0 }, -0.4, "field", "mecanum", 2, 3, 0.9, "blue");
    expect(blue.vx).toBeCloseTo(2);
    expect(blue.vz).toBeCloseTo(2 * 0.9);
    expect(blue.yawRate).toBe(0);
  });

  it("drives W along the front bumper and A to the robot's left", () => {
    const yaws = [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.7, 2.4];
    for (const yaw of yaws) {
      const ahead = chassisCommand({ forward: 1, strafe: 0, turn: 0 }, yaw, "robot", "mecanum", 2, 3);
      expect(ahead.vx).toBeCloseTo(2 * Math.sin(yaw));
      expect(ahead.vz).toBeCloseTo(2 * Math.cos(yaw));
      const left = chassisCommand({ forward: 0, strafe: -1, turn: 0 }, yaw, "robot", "mecanum", 2, 3, 1);
      expect(left.vx).toBeCloseTo(2 * -Math.cos(yaw));
      expect(left.vz).toBeCloseTo(2 * Math.sin(yaw));
    }
  });

  it("turns robot-centric forward with yaw", () => {
    const ahead = chassisCommand({ forward: 1, strafe: 0, turn: 0 }, 0, "robot", "mecanum", 2, 3);
    expect(ahead.vz).toBeCloseTo(2);
    expect(ahead.vx).toBeCloseTo(0);
    const blue = chassisCommand({ forward: 1, strafe: 0, turn: 0 }, Math.PI / 2, "robot", "mecanum", 2, 3);
    expect(blue.vx).toBeCloseTo(2);
    expect(blue.vz).toBeCloseTo(0);
  });

  it("drops strafe on tank drive", () => {
    const command = chassisCommand({ forward: 1, strafe: 1, turn: 0.5 }, 0, "robot", "tank", 2, 4);
    expect(command.vx).toBeCloseTo(0);
    expect(command.vz).toBeCloseTo(2);
    expect(command.yawRate).toBeCloseTo(2);
  });

  it("lands a 45 degree shot near v²/g with drag off", () => {
    const speed = 10;
    let pos = { x: 0, y: 0, z: 0 };
    let vel = shotVelocity(0, 45, speed);
    let seenUp = false;
    for (let i = 0; i < 4000; i += 1) {
      const next = stepBallistic(pos, vel, 0.001, 0);
      pos = next.pos;
      vel = next.vel;
      if (pos.y > 0.2) seenUp = true;
      if (seenUp && pos.y <= 0) break;
    }
    const range = speed * speed / 9.81;
    expect(pos.z).toBeGreaterThan(range - 0.15);
    expect(pos.z).toBeLessThan(range + 0.15);
    const arc = predictArc({ x: 0, y: 1, z: 0 }, shotVelocity(0, 60, 6), 0.05, 10, 1 / 30);
    expect(arc.length).toBeGreaterThan(2);
    expect(arc[arc.length - 1]!.y).toBeLessThan(arc[0]!.y + 5);
  });
});

describe("auto scripts", () => {
  it("parses comments, hood, and a multi-launch", () => {
    const parsed = parseScript(`
      # leave and shoot
      forward 24
      turn -30
      hood 62
      launch 3
      nope
    `);
    expect(parsed.errors).toEqual(['line 7: unknown command "nope"']);
    expect(parsed.cmds.map((cmd) => cmd.type)).toEqual([
      "forward",
      "turn",
      "hood",
      "launch",
      "wait",
      "launch",
      "wait",
      "launch",
    ]);
  });

  it("drives forward until the distance is covered, and pulses launch once", () => {
    const runtime = createRuntime(parseScript("forward 10\nlaunch").cmds);
    const mid = stepAuto(runtime, { dt: 0.1, movedInches: 4, turnedDeg: 0 });
    expect(mid.drive.forward).toBe(1);
    expect(mid.drive.done).toBe(false);
    const doneMove = stepAuto(mid.runtime, { dt: 0.1, movedInches: 10, turnedDeg: 0 });
    expect(doneMove.drive.commandIndex).toBe(1);
    const first = stepAuto(doneMove.runtime, { dt: 0.016, movedInches: 0, turnedDeg: 0 });
    expect(first.drive.launch).toBe(true);
    const second = stepAuto(first.runtime, { dt: 0.016, movedInches: 0, turnedDeg: 0 });
    expect(second.drive.launch).toBe(false);
    expect(second.drive.done).toBe(true);
  });
});

describe("field layout", () => {
  it("is a 12 ft square of 24 in tiles with red on the audience's left", () => {
    expect(FIELD_IN).toBe(144);
    expect(tileLabel(0, 0)).toBe("A1");
    expect(tileLabel(5, 5)).toBe("F6");
    const a5 = tileAabb(0, 4);
    expect(RED_LOADING_ZONE.maxX).toBeCloseTo(72);
    expect(RED_LOADING_ZONE.maxX - RED_LOADING_ZONE.minX).toBe(11);
    expect(RED_LOADING_ZONE.minZ).toBeCloseTo(a5.minZ);
    expect(RED_LOADING_ZONE.maxZ).toBeCloseTo(a5.maxZ);
    expect(a5.maxX).toBeCloseTo(72);
    const f2 = tileAabb(5, 1);
    expect(BLUE_LOADING_ZONE.minZ).toBeCloseTo(f2.minZ);
    expect(BLUE_LOADING_ZONE.maxZ).toBeCloseTo(f2.maxZ);
    expect(BLUE_LOADING_ZONE.minX).toBeCloseTo(-72);
  });

  it("puts gardens in opposite corners and mirrors the loading zones", () => {
    expect(RED_GARDEN.maxZ).toBe(72);
    expect(BLUE_GARDEN.minZ).toBe(-72);
    expect(RED_GARDEN.maxX - RED_GARDEN.minX).toBe(23);
    expect(RED_GARDEN.maxZ - RED_GARDEN.minZ).toBe(2);
    expect(-RED_LOADING_ZONE.minX).toBeCloseTo(BLUE_LOADING_ZONE.maxX);
    expect(-RED_LOADING_ZONE.maxZ).toBeCloseTo(BLUE_LOADING_ZONE.minZ);
    expect(-RED_GARDEN.minX).toBeCloseTo(BLUE_GARDEN.maxX);
    expect(-RED_GARDEN.minZ).toBeCloseTo(BLUE_GARDEN.maxZ);
    expect(FLOWERS).toHaveLength(4);
  });

  it("stages 40 pollen and 6 nectar on the field for both alliance sizes", () => {
    for (const count of [2, 4] as const) {
      const tally = countPieces(pieceSpawns(count));
      expect(tally.pollen).toBe(POLLEN_COUNT);
      expect(tally.nectarOnField).toBe(6);
    }
  });

  it("starts robots on their wall, outside the loading zone", () => {
    const starts = robotStarts(2, 16);
    const red = starts[0]!;
    expect(red.x).toBeGreaterThan(0);
    expect(touchingPerimeter({ ...red, lengthIn: 16, widthIn: 16 })).toBe(true);
    expect(inLoadingZone({ ...red, lengthIn: 16, widthIn: 16 }, "red")).toBe(false);
    const parked = { x: 72 - 8, z: -36, lengthIn: 16, widthIn: 14, yaw: -Math.PI / 2 };
    expect(inLoadingZone(parked, "red")).toBe(true);
    expect(footprintHitsZone(parked, BLUE_LOADING_ZONE)).toBe(false);
  });
});

describe("Table 10-2 scoring", () => {
  it("scores leave and both parks per robot, and locks auto from the snapshot", () => {
    const autoRobots = [
      robot({ id: "r", alliance: "red", touchingWall: false, inLoadingZone: true }),
      robot({ id: "b", alliance: "blue", touchingWall: true, inLoadingZone: false }),
    ];
    const live = [
      robot({ id: "r", alliance: "red", touchingWall: true, inLoadingZone: true }),
      robot({ id: "b", alliance: "blue", touchingWall: false, inLoadingZone: true }),
    ];
    const score = scoreMatch(emptyInput({ autoRobots, robots: live, assessTeleopPark: true }));
    expect(score.red.leave).toBe(POINTS.leave);
    expect(score.red.autoPark).toBe(POINTS.park);
    expect(score.red.teleopPark).toBe(POINTS.park);
    expect(score.blue.leave).toBe(0);
    expect(score.blue.teleopPark).toBe(POINTS.park);
    expect(score.red.matchPoints).toBe(3 + 5 + 5);
  });

  it("scores hive tips, upward cell contents, and alliance gardens", () => {
    const pieces: ScorePiece[] = [
      { id: "n1", kind: "nectar", alliance: "red", location: { kind: "cell", alliance: "red", upward: true } },
      { id: "n2", kind: "nectar", alliance: "blue", location: { kind: "cell", alliance: "blue", upward: false } },
      { id: "p1", kind: "pollen", alliance: null, location: { kind: "garden", alliance: "blue" } },
      { id: "held", kind: "pollen", alliance: null, location: { kind: "held" } },
    ];
    const score = scoreMatch(
      emptyInput({
        pieces,
        tips: [
          { alliance: "red", period: "auto" },
          { alliance: "red", period: "teleop" },
        ],
      }),
    );
    expect(score.red.hive).toBe(40);
    expect(score.red.autoTipCount).toBe(1);
    expect(score.red.cell).toBe(2);
    expect(score.blue.cell).toBe(0);
    expect(score.blue.garden).toBe(1);
    expect(score.red.matchPoints).toBe(42);
  });

  it("gives flower ownership to the top nectar and the bottom bonus to the lowest nectar", () => {
    const pieces: ScorePiece[] = [
      { id: "bottom", kind: "nectar", alliance: "red", location: { kind: "flower", flowerId: "far", scoring: true, heightIn: 11 } },
      { id: "p", kind: "pollen", alliance: null, location: { kind: "flower", flowerId: "far", scoring: true, heightIn: 14 } },
      { id: "top", kind: "nectar", alliance: "blue", location: { kind: "flower", flowerId: "far", scoring: true, heightIn: 18 } },
      { id: "low", kind: "pollen", alliance: null, location: { kind: "flower", flowerId: "far", scoring: false, heightIn: 3 } },
      { id: "only-pollen", kind: "pollen", alliance: null, location: { kind: "flower", flowerId: "red", scoring: true, heightIn: 12 } },
    ];
    const score = scoreMatch(emptyInput({ pieces }));
    expect(score.blue.flowerElementCount).toBe(3);
    expect(score.blue.flower).toBe(6);
    expect(score.red.bottomNectarCount).toBe(1);
    expect(score.red.flower).toBe(5);
    expect(score.red.flowerElementCount).toBe(0);
  });

  it("awards foul points to the opponent and lets them decide the match", () => {
    const score = scoreMatch(
      emptyInput({
        fouls: [
          { against: "blue", severity: "major", rule: "G410", detail: "early nectar" },
          { against: "red", severity: "minor", rule: "G426", detail: "early human" },
        ],
      }),
    );
    expect(score.red.foulPoints).toBe(POINTS.majorFoul);
    expect(score.blue.foulPoints).toBe(POINTS.minorFoul);
    expect(score.red.result).toBe("win");
    expect(score.red.rankingPoints).toBe(RP_THRESHOLD.win);
    expect(score.blue.rankingPoints).toBe(0);
  });

  it("awards swarm, both pollinator RPs, and a tie RP", () => {
    const robots = [0, 1, 2, 3].map((index) =>
      robot({
        id: `r${index}`,
        alliance: index < 2 ? "red" : "blue",
        touchingWall: false,
        inLoadingZone: true,
      }),
    );
    const tips = Array.from({ length: 7 }, () => ({ alliance: "red" as const, period: "teleop" as const }));
    const score = scoreMatch(
      emptyInput({
        autoRobots: robots,
        robots,
        tips,
      }),
    );
    expect(score.red.leave + score.red.autoPark + score.red.teleopPark).toBeGreaterThanOrEqual(16);
    expect(score.blue.swarm).toBe(true);
    expect(score.red.pollinator1).toBe(true);
    expect(score.red.pollinator2).toBe(true);
    expect(score.blue.pollinator1).toBe(false);
    expect(score.red.result).toBe("win");
    expect(score.red.rankingPoints).toBe(1 + 1 + 1 + 3);

    const tied = scoreMatch(emptyInput());
    expect(tied.red.result).toBe("tie");
    expect(tied.red.rankingPoints).toBe(RP_THRESHOLD.tie);
    expect(tied.blue.rankingPoints).toBe(RP_THRESHOLD.tie);
  });

  it("counts a pin foul at 3 seconds and again every 3 seconds", () => {
    expect(pinningFoulCount(2.9)).toBe(0);
    expect(pinningFoulCount(3)).toBe(1);
    expect(pinningFoulCount(8.9)).toBe(2);
    expect(pinningFoulCount(9)).toBe(3);
  });

  it("places the hive threshold between the calibration rows", () => {
    expect(7 * POLLEN_MASS_KG).toBeLessThan(HIVE_TIP_MASS_KG);
    expect(8 * POLLEN_MASS_KG).toBeGreaterThanOrEqual(HIVE_TIP_MASS_KG);
    expect(3 * NECTAR_MASS_KG + 2 * POLLEN_MASS_KG).toBeLessThan(HIVE_TIP_MASS_KG);
    expect(3 * NECTAR_MASS_KG + 3 * POLLEN_MASS_KG).toBeGreaterThanOrEqual(HIVE_TIP_MASS_KG);
    expect(3 * NECTAR_MASS_KG + 3 * POLLEN_MASS_KG).toBeLessThan(8 * POLLEN_MASS_KG);
  });
});
