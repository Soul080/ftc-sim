import "./style.css";
import { KEY_ACTIONS, type KeyMap } from "./rules/controls";
import type { DriveMode, DriveTrain } from "./rules/drive";
import { MOTOR_FREE_RPM, presetSpeed, strafePenaltyPercent, turnDegPerSec } from "./rules/garage";
import type { AutoRecording } from "./rules/recording";
import type { AllianceScore } from "./rules/scoring";
import type { Alliance } from "./rules/constants";
import {
  DEFAULT_CONFIG,
  Simulator,
  type CameraName,
  type DriverMode,
  type HudModel,
  type MotorPreset,
  type SimConfig,
} from "./sim/Simulator";
import type { Difficulty } from "./rules/ai";

const STORAGE_KEY = "biobuzz-sim-config";
const AUTO_KEY = "biobuzz-sim-autos";

interface SavedState {
  config: Partial<SimConfig>;
  scripts: Record<string, string>;
}

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const boot = document.querySelector<HTMLElement>("#boot");
const bootStatus = document.querySelector<HTMLElement>("#boot-status");
if (!canvas || !boot || !bootStatus) throw new Error("Page shell is missing.");

const sim = new Simulator(canvas);
const saved = loadState();
if (saved?.config) sim.setConfig(mergeConfig(saved.config));
const scriptIds = ["red-1", "blue-1", "red-2", "blue-2"];
if (saved?.scripts) {
  for (const id of scriptIds) {
    if (typeof saved.scripts[id] === "string") sim.setScript(id, saved.scripts[id]);
  }
}
loadAutos();

declare global {
  interface Window {
    __SIM__?: {
      ready: () => boolean;
      start: () => void;
      reset: () => void;
      camera: (name: CameraName) => void;
      hud: () => HudModel;
      config: () => SimConfig;
      advance: (seconds: number) => void;
      poses: () => ReturnType<Simulator["poses"]>;
      setSpeed: (multiplier: number) => void;
    };
  }
}

window.__SIM__ = {
  ready: () => sim.isReady,
  start: () => sim.startMatch(),
  reset: () => sim.resetField(),
  camera: (name) => sim.setCamera(name),
      hud: () => sim.hud(),
      config: () => sim.getConfig(),
      advance: (seconds: number) => sim.advance(seconds),
      poses: () => sim.poses(),
      setSpeed: (multiplier: number) => sim.setSpeed(multiplier),
    };

bindPanel();
buildBinds();

