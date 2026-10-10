import "./style.css";
import {
  DEFAULT_CONFIG,
  Simulator,
  type CameraName,
  type HudModel,
  type SimConfig,
} from "./sim/Simulator";
import type { DriveMode, DriveTrain } from "./rules/drive";
import type { AllianceScore } from "./rules/scoring";

const STORAGE_KEY = "biobuzz-sim-config";

interface SavedState {
  config: SimConfig;
  scripts: Record<string, string>;
}

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const boot = document.querySelector<HTMLElement>("#boot");
const bootStatus = document.querySelector<HTMLElement>("#boot-status");
if (!canvas || !boot || !bootStatus) throw new Error("Page shell is missing.");

const sim = new Simulator(canvas);
const saved = loadState();
if (saved?.config) sim.setConfig({ ...DEFAULT_CONFIG, ...saved.config });
const scriptIds = ["red-1", "blue-1", "red-2", "blue-2"];
if (saved?.scripts) {
  for (const id of scriptIds) {
    if (typeof saved.scripts[id] === "string") sim.setScript(id, saved.scripts[id]);
  }
}

declare global {
  interface Window {
    __SIM__?: {
      ready: () => boolean;
      start: () => void;
      reset: () => void;
      camera: (name: CameraName) => void;
      hud: () => HudModel;
    };
  }
}

window.__SIM__ = {
  ready: () => sim.isReady,
  start: () => sim.startMatch(),
  reset: () => sim.resetField(),
  camera: (name) => sim.setCamera(name),
  hud: () => sim.hud(),
};

bindPanel();

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
  document.querySelector("#reset")?.addEventListener("click", () => sim.resetField());
  document.querySelector("#panel-toggle")?.addEventListener("click", () => {
    document.querySelector("#panel")?.classList.toggle("open");
  });
  document.querySelector("#panel-close")?.addEventListener("click", () => {
    document.querySelector("#panel")?.classList.remove("open");
  });

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

  bindCheck("drag", (checked) => sim.setConfig({ drag: checked }));
  bindCheck("trajectory", (checked) => sim.setConfig({ trajectory: checked }));
  bindCheck("aim", (checked) => sim.setConfig({ aimAssist: checked }));
  bindCheck("mute", (checked) => sim.setConfig({ muted: checked }));

  for (const id of scriptIds) {
    const box = document.querySelector<HTMLTextAreaElement>(`#script-${id}`);
    box?.addEventListener("input", () => {
      sim.setScript(id, box.value);
      persist();
    });
  }
}

function bindRange(id: string, outId: string, suffix: string, commit: (value: number) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const out = document.querySelector<HTMLElement>(`#${outId}`);
  if (!input || !out) return;
  const paint = (): void => {
    out.textContent = `${input.value}${suffix}`;
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

function syncPanel(): void {
  const config = sim.getConfig();
  setRange("length", config.lengthIn, "length-out", " in");
  setRange("width", config.widthIn, "width-out", " in");
  setRange("height", config.heightIn, "height-out", " in");
  setRange("mass", config.massKg, "mass-out", " kg");
  setRange("speed", config.maxSpeed, "speed-out", " m/s");
  setRange("launch", config.launchSpeed, "launch-out", " m/s");
  setRange("robots", config.robotCount, "robots-out", "");
  setCheck("drag", config.drag);
  setCheck("trajectory", config.trajectory);
  setCheck("aim", config.aimAssist);
  setCheck("mute", config.muted);
  mark("[data-train]", "data-train", config.train);
  mark("[data-mode]", "data-mode", config.mode);
  for (const id of scriptIds) {
    const box = document.querySelector<HTMLTextAreaElement>(`#script-${id}`);
    if (box && document.activeElement !== box) box.value = sim.getScript(id);
  }
  for (const node of document.querySelectorAll(".extra-script")) {
    node.toggleAttribute("hidden", config.robotCount !== 4);
  }
}

function setRange(id: string, value: number, outId: string, suffix: string): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const out = document.querySelector<HTMLElement>(`#${outId}`);
  if (!input || !out || document.activeElement === input) return;
  input.value = String(value);
  out.textContent = `${value}${suffix}`;
}

function setCheck(id: string, checked: boolean): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (input) input.checked = checked;
}

function mark(selector: string, attr: string, value: string): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(selector)) {
    button.classList.toggle("active", button.getAttribute(attr) === value);
  }
}

let lastFouls = "";
let lastBreak = "";

function paintHud(hud: HudModel): void {
  text("phase", hud.phaseLabel);
  text("time", hud.time);
  text("clock-meta", `${hud.camera} · ${hud.mode} · ${hud.train}`);
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
  text(
    "nectar-line",
    `Nectar tray red ${hud.tray.red} · blue ${hud.tray.blue}. Returns red ${hud.returns.red} · blue ${hud.returns.blue}. May enter red ${hud.mayEnter.red} · blue ${hud.mayEnter.blue}.`,
  );
  text(
    "held-line",
    hud.held.map((robot) => `${robot.id} holds ${robot.count}, hood ${robot.hood}°`).join(" · "),
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
