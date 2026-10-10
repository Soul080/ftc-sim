import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { predictArc, shotVelocity, type Vec3 } from "../rules/ballistics";
import { clockDisplay, flowerWindowOpen, nectarEntryLegal, tickClock, autoClock, setupClock, type Clock, type Phase } from "../rules/clock";
import {
  BALL_DRAG_K,
  CELL_CENTER_ARM_IN,
  CELL_DEPTH_IN,
  CELL_OPENING_H_IN,
  CELL_OPENING_W_IN,
  FLOWER_MIDDLE_IN,
  FLOWER_RETRIEVAL_H_IN,
  FLOWER_TOP_IN,
  GRAVITY,
  HALF_IN,
  HIVE_FRAME_DEPTH_IN,
  HIVE_FRAME_WIDTH_IN,
  HIVE_PIVOT_HEIGHT_IN,
  HIVE_TIP_MASS_KG,
  MAX_CONTROLLED,
  NECTAR_DIAMETER_IN,
  NECTAR_IN_TRAY,
  NECTAR_MASS_KG,
  POLLEN_DIAMETER_IN,
  POLLEN_MASS_KG,
  ROBOT_MAX_IN,
  WALL_ABOVE_TILE_IN,
  clamp,
  inches,
  m,
  opponent,
  type Alliance,
  type PieceKind,
} from "../rules/constants";
import { chassisCommand, type DriveMode, type DriveTrain, type Stick } from "../rules/drive";
import { createRuntime, parseScript, stepAuto, type AutoRuntime } from "../rules/auto";
import {
  FLOWERS,
  HIVES,
  garden,
  inLoadingZone,
  loadingZone,
  pieceSpawns,
  robotStarts,
  touchingPerimeter,
  type FlowerSpec,
  type PieceSpawn,
} from "../rules/layout";
import { scoreMatch, type HiveTip, type MatchScore, type ScoreFoul, type ScorePiece, type ScoreRobot } from "../rules/scoring";
import { makeBall, makeBeam, makeFlower, makeFrame, makeRobot, makeWalls, disposeRobotTextures } from "../render/meshes";
import { makeFloorMesh } from "../render/floor";
import { Announcer } from "./audio";
import { quatX, quatY, wrapPi, yawOf } from "./math";

export type CameraName = "broadcast" | "top" | "red" | "blue" | "free";

export interface SimConfig {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  massKg: number;
  maxSpeed: number;
  train: DriveTrain;
  mode: DriveMode;
  robotCount: 2 | 4;
  launchSpeed: number;
  drag: boolean;
  trajectory: boolean;
  aimAssist: boolean;
  muted: boolean;
}

export interface HudModel {
  phase: Phase;
  phaseLabel: string;
  time: string;
  score: MatchScore;
  tray: Record<Alliance, number>;
  returns: Record<Alliance, number>;
  mayEnter: Record<Alliance, string>;
  cards: Record<Alliance, number>;
  fouls: string[];
  message: string;
  camera: CameraName;
  mode: DriveMode;
  train: DriveTrain;
  held: Array<{ id: string; alliance: Alliance; count: number; hood: number }>;
  practice: boolean;
}

interface Robot {
  id: string;
  alliance: Alliance;
  slot: 1 | 2;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  held: Piece[];
  hood: number;
  cooldown: number;
  intakeWait: number;
  auto: AutoRuntime;
  measureIndex: number;
  origin: THREE.Vector3;
  originYaw: number;
  originForward: THREE.Vector3;
  originRight: THREE.Vector3;
  wish: THREE.Vector3;
  autoFouled: boolean;
  opponentGrabs: number;
  pinWarn: number;
}

interface Piece {
  id: string;
  kind: PieceKind;
  alliance: Alliance | null;
  mass: number;
  radius: number;
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  mode: "free" | "held" | "hive" | "hidden";
  slot: number;
  hive: Alliance | null;
  cell: "audience" | "far" | null;
  flowerFouled: boolean;
  launchTime: number;
  scoringAttempt: boolean;
  launcher: Alliance | null;
  insideFor: number;
  spillUntil: number;
}

interface Hive {
  alliance: Alliance;
  pivotX: number;
  body: RAPIER.RigidBody;
  beam: THREE.Group;
  angle: number;
  tipping: boolean;
  target: number;
  cooldown: number;
}

const STABLE = (28 * Math.PI) / 180;
const STEP = 1 / 60;
const ZERO = { x: 0, y: 0, z: 0 };

export const DEFAULT_CONFIG: SimConfig = {
  lengthIn: 16,
  widthIn: 15,
  heightIn: 13,
  massKg: 12,
  maxSpeed: 1.6,
  train: "mecanum",
  mode: "field",
  robotCount: 2,
  launchSpeed: 6.6,
  drag: true,
  trajectory: true,
  aimAssist: false,
  muted: false,
};

export const SAMPLE_RED_AUTO = `forward 30
turn -32
hood 52
launch 4
`;

export const SAMPLE_BLUE_AUTO = `forward 30
turn -32
hood 52
launch 4
`;