void sim
  .init()
  .then(() => {
    boot.hidden = true;
    for (const id of ["board", "message", "panel", "panel-toggle"]) {
      const node = document.getElementById(id);
      if (node) node.hidden = false;
    }
    syncPanel();
    const frame = (now: number): void => {
      sim.frame(now);
      paintHud(sim.hud());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })
  .catch((error: unknown) => {
    boot.classList.add("error");
    const detail = error instanceof Error ? error.message : "Unknown error";
    bootStatus.textContent = `The field could not start. WebGL or WebAssembly failed: ${detail}`;
  });

function bindPanel(): void {
  document.querySelector("#start")?.addEventListener("click", () => sim.startMatch());
  document.querySelector("#ai-vs-ai")?.addEventListener("click", () => {
    sim.setConfig({
      redDriver: "ai",
      blueDriver: "ai",
      redDifficulty: "standard",
      blueDifficulty: "standard",
    });
    persist();
    syncPanel();
    sim.startMatch();
  });
  document.querySelector("#reset")?.addEventListener("click", () => sim.resetField());
  document.querySelector("#record-red")?.addEventListener("click", () => beginRecord("red"));
  document.querySelector("#record-blue")?.addEventListener("click", () => beginRecord("blue"));
  document.querySelector("#record-stop")?.addEventListener("click", () => {
    const name = document.querySelector<HTMLInputElement>("#record-name")?.value ?? "";
    sim.finishRecording(name);
    persistAutos();
    syncRecords();
  });
  document.querySelector("#panel-toggle")?.addEventListener("click", () => {
    document.querySelector("#panel")?.classList.toggle("open");
  });
  document.querySelector("#panel-close")?.addEventListener("click", () => {
    document.querySelector("#panel")?.classList.remove("open");
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    button.addEventListener("click", () => showTab(button.dataset.tab ?? "match"));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-train]")) {
    button.addEventListener("click", () => {
      sim.setConfig({ train: button.dataset.train as DriveTrain });
      persist();
      syncPanel();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      sim.setConfig({ mode: button.dataset.mode as DriveMode });
      persist();
      syncPanel();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-camera]")) {
    button.addEventListener("click", () => sim.setCamera(button.dataset.camera as CameraName));
  }

  bindRange("length", "length-out", " in", (value) => sim.setConfig({ lengthIn: value }));
  bindRange("width", "width-out", " in", (value) => sim.setConfig({ widthIn: value }));
  bindRange("height", "height-out", " in", (value) => sim.setConfig({ heightIn: value }));
  bindRange("mass", "mass-out", " kg", (value) => sim.setConfig({ massKg: value }));
  bindRange("speed", "speed-out", " m/s", (value) => sim.setConfig({ maxSpeed: value }));
  bindRange("launch", "launch-out", " m/s", (value) => sim.setConfig({ launchSpeed: value }));
  bindRange("robots", "robots-out", "", (value) => sim.setConfig({ robotCount: value === 4 ? 4 : 2 }));
  bindRange("fov", "fov-out", "°", (value) => sim.setConfig({ fov: value }));
  bindRange("wheel", "wheel-out", " in", (value) => {
    const config = sim.getConfig();
    const maxSpeed = config.motor === "stock" || config.motor === "measured" ? config.maxSpeed : presetSpeed(config.motor, value, config.measFwd);
    sim.setConfig({ wheelDiameterIn: value, maxSpeed });
  });
  bindRange("meas-fwd", "meas-fwd-out", " m/s", (value) => sim.setConfig({ measFwd: value }));
  bindRange("meas-strafe", "meas-strafe-out", " m/s", (value) => sim.setConfig({ measStrafe: value }));
  bindRange("meas-accel", "meas-accel-out", " s", (value) => sim.setConfig({ measAccel: value }));
  bindRange("meas-stop", "meas-stop-out", " in", (value) => sim.setConfig({ measStop: value }));
  bindRange("meas-turn", "meas-turn-out", " s", (value) => sim.setConfig({ measTurn: value }));
  bindRange("deadzone", "deadzone-out", "", (value) => sim.setConfig({ deadzone: value }), 2);
  bindRange("turn-deadzone", "turn-deadzone-out", "", (value) => sim.setConfig({ turnDeadzone: value }), 2);
  bindRange("move-curve", "move-curve-out", "", (value) => sim.setConfig({ moveCurve: value }), 1);
  bindRange("turn-curve", "turn-curve-out", "", (value) => sim.setConfig({ turnCurve: value }), 1);
  bindRange("precision", "precision-out", "", (value) => sim.setConfig({ precisionScale: value }), 2);
  bindRange("turn-rate", "turn-rate-out", " rad/s", (value) => sim.setConfig({ turnRate: value }), 1);
  bindRange("strafe-eff", "strafe-eff-out", "", (value) => sim.setConfig({ strafeEfficiency: value }), 0, (value) => `${Math.round(value * 100)}%`);
  bindRange("accel", "accel-out", "×", (value) => sim.setConfig({ accelScale: value }), 2);
  bindRange("brake", "brake-out", "", (value) => sim.setConfig({ brakeDamping: value }), 2);
  bindRange("gravity", "gravity-out", "", (value) => sim.setConfig({ gravity: value }), 2);
  bindRange("friction", "friction-out", "", (value) => sim.setConfig({ robotFriction: value }), 2);
  bindRange("bounce", "bounce-out", "", (value) => sim.setConfig({ ballRestitution: value }), 2);
  bindRange("master", "master-out", "", (value) => sim.setConfig({ master: value }), 0, (value) => `${Math.round(value * 100)}%`);
  bindRange("sfx", "sfx-out", "", (value) => sim.setConfig({ sfx: value }), 0, (value) => `${Math.round(value * 100)}%`);
  bindRange("crowd", "crowd-out", "", (value) => sim.setConfig({ crowd: value }), 0, (value) => `${Math.round(value * 100)}%`);

  bindCheck("drag", (checked) => sim.setConfig({ drag: checked }));
  bindCheck("trajectory", (checked) => sim.setConfig({ trajectory: checked }));
  bindCheck("aim", (checked) => sim.setConfig({ aimAssist: checked }));
  bindCheck("mute", (checked) => sim.setConfig({ muted: checked }));
  bindCheck("colorblind", (checked) => sim.setConfig({ colorblind: checked }));
  bindCheck("show-hud", (checked) => sim.setConfig({ showHud: checked }));
  bindCheck("overlay", (checked) => sim.setConfig({ opponentOverlay: checked }));
  bindCheck("shadows", (checked) => sim.setConfig({ shadows: checked }));
  bindCheck("msaa", (checked) => sim.setConfig({ msaa: checked }));
  bindCheck("vsync", (checked) => sim.setConfig({ vsync: checked }));
  bindCheck("invert-x", (checked) => sim.setConfig({ invertMoveX: checked }));
  bindCheck("invert-y", (checked) => sim.setConfig({ invertMoveY: checked }));
  bindCheck("invert-turn", (checked) => sim.setConfig({ invertTurn: checked }));

  bindSelect("red-driver", (value) => sim.setConfig({ redDriver: value as DriverMode }));
  bindSelect("blue-driver", (value) => sim.setConfig({ blueDriver: value as DriverMode }));
  bindSelect("red-difficulty", (value) => sim.setConfig({ redDifficulty: value as Difficulty }));
  bindSelect("blue-difficulty", (value) => sim.setConfig({ blueDifficulty: value as Difficulty }));
  bindSelect("intake-ends", (value) => sim.setConfig({ intakeEnds: value === "both" ? "both" : "front" }));
  bindSelect("collects", (value) => sim.setConfig({ collects: value === "pollen" ? "pollen" : "both" }));
  bindSelect("motor", (value) => applyMotor(value as MotorPreset));

  const name = document.querySelector<HTMLInputElement>("#robot-name");
  name?.addEventListener("change", () => {
    sim.setConfig({ robotName: name.value });
    persist();
    syncPanel();
  });
  for (const id of ["red-color", "blue-color"] as const) {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    input?.addEventListener("input", () => {
      sim.setConfig(id === "red-color" ? { redColor: input.value } : { blueColor: input.value });
      persist();
    });
  }

  document.querySelector("#apply-measured")?.addEventListener("click", () => {
    const config = sim.getConfig();
    const efficiency = Math.max(0.35, Math.min(1, config.measStrafe / Math.max(0.2, config.measFwd)));
    const stopM = config.measStop * 0.0254;
    sim.setConfig({
      motor: "measured",
      maxSpeed: config.measFwd,
      strafeEfficiency: efficiency,
      turnRate: Math.max(0.4, Math.min(6, (Math.PI * 2) / config.measTurn)),
      brakeDamping: Math.max(0.01, Math.min(2, (config.measFwd / Math.max(0.05, stopM)) * 0.12)),
    });
    persist();
    syncPanel();
  });
  document.querySelector("#fullscreen")?.addEventListener("click", () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });
  document.querySelector("#reset-settings")?.addEventListener("click", () => {
    sim.setConfig({
      ...DEFAULT_CONFIG,
      redKeys: { ...DEFAULT_CONFIG.redKeys },
      blueKeys: { ...DEFAULT_CONFIG.blueKeys },
    });
    persist();
    syncPanel();
  });

  for (const id of scriptIds) {
    const box = document.querySelector<HTMLTextAreaElement>(`#script-${id}`);
    box?.addEventListener("input", () => {
      sim.setScript(id, box.value);
      persist();
    });
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (!capture) return;
      event.preventDefault();
      event.stopPropagation();
      const pending = capture;
      capture = null;
      sim.setKeyCapture(false);
      if (event.code !== "Escape") {
        const config = sim.getConfig();
        if (pending.alliance === "red") sim.setConfig({ redKeys: { ...config.redKeys, [pending.action]: event.code } });
        else sim.setConfig({ blueKeys: { ...config.blueKeys, [pending.action]: event.code } });
        persist();
      }
      syncPanel();
    },
    true,
  );
}

