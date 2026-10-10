export type AutoCmd =
  | { type: "forward" | "back"; inches: number }
  | { type: "strafe"; inches: number }
  | { type: "turn"; degrees: number }
  | { type: "wait" | "intake"; seconds: number }
  | { type: "launch" | "deposit" | "eject" }
  | { type: "hood"; degrees: number };

export interface AutoRuntime {
  cmds: AutoCmd[];
  index: number;
  elapsed: number;
  pulsed: boolean;
}

export interface AutoSample {
  dt: number;
  /** Inches traveled in the commanded direction since this command started. */
  movedInches: number;
  /** Degrees turned in the commanded direction since this command started. */
  turnedDeg: number;
}

export interface AutoDrive {
  forward: number;
  strafe: number;
  turn: number;
  intake: boolean;
  launch: boolean;
  deposit: boolean;
  eject: boolean;
  hood: number | null;
  commandIndex: number;
  done: boolean;
}

const IDLE: Omit<AutoDrive, "commandIndex" | "done"> = {
  forward: 0,
  strafe: 0,
  turn: 0,
  intake: false,
  launch: false,
  deposit: false,
  eject: false,
  hood: null,
};

export function parseScript(source: string): { cmds: AutoCmd[]; errors: string[] } {
  const cmds: AutoCmd[] = [];
  const errors: string[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const op = (parts[0] ?? "").toLowerCase();
    const arg = parts[1] !== undefined ? Number(parts[1]) : Number.NaN;
    const where = `line ${i + 1}`;
    switch (op) {
      case "forward":
      case "back":
        if (!Number.isFinite(arg) || arg < 0) errors.push(`${where}: ${op} needs a positive number`);
        else cmds.push({ type: op, inches: arg });
        break;
      case "wait":
      case "intake":
        if (!Number.isFinite(arg) || arg < 0) errors.push(`${where}: ${op} needs a positive number`);
        else cmds.push({ type: op, seconds: arg });
        break;
      case "strafe":
      case "turn":
      case "hood":
        if (!Number.isFinite(arg)) errors.push(`${where}: ${op} needs a number`);
        else if (op === "hood") cmds.push({ type: "hood", degrees: arg });
        else if (op === "turn") cmds.push({ type: "turn", degrees: arg });
        else cmds.push({ type: "strafe", inches: arg });
        break;
      case "launch": {
        const count = parts[1] === undefined ? 1 : Number(parts[1]);
        if (!Number.isInteger(count) || count < 1 || count > 8) {
          errors.push(`${where}: launch count must be 1–8`);
          break;
        }
        for (let n = 0; n < count; n += 1) {
          if (n > 0) cmds.push({ type: "wait", seconds: 0.32 });
          cmds.push({ type: "launch" });
        }
        break;
      }
      case "deposit":
      case "eject":
        cmds.push({ type: op });
        break;
      default:
        errors.push(`${where}: unknown command "${op}"`);
    }
  }
  return { cmds, errors };
}

export function createRuntime(cmds: AutoCmd[]): AutoRuntime {
  return { cmds, index: 0, elapsed: 0, pulsed: false };
}

export function stepAuto(runtime: AutoRuntime, sample: AutoSample): { runtime: AutoRuntime; drive: AutoDrive } {
  const cmd = runtime.cmds[runtime.index];
  if (!cmd) {
    return {
      runtime,
      drive: { ...IDLE, commandIndex: runtime.index, done: true },
    };
  }
  const elapsed = runtime.elapsed + sample.dt;
  const finish = (): { runtime: AutoRuntime; drive: AutoDrive } => ({
    runtime: { ...runtime, index: runtime.index + 1, elapsed: 0, pulsed: false },
    drive: { ...IDLE, commandIndex: runtime.index + 1, done: runtime.index + 1 >= runtime.cmds.length },
  });

  if (cmd.type === "forward" || cmd.type === "back") {
    const timeout = Math.max(1.4, cmd.inches / 10 + 0.6);
    if (sample.movedInches >= cmd.inches - 0.25 || elapsed >= timeout) return finish();
    return {
      runtime: { ...runtime, elapsed },
      drive: { ...IDLE, forward: cmd.type === "forward" ? 1 : -1, commandIndex: runtime.index, done: false },
    };
  }
  if (cmd.type === "strafe") {
    const need = Math.abs(cmd.inches);
    const timeout = Math.max(1.4, need / 10 + 0.6);
    if (sample.movedInches >= need - 0.25 || elapsed >= timeout) return finish();
    return {
      runtime: { ...runtime, elapsed },
      drive: {
        ...IDLE,
        strafe: cmd.inches >= 0 ? 1 : -1,
        commandIndex: runtime.index,
        done: false,
      },
    };
  }
  if (cmd.type === "turn") {
    const need = Math.abs(cmd.degrees);
    const timeout = Math.max(0.8, need / 80 + 0.4);
    if (sample.turnedDeg >= need - 0.8 || elapsed >= timeout) return finish();
    return {
      runtime: { ...runtime, elapsed },
      drive: {
        ...IDLE,
        turn: cmd.degrees >= 0 ? 1 : -1,
        commandIndex: runtime.index,
        done: false,
      },
    };
  }
  if (cmd.type === "wait" || cmd.type === "intake") {
    if (elapsed >= cmd.seconds) return finish();
    return {
      runtime: { ...runtime, elapsed },
      drive: {
        ...IDLE,
        intake: cmd.type === "intake",
        commandIndex: runtime.index,
        done: false,
      },
    };
  }
  if (cmd.type === "hood") {
    const next = runtime.index + 1;
    return {
      runtime: { ...runtime, index: next, elapsed: 0, pulsed: false },
      drive: { ...IDLE, hood: cmd.degrees, commandIndex: next, done: next >= runtime.cmds.length },
    };
  }
  if (!runtime.pulsed) {
    return {
      runtime: { ...runtime, elapsed, pulsed: true },
      drive: {
        ...IDLE,
        launch: cmd.type === "launch",
        deposit: cmd.type === "deposit",
        eject: cmd.type === "eject",
        commandIndex: runtime.index,
        done: false,
      },
    };
  }
  return finish();
}
