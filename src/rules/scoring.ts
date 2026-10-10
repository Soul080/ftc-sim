import {
  PIN_SECONDS,
  POINTS,
  RP_THRESHOLD,
  opponent,
  type Alliance,
} from "./constants";

export type Period = "auto" | "teleop";

export type PieceLocation =
  | { kind: "field" }
  | { kind: "held" }
  | { kind: "tray" }
  | { kind: "out" }
  | { kind: "garden"; alliance: Alliance }
  | { kind: "flower"; flowerId: string; scoring: boolean; heightIn: number }
  | { kind: "cell"; alliance: Alliance; upward: boolean };

export interface ScorePiece {
  id: string;
  kind: "pollen" | "nectar";
  alliance: Alliance | null;
  location: PieceLocation;
}

export interface ScoreRobot {
  id: string;
  alliance: Alliance;
  touchingWall: boolean;
  inLoadingZone: boolean;
}

export interface HiveTip {
  alliance: Alliance;
  period: Period;
}

export interface ScoreFoul {
  against: Alliance;
  severity: "minor" | "major";
  rule: string;
  detail: string;
}

export interface ScoreInput {
  pieces: ScorePiece[];
  /** Snapshot at the end of AUTO. During AUTO, pass the live robots for a projection. */
  autoRobots: ScoreRobot[];
  robots: ScoreRobot[];
  tips: HiveTip[];
  fouls: ScoreFoul[];
  assessTeleopPark: boolean;
  assessFieldScores: boolean;
}

export interface AllianceScore {
  leave: number;
  autoPark: number;
  teleopPark: number;
  hive: number;
  cell: number;
  flower: number;
  garden: number;
  foulPoints: number;
  matchPoints: number;
  rankingPoints: number;
  leaveCount: number;
  autoParkCount: number;
  teleopParkCount: number;
  tipCount: number;
  autoTipCount: number;
  cellCount: number;
  flowerElementCount: number;
  bottomNectarCount: number;
  gardenCount: number;
  minorFouls: number;
  majorFouls: number;
  swarm: boolean;
  pollinator1: boolean;
  pollinator2: boolean;
  result: "win" | "loss" | "tie";
}

export interface MatchScore {
  red: AllianceScore;
  blue: AllianceScore;
}

interface MutableScore {
  leaveCount: number;
  autoParkCount: number;
  teleopParkCount: number;
  tipCount: number;
  autoTipCount: number;
  cellCount: number;
  flowerElementCount: number;
  bottomNectarCount: number;
  gardenCount: number;
  foulPoints: number;
  minorFouls: number;
  majorFouls: number;
}

function blank(): MutableScore {
  return {
    leaveCount: 0,
    autoParkCount: 0,
    teleopParkCount: 0,
    tipCount: 0,
    autoTipCount: 0,
    cellCount: 0,
    flowerElementCount: 0,
    bottomNectarCount: 0,
    gardenCount: 0,
    foulPoints: 0,
    minorFouls: 0,
    majorFouls: 0,
  };
}

function finalize(score: MutableScore, result: AllianceScore["result"], rankingExtra: number): AllianceScore {
  const leave = score.leaveCount * POINTS.leave;
  const autoPark = score.autoParkCount * POINTS.park;
  const teleopPark = score.teleopParkCount * POINTS.park;
  const hive = score.tipCount * POINTS.hiveTip;
  const cell = score.cellCount * POINTS.cell;
  const flower = score.flowerElementCount * POINTS.flowerElement + score.bottomNectarCount * POINTS.bottomNectar;
  const garden = score.gardenCount * POINTS.garden;
  const matchPoints = leave + autoPark + teleopPark + hive + cell + flower + garden + score.foulPoints;
  const swarm = leave + autoPark + teleopPark >= RP_THRESHOLD.swarmPoints;
  const pollinator1 = score.tipCount >= RP_THRESHOLD.pollinator1Tips;
  const pollinator2 = score.tipCount >= RP_THRESHOLD.pollinator2Tips;
  const rankingPoints =
    (swarm ? 1 : 0) + (pollinator1 ? 1 : 0) + (pollinator2 ? 1 : 0) + rankingExtra;
  return {
    leave,
    autoPark,
    teleopPark,
    hive,
    cell,
    flower,
    garden,
    foulPoints: score.foulPoints,
    matchPoints,
    rankingPoints,
    leaveCount: score.leaveCount,
    autoParkCount: score.autoParkCount,
    teleopParkCount: score.teleopParkCount,
    tipCount: score.tipCount,
    autoTipCount: score.autoTipCount,
    cellCount: score.cellCount,
    flowerElementCount: score.flowerElementCount,
    bottomNectarCount: score.bottomNectarCount,
    gardenCount: score.gardenCount,
    minorFouls: score.minorFouls,
    majorFouls: score.majorFouls,
    swarm,
    pollinator1,
    pollinator2,
    result,
  };
}