function applyMotor(motor: MotorPreset): void {
  const config = sim.getConfig();
  const patch: Partial<SimConfig> = {
    motor,
    maxSpeed: presetSpeed(motor, config.wheelDiameterIn, config.measFwd),
  };
  if (motor === "stock") {
    patch.strafeEfficiency = 0.9;
    patch.turnRate = 2.5;
    patch.accelScale = 1;
    patch.brakeDamping = 0.04;
  }
  sim.setConfig(patch);
  persist();
  syncPanel();
}

function showTab(name: string): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    button.classList.toggle("active", button.dataset.tab === name);
  }
  for (const field of document.querySelectorAll<HTMLElement>("#panel fieldset")) {
    field.hidden = field.dataset.tab !== name;
  }
}

let capture: { alliance: "red" | "blue"; action: keyof KeyMap } | null = null;

function buildBinds(): void {
  fillBinds("red-binds", "red");
  fillBinds("blue-binds", "blue");
}

function fillBinds(id: string, alliance: "red" | "blue"): void {
  const root = document.getElementById(id);
  if (!root) return;
  root.replaceChildren();
  for (const action of KEY_ACTIONS) {
    if (alliance === "blue" && action.id === "fieldCentric") continue;
    const label = document.createElement("span");
    label.textContent = action.label;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action.id;
    button.addEventListener("click", () => {
      capture = { alliance, action: action.id };
      sim.setKeyCapture(true);
      button.textContent = "Press a key";
    });
    root.append(label, button);
  }
}

