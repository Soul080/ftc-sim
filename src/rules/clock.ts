import {
  AUTO_SEC,
  ENDGAME_REMAINING_SEC,
  FLOWER_UNLOCK_REMAINING_SEC,
  TELEOP_SEC,
  TRANSITION_SEC,
} from "./constants";

export type Phase = "setup" | "auto" | "transition" | "teleop" | "ended";
export type ClockEvent = "auto-end" | "teleop-start" | "flower-unlock" | "endgame" | "match-end";

export interface Clock {
  phase: Phase;
  remaining: number;
}

export function setupClock(): Clock {
  return { phase: "setup", remaining: AUTO_SEC };
}

export function autoClock(): Clock {
  return { phase: "auto", remaining: AUTO_SEC };
}

export function tickClock(clock: Clock, dt: number): { clock: Clock; events: ClockEvent[] } {
  if (clock.phase === "setup" || clock.phase === "ended" || dt <= 0) {
    return { clock, events: [] };
  }
  const events: ClockEvent[] = [];
  let phase: Phase = clock.phase;
  let remaining = clock.remaining;
  let left = dt;
  while (left > 1e-8 && phase !== "ended") {
    if (phase === "auto") {
      const step = Math.min(left, remaining);
      remaining -= step;
      left -= step;
      if (remaining <= 1e-8) {
        events.push("auto-end");
        phase = "transition";
        remaining = TRANSITION_SEC;
      }
    } else if (phase === "transition") {
      const step = Math.min(left, remaining);
      remaining -= step;
      left -= step;
      if (remaining <= 1e-8) {
        events.push("teleop-start");
        phase = "teleop";
        remaining = TELEOP_SEC;
      }
    } else {
      const before = remaining;
      const step = Math.min(left, remaining);
      remaining -= step;
      left -= step;
      if (before > FLOWER_UNLOCK_REMAINING_SEC && remaining <= FLOWER_UNLOCK_REMAINING_SEC) {
        events.push("flower-unlock");
      }
      if (before > ENDGAME_REMAINING_SEC && remaining <= ENDGAME_REMAINING_SEC) {
        events.push("endgame");
      }
      if (remaining <= 1e-8) {
        events.push("match-end");
        phase = "ended";
        remaining = 0;
      }
    }
  }
  return { clock: { phase, remaining }, events };
}

export function flowerWindowOpen(clock: Clock): boolean {
  return clock.phase === "ended" || (clock.phase === "teleop" && clock.remaining <= FLOWER_UNLOCK_REMAINING_SEC);
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds - 1e-4));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function clockDisplay(clock: Clock): { time: string; phaseLabel: string } {
  switch (clock.phase) {
    case "setup":
      return { time: "2:30", phaseLabel: "READY" };
    case "auto":
      return { time: formatClock(120 + clock.remaining), phaseLabel: "AUTO" };
    case "transition":
      return { time: formatClock(clock.remaining), phaseLabel: "TRANSITION" };
    case "teleop":
      return { time: formatClock(clock.remaining), phaseLabel: "TELEOP" };
    case "ended":
      return { time: "0:00", phaseLabel: "FINAL" };
  }
}

/**
 * G426. Practice ignores the limit. During the flower window every remaining
 * nectar may enter. Otherwise each completed hive tip allows one entry.
 * `legalEntries` counts entries that were allowed; early entries do not spend a later tip credit.
 */
export function nectarEntryLegal(
  tips: number,
  legalEntries: number,
  clock: Clock,
  practice: boolean,
): boolean {
  if (practice) return true;
  if (flowerWindowOpen(clock)) return true;
  return legalEntries < tips;
}