export class Simulator {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: RAPIER.World | null = null;
  private robots: Robot[] = [];
  private pieces: Piece[] = [];
  private hives: Hive[] = [];
  private keys = new Set<string>();
  private edges = new Set<string>();
  private config: SimConfig = { ...DEFAULT_CONFIG };
  private clock: Clock = setupClock();
  private tips: HiveTip[] = [];
  private fouls: ScoreFoul[] = [];
  private autoSnap: ScoreRobot[] | null = null;
  private tray: Record<Alliance, number> = { red: NECTAR_IN_TRAY, blue: NECTAR_IN_TRAY };
  private returns: Record<Alliance, number> = { red: 0, blue: 0 };
  private legalEntries: Record<Alliance, number> = { red: 0, blue: 0 };
  private cards: Record<Alliance, number> = { red: 0, blue: 0 };
  private scripts: Record<string, string> = {
    "red-1": SAMPLE_RED_AUTO,
    "blue-1": SAMPLE_BLUE_AUTO,
    "red-2": "",
    "blue-2": "",
  };
  private message = "Practice. Start a match for the clock, auto, and fouls.";
  private cameraName: CameraName = "broadcast";
  private announcer = new Announcer();
  private ready = false;
  private last = 0;
  private acc = 0;
  private simTime = 0;
  private nectarEdge: Record<Alliance, boolean> = { red: false, blue: false };
  private orbit = { theta: 0.55, phi: 1.05, radius: 4.4, target: new THREE.Vector3(0, 0.2, 0) };
  private dragging = false;
  private dragButton = 0;
  private lastX = 0;
  private lastY = 0;
  private trails: Record<Alliance, THREE.Line> = { red: null!, blue: null! };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 40);
    this.scene.background = new THREE.Color(0x171b19);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.onResize();
  }

  get isReady(): boolean {
    return this.ready;
  }

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = STEP;
    this.world.numSolverIterations = 6;
    this.world.maxCcdSubsteps = 2;
    this.buildStatic();
    this.spawnActors();
    this.ready = true;
    this.onResize();
  }

  frame(now: number): void {
    if (!this.ready || !this.world) return;
    if (this.last === 0) this.last = now;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!isTyping()) {
      this.nectarEdge.red = this.edges.has("KeyZ");
      this.nectarEdge.blue = this.edges.has("KeyB");
    }
    this.edges.clear();
    this.readCameraKeys();
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this.fixed(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    this.syncMeshes();
    this.updateCamera();
    this.updateTrails();
    this.renderer.render(this.scene, this.camera);
  }

  startMatch(): void {
    this.announcer.unlock();
    this.resetField();
    this.clock = autoClock();
    for (const robot of this.robots) {
      const parsed = parseScript(this.scripts[robot.id] ?? "");
      robot.auto = createRuntime(parsed.cmds);
      robot.measureIndex = -1;
      if (parsed.errors[0]) this.message = parsed.errors[0];
    }
    this.announcer.start();
    this.message = "Auto. Drivers stay off the controls until teleop.";
  }

  resetField(): void {
    this.clearActors();
    this.clock = setupClock();
    this.tips = [];
    this.fouls = [];
    this.autoSnap = null;
    this.tray = { red: NECTAR_IN_TRAY, blue: NECTAR_IN_TRAY };
    this.returns = { red: 0, blue: 0 };
    this.legalEntries = { red: 0, blue: 0 };
    this.cards = { red: 0, blue: 0 };
    this.simTime = 0;
    this.spawnActors();
    for (const hive of this.hives) {
      hive.angle = hive.alliance === "red" ? STABLE : -STABLE;
      hive.tipping = false;
      hive.cooldown = 0;
      hive.beam.rotation.x = hive.angle;
    }
    this.message = "Field reset. Practice, or start a match.";
  }

  setConfig(next: Partial<SimConfig>): void {
    const merged = sanitize({ ...this.config, ...next });
    const structural =
      merged.lengthIn !== this.config.lengthIn ||
      merged.widthIn !== this.config.widthIn ||
      merged.heightIn !== this.config.heightIn ||
      merged.massKg !== this.config.massKg ||
      merged.robotCount !== this.config.robotCount;
    this.config = merged;
    this.announcer.muted = merged.muted;
    if (structural && this.ready) this.resetField();
  }

  getConfig(): SimConfig {
    return { ...this.config };
  }

  setScript(id: string, source: string): void {
    this.scripts[id] = source;
  }

  getScript(id: string): string {
    return this.scripts[id] ?? "";
  }

  setCamera(name: CameraName): void {
    this.cameraName = name;
    if (name !== "free") this.camera.up.set(0, 1, 0);
  }

  hud(): HudModel {
    const score = this.currentScore();
    const practice = this.clock.phase === "setup";
    return {
      phase: this.clock.phase,
      phaseLabel: clockDisplay(this.clock).phaseLabel,
      time: clockDisplay(this.clock).time,
      score,
      tray: { ...this.tray },
      returns: { ...this.returns },
      mayEnter: {
        red: this.mayEnterLabel("red"),
        blue: this.mayEnterLabel("blue"),
      },
      cards: { ...this.cards },
      fouls: this.fouls.slice(-5).map((foul) => `${foul.rule} ${foul.severity} on ${foul.against}: ${foul.detail}`),
      message: this.message,
      camera: this.cameraName,
      mode: this.config.mode,
      train: this.config.train,
      held: this.robots.map((robot) => ({
        id: robot.id,
        alliance: robot.alliance,
        count: robot.held.length,
        hood: Math.round(robot.hood),
      })),
      practice,
    };
  }

  private currentScore(): MatchScore {
    const live = this.robotSnapshots();
    const projectingAuto = this.clock.phase === "setup" || this.clock.phase === "auto";
    return scoreMatch({
      pieces: this.pieceSnapshots(),
      autoRobots: projectingAuto ? live : (this.autoSnap ?? []),
      robots: live,
      tips: this.tips,
      fouls: this.fouls,
      assessTeleopPark: this.clock.phase !== "auto" && this.clock.phase !== "transition",
      assessFieldScores: true,
    });
  }

  private buildStatic(): void {
    const world = this.world;
    if (!world) return;
    this.scene.add(new THREE.HemisphereLight(0xd7e4f2, 0x3d463c, 0.72));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
    sun.position.set(4.5, 9.5, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const shadow = sun.shadow.camera;
    shadow.left = -3.2;
    shadow.right = 3.2;
    shadow.top = 3.2;
    shadow.bottom = -3.2;
    shadow.near = 1;
    shadow.far = 20;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(makeFloorMesh());
    this.scene.add(makeWalls());
    this.scene.add(makeFrame());

    const floor = RAPIER.ColliderDesc.cuboid(8, 0.05, 8)
      .setTranslation(0, -0.05, 0)
      .setFriction(0.95)
      .setRestitution(0.04);
    world.createCollider(floor);
    const half = m(HALF_IN);
    const thick = m(1.1);
    const wallH = m(WALL_ABOVE_TILE_IN);
    const span = half + thick;
    const walls = [
      { x: 0, z: half + thick / 2, hx: span, hz: thick / 2 },
      { x: 0, z: -half - thick / 2, hx: span, hz: thick / 2 },
      { x: half + thick / 2, z: 0, hx: thick / 2, hz: span },
      { x: -half - thick / 2, z: 0, hx: thick / 2, hz: span },
    ];
    for (const wall of walls) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(wall.hx, wallH / 2, wall.hz)
          .setTranslation(wall.x, wallH / 2, wall.z)
          .setFriction(0.25)
          .setRestitution(0.12),
      );
    }
    const railZ = m(HIVE_FRAME_DEPTH_IN / 2);
    const railX = m(HIVE_FRAME_WIDTH_IN / 2);
    for (const z of [-railZ, railZ]) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(railX, m(0.45), m(0.7)).setTranslation(0, m(0.45), z).setFriction(0.6),
      );
    }

    for (const spec of FLOWERS) {
      this.scene.add(makeFlower(spec));
      this.addFlowerColliders(spec);
    }
    for (const spec of HIVES) {
      const beam = makeBeam(spec.alliance);
      const pivot = m(spec.pivotX);
      const py = m(HIVE_PIVOT_HEIGHT_IN);
      beam.position.set(pivot, py, 0);
      const angle = spec.alliance === "red" ? STABLE : -STABLE;
      beam.rotation.x = angle;
      this.scene.add(beam);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pivot, py, 0).setRotation(quatX(angle)),
      );
      addCellColliders(world, body, -1, -m(CELL_CENTER_ARM_IN));
      addCellColliders(world, body, 1, m(CELL_CENTER_ARM_IN));
      this.hives.push({
        alliance: spec.alliance,
        pivotX: pivot,
        body,
        beam,
        angle,
        tipping: false,
        target: angle,
        cooldown: 0,
      });
    }
    for (const alliance of ["red", "blue"] as const) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
      const material = new THREE.LineBasicMaterial({
        color: alliance === "red" ? 0xff8d7a : 0x8eb6ff,
        transparent: true,
        opacity: 0.85,
      });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      line.visible = false;
      this.scene.add(line);
      this.trails[alliance] = line;
    }
  }

  private addFlowerColliders(spec: FlowerSpec): void {
    const world = this.world;
    if (!world) return;
    const cx = m(spec.x);
    const cz = m(spec.z);
    const cupR = m(1.75);
    const segments = 8;
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const front = dx * spec.openX + dz * spec.openZ > 0.55;
      const px = cx + dx * cupR;
      const pz = cz + dz * cupR;
      const yaw = Math.atan2(dx, dz);
      if (!front) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(m(0.28), m(FLOWER_MIDDLE_IN) / 2, m(0.22))
            .setTranslation(px, m(FLOWER_MIDDLE_IN) / 2, pz)
            .setRotation(quatY(yaw))
            .setFriction(0.55),
        );
      } else {
        const upper = (FLOWER_MIDDLE_IN - FLOWER_RETRIEVAL_H_IN) / 2;
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(m(0.28), m(upper), m(0.22))
            .setTranslation(px, m(FLOWER_RETRIEVAL_H_IN + upper), pz)
            .setRotation(quatY(yaw))
            .setFriction(0.55),
        );
      }
    }
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(m(0.2), m(1.85))
        .setTranslation(cx, m(FLOWER_MIDDLE_IN), cz)
        .setFriction(0.7),
    );
    const basket = m(3.15);
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const height = (FLOWER_TOP_IN - FLOWER_MIDDLE_IN) / 2;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(m(0.28), m(height), m(0.22))
          .setTranslation(cx + dx * basket, m(FLOWER_MIDDLE_IN + height), cz + dz * basket)
          .setRotation(quatY(Math.atan2(dx, dz)))
          .setFriction(0.4),
      );
    }
    const mouth = m(2.45);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(m(0.32), m(0.35), m(0.28))
          .setTranslation(cx + dx * mouth, m(FLOWER_TOP_IN), cz + dz * mouth)
          .setRotation(quatY(Math.atan2(dx, dz))),
      );
    }
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(m(3), m(FLOWER_TOP_IN * 0.02 + 0.4), m(0.2)).setTranslation(
        cx - spec.openX * mouth,
        m(FLOWER_TOP_IN + 0.7),
        cz - spec.openZ * mouth,
      ),
    );
  }

  private spawnActors(): void {
    const world = this.world;
    if (!world) return;
    const starts = robotStarts(this.config.robotCount, this.config.lengthIn);
    for (const start of starts) {
      const yaw = start.yaw;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(m(start.x), m(this.config.heightIn / 2) + 0.01, m(start.z))
          .setRotation(quatY(yaw))
          .setLinearDamping(0.04)
          .setAngularDamping(0.4)
          .setCanSleep(false)
          .setCcdEnabled(true),
      );
      body.setEnabledRotations(false, true, false, true);
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(m(this.config.widthIn / 2), m(this.config.heightIn / 2), m(this.config.lengthIn / 2))
          .setMass(this.config.massKg)
          .setFriction(1.05)
          .setRestitution(0.02),
        body,
      );
      const label = `${start.alliance === "red" ? "R" : "B"}${start.slot}`;
      const mesh = makeRobot(start.alliance, label, this.config.lengthIn, this.config.widthIn, this.config.heightIn);
      this.scene.add(mesh);
      this.robots.push({
        id: start.id,
        alliance: start.alliance,
        slot: start.slot,
        body,
        collider,
        mesh,
        held: [],
        hood: 50,
        cooldown: 0,
        intakeWait: 0,
        auto: createRuntime([]),
        measureIndex: -1,
        origin: new THREE.Vector3(),
        originYaw: yaw,
        originForward: new THREE.Vector3(),
        originRight: new THREE.Vector3(),
        wish: new THREE.Vector3(),
        autoFouled: false,
        opponentGrabs: 0,
        pinWarn: 0,
      });
    }
    for (const spawn of pieceSpawns(this.config.robotCount)) this.spawnPiece(spawn);
    for (const alliance of ["red", "blue"] as const) {
      for (let i = 0; i < NECTAR_IN_TRAY; i += 1) {
        this.spawnPiece({
          id: `nectar-tray-${alliance}-${i}`,
          kind: "nectar",
          alliance,
          x: 0,
          y: -20,
          z: 0,
          spawn: { mode: "free" },
        });
        const piece = this.pieces[this.pieces.length - 1];
        if (piece) this.hidePiece(piece);
      }
    }
  }

  private spawnPiece(spawn: PieceSpawn): void {
    const world = this.world;
    if (!world) return;
    const radiusIn = spawn.kind === "pollen" ? POLLEN_DIAMETER_IN / 2 : NECTAR_DIAMETER_IN / 2;
    const mass = spawn.kind === "pollen" ? POLLEN_MASS_KG : NECTAR_MASS_KG;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(m(spawn.x), m(spawn.y), m(spawn.z))
        .setCanSleep(true)
        .setCcdEnabled(true)
        .setLinearDamping(0.08)
        .setAngularDamping(0.4),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(m(radiusIn))
        .setMass(mass)
        .setFriction(0.42)
        .setRestitution(0.32),
      body,
    );
    const mesh = makeBall(spawn.kind, spawn.alliance);
    this.scene.add(mesh);
    const piece: Piece = {
      id: spawn.id,
      kind: spawn.kind,
      alliance: spawn.alliance,
      mass,
      radius: m(radiusIn),
      body,
      mesh,
      mode: "free",
      slot: 0,
      hive: null,
      cell: null,
      flowerFouled: false,
      launchTime: -10,
      scoringAttempt: false,
      launcher: null,
      insideFor: 0,
      spillUntil: 0,
    };
    this.pieces.push(piece);
    if (spawn.spawn.mode === "held") {
      const robotId = spawn.spawn.robotId;
      const holder = this.robots.find((item) => item.id === robotId);
      if (holder) this.hold(holder, piece, false);
    } else if (spawn.spawn.mode === "hive") {
      const alliance = spawn.spawn.alliance;
      const hive = this.hives.find((item) => item.alliance === alliance);
      if (hive) {
        const which = hive.angle >= 0 ? "audience" : "far";
        this.capture(hive, piece, which, true);
      }
    }
  }

  private clearActors(): void {
    const world = this.world;
    if (!world) return;
    for (const piece of this.pieces) {
      world.removeRigidBody(piece.body);
      piece.mesh.removeFromParent();
    }
    for (const robot of this.robots) {
      world.removeRigidBody(robot.body);
      disposeRobotTextures(robot.mesh);
      robot.mesh.removeFromParent();
    }
    this.pieces = [];
    this.robots = [];
  }

  private fixed(dt: number): void {
    const ticked = tickClock(this.clock, dt);
    this.clock = ticked.clock;
    if (ticked.events.includes("auto-end")) {
      this.autoSnap = this.robotSnapshots();
      this.announcer.buzzer();
      this.message = "Transition. Robots must stay still.";
    }
    if (ticked.events.includes("teleop-start")) {
      this.announcer.bells();
      this.message = "Teleop. Flowers lock nectar out until 1:00.";
    }
    if (ticked.events.includes("flower-unlock")) {
      this.announcer.chime();
      this.message = "One minute left. Nectar may enter the flowers. Remaining nectar may enter the field.";
    }
    if (ticked.events.includes("endgame")) {
      this.announcer.whistle();
      this.message = "Endgame. Twenty seconds.";
    }
    if (ticked.events.includes("match-end")) {
      this.announcer.buzzer();
      this.message = "Match over. Score includes anything still settling.";
    }

    this.simTime += dt;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let index = 0; index < this.robots.length; index += 1) {
      const robot = this.robots[index];
      if (!robot) continue;
      robot.cooldown = Math.max(0, robot.cooldown - dt);
      robot.intakeWait = Math.max(0, robot.intakeWait - dt);
      const human = this.humanStick(robot, pads[index] ?? null);
      let stick = human.stick;
      let launch = human.launch;
      let intake = human.intake;
      let deposit = human.deposit;
      let eject = human.eject;
      if (this.clock.phase === "auto") {
        const driven = this.stepRobotAuto(robot, dt);
        stick = { forward: driven.forward, strafe: driven.strafe, turn: driven.turn };
        launch = driven.launch;
        intake = driven.intake;
        deposit = driven.deposit;
        eject = driven.eject;
        if (driven.hood !== null) robot.hood = clamp(driven.hood, 25, 75);
      } else if (this.clock.phase === "transition" || this.clock.phase === "ended") {
        stick = { forward: 0, strafe: 0, turn: 0 };
        launch = false;
        intake = false;
        deposit = false;
        eject = false;
      }
      this.applyDrive(robot, stick, dt);
      if (launch) this.launch(robot, false);
      if (deposit) this.launch(robot, true);
      if (eject) this.eject(robot);
      if (intake) this.intake(robot);
    }
    if (this.nectarEdge.red) this.introduce("red");
    if (this.nectarEdge.blue) this.introduce("blue");
    this.nectarEdge.red = false;
    this.nectarEdge.blue = false;

    this.stepHives(dt);
    this.world?.step();
    this.capturePasses(dt);
    this.applyDrag(dt);
    this.enforceBounds();
    this.watchPins(dt);
    this.watchAutoContact();
    this.watchFlowerFouls();
  }

  private humanStick(robot: Robot, pad: Gamepad | null): {
    stick: Stick;
    launch: boolean;
    intake: boolean;
    deposit: boolean;
    eject: boolean;
  } {
    const fromPad = pad ? this.padStick(pad) : null;
    const padLive = fromPad && (Math.hypot(fromPad.stick.forward, fromPad.stick.strafe, fromPad.stick.turn) > 0.2 || fromPad.launch || fromPad.intake || fromPad.deposit || fromPad.eject);
    if (pad && fromPad && padLive) {
      if (fromPad.nectarEdge) this.nectarEdge[robot.alliance] = true;
      if (fromPad.hood !== 0) robot.hood = clamp(robot.hood + fromPad.hood * STEP * 70, 25, 75);
      return fromPad;
    }
    if (robot.slot !== 1) return { stick: { forward: 0, strafe: 0, turn: 0 }, launch: false, intake: false, deposit: false, eject: false };
    const typing = isTyping();
    const down = (code: string) => !typing && this.keys.has(code);
    if (robot.alliance === "red") {
      if (down("Digit1")) robot.hood = clamp(robot.hood + STEP * 50, 25, 75);
      if (down("Digit2")) robot.hood = clamp(robot.hood - STEP * 50, 25, 75);
      return {
        stick: {
          forward: axis(down("KeyS"), down("KeyW")),
          strafe: axis(down("KeyA"), down("KeyD")),
          turn: axis(down("KeyQ"), down("KeyE")),
        },
        launch: down("KeyG"),
        intake: down("KeyF"),
        deposit: down("KeyV"),
        eject: down("KeyX"),
      };
    }
    if (down("Digit9")) robot.hood = clamp(robot.hood + STEP * 50, 25, 75);
    if (down("Digit0")) robot.hood = clamp(robot.hood - STEP * 50, 25, 75);
    return {
      stick: {
        forward: axis(down("ArrowDown"), down("ArrowUp")),
        strafe: axis(down("ArrowLeft"), down("ArrowRight")),
        turn: axis(down("KeyK"), down("KeyL")),
      },
      launch: down("Quote"),
      intake: down("Semicolon"),
      deposit: down("Slash"),
      eject: down("Period"),
    };
  }

  private padStick(pad: Gamepad): {
    stick: Stick;
    launch: boolean;
    intake: boolean;
    deposit: boolean;
    eject: boolean;
    nectarEdge: boolean;
    hood: number;
  } {
    const dead = (value: number) => (Math.abs(value) < 0.15 ? 0 : value);
    const button = (index: number) => pad.buttons[index]?.pressed ?? false;
    const tagged = pad as Gamepad & { __prevY?: boolean; __prevStart?: boolean };
    const previous = tagged.__prevY ?? false;
    const y = button(3);
    tagged.__prevY = y;
    const start = button(9);
    if (start && !tagged.__prevStart && this.clock.phase === "setup") this.startMatch();
    tagged.__prevStart = start;
    return {
      stick: {
        forward: -dead(pad.axes[1] ?? 0),
        strafe: dead(pad.axes[0] ?? 0),
        turn: dead(pad.axes[2] ?? 0),
      },
      intake: (pad.buttons[7]?.value ?? 0) > 0.4,
      launch: (pad.buttons[6]?.value ?? 0) > 0.4,
      deposit: button(5),
      eject: button(4),
      nectarEdge: y && !previous,
      hood: (button(12) ? 1 : 0) - (button(13) ? 1 : 0),
    };
  }

  private stepRobotAuto(robot: Robot, dt: number): ReturnType<typeof stepAuto>["drive"] {
    const cmd = robot.auto.cmds[robot.auto.index];
    if (robot.measureIndex !== robot.auto.index) {
      robot.measureIndex = robot.auto.index;
      const pos = robot.body.translation();
      robot.origin.set(pos.x, pos.y, pos.z);
      robot.originYaw = yawOf(robot.body.rotation());
      robot.originForward.set(Math.sin(robot.originYaw), 0, Math.cos(robot.originYaw));
      robot.originRight.set(Math.cos(robot.originYaw), 0, -Math.sin(robot.originYaw));
    }
    const pos = robot.body.translation();
    const deltaX = pos.x - robot.origin.x;
    const deltaZ = pos.z - robot.origin.z;
    const alongF = deltaX * robot.originForward.x + deltaZ * robot.originForward.z;
    const alongR = deltaX * robot.originRight.x + deltaZ * robot.originRight.z;
    let moved = 0;
    if (cmd?.type === "forward") moved = inches(alongF);
    else if (cmd?.type === "back") moved = inches(-alongF);
    else if (cmd?.type === "strafe") moved = inches(cmd.inches >= 0 ? alongR : -alongR);
    const dyaw = wrapPi(yawOf(robot.body.rotation()) - robot.originYaw);
    const turned = cmd?.type === "turn" ? (cmd.degrees >= 0 ? 1 : -1) * ((dyaw * 180) / Math.PI) : 0;
    const stepped = stepAuto(robot.auto, { dt, movedInches: moved, turnedDeg: turned });
    robot.auto = stepped.runtime;
    return stepped.drive;
  }

  private applyDrive(robot: Robot, stick: Stick, dt: number): void {
    const yaw = yawOf(robot.body.rotation());
    const command = chassisCommand(stick, yaw, this.clock.phase === "auto" ? "robot" : this.config.mode, this.config.train, this.config.maxSpeed, 2.5);
    robot.wish.set(command.vx, 0, command.vz);
    const velocity = robot.body.linvel();
    const mass = Math.max(1, robot.body.mass());
    const aMax = 4.4 * (12 / mass);
    const dvx = clamp(command.vx - velocity.x, -aMax * dt, aMax * dt);
    const dvz = clamp(command.vz - velocity.z, -aMax * dt, aMax * dt);
    robot.body.applyImpulse({ x: dvx * mass, y: 0, z: dvz * mass }, true);
    const ang = robot.body.angvel();
    const dYaw = clamp(command.yawRate - ang.y, -12 * dt, 12 * dt);
    robot.body.setAngvel({ x: 0, y: ang.y + dYaw, z: 0 }, true);
  }

  private launch(robot: Robot, deposit: boolean): void {
    if (robot.cooldown > 0 || robot.held.length === 0) return;
    const piece = robot.held[0];
    if (!piece) return;
    const yaw = yawOf(robot.body.rotation());
    const muzzle = this.muzzle(robot, yaw);
    if (deposit) {
      const flower = this.nearestFlower(robot, yaw);
      if (!flower) {
        this.message = `${robot.id} is too far from a flower.`;
        return;
      }
      const time = 0.4;
      const target = { x: m(flower.x), y: m(FLOWER_TOP_IN + 1.5), z: m(flower.z) };
      this.release(robot, piece, {
        x: (target.x - muzzle.x) / time,
        y: (target.y - muzzle.y) / time + 0.5 * GRAVITY * time,
        z: (target.z - muzzle.z) / time,
      }, muzzle, true);
      return;
    }
    let shotYaw = yaw;
    if (this.config.aimAssist) {
      const mouth = this.mouth(robot.alliance);
      shotYaw = yaw + wrapPi(Math.atan2(mouth.x - muzzle.x, mouth.z - muzzle.z) - yaw) * 0.72;
    }
    const velocity = shotVelocity(shotYaw, robot.hood, this.config.launchSpeed);
    this.release(robot, piece, velocity, muzzle, robot.hood >= 35);
  }

  private release(robot: Robot, piece: Piece, velocity: Vec3, muzzle: Vec3, scoringAttempt: boolean): void {
    robot.held.shift();
    robot.cooldown = 0.28;
    piece.mode = "free";
    piece.mesh.removeFromParent();
    this.scene.add(piece.mesh);
    piece.body.setEnabled(true);
    piece.body.setTranslation(muzzle, true);
    piece.body.setLinvel(velocity, true);
    piece.body.setAngvel(ZERO, true);
    piece.launchTime = this.simTime;
    piece.scoringAttempt = scoringAttempt;
    piece.launcher = robot.alliance;
    piece.spillUntil = 0;
    piece.hive = null;
    piece.cell = null;
  }

  private eject(robot: Robot): void {
    if (robot.cooldown > 0 || robot.held.length === 0) return;
    const piece = robot.held[0];
    if (!piece) return;
    const yaw = yawOf(robot.body.rotation());
    const muzzle = this.muzzle(robot, yaw);
    muzzle.y = piece.radius + 0.04;
    this.release(
      robot,
      piece,
      { x: Math.sin(yaw) * 1.3, y: 0.4, z: Math.cos(yaw) * 1.3 },
      muzzle,
      false,
    );
  }

  private intake(robot: Robot): void {
    if (robot.intakeWait > 0) return;
    if (robot.held.length >= MAX_CONTROLLED) {
      this.message = `${robot.id} is already holding ${MAX_CONTROLLED}.`;
      return;
    }
    const yaw = yawOf(robot.body.rotation());
    const pos = robot.body.translation();
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const mouthX = pos.x + fx * m(this.config.lengthIn / 2);
    const mouthZ = pos.z + fz * m(this.config.lengthIn / 2);
    let best: Piece | null = null;
    let bestD = m(11);
    for (const piece of this.pieces) {
      if (piece.mode !== "free" || this.simTime < piece.spillUntil) continue;
      const at = piece.body.translation();
      const dx = at.x - mouthX;
      const dz = at.z - mouthZ;
      const dist = Math.hypot(dx, dz);
      const ahead = dx * fx + dz * fz;
      if (dist < bestD && ahead > -0.05) {
        best = piece;
        bestD = dist;
      }
    }
    if (!best) best = this.flowerGrab(robot);
    if (!best) return;
    if (best.kind === "nectar" && best.alliance && best.alliance !== robot.alliance) {
      robot.opponentGrabs += 1;
      this.message = `G408: ${robot.id} cannot control ${best.alliance} nectar.`;
      if (this.rulesOn() && robot.opponentGrabs >= 2) {
        this.cards[robot.alliance] = Math.max(this.cards[robot.alliance], 1);
        this.message = `G408 yellow card on ${robot.alliance}. Opponent nectar stays down.`;
      }
      robot.intakeWait = 0.4;
      return;
    }
    this.hold(robot, best, true);
    robot.intakeWait = 0.1;
  }

  private flowerGrab(robot: Robot): Piece | null {
    const pos = robot.body.translation();
    let best: Piece | null = null;
    let bestD = m(18);
    for (const flower of FLOWERS) {
      const dx = pos.x - m(flower.x);
      const dz = pos.z - m(flower.z);
      if (Math.hypot(dx, dz) > m(18)) continue;
      for (const piece of this.pieces) {
        if (piece.mode !== "free" || piece.kind !== "pollen") continue;
        const at = piece.body.translation();
        if (at.y > m(FLOWER_MIDDLE_IN)) continue;
        const dFlower = Math.hypot(at.x - m(flower.x), at.z - m(flower.z));
        const dRobot = Math.hypot(at.x - pos.x, at.z - pos.z);
        if (dFlower < m(5) && dRobot < bestD) {
          best = piece;
          bestD = dRobot;
        }
      }
    }
    return best;
  }

  private hold(robot: Robot, piece: Piece, fromField: boolean): void {
    if (fromField) {
      piece.body.setLinvel(ZERO, true);
    }
    piece.mode = "held";
    piece.body.setEnabled(false);
    piece.mesh.removeFromParent();
    robot.mesh.add(piece.mesh);
    const index = robot.held.length;
    piece.mesh.position.set(m((index - 1.5) * 2.7), m(this.config.heightIn * 0.62), m(this.config.lengthIn * 0.02));
    piece.mesh.rotation.set(0, 0, 0);
    piece.mesh.visible = true;
    robot.held.push(piece);
    piece.hive = null;
    piece.cell = null;
  }

  private introduce(alliance: Alliance): void {
    const practice = this.clock.phase === "setup";
    const tips = this.tips.filter((tip) => tip.alliance === alliance).length;
    const legal = nectarEntryLegal(tips, this.legalEntries[alliance], this.clock, practice);
    const returning = this.returns[alliance] > 0;
    if (!returning && this.tray[alliance] <= 0) {
      this.message = `No ${alliance} nectar left in the alliance area.`;
      return;
    }
    const piece = this.pieces.find((item) => item.mode === "hidden" && item.alliance === alliance);
    if (!piece) return;
    const zone = loadingZone(alliance);
    const x = alliance === "red" ? zone.minX + 6 : zone.maxX - 6;
    const z = (zone.minZ + zone.maxZ) / 2;
    piece.mode = "free";
    piece.mesh.visible = true;
    piece.body.setEnabled(true);
    piece.body.setTranslation({ x: m(x), y: piece.radius + 0.08, z: m(z) }, true);
    piece.body.setLinvel({ x: 0, y: -0.2, z: 0 }, true);
    piece.scoringAttempt = false;
    piece.launcher = null;
    piece.launchTime = -10;
    if (returning) this.returns[alliance] -= 1;
    else this.tray[alliance] -= 1;
    if (returning || legal) {
      if (!returning && !practice && !flowerWindowOpen(this.clock)) this.legalEntries[alliance] += 1;
      this.message = `${alliance} nectar entered through the loading zone.`;
    } else if (this.rulesOn()) {
      this.addFoul(alliance, "minor", "G426", "nectar entered before a hive tip or the one-minute mark");
    }
  }

  private stepHives(dt: number): void {
    for (const hive of this.hives) {
      hive.cooldown = Math.max(0, hive.cooldown - dt);
      if (!hive.tipping && hive.cooldown <= 0) {
        const up = hive.angle >= 0 ? "audience" : "far";
        let mass = 0;
        for (const piece of this.pieces) {
          if (piece.mode === "hive" && piece.hive === hive.alliance && piece.cell === up) mass += piece.mass;
        }
        if (mass >= HIVE_TIP_MASS_KG) {
          hive.tipping = true;
          hive.target = hive.angle >= 0 ? -STABLE : STABLE;
          this.dumpHive(hive);
        }
      }
      if (hive.tipping) {
        const step = Math.sign(hive.target - hive.angle) * 2.8 * dt;
        hive.angle += step;
        if (Math.sign(hive.target - hive.angle) !== Math.sign(step) || Math.abs(hive.angle - hive.target) < 0.03) {
          hive.angle = hive.target;
          hive.tipping = false;
          hive.cooldown = 0.8;
          const period = this.clock.phase === "auto" || this.clock.phase === "transition" ? "auto" : "teleop";
          this.tips.push({ alliance: hive.alliance, period });
          this.message = `${hive.alliance.toUpperCase()} hive tipped. +20 and one nectar credit.`;
        }
      }
      hive.beam.rotation.x = hive.angle;
      hive.body.setNextKinematicTranslation({ x: hive.pivotX, y: m(HIVE_PIVOT_HEIGHT_IN), z: 0 });
      hive.body.setNextKinematicRotation(quatX(hive.angle));
    }
  }

  private dumpHive(hive: Hive): void {
    for (const piece of this.pieces) {
      if (piece.mode !== "hive" || piece.hive !== hive.alliance) continue;
      const worldPos = piece.mesh.getWorldPosition(new THREE.Vector3());
      piece.mesh.removeFromParent();
      this.scene.add(piece.mesh);
      piece.mode = "free";
      piece.body.setEnabled(true);
      piece.body.setTranslation({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, true);
      const outward = piece.cell === "audience" ? -1.3 : 1.3;
      piece.body.setLinvel({ x: ((piece.slot % 3) - 1) * 0.4, y: 0.15, z: outward }, true);
      piece.spillUntil = this.simTime + 0.9;
      piece.hive = null;
      piece.cell = null;
      piece.scoringAttempt = false;
      piece.launchTime = -10;
    }
  }

  private capture(hive: Hive, piece: Piece, which: "audience" | "far", initial: boolean): void {
    piece.mode = "hive";
    piece.hive = hive.alliance;
    piece.cell = which;
    piece.slot = this.nextSlot(hive);
    piece.body.setLinvel(ZERO, true);
    piece.body.setAngvel(ZERO, true);
    piece.body.setEnabled(false);
    if (!initial) piece.mesh.removeFromParent();
    else piece.mesh.removeFromParent();
    hive.beam.add(piece.mesh);
    piece.mesh.position.copy(slotLocal(which, piece.slot));
    piece.mesh.rotation.set(0, 0, 0);
    piece.mesh.visible = true;
  }

  private nextSlot(hive: Hive): number {
    const used = new Set(
      this.pieces.filter((piece) => piece.mode === "hive" && piece.hive === hive.alliance).map((piece) => piece.slot),
    );
    for (let i = 0; i < 12; i += 1) if (!used.has(i)) return i;
    return 0;
  }

  private capturePasses(dt: number): void {
    for (const hive of this.hives) {
      if (hive.tipping || hive.cooldown > 0) continue;
      const up = hive.angle >= 0 ? "audience" : "far";
      for (const piece of this.pieces) {
        if (piece.mode !== "free" || this.simTime < piece.spillUntil) continue;
        const local = worldToHive(piece.body.translation(), hive);
        if (!insideCell(local, up)) {
          piece.insideFor = 0;
          continue;
        }
        piece.insideFor += dt;
        const speed = Math.hypot(piece.body.linvel().x, piece.body.linvel().y, piece.body.linvel().z);
        if (piece.insideFor > 0.08 || speed < 1.1) this.capture(hive, piece, up, false);
      }
    }
  }

  private applyDrag(dt: number): void {
    if (!this.config.drag) return;
    for (const piece of this.pieces) {
      if (piece.mode !== "free") continue;
      const velocity = piece.body.linvel();
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (speed < 0.05) continue;
      const k = BALL_DRAG_K;
      const mass = piece.mass;
      piece.body.applyImpulse(
        {
          x: -k * speed * velocity.x * mass * dt,
          y: -k * speed * velocity.y * mass * dt,
          z: -k * speed * velocity.z * mass * dt,
        },
        true,
      );
    }
  }

  private enforceBounds(): void {
    const limit = m(HALF_IN) + 0.02;
    const wallTop = m(WALL_ABOVE_TILE_IN);
    for (const piece of this.pieces) {
      if (piece.mode !== "free") continue;
      const pos = piece.body.translation();
      if (pos.y < -0.3) {
        piece.body.setTranslation({ x: clamp(pos.x, -limit, limit), y: piece.radius + 0.05, z: clamp(pos.z, -limit, limit) }, true);
        piece.body.setLinvel(ZERO, true);
        continue;
      }
      const outside = Math.abs(pos.x) > limit || Math.abs(pos.z) > limit;
      if (!outside) continue;
      if (pos.y < wallTop * 0.92) {
        piece.body.setTranslation(
          {
            x: clamp(pos.x, -m(HALF_IN) + piece.radius, m(HALF_IN) - piece.radius),
            y: pos.y,
            z: clamp(pos.z, -m(HALF_IN) + piece.radius, m(HALF_IN) - piece.radius),
          },
          true,
        );
        continue;
      }
      this.exitField(piece);
    }
  }

  private exitField(piece: Piece): void {
    const launched = this.simTime - piece.launchTime < 2.5 && piece.launcher;
    if (launched && !piece.scoringAttempt && this.rulesOn()) {
      this.addFoul(piece.launcher as Alliance, "major", "G405", `${piece.kind} deliberately left the field`);
    }
    if (piece.kind === "nectar" && piece.alliance) {
      this.hidePiece(piece);
      this.returns[piece.alliance] += 1;
      this.message = `${piece.alliance} nectar left the field and is back with the drive team.`;
      return;
    }
    const pos = piece.body.translation();
    piece.body.setTranslation(
      {
        x: clamp(pos.x, -m(HALF_IN) + 0.12, m(HALF_IN) - 0.12),
        y: piece.radius + 0.06,
        z: clamp(pos.z, -m(HALF_IN) + 0.12, m(HALF_IN) - 0.12),
      },
      true,
    );
    piece.body.setLinvel(ZERO, true);
    piece.launchTime = -10;
  }

  private hidePiece(piece: Piece): void {
    piece.mode = "hidden";
    piece.mesh.visible = false;
    piece.body.setEnabled(false);
    piece.body.setTranslation({ x: 0, y: -2, z: 0 }, true);
    piece.body.setLinvel(ZERO, true);
    piece.hive = null;
    piece.cell = null;
  }

  private watchPins(dt: number): void {
    if (!this.rulesOn() || this.clock.phase === "auto" || this.clock.phase === "transition") return;
    for (const aggressor of this.robots) {
      for (const victim of this.robots) {
        if (aggressor.alliance === victim.alliance) continue;
        if (!this.robotsTouch(aggressor, victim)) {
          aggressor.pinWarn = Math.max(0, aggressor.pinWarn - dt);
          continue;
        }
        const victimSpeed = Math.hypot(victim.body.linvel().x, victim.body.linvel().z);
        const awayX = victim.body.translation().x - aggressor.body.translation().x;
        const awayZ = victim.body.translation().z - aggressor.body.translation().z;
        const away = Math.hypot(awayX, awayZ) || 1;
        const push = (aggressor.wish.x * awayX + aggressor.wish.z * awayZ) / away;
        const escape = (victim.wish.x * awayX + victim.wish.z * awayZ) / away;
        if (victimSpeed < 0.22 && push > 0.25 && escape > 0.15) aggressor.pinWarn += dt;
        else aggressor.pinWarn = Math.max(0, aggressor.pinWarn - dt * 2);
        const count = aggressor.pinWarn >= 3 ? Math.floor(aggressor.pinWarn / 3) : 0;
        const given = this.fouls.filter((foul) => foul.rule === "G421" && foul.detail.includes(aggressor.id) && foul.detail.includes(victim.id)).length;
        if (count > given) {
          this.addFoul(aggressor.alliance, "major", "G421", `${aggressor.id} pinned ${victim.id}`);
        }
      }
    }
  }

  private robotsTouch(a: Robot, b: Robot): boolean {
    let hit = false;
    this.world?.contactPairsWith(a.collider, (other) => {
      if (other.handle === b.collider.handle) hit = true;
    });
    return hit;
  }

  private watchAutoContact(): void {
    if (this.clock.phase !== "auto") return;
    for (const robot of this.robots) {
      if (robot.autoFouled) continue;
      const x = inches(robot.body.translation().x);
      const crossed = robot.alliance === "red" ? x < -1 : x > 1;
      if (!crossed) continue;
      for (const other of this.robots) {
        if (other.alliance === robot.alliance) continue;
        const dx = robot.body.translation().x - other.body.translation().x;
        const dz = robot.body.translation().z - other.body.translation().z;
        if (Math.hypot(dx, dz) < m(20)) {
          robot.autoFouled = true;
          this.addFoul(robot.alliance, "major", "G402", `${robot.id} disrupted the opposing alliance during auto`);
        }
      }
    }
  }

  private watchFlowerFouls(): void {
    if (!this.rulesOn() || flowerWindowOpen(this.clock)) return;
    for (const piece of this.pieceSnapshots()) {
      if (piece.kind !== "nectar" || piece.location.kind !== "flower" || !piece.location.scoring) continue;
      const live = this.pieces.find((item) => item.id === piece.id);
      if (!live || live.flowerFouled || !live.alliance) continue;
      live.flowerFouled = true;
      this.addFoul(live.alliance, "major", "G410", `${live.alliance} nectar entered a flower before 1:00`);
    }
  }

  private addFoul(against: Alliance, severity: "minor" | "major", rule: string, detail: string): void {
    if (!this.rulesOn()) return;
    this.fouls.push({ against, severity, rule, detail });
    const points = severity === "minor" ? 5 : 20;
    this.message = `${rule} ${severity} foul on ${against}. +${points} to ${opponent(against)}.`;
  }

  private rulesOn(): boolean {
    return this.clock.phase !== "setup";
  }

  private mayEnterLabel(alliance: Alliance): string {
    if (this.clock.phase === "setup" || flowerWindowOpen(this.clock)) return "all";
    const tips = this.tips.filter((tip) => tip.alliance === alliance).length;
    return String(Math.max(0, tips - this.legalEntries[alliance]));
  }

  private robotSnapshots(): ScoreRobot[] {
    return this.robots.map((robot) => {
      const pos = robot.body.translation();
      const yaw = yawOf(robot.body.rotation());
      const foot = {
        x: inches(pos.x),
        z: inches(pos.z),
        lengthIn: this.config.lengthIn,
        widthIn: this.config.widthIn,
        yaw,
      };
      return {
        id: robot.id,
        alliance: robot.alliance,
        touchingWall: touchingPerimeter(foot),
        inLoadingZone: inLoadingZone(foot, robot.alliance),
      };
    });
  }

  private pieceSnapshots(): ScorePiece[] {
    return this.pieces
      .filter((piece) => piece.mode !== "hidden")
      .map((piece) => ({
        id: piece.id,
        kind: piece.kind,
        alliance: piece.alliance,
        location: this.locate(piece),
      }));
  }

  private locate(piece: Piece): ScorePiece["location"] {
    if (piece.mode === "held") return { kind: "held" };
    if (piece.mode === "hive" && piece.hive && piece.cell) {
      const hive = this.hives.find((item) => item.alliance === piece.hive);
      const up = hive ? (hive.angle >= 0 ? "audience" : "far") : piece.cell;
      return { kind: "cell", alliance: piece.hive, upward: piece.cell === up };
    }
    const pos = piece.body.translation();
    const x = inches(pos.x);
    const y = inches(pos.y);
    const z = inches(pos.z);
    const radius = inches(piece.radius);
    for (const flower of FLOWERS) {
      const dist = Math.hypot(x - flower.x, z - flower.z);
      if (dist <= 3.6 + radius && y + radius >= FLOWER_MIDDLE_IN && y - radius <= FLOWER_TOP_IN + 1.2) {
        return { kind: "flower", flowerId: flower.id, scoring: true, heightIn: y };
      }
    }
    if (footprintPoint(x, z, radius, garden("red"))) return { kind: "garden", alliance: "red" };
    if (footprintPoint(x, z, radius, garden("blue"))) return { kind: "garden", alliance: "blue" };
    return { kind: "field" };
  }

  private muzzle(robot: Robot, yaw: number): Vec3 {
    const pos = robot.body.translation();
    return {
      x: pos.x + Math.sin(yaw) * m(this.config.lengthIn / 2 + 0.4),
      y: m(this.config.heightIn * 0.82),
      z: pos.z + Math.cos(yaw) * m(this.config.lengthIn / 2 + 0.4),
    };
  }

  private nearestFlower(robot: Robot, yaw: number): FlowerSpec | null {
    const pos = robot.body.translation();
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    let best: FlowerSpec | null = null;
    let bestD = Infinity;
    for (const flower of FLOWERS) {
      const dx = m(flower.x) - pos.x;
      const dz = m(flower.z) - pos.z;
      const dist = Math.hypot(dx, dz);
      const facing = dx * fx + dz * fz;
      if (dist < m(34) && (facing > -0.15 || dist < m(16)) && dist < bestD) {
        best = flower;
        bestD = dist;
      }
    }
    return best;
  }

  private mouth(alliance: Alliance): Vec3 {
    const hive = this.hives.find((item) => item.alliance === alliance);
    if (!hive) return { x: 0, y: 1, z: 0 };
    const which = hive.angle >= 0 ? "audience" : "far";
    const sign = which === "audience" ? -1 : 1;
    const localZ = m(sign * (CELL_CENTER_ARM_IN + CELL_DEPTH_IN / 2));
    const c = Math.cos(hive.angle);
    const s = Math.sin(hive.angle);
    return {
      x: hive.pivotX,
      y: m(HIVE_PIVOT_HEIGHT_IN) + m(1) * c - localZ * s,
      z: m(1) * s + localZ * c,
    };
  }

  private syncMeshes(): void {
    for (const robot of this.robots) {
      const pos = robot.body.translation();
      const rot = robot.body.rotation();
      robot.mesh.position.set(pos.x, pos.y - m(this.config.heightIn / 2), pos.z);
      robot.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      const hood = robot.mesh.getObjectByName("hood");
      if (hood) hood.rotation.x = -((robot.hood - 50) * Math.PI) / 180;
    }
    for (const piece of this.pieces) {
      if (piece.mode !== "free") continue;
      const pos = piece.body.translation();
      const rot = piece.body.rotation();
      piece.mesh.position.set(pos.x, pos.y, pos.z);
      piece.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
  }

  private updateCamera(): void {
    const cam = this.camera;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;
    if (this.cameraName === "broadcast") {
      cam.up.set(0, 1, 0);
      cam.position.set(0, 2.45, -3.65);
      cam.lookAt(0, 0.25, 0.15);
    } else if (this.cameraName === "top") {
      cam.up.set(0, 0, 1);
      cam.position.set(0, 6.1, 0.01);
      cam.lookAt(0, 0, 0);
    } else if (this.cameraName === "red" || this.cameraName === "blue") {
      const robot = this.robots.find((item) => item.alliance === this.cameraName && item.slot === 1) ?? this.robots[0];
      if (!robot) return;
      const yaw = yawOf(robot.body.rotation());
      const pos = robot.mesh.position;
      cam.up.set(0, 1, 0);
      cam.position.set(pos.x - Math.sin(yaw) * 1.7, pos.y + 0.95, pos.z - Math.cos(yaw) * 1.7);
      cam.lookAt(pos.x + Math.sin(yaw) * 0.4, pos.y + 0.25, pos.z + Math.cos(yaw) * 0.4);
    } else {
      const orbit = this.orbit;
      const sinP = Math.sin(orbit.phi);
      cam.up.set(0, 1, 0);
      cam.position.set(
        orbit.target.x + orbit.radius * sinP * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(orbit.phi),
        orbit.target.z + orbit.radius * sinP * Math.cos(orbit.theta),
      );
      cam.lookAt(orbit.target);
    }
  }

  private updateTrails(): void {
    for (const alliance of ["red", "blue"] as const) {
      const line = this.trails[alliance];
      const robot = this.robots.find((item) => item.alliance === alliance && item.slot === 1);
      if (!line || !robot || !this.config.trajectory || this.clock.phase === "transition" || this.clock.phase === "ended") {
        if (line) line.visible = false;
        continue;
      }
      const yaw = yawOf(robot.body.rotation());
      const muzzle = this.muzzle(robot, yaw);
      let shotYaw = yaw;
      if (this.config.aimAssist) {
        const mouth = this.mouth(alliance);
        shotYaw = yaw + wrapPi(Math.atan2(mouth.x - muzzle.x, mouth.z - muzzle.z) - yaw) * 0.72;
      }
      const arc = predictArc(muzzle, shotVelocity(shotYaw, robot.hood, this.config.launchSpeed), this.config.drag ? BALL_DRAG_K : 0);
      const position = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < 48; i += 1) {
        const point = arc[Math.min(i, arc.length - 1)] ?? muzzle;
        position.setXYZ(i, point.x, point.y, point.z);
      }
      position.needsUpdate = true;
      line.geometry.setDrawRange(0, arc.length);
      line.visible = true;
    }
  }

  private readCameraKeys(): void {
    if (isTyping()) return;
    const map: Record<string, CameraName> = {
      F1: "broadcast",
      F2: "top",
      F3: "red",
      F4: "blue",
      F5: "free",
    };
    for (const [code, name] of Object.entries(map)) {
      if (this.keys.has(code)) this.setCamera(name);
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keys.has(event.code)) this.edges.add(event.code);
    this.keys.add(event.code);
    if (isTyping()) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "F1", "F2", "F3", "F4", "F5"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "Enter") {
      event.preventDefault();
      if (this.clock.phase === "setup") this.startMatch();
    }
    if (event.repeat) return;
    if (event.code === "KeyC") {
      const order: CameraName[] = ["broadcast", "top", "red", "blue", "free"];
      const index = order.indexOf(this.cameraName);
      this.setCamera(order[(index + 1) % order.length] ?? "broadcast");
    }
    if (event.code === "KeyM") this.setConfig({ muted: !this.config.muted });
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onResize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / Math.max(1, height);
      this.camera.updateProjectionMatrix();
    }
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.dragButton = event.button;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (event.button === 0) this.cameraName = "free";
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || this.cameraName !== "free") return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (this.dragButton === 2 || event.shiftKey) {
      const rightX = Math.cos(this.orbit.theta);
      const rightZ = -Math.sin(this.orbit.theta);
      const scale = this.orbit.radius * 0.0016;
      this.orbit.target.x -= rightX * dx * scale;
      this.orbit.target.z -= rightZ * dx * scale;
      this.orbit.target.y += dy * scale * 0.6;
    } else {
      this.orbit.theta -= dx * 0.005;
      this.orbit.phi = clamp(this.orbit.phi + dy * 0.004, 0.25, 1.45);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.cameraName = "free";
    this.orbit.radius = clamp(this.orbit.radius + event.deltaY * 0.004, 1.4, 9);
  };
}

