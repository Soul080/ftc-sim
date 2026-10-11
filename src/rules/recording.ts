import type { Alliance } from "./constants";
import type { DriveMode } from "./drive";

/** One sampled moment of a driver's inputs. `t` is seconds from the start of auto. */
export interface DriveFrame {
  t: number;
  forward: number;
  strafe: number;
  turn: number;
  intake: boolean;
  launch: boolean;
  deposit: boolean;
  eject: boolean;
  hood: number;
  turret: number;
}

export interface AutoRecording {
  id: string;
  name: string;
  alliance: Alliance;
  mode: DriveMode;
  duration: number;
  frames: DriveFrame[];
}

export const AUTO_RECORD_SEC = 30;
const SAMPLE_GAP = 0.05;

export function idleFrame(t = 0): DriveFrame {
  return {
    t,
    forward: 0,
    strafe: 0,
    turn: 0,
    intake: false,
    launch: false,
    deposit: false,
    eject: false,
    hood: 50,
    turret: 0,
  };
}

/** Keep samples at about 20 Hz and refuse anything past the 30 s auto. */
export function appendFrame(frames: DriveFrame[], frame: DriveFrame): DriveFrame[] {
  if (frame.t < 0 || frame.t > AUTO_RECORD_SEC + 1e-6) return frames;
  const last = frames[frames.length - 1];
  if (last && frame.t - last.t < SAMPLE_GAP - 1e-4) return frames;
  return [...frames, { ...frame, t: Math.min(AUTO_RECORD_SEC, frame.t) }];
}

/**
 * The input that should be held at `elapsed` seconds.
 * After the last sample, the robot stops but keeps the recorded hood and turret.
 */
export function frameAt(frames: DriveFrame[], elapsed: number): DriveFrame {
  if (frames.length === 0) return idleFrame(elapsed);
  let chosen = frames[0] ?? idleFrame();
  for (const frame of frames) {
    if (frame.t <= elapsed + 1e-6) chosen = frame;
    else break;
  }
  const end = frames[frames.length - 1]?.t ?? 0;
  if (elapsed > end + SAMPLE_GAP) {
    return { ...idleFrame(elapsed), hood: chosen.hood, turret: chosen.turret };
  }
  return chosen;
}