function bindRange(
  id: string,
  outId: string,
  suffix: string,
  commit: (value: number) => void,
  digits?: number,
  format?: (value: number) => string,
): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const out = document.querySelector<HTMLElement>(`#${outId}`);
  if (!input || !out) return;
  const paint = (): void => {
    const value = Number(input.value);
    out.textContent = format ? format(value) : `${digits === undefined ? input.value : value.toFixed(digits)}${suffix}`;
  };
  input.addEventListener("input", paint);
  input.addEventListener("change", () => {
    commit(Number(input.value));
    persist();
    syncPanel();
  });
  paint();
}

function bindCheck(id: string, commit: (checked: boolean) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  input?.addEventListener("change", () => {
    commit(input.checked);
    persist();
  });
}

function bindSelect(id: string, commit: (value: string) => void): void {
  const input = document.querySelector<HTMLSelectElement>(`#${id}`);
  input?.addEventListener("change", () => {
    commit(input.value);
    if (id !== "motor") {
      persist();
      syncPanel();
    }
  });
}

function syncPanel(): void {
  const config = sim.getConfig();
  setRange("length", config.lengthIn, "length-out", " in");
  setRange("width", config.widthIn, "width-out", " in");
  setRange("height", config.heightIn, "height-out", " in");
  setRange("mass", config.massKg, "mass-out", " kg");
  setRange("speed", config.maxSpeed, "speed-out", " m/s");
  setRange("launch", config.launchSpeed, "launch-out", " m/s");
  setRange("robots", config.robotCount, "robots-out", "");
  setRange("fov", config.fov, "fov-out", "°", 0);
  setRange("wheel", config.wheelDiameterIn, "wheel-out", " in", 1);
  setRange("meas-fwd", config.measFwd, "meas-fwd-out", " m/s");
  setRange("meas-strafe", config.measStrafe, "meas-strafe-out", " m/s");
  setRange("meas-accel", config.measAccel, "meas-accel-out", " s");
  setRange("meas-stop", config.measStop, "meas-stop-out", " in", 0);
  setRange("meas-turn", config.measTurn, "meas-turn-out", " s", 1);
  setRange("deadzone", config.deadzone, "deadzone-out", "", 2);
  setRange("turn-deadzone", config.turnDeadzone, "turn-deadzone-out", "", 2);
  setRange("move-curve", config.moveCurve, "move-curve-out", "", 1);
  setRange("turn-curve", config.turnCurve, "turn-curve-out", "", 1);
  setRange("precision", config.precisionScale, "precision-out", "", 2);
  setRange("turn-rate", config.turnRate, "turn-rate-out", " rad/s", 1);
  setRange("strafe-eff", config.strafeEfficiency, "strafe-eff-out", "", 0, (value) => `${Math.round(value * 100)}%`);
  setRange("accel", config.accelScale, "accel-out", "×", 2);
  setRange("brake", config.brakeDamping, "brake-out", "", 2);
  setRange("gravity", config.gravity, "gravity-out", "", 2);
  setRange("friction", config.robotFriction, "friction-out", "", 2);
  setRange("bounce", config.ballRestitution, "bounce-out", "", 2);
  setRange("master", config.master, "master-out", "", 0, (value) => `${Math.round(value * 100)}%`);
  setRange("sfx", config.sfx, "sfx-out", "", 0, (value) => `${Math.round(value * 100)}%`);
  setRange("crowd", config.crowd, "crowd-out", "", 0, (value) => `${Math.round(value * 100)}%`);
  setCheck("drag", config.drag);
  setCheck("trajectory", config.trajectory);
  setCheck("aim", config.aimAssist);
  setCheck("mute", config.muted);
  setCheck("colorblind", config.colorblind);
  setCheck("show-hud", config.showHud);
  setCheck("overlay", config.opponentOverlay);
  setCheck("shadows", config.shadows);
  setCheck("msaa", config.msaa);
  setCheck("vsync", config.vsync);
  setCheck("invert-x", config.invertMoveX);
  setCheck("invert-y", config.invertMoveY);
  setCheck("invert-turn", config.invertTurn);
  setSelect("red-driver", config.redDriver);
  setSelect("blue-driver", config.blueDriver);
  setSelect("red-difficulty", config.redDifficulty);
  setSelect("blue-difficulty", config.blueDifficulty);
  setSelect("intake-ends", config.intakeEnds);
  setSelect("collects", config.collects);
  setSelect("motor", config.motor);
  const name = document.querySelector<HTMLInputElement>("#robot-name");
  if (name && document.activeElement !== name) name.value = config.robotName;
  setColor("red-color", config.redColor);
  setColor("blue-color", config.blueColor);
  mark("[data-train]", "data-train", config.train);
  mark("[data-mode]", "data-mode", config.mode);
  paintBinds(config);
  const derived = document.querySelector("#derived");
  if (derived) derived.textContent = derivedLine(config);
  for (const id of scriptIds) {
    const box = document.querySelector<HTMLTextAreaElement>(`#script-${id}`);
    if (box && document.activeElement !== box) box.value = sim.getScript(id);
  }
  for (const node of document.querySelectorAll(".extra-script")) {
    node.toggleAttribute("hidden", config.robotCount !== 4);
  }
  document.body.classList.toggle("hide-hud", !config.showHud);
  syncRecords();
}

