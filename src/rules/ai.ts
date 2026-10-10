import { CELL_CENTER_ARM_IN, MAX_CONTROLLED, type Alliance } from "./constants";
import { FLOWERS, HIVES, garden, loadingZone, type FlowerSpec } from "./layout";

export type Difficulty = "gentle" | "standard" | "challenging";
export type AiPhase = "setup" | "auto" | "transition" | "teleop" | "ended";

export interface AiHeld {
  kind: "pollen" | "nectar";
  alliance: Alliance | null;
}

export interface AiPiece {
  kind: "pollen" | "nectar";
  alliance: Alliance | null;
  /** Inches. */
  x: number;
  z: number;
  spill: boolean;
}

export interface AiRobot {
  x: number;
  z: number;
  /** Radians. 0 faces +Z. Positive yaw turns toward +X. */
  yaw: number;
  hood: number;
  held: AiHeld[];
}

export interface AiInput {
  alliance: Alliance;
  difficulty: Difficulty;
  phase: AiPhase;
  /** Seconds left in teleop. Ignored in other phases. */
  teleopRemaining: number;
  flowerOpen: boolean;
  /** G426: a new nectar may enter without a foul. */
  nectarLegal: boolean;
  lengthIn: number;
  /** "pollen" refuses nectar. "both" accepts own nectar. */
  collects: "pollen" | "both";
  robot: AiRobot;
  pieces: AiPiece[];
  opponents: Array<{ x: number; z: number }>;
}

export interface AiCommand {
  forward: number;
  strafe: number;
  turn: number;
  launch: boolean;
  intake: boolean;
  deposit: boolean;
  eject: boolean;
  /** Set the hood, or leave it alone. */
  hood: number | null;
  /** Rising edge asks the human-player station for one nectar. */
  nectar: boolean;
  status: string;
}

const GAIN: Record<Difficulty, number> = { gentle: 0.55, standard: 0.85, challenging: 1 };
/** Park when this many teleop seconds remain. */
const PARK_AT: Record<Difficulty, number> = { gentle: 28, standard: 20, challenging: 12 };
const AIM_SLOP: Record<Difficulty, number> = { gentle: 0.42, standard: 0.24, challenging: 0.14 };

export function aimYaw(x: number, z: number, aimX: number, aimZ: number): number {
  return Math.atan2(aimX - x, aimZ - z);
}

/** Stand on the alliance side of the hive and shoot into the cell that starts up. */
export function shootingSpot(alliance: Alliance): { x: number; z: number; aimX: number; aimZ: number } {
  const hive = HIVES.find((item) => item.alliance === alliance);
  const aimX = hive?.pivotX ?? 0;
  const aimZ = alliance === "red" ? -CELL_CENTER_ARM_IN : CELL_CENTER_ARM_IN;
  return {
    x: alliance === "red" ? 38 : -38,
    z: alliance === "red" ? -28 : 28,
    aimX,
    aimZ,
  };
}

/** Just inside the field from the alliance garden, where an eject lands on the tape. */
export function gardenSpot(alliance: Alliance): { x: number; z: number } {
  const zone = garden(alliance);
  return {
    x: (zone.minX + zone.maxX) / 2,
    z: alliance === "red" ? zone.minZ - 8 : zone.maxZ + 8,
  };
}

export function decide(input: AiInput): AiCommand {
  const idle = empty(input.phase === "transition" ? "Disabled by the match" : input.phase === "ended" ? "Match over" : "Waiting");
  if (input.phase === "transition" || input.phase === "ended" || input.phase === "setup") return idle;

  const gain = GAIN[input.difficulty];
  if (input.robot.held.some((piece) => piece.kind === "nectar" && piece.alliance && piece.alliance !== input.alliance)) {
    return { ...empty("Ejecting opponent nectar"), eject: true };
  }

  if (input.phase === "teleop" && input.teleopRemaining <= PARK_AT[input.difficulty]) {
    return goPark(input, gain);
  }

  const ownNectar = input.robot.held.some((piece) => piece.kind === "nectar" && piece.alliance === input.alliance);
  if (ownNectar && input.flowerOpen) return goFlower(input, gain);

  const full = input.robot.held.length >= MAX_CONTROLLED;
  const target = nearestPiece(input);
  const closeEnough = target ? hypot(input.robot.x - target.x, input.robot.z - target.z) < 36 : false;
  if (!full && target && (input.robot.held.length < 2 || closeEnough)) return goCollect(input, target, gain);

  if (input.robot.held.length > 0) {
    if (gardenBetter(input)) return goGarden(input, gain);
    return goHive(input, gain);
  }

  if (input.nectarLegal && !ownNectar && inLoading(input)) {
    const spot = parkPoint(input);
    return {
      ...steer(input, spot.x, spot.z, spot.x, spot.z, gain, 4, "Collecting nectar"),
      nectar: true,
      intake: true,
    };
  }

  const search = gardenSpot(input.alliance);
  const wandering = steer(input, search.x, search.z, search.x, search.z, gain, 6, "Waiting: no compatible elements");
  return { ...wandering, intake: false, launch: false, deposit: false, eject: false, nectar: false, hood: null };
}