/**
 * Table 10-2 and §10.5. Flower ownership is the alliance of the top-most nectar
 * in that flower's scoring volume. The bottom nectar bonus goes to the alliance
 * of the bottom-most nectar. Owned flowers award 2 points for every pollen and
 * nectar in the scoring volume.
 */
export function scoreMatch(input: ScoreInput): MatchScore {
  const red = blank();
  const blue = blank();
  const bag = { red, blue };

  for (const robot of input.autoRobots) {
    if (!robot.touchingWall) bag[robot.alliance].leaveCount += 1;
    if (robot.inLoadingZone) bag[robot.alliance].autoParkCount += 1;
  }
  if (input.assessTeleopPark) {
    for (const robot of input.robots) {
      if (robot.inLoadingZone) bag[robot.alliance].teleopParkCount += 1;
    }
  }

  for (const tip of input.tips) {
    bag[tip.alliance].tipCount += 1;
    if (tip.period === "auto") bag[tip.alliance].autoTipCount += 1;
  }

  if (input.assessFieldScores) {
    for (const piece of input.pieces) {
      if (piece.location.kind === "garden") bag[piece.location.alliance].gardenCount += 1;
      if (piece.location.kind === "cell" && piece.location.upward) {
        bag[piece.location.alliance].cellCount += 1;
      }
    }
    const byFlower = new Map<string, ScorePiece[]>();
    for (const piece of input.pieces) {
      if (piece.location.kind !== "flower" || !piece.location.scoring) continue;
      const list = byFlower.get(piece.location.flowerId) ?? [];
      list.push(piece);
      byFlower.set(piece.location.flowerId, list);
    }
    for (const stack of byFlower.values()) {
      stack.sort((a, b) => {
        const ah = a.location.kind === "flower" ? a.location.heightIn : 0;
        const bh = b.location.kind === "flower" ? b.location.heightIn : 0;
        return ah - bh;
      });
      const nectar = stack.filter((piece) => piece.kind === "nectar" && piece.alliance);
      const bottom = nectar[0];
      const top = nectar[nectar.length - 1];
      if (bottom?.alliance) bag[bottom.alliance].bottomNectarCount += 1;
      if (top?.alliance) bag[top.alliance].flowerElementCount += stack.length;
    }
  }

  for (const foul of input.fouls) {
    const receiver = opponent(foul.against);
    const points = foul.severity === "minor" ? POINTS.minorFoul : POINTS.majorFoul;
    bag[receiver].foulPoints += points;
    if (foul.severity === "minor") bag[foul.against].minorFouls += 1;
    else bag[foul.against].majorFouls += 1;
  }

  const redMatch =
    red.leaveCount * POINTS.leave +
    red.autoParkCount * POINTS.park +
    red.teleopParkCount * POINTS.park +
    red.tipCount * POINTS.hiveTip +
    red.cellCount * POINTS.cell +
    red.flowerElementCount * POINTS.flowerElement +
    red.bottomNectarCount * POINTS.bottomNectar +
    red.gardenCount * POINTS.garden +
    red.foulPoints;
  const blueMatch =
    blue.leaveCount * POINTS.leave +
    blue.autoParkCount * POINTS.park +
    blue.teleopParkCount * POINTS.park +
    blue.tipCount * POINTS.hiveTip +
    blue.cellCount * POINTS.cell +
    blue.flowerElementCount * POINTS.flowerElement +
    blue.bottomNectarCount * POINTS.bottomNectar +
    blue.gardenCount * POINTS.garden +
    blue.foulPoints;
  const redResult = redMatch > blueMatch ? "win" : redMatch < blueMatch ? "loss" : "tie";
  const blueResult = blueMatch > redMatch ? "win" : blueMatch < redMatch ? "loss" : "tie";
  const redExtra = redResult === "win" ? RP_THRESHOLD.win : redResult === "tie" ? RP_THRESHOLD.tie : 0;
  const blueExtra = blueResult === "win" ? RP_THRESHOLD.win : blueResult === "tie" ? RP_THRESHOLD.tie : 0;
  return {
    red: finalize(red, redResult, redExtra),
    blue: finalize(blue, blueResult, blueExtra),
  };
}

/** G421 — one major foul when the pin reaches 3 seconds, plus another every 3 seconds. */
export function pinningFoulCount(durationSec: number): number {
  if (durationSec < PIN_SECONDS) return 0;
  return Math.floor(durationSec / PIN_SECONDS);
}