function derivedLine(config: SimConfig): string {
  const inchesPerSec = config.maxSpeed / 0.0254;
  const turn = config.motor === "measured" ? turnDegPerSec(config.measTurn) : (config.turnRate * 180) / Math.PI;
  const baseAccel = config.motor === "measured" ? config.maxSpeed / Math.max(0.2, config.measAccel) : 4.4 * (12 / config.massKg);
  const accelSec = config.maxSpeed / Math.max(0.2, baseAccel * config.accelScale);
  const motor = config.motor;
  const rpm = motor === "hex20" || motor === "hex40" || motor === "neverest40" ? ` Catalogue free speed ${MOTOR_FREE_RPM[motor]} rpm at the motor.` : "";
  return `${config.robotName}: ${inchesPerSec.toFixed(0)} in/s, strafe penalty ${strafePenaltyPercent(config.strafeEfficiency)}%, turn ${turn.toFixed(0)}°/s, 0–top about ${accelSec.toFixed(2)} s.${rpm} Wheel ${wheelNote(config)}.`;
}

function wheelNote(config: SimConfig): string {
  if (config.motor === "stock") return "uses the stock 1.6 m/s tune";
  if (config.motor === "measured") return "uses the measured forward speed";
  return `${config.wheelDiameterIn.toFixed(1)} in, ${presetSpeed(config.motor, config.wheelDiameterIn, config.measFwd).toFixed(2)} m/s free`;
}