function axis(neg: boolean, pos: boolean): number {
  return (pos ? 1 : 0) - (neg ? 1 : 0);
}

function isTyping(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function sanitize(config: SimConfig): SimConfig {
  return {
    ...config,
    lengthIn: clamp(config.lengthIn, 12, ROBOT_MAX_IN),
    widthIn: clamp(config.widthIn, 12, ROBOT_MAX_IN),
    heightIn: clamp(config.heightIn, 8, ROBOT_MAX_IN),
    massKg: clamp(config.massKg, 4, 30),
    maxSpeed: clamp(config.maxSpeed, 0.5, 2.6),
    launchSpeed: clamp(config.launchSpeed, 3, 12),
    robotCount: config.robotCount === 4 ? 4 : 2,
  };
}

function addCellColliders(world: RAPIER.World, body: RAPIER.RigidBody, openingSign: number, centerZ: number): void {
  const w = m(CELL_OPENING_W_IN) / 2;
  const h = m(CELL_OPENING_H_IN) / 2;
  const d = m(CELL_DEPTH_IN) / 2;
  const t = m(0.32);
  const panels: Array<[number, number, number, number, number, number]> = [
    [w, t, d, 0, -h, centerZ],
    [w, t, d * 0.72, 0, h, centerZ],
    [t, h, d, -w, 0, centerZ],
    [t, h, d, w, 0, centerZ],
    [w, h, t, 0, 0, centerZ - openingSign * d],
    [w, h * 0.22, t, 0, -h * 0.5, centerZ + openingSign * d],
  ];
  for (const [hx, hy, hz, x, y, z] of panels) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.45).setRestitution(0.18),
      body,
    );
  }
}