function goPark(input: AiInput, gain: number): AiCommand {
  const spot = parkPoint(input);
  const inside = pointIn(spot.zone, input.robot.x, input.robot.z);
  const faceZ = input.alliance === "red" ? spot.z + 20 : spot.z - 20;
  const cmd = steer(input, spot.x, spot.z, spot.x, faceZ, gain, inside ? 2 : 5, inside ? "Holding the loading zone" : "Parking");
  if (inside && hypot(input.robot.x - spot.x, input.robot.z - spot.z) < 6) {
    cmd.forward = 0;
    cmd.strafe = 0;
  }
  cmd.launch = false;
  cmd.intake = false;
  cmd.deposit = false;
  cmd.eject = false;
  cmd.nectar = false;
  return cmd;
}

function goFlower(input: AiInput, gain: number): AiCommand {
  const flower = ownFlower(input);
  const dist = hypot(input.robot.x - flower.x, input.robot.z - flower.z);
  const yawErr = Math.abs(wrap(aimYaw(input.robot.x, input.robot.z, flower.x, flower.z) - input.robot.yaw));
  const ready = dist < 18 && yawErr < 0.45;
  const cmd = steer(input, flower.x, flower.z, flower.x, flower.z, gain, ready ? 3 : 8, ready ? "Depositing in the flower" : "Travelling to a flower");
  cmd.deposit = ready && input.flowerOpen;
  cmd.launch = false;
  cmd.intake = false;
  cmd.hood = null;
  return cmd;
}

function goCollect(input: AiInput, piece: AiPiece, gain: number): AiCommand {
  const mouth = mouthOf(input);
  const dx = piece.x - mouth.x;
  const dz = piece.z - mouth.z;
  const dist = hypot(dx, dz);
  const fx = Math.sin(input.robot.yaw);
  const fz = Math.cos(input.robot.yaw);
  const ahead = dx * fx + dz * fz;
  const facing = dist < 12 && ahead > -1;
  const cmd = steer(input, piece.x, piece.z, piece.x, piece.z, gain, facing ? 2 : 6, facing ? "Collecting" : "Travelling to a piece");
  cmd.intake = facing;
  cmd.launch = false;
  cmd.deposit = false;
  cmd.hood = null;
  return cmd;
}

function goGarden(input: AiInput, gain: number): AiCommand {
  const spot = gardenSpot(input.alliance);
  const dist = hypot(input.robot.x - spot.x, input.robot.z - spot.z);
  const ready = dist < 7;
  const cmd = steer(input, spot.x, spot.z, spot.x, spot.z, gain, ready ? 2 : 6, ready ? "Scoring the garden" : "Travelling to the garden");
  cmd.eject = ready && input.robot.held.some((piece) => piece.kind === "pollen");
  cmd.launch = false;
  cmd.deposit = false;
  cmd.intake = false;
  cmd.hood = null;
  return cmd;
}

function goHive(input: AiInput, gain: number): AiCommand {
  const spot = shootingSpot(input.alliance);
  const dist = hypot(input.robot.x - spot.x, input.robot.z - spot.z);
  const yawErr = Math.abs(wrap(aimYaw(input.robot.x, input.robot.z, spot.aimX, spot.aimZ) - input.robot.yaw));
  const slop = AIM_SLOP[input.difficulty];
  const aligned = dist < 8 && yawErr < slop;
  const status = aligned ? "Shooting" : dist < 14 ? "Aiming" : "Travelling to shooting spot";
  const cmd = steer(input, spot.x, spot.z, spot.aimX, spot.aimZ, gain, aligned ? 3 : 7, status);
  cmd.launch = aligned && input.robot.held.length > 0;
  cmd.intake = false;
  cmd.deposit = false;
  cmd.eject = false;
  cmd.hood = 52;
  return cmd;
}