function paintBinds(config: SimConfig): void {
  paintBindColumn("red-binds", config.redKeys);
  paintBindColumn("blue-binds", config.blueKeys);
}

function paintBindColumn(id: string, keys: KeyMap): void {
  const root = document.getElementById(id);
  if (!root || capture) return;
  for (const button of root.querySelectorAll<HTMLButtonElement>("button")) {
    const action = button.dataset.action as keyof KeyMap | undefined;
    if (!action) continue;
    button.textContent = formatKey(keys[action]);
  }
}

function formatKey(code: string): string {
  if (!code) return "—";
  const named: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "L Shift",
    ShiftRight: "R Shift",
    Quote: "'",
    Semicolon: ";",
    Slash: "/",
    Period: ".",
    Space: "Space",
  };
  if (named[code]) return named[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

function setRange(
  id: string,
  value: number,
  outId: string,
  suffix: string,
  digits?: number,
  format?: (value: number) => string,
): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const out = document.querySelector<HTMLElement>(`#${outId}`);
  if (!input || !out || document.activeElement === input) return;
  input.value = String(value);
  out.textContent = format ? format(value) : `${digits === undefined ? value : value.toFixed(digits)}${suffix}`;
}

function setCheck(id: string, checked: boolean): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (input) input.checked = checked;
}

function setSelect(id: string, value: string): void {
  const input = document.querySelector<HTMLSelectElement>(`#${id}`);
  if (input && document.activeElement !== input) input.value = value;
}

function setColor(id: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (input && document.activeElement !== input) input.value = value;
}

function mark(selector: string, attr: string, value: string): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(selector)) {
    button.classList.toggle("active", button.getAttribute(attr) === value);
  }
}

let lastFouls = "";
let lastBreak = "";
let lastSaved = "";

function paintHud(hud: HudModel): void {
  const config = sim.getConfig();
  document.body.classList.toggle("hide-hud", !config.showHud);
  text("phase", hud.phaseLabel);
  text("time", hud.time);
  const drivers = `red ${config.redDriver} · blue ${config.blueDriver}`;
  if (hud.recording) {
    text("clock-meta", `Recording ${hud.recording.alliance} ${hud.recording.elapsed.toFixed(1)}s / 30`);
  } else {
    text("clock-meta", `${hud.camera} · ${hud.mode} · ${hud.train} · ${drivers}`);
  }
  text("red-points", String(hud.score.red.matchPoints));
  text("blue-points", String(hud.score.blue.matchPoints));
  text("red-rp", rpLine(hud.score.red));
  text("blue-rp", rpLine(hud.score.blue));
  const breaks = `${breakLine(hud.score.red)}|${breakLine(hud.score.blue)}`;
  if (breaks !== lastBreak) {
    lastBreak = breaks;
    text("red-break", breakLine(hud.score.red));
    text("blue-break", breakLine(hud.score.blue));
  }
  text("message", hud.message);
  const overlay = document.getElementById("ai-line");
  if (overlay) {
    const red = config.redDriver === "ai" ? hud.ai.red || "waiting" : "human";
    const blue = config.blueDriver === "ai" ? hud.ai.blue || "waiting" : "human";
    overlay.hidden = !config.opponentOverlay;
    text("ai-line", `Red ${red} · Blue ${blue}`);
  }
  const pads = document.getElementById("pads");
  if (pads) {
    const prefix = hud.pads.length ? `Connected: ${hud.pads.join(", ")}. ` : "No gamepad yet. ";
    const full = `${prefix}Left stick drives, right stick turns, RT intake, LT launch, RB deposit, LB eject, Y nectar, click the left stick for precision, D-pad hood, Start begins the match. Slots 2 are gamepad-only.`;
    if (pads.textContent !== full) pads.textContent = full;
  }
  text(
    "nectar-line",
    `Nectar tray red ${hud.tray.red} · blue ${hud.tray.blue}. Returns red ${hud.returns.red} · blue ${hud.returns.blue}. May enter red ${hud.mayEnter.red} · blue ${hud.mayEnter.blue}.`,
  );
  text(
    "held-line",
    hud.held.map((robot) => `${robot.id} holds ${robot.count}, hood ${robot.hood}°`).join(" · ") || "Robots are still spawning.",
  );
  const fouls = hud.fouls.join("\n");
  if (fouls !== lastFouls) {
    lastFouls = fouls;
    const list = document.querySelector("#fouls");
    if (list) {
      list.replaceChildren(
        ...hud.fouls.map((foul) => {
          const item = document.createElement("li");
          item.textContent = foul;
          return item;
        }),
      );
    }
  }
  const start = document.querySelector<HTMLButtonElement>("#start");
  if (start) {
    const live = hud.phase !== "setup" && hud.phase !== "ended";
    start.disabled = live;
    start.textContent = hud.phase === "ended" ? "Run again" : live ? "Match running" : "Start match";
  }
  mark("[data-camera]", "data-camera", hud.camera);
  const serial = JSON.stringify(config);
  if (serial !== lastSaved) {
    lastSaved = serial;
    persist();
    syncPanel();
  }
}