function slotLocal(which: "audience" | "far", index: number): THREE.Vector3 {
  const sign = which === "audience" ? -1 : 1;
  const col = index % 4;
  const row = Math.floor(index / 4);
  return new THREE.Vector3(m((col - 1.5) * 3.3), m(-2.4 + row * 3.2), m(sign * (CELL_CENTER_ARM_IN - 1.5)));
}

function worldToHive(pos: { x: number; y: number; z: number }, hive: Hive): Vec3 {
  const dy = pos.y - m(HIVE_PIVOT_HEIGHT_IN);
  const dz = pos.z;
  const c = Math.cos(hive.angle);
  const s = Math.sin(hive.angle);
  return { x: pos.x - hive.pivotX, y: dy * c + dz * s, z: -dy * s + dz * c };
}

function insideCell(local: Vec3, which: "audience" | "far"): boolean {
  const centerZ = (which === "audience" ? -1 : 1) * m(CELL_CENTER_ARM_IN);
  return Math.abs(local.x) < m(10.5) && Math.abs(local.y) < m(8) && Math.abs(local.z - centerZ) < m(7.5);
}

function footprintPoint(x: number, z: number, radius: number, zone: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
  const cx = clamp(x, zone.minX, zone.maxX);
  const cz = clamp(z, zone.minZ, zone.maxZ);
  return (x - cx) ** 2 + (z - cz) ** 2 <= radius * radius;
}