function steer(
  input: AiInput,
  tx: number,
  tz: number,
  faceX: number,
  faceZ: number,
  gain: number,
  stopIn: number,
  status: string,
): AiCommand {
  let dx = tx - input.robot.x;
  let dz = tz - input.robot.z;
  if (input.phase === "auto") {
    const clamped = input.alliance === "red" ? Math.max(tx, 10) : Math.min(tx, -10);
    dx = clamped - input.robot.x;
  }
  let blocked = false;
  for (const opp of input.opponents) {
    const ox = input.robot.x - opp.x;
    const oz = input.robot.z - opp.z;
    const dist = hypot(ox, oz);
    if (dist < 16 && dist > 0.05) {
      const push = ((16 - dist) / 16) * 26;
      dx += (ox / dist) * push;
      dz += (oz / dist) * push;
      if (dist < 10) blocked = true;
    }
  }
  const dist = hypot(dx, dz);
  let forward = 0;
  let strafe = 0;
  if (dist > stopIn) {
    forward = (dz / dist) * gain;
    strafe = (-dx / dist) * gain;
  }
  const err = wrap(aimYaw(input.robot.x, input.robot.z, faceX, faceZ) - input.robot.yaw);
  const turn = clamp(err / 0.45) * gain;
  return {
    forward: clamp(forward),
    strafe: clamp(strafe),
    turn: clamp(turn),
    launch: false,
    intake: false,
    deposit: false,
    eject: false,
    hood: null,
    nectar: false,
    status: blocked ? "Blocked backing off" : status,
  };
}

function nearestPiece(input: AiInput): AiPiece | null {
  let best: AiPiece | null = null;
  let bestD = Infinity;
  for (const piece of input.pieces) {
    if (piece.spill) continue;
    if (!compatible(input, piece)) continue;
    if (!onOwnHalf(input, piece.x)) continue;
    const dist = hypot(input.robot.x - piece.x, input.robot.z - piece.z);
    if (dist < bestD) {
      best = piece;
      bestD = dist;
    }
  }
  return best;
}

function compatible(input: AiInput, piece: AiPiece): boolean {
  if (piece.kind === "pollen") return true;
  if (input.collects === "pollen") return false;
  return piece.alliance === input.alliance;
}

function onOwnHalf(input: AiInput, x: number): boolean {
  if (input.phase !== "auto") return true;
  return input.alliance === "red" ? x >= 8 : x <= -8;
}

function gardenBetter(input: AiInput): boolean {
  if (!input.robot.held.some((piece) => piece.kind === "pollen")) return false;
  if (input.robot.held.some((piece) => piece.kind === "nectar")) return false;
  const spot = gardenSpot(input.alliance);
  const gardenDist = hypot(input.robot.x - spot.x, input.robot.z - spot.z);
  // Only cash a garden when the robot is already on that tape. A full hopper
  // is worth a hive shot, even if the garden happens to be closer to the start.
  if (gardenDist > 12) return false;
  const hive = shootingSpot(input.alliance);
  return gardenDist + 8 < hypot(input.robot.x - hive.x, input.robot.z - hive.z);
}

function ownFlower(input: AiInput): FlowerSpec {
  const wall = FLOWERS.find((flower) => flower.wall === input.alliance);
  if (input.phase === "auto" && wall) return wall;
  let best = wall ?? FLOWERS[0]!;
  let bestD = hypot(input.robot.x - best.x, input.robot.z - best.z);
  for (const flower of FLOWERS) {
    if (input.phase === "auto" && !onOwnHalf(input, flower.x)) continue;
    const dist = hypot(input.robot.x - flower.x, input.robot.z - flower.z);
    if (dist < bestD) {
      best = flower;
      bestD = dist;
    }
  }
  return best;
}

function parkPoint(input: AiInput): { x: number; z: number; zone: { minX: number; maxX: number; minZ: number; maxZ: number } } {
  const zone = loadingZone(input.alliance);
  const inset = input.lengthIn / 2 + 0.3;
  const x = input.alliance === "red" ? zone.maxX - inset : zone.minX + inset;
  const z = (zone.minZ + zone.maxZ) / 2;
  return { x, z, zone };
}

function inLoading(input: AiInput): boolean {
  const zone = loadingZone(input.alliance);
  return pointIn(zone, input.robot.x, input.robot.z);
}

function mouthOf(input: AiInput): { x: number; z: number } {
  return {
    x: input.robot.x + Math.sin(input.robot.yaw) * (input.lengthIn / 2),
    z: input.robot.z + Math.cos(input.robot.yaw) * (input.lengthIn / 2),
  };
}

function pointIn(zone: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}

function empty(status: string): AiCommand {
  return {
    forward: 0,
    strafe: 0,
    turn: 0,
    launch: false,
    intake: false,
    deposit: false,
    eject: false,
    hood: null,
    nectar: false,
    status,
  };
}

function hypot(x: number, z: number): number {
  return Math.hypot(x, z);
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function wrap(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