function breakLine(score: AllianceScore): string {
  return `Leave ${score.leave} · Park ${score.autoPark}+${score.teleopPark} · Hive ${score.hive} · Cell ${score.cell} · Flower ${score.flower} · Garden ${score.garden} · Fouls ${score.foulPoints}`;
}

function rpLine(score: AllianceScore): string {
  const chips = [`${score.rankingPoints} RP`];
  if (score.swarm) chips.push("SWARM");
  if (score.pollinator1) chips.push("POLLINATOR");
  if (score.pollinator2) chips.push("POLLINATOR 2");
  if (score.result === "win") chips.push("WIN");
  else if (score.result === "tie") chips.push("TIE");
  return chips.join(" · ");
}

function text(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function persist(): void {
  const scripts: Record<string, string> = {};
  for (const id of scriptIds) scripts[id] = sim.getScript(id);
  const state: SavedState = { config: sim.getConfig(), scripts };
  lastSaved = JSON.stringify(state.config);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed || typeof parsed !== "object" || !parsed.config) return null;
    return parsed;
  } catch {
    return null;
  }
}

function beginRecord(alliance: Alliance): void {
  sim.setConfig(alliance === "red" ? { redDriver: "human" } : { blueDriver: "human" });
  sim.startRecording(alliance);
  persist();
  syncPanel();
}

function syncRecords(): void {
  const root = document.getElementById("record-list");
  if (!root) return;
  root.replaceChildren();
  for (const rec of sim.getRecordings()) {
    const row = document.createElement("div");
    row.className = "record-row";
    const armed = sim.armedRecordingId(rec.alliance) === rec.id;
    const label = document.createElement("span");
    label.textContent = `${rec.alliance} · ${rec.name} · ${rec.duration.toFixed(1)}s${armed ? " · armed" : ""}`;
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = armed ? "Armed" : "Use";
    use.addEventListener("click", () => {
      sim.armRecording(rec.alliance, armed ? null : rec.id);
      persistAutos();
      syncRecords();
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      sim.deleteRecording(rec.id);
      persistAutos();
      syncRecords();
    });
    row.append(label, use, del);
    root.append(row);
  }
}

function persistAutos(): void {
  const state = {
    recordings: sim.getRecordings(),
    armed: { red: sim.armedRecordingId("red"), blue: sim.armedRecordingId("blue") },
  };
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function loadAutos(): void {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { recordings?: AutoRecording[]; armed?: { red?: string | null; blue?: string | null } };
    const recordings = (parsed.recordings ?? []).filter(
      (item) => item && Array.isArray(item.frames) && (item.alliance === "red" || item.alliance === "blue"),
    );
    sim.setRecordings(recordings);
    if (parsed.armed?.red) sim.armRecording("red", parsed.armed.red);
    if (parsed.armed?.blue) sim.armRecording("blue", parsed.armed.blue);
  } catch {
    /* ignore broken saves */
  }
}

function mergeConfig(saved: Partial<SimConfig>): Partial<SimConfig> {
  return {
    ...saved,
    redKeys: { ...DEFAULT_CONFIG.redKeys, ...(saved.redKeys ?? {}) },
    blueKeys: { ...DEFAULT_CONFIG.blueKeys, ...(saved.blueKeys ?? {}) },
  };
}
