import * as THREE from "three";
import { buildMap, emptyExplored, TILE, type BuiltMap, type ExploredCache } from "./maps";
import { createMaterials, type MaterialKit } from "./materials";
import { useGameStore } from "./store";
import { gameAudio } from "./audio";
import type {
  Cell,
  CombatAction,
  CombatEnemy,
  Facing,
  FootSurface,
  MapId,
  Zone,
} from "./types";
import {
  buildTurnOrder,
  calcEnemyDamage,
  calcPlayerAttack,
  calcSpellDamage,
  escapeChance,
  victoryRewards,
  ARCHETYPE_STATS,
} from "./combatLogic";
import { PostFxPipeline } from "./postfx";
import { loadSave, type SaveGame } from "./save";
import { makeItem } from "./items";
import type { QuestStep } from "./types";

const EYE_H = 1.65;
const MOVE_DUR = 0.26;
const TURN_DUR = 0.3;
const TRANSITION_MS = 500;

const FACING_YAW: Record<Facing, number> = {
  0: 0,
  1: -Math.PI / 2,
  2: Math.PI,
  3: Math.PI / 2,
};

const DIR: Record<Facing, { dx: number; dz: number }> = {
  0: { dx: 0, dz: -1 },
  1: { dx: 1, dz: 0 },
  2: { dx: 0, dz: 1 },
  3: { dx: -1, dz: 0 },
};

function wrapFacing(f: number): Facing {
  return (((f % 4) + 4) % 4) as Facing;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function floorMaterial(mats: MaterialKit, cell: Cell): THREE.MeshStandardMaterial {
  switch (cell.kind) {
    case "moss":
      return mats.moss;
    case "marble":
      return mats.marble;
    case "grass":
      return mats.grass;
    case "path":
      return mats.path;
    case "cobble":
      return mats.cobble;
    case "carpet":
      return mats.carpet;
    case "wood":
    case "tavern":
      return mats.wood;
    case "rune":
      return mats.rune;
    case "teleporter":
      return mats.teleporter;
    case "grate":
      return mats.iron;
    default:
      if (cell.zone === "wilderness") return mats.grass;
      if (cell.zone === "city") return mats.cobble;
      if (cell.zone === "castle") return mats.marble;
      if (cell.zone === "crypt") return mats.stone;
      return mats.stone;
  }
}

function surfaceFor(cell: Cell | undefined): FootSurface {
  if (!cell) return "stone";
  if (cell.kind === "wood" || cell.kind === "tavern") return "wood";
  if (cell.kind === "moss") return "mud";
  if (cell.kind === "grass") return "grass";
  if (cell.kind === "marble" || cell.kind === "rune") return "marble";
  if (cell.kind === "carpet") return "carpet";
  if (cell.kind === "cobble" || cell.kind === "path") return "cobble";
  return "stone";
}

interface TorchLight {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
  x: number;
  z: number;
  mesh: THREE.Group;
  wx: number;
  wy: number;
  wz: number;
}

interface Anim {
  kind: "move" | "turn";
  t: number;
  dur: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  fromYaw: number;
  toYaw: number;
  fromFacing: Facing;
  toFacing: Facing;
}

interface PushAnim {
  mesh: THREE.Object3D;
  t: number;
  dur: number;
  fromX: number;
  toX: number;
  fromZ: number;
  toZ: number;
}

export class DungeonEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mats: MaterialKit;
  private mapCache = new Map<MapId, BuiltMap>();
  private exploredCache: ExploredCache = {};
  private map: BuiltMap;
  private mapId: MapId = "city";
  private keys = new Set<string>();
  private anim: Anim | null = null;
  private pushAnims: PushAnim[] = [];
  private inCombat = false;
  private combatCamT = 0;
  private combatCamFrom = { x: 0, y: 0, z: 0, yaw: 0, fov: 72 };
  private combatCamTo = { x: 0, y: 0, z: 0, yaw: 0, fov: 58 };
  private combatVfx: { meshes: THREE.Object3D[]; t: number; dur: number; kind: string } | null = null;
  private combatBusy = false;
  private combatGen = 0;
  private exploreFov = 72;
  private postfx: PostFxPipeline | null = null;
  private spellLights: THREE.PointLight[] = [];
  private npcMeshes = new Map<string, THREE.Object3D>();
  private pendingLoad: SaveGame | null = null;
  private autoSaveTimer = 0;
  private gridX: number;
  private gridZ: number;
  private facing: Facing = 0;
  private yaw = 0;
  private torches: TorchLight[] = [];
  private enemyMeshes = new Map<string, THREE.Object3D>();
  private chestMeshes = new Map<string, THREE.Object3D>();
  private secretMeshes = new Map<string, THREE.Mesh>();
  private secretAuras = new Map<string, THREE.Mesh>();
  private pushMeshes = new Map<string, THREE.Object3D>();
  private sun: THREE.DirectionalLight;
  private moon: THREE.DirectionalLight;
  private amb: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private fill: THREE.PointLight;
  private fogDungeon: THREE.FogExp2;
  private fogWild: THREE.FogExp2;
  private fogCity: THREE.FogExp2;
  private fogCrypt: THREE.FogExp2;
  private lastTime = performance.now();
  private running = false;
  private disposed = false;
  private transitioning = false;
  private container: HTMLElement;
  private onResize: () => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private explored: boolean[][];
  private lastHud = 0;
  private inputQueue: string[] = [];
  private worldGroup: THREE.Group;
  private fxGroup: THREE.Group;
  private disposables: { dispose: () => void }[] = [];
  private lastZone: Zone | null = null;
  private seekerWasOn = false;
  private audioBound = false;
  private dust: THREE.Points | null = null;
  private dustVel: Float32Array | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.map = this.getOrBuild("city");
    this.mapId = "city";
    this.gridX = this.map.start.x;
    this.gridZ = this.map.start.z;
    this.facing = this.map.start.facing;
    this.yaw = FACING_YAW[this.facing];
    this.explored = this.getExplored("city");

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, {
      display: "block",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });

    this.scene = new THREE.Scene();
    this.fogDungeon = new THREE.FogExp2(0x0a0c10, 0.055);
    this.fogWild = new THREE.FogExp2(0x152030, 0.022);
    this.fogCity = new THREE.FogExp2(0x1a1820, 0.018);
    this.fogCrypt = new THREE.FogExp2(0x0a120a, 0.06);
    this.scene.fog = this.fogCity;
    this.scene.background = new THREE.Color(0x14141c);

    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.08,
      220,
    );
    this.camera.position.set(this.gridX * TILE + TILE / 2, EYE_H, this.gridZ * TILE + TILE / 2);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;

    this.mats = createMaterials();
    this.worldGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.scene.add(this.worldGroup, this.fxGroup);

    this.amb = new THREE.AmbientLight(0x405060, 0.45);
    this.hemi = new THREE.HemisphereLight(0x9ab8e0, 0x2a3a20, 0.5);
    this.sun = new THREE.DirectionalLight(0xffe8c8, 0.25);
    this.sun.position.set(40, 60, 20);
    this.moon = new THREE.DirectionalLight(0xb0c4e8, 0.55);
    this.moon.position.set(-30, 50, -10);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    const sc = this.moon.shadow.camera;
    sc.near = 1;
    sc.far = 140;
    sc.left = sc.bottom = -55;
    sc.right = sc.top = 55;
    this.fill = new THREE.PointLight(0xffcc88, 1.0, 14, 1.4);
    this.fill.position.set(0, 0.2, 0);
    this.camera.add(this.fill);
    this.scene.add(this.amb, this.hemi, this.sun, this.moon, this.camera);

    try {
      this.postfx = new PostFxPipeline(this.renderer, this.scene, this.camera);
      this.postfx.applySettings(useGameStore.getState().graphics);
    } catch {
      this.postfx = null;
    }

    this.buildWorld();
    this.addSky();
    this.spawnNpcs();

    this.onResize = () => this.resize();
    this.onKeyDown = (e) => this.handleKeyDown(e);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.revealFov();
    this.syncHud(true);
    this.wireControlsTest();
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private getOrBuild(id: MapId): BuiltMap {
    let m = this.mapCache.get(id);
    if (!m) {
      m = buildMap(id);
      this.mapCache.set(id, m);
    }
    return m;
  }

  private getExplored(id: MapId): boolean[][] {
    const m = this.getOrBuild(id);
    if (!this.exploredCache[id]) this.exploredCache[id] = emptyExplored(m);
    return this.exploredCache[id]!;
  }

  async start(opts?: { continueSave?: boolean }) {
    if (this.running || this.disposed) return;
    await gameAudio.unlock();
    this.bindSpatialAudio();
    this.audioBound = true;
    const store = useGameStore.getState();
    store.setAudioReady(true);
    gameAudio.playMenuConfirm();
    this.running = true;

    if (opts?.continueSave) {
      const save = loadSave();
      if (save) {
        await this.applySave(save);
        store.setStarted(true);
        store.pushLog("Welcome back, travelers. Your journey continues.", "system");
        return;
      }
    }

    store.setStarted(true);
    store.setMapId("city");
    store.setQuestStep("arrive_tavern");
    // Snap to tavern start
    this.gridX = this.map.start.x;
    this.gridZ = this.map.start.z;
    this.facing = this.map.start.facing;
    this.yaw = FACING_YAW[this.facing];
    this.camera.position.set(this.gridX * TILE + TILE / 2, EYE_H, this.gridZ * TILE + TILE / 2);
    this.camera.rotation.y = this.yaw;
    this.revealFov();
    this.syncHud(true);
    store.pushLog(
      "The Scarlet Bard's hearth crackles. Innkeeper Brann waves you over — press E to speak.",
      "system",
    );
    store.setMessage("Speak with Innkeeper Brann (E)");
    window.setTimeout(() => store.setMessage(null), 5000);
    const zone = this.cellAt(this.gridX, this.gridZ)?.zone ?? "tavern";
    gameAudio.setZone(zone);
    this.lastZone = zone;
    this.postfx?.applySettings(store.graphics);
  }

  applyGraphicsFromStore() {
    this.postfx?.applySettings(useGameStore.getState().graphics);
  }

  private async applySave(save: SaveGame) {
    const store = useGameStore.getState();
    store.hydrateFromSave(save);
    // restore explored
    this.exploredCache = { ...(save.explored as typeof this.exploredCache) };
    // rebuild map enemies state
    for (const mid of Object.keys(save.enemies) as Array<keyof typeof save.enemies>) {
      const map = this.getOrBuild(mid as MapId);
      const list = save.enemies[mid] ?? [];
      for (const pe of list) {
        const e = map.enemies.find((x) => x.id === pe.id);
        if (!e) continue;
        e.alive = pe.alive;
        e.hp = pe.hp;
      }
    }
    this.mapId = save.mapId;
    this.map = this.getOrBuild(save.mapId);
    this.explored = this.getExplored(save.mapId);
    this.gridX = save.player.x;
    this.gridZ = save.player.z;
    this.facing = save.facing;
    this.yaw = FACING_YAW[this.facing];
    this.camera.position.set(this.gridX * TILE + TILE / 2, EYE_H, this.gridZ * TILE + TILE / 2);
    this.camera.rotation.y = this.yaw;
    this.clearWorld();
    this.buildWorld();
    this.spawnNpcs();
    this.bindSpatialAudio();
    // hide dead enemies
    for (const e of this.map.enemies) {
      if (!e.alive) {
        const mesh = this.enemyMeshes.get(e.id);
        if (mesh) {
          this.worldGroup.remove(mesh);
          this.enemyMeshes.delete(e.id);
        }
        const cell = this.cellAt(e.x, e.z);
        if (cell) {
          cell.enemyId = undefined;
          if (cell.kind === "enemy") cell.kind = "floor";
        }
      }
    }
    this.revealFov();
    this.syncHud(true);
    gameAudio.setZone(save.zone);
    this.lastZone = save.zone;
    if (save.activeSong) gameAudio.playSong(save.activeSong);
    this.postfx?.applySettings(store.graphics);
  }

  saveGame() {
    const store = useGameStore.getState();
    const enemies: SaveGame["enemies"] = {};
    for (const [id, map] of this.mapCache) {
      enemies[id] = map.enemies.map((e) => ({
        id: e.id,
        alive: e.alive,
        hp: e.hp,
      }));
    }
    store.persist({
      party: store.party,
      gold: store.gold,
      inventory: store.inventory,
      questStep: store.questStep,
      hasMedallion: store.hasMedallion,
      dungeonUnlocked: store.dungeonUnlocked,
      questComplete: store.questComplete,
      mapId: this.mapId,
      player: { x: this.gridX, z: this.gridZ },
      facing: this.facing,
      zone: store.zone,
      explored: { ...this.exploredCache },
      enemies,
      graphics: store.graphics,
      activeSong: store.activeSong,
      attackMult: store.attackMult,
      defenseMult: store.defenseMult,
      seekerActive: store.seekerActive,
    });
  }

  private spawnNpcs() {
    this.npcMeshes.clear();
    const { width, height, cells } = this.map;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        if (cells[z]![x]!.kind !== "npc") continue;
        const wx = x * TILE + TILE / 2;
        const wz = z * TILE + TILE / 2;
        const g = new THREE.Group();
        const body = new THREE.Mesh(
          this.trackGeo(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8)),
          new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.8 }),
        );
        body.position.y = 1.0;
        const head = new THREE.Mesh(
          this.trackGeo(new THREE.SphereGeometry(0.26, 10, 10)),
          new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.7 }),
        );
        head.position.y = 1.7;
        const apron = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(0.55, 0.5, 0.15)),
          new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 }),
        );
        apron.position.set(0, 0.95, 0.2);
        g.add(body, head, apron);
        g.position.set(wx, 0, wz);
        this.worldGroup.add(g);
        this.npcMeshes.set(`${x},${z}`, g);
      }
    }
  }

  interact() {
    if (!this.running || this.inCombat || this.transitioning) return;
    // Check adjacent + current for NPC
    const dirs = [
      { dx: 0, dz: 0 },
      ...Object.values(DIR),
    ];
    for (const d of dirs) {
      const x = this.gridX + d.dx;
      const z = this.gridZ + d.dz;
      const cell = this.cellAt(x, z);
      if (cell?.kind === "npc") {
        this.talkInnkeeper();
        return;
      }
    }
    // tavern rest if on tavern floor
    const here = this.cellAt(this.gridX, this.gridZ);
    if (here?.zone === "tavern") {
      useGameStore.getState().pushLog("The tavern is warm — speak with Brann (E) or rest by the fire.", "info");
    }
  }

  private talkInnkeeper() {
    const store = useGameStore.getState();
    const step = store.questStep;
    gameAudio.playMenuConfirm();

    if (step === "arrive_tavern") {
      store.setQuestStep("seek_crypt");
      store.healParty(12);
      store.pushLog(
        'Brann: "Cultists stole the Eldritch Medallion! Find their Overgrown Crypt in the Outer Wilds — look for a mossy trapdoor."',
        "system",
      );
      store.setMessage("Quest: Find the Overgrown Crypt");
      window.setTimeout(() => store.setMessage(null), 4500);
      this.saveGame();
      return;
    }
    if (step === "seek_crypt" || step === "slay_cultist") {
      store.pushLog(
        'Brann: "Still no medallion? South gate to the wilds, then the trapdoor among the trees."',
        "system",
      );
      return;
    }
    if (step === "return_medallion" || store.hasMedallion) {
      // turn in
      store.setHasMedallion(false);
      store.setDungeonUnlocked(true);
      store.setQuestStep("storm_dungeon");
      // remove medallion from inventory
      const med = store.inventory.find((i) => i.defId === "eldritch_medallion");
      if (med) store.removeItem(med.uid);
      store.healParty(20);
      store.addGold(50);
      store.pushLog(
        "Brann: \"By the hearth — you've done it! Castle Hargrove's dungeon is unsealed. The Dungeon Warden awaits.\"",
        "system",
      );
      store.setMessage("Dungeon unlocked — defeat the Warden!");
      window.setTimeout(() => store.setMessage(null), 5000);
      this.saveGame();
      return;
    }
    if (step === "storm_dungeon") {
      store.pushLog(
        'Brann: "North to Castle Hargrove, then the stairs below. The Warden is no tavern brawler."',
        "system",
      );
      return;
    }
    if (step === "complete") {
      store.healParty(8);
      store.pushLog("Brann: \"Heroes of Skara Brae! Drink free tonight — you've earned it.\"", "system");
      return;
    }
  }

  queueInput(code: string) {
    this.inputQueue.push(code);
  }

  castSong(id: "fury" | "watch" | "seeker" | null) {
    const ok = useGameStore.getState().setSong(id);
    if (ok) this.applySeekerVisuals(useGameStore.getState().seekerActive);
  }

  private clearWorld() {
    while (this.worldGroup.children.length) {
      this.worldGroup.remove(this.worldGroup.children[0]!);
    }
    while (this.fxGroup.children.length) {
      this.fxGroup.remove(this.fxGroup.children[0]!);
    }
    for (const tr of this.torches) {
      this.scene.remove(tr.light);
    }
    this.torches = [];
    this.enemyMeshes.clear();
    this.chestMeshes.clear();
    this.secretMeshes.clear();
    this.secretAuras.clear();
    this.pushMeshes.clear();
    this.dust = null;
    this.dustVel = null;
  }

  private async transitionTo(
    mapId: MapId,
    x: number,
    z: number,
    facing: Facing,
    label: string,
    force = false,
  ) {
    if (this.transitioning && !force) return;
    // Quest gate: dungeon locked until medallion returned
    if (mapId === "dungeon" && !useGameStore.getState().dungeonUnlocked && !force) {
      useGameStore.getState().pushLog(
        "A seal of green runes bars the dungeon. Return the Eldritch Medallion to Brann first.",
        "danger",
      );
      gameAudio.playWallBump();
      return;
    }
    // Quest progress: entering crypt
    if (mapId === "crypt" && useGameStore.getState().questStep === "seek_crypt") {
      useGameStore.getState().setQuestStep("slay_cultist");
      useGameStore.getState().pushLog(
        "The Overgrown Crypt yawns open. Somewhere below, the Cultist Leader waits.",
        "system",
      );
    }
    this.transitioning = true;
    this.anim = null;
    useGameStore.getState().setTransitioning(true);
    useGameStore.getState().pushLog(label, "system");
    gameAudio.playDoor();

    await new Promise((r) => setTimeout(r, TRANSITION_MS * 0.45));
    if (this.disposed) return;

    this.mapId = mapId;
    this.map = this.getOrBuild(mapId);
    this.explored = this.getExplored(mapId);
    this.gridX = x;
    this.gridZ = z;
    this.facing = facing;
    this.yaw = FACING_YAW[facing];
    this.camera.position.set(x * TILE + TILE / 2, EYE_H, z * TILE + TILE / 2);
    this.camera.rotation.y = this.yaw;
    this.seekerWasOn = false;

    this.clearWorld();
    this.buildWorld();
    this.spawnNpcs();
    this.bindSpatialAudio();
    // remove dead
    for (const e of this.map.enemies) {
      if (!e.alive) {
        const mesh = this.enemyMeshes.get(e.id);
        if (mesh) {
          this.worldGroup.remove(mesh);
          this.enemyMeshes.delete(e.id);
        }
      }
    }

    const zone = this.cellAt(x, z)?.zone ?? this.map.defaultZone;
    gameAudio.setZone(zone);
    this.lastZone = zone;

    useGameStore.getState().setMapId(mapId);
    this.revealFov();
    this.syncHud(true);

    if (useGameStore.getState().seekerActive) {
      this.applySeekerVisuals(true);
    }

    await new Promise((r) => setTimeout(r, TRANSITION_MS * 0.45));
    this.transitioning = false;
    useGameStore.getState().setTransitioning(false);
    useGameStore.getState().pushLog(`Entered ${this.map.name}.`, "info");
    this.saveGame();
  }

  private bindSpatialAudio() {
    // re-register only if context ready
    if (!gameAudio.ready && !this.audioBound) return;
    for (const tr of this.torches) {
      gameAudio.registerSpatial(`torch-${this.mapId}-${tr.x}-${tr.z}`, "torch", tr.wx, tr.wy, tr.wz);
    }
    for (const f of this.map.fountains) {
      const wx = f.x * TILE + TILE / 2;
      const wz = f.z * TILE + TILE / 2;
      gameAudio.registerSpatial(`fountain-${this.mapId}-${f.x}-${f.z}`, "fountain", wx, 0.8, wz);
    }
    for (const h of this.map.hearths) {
      const wx = h.x * TILE + TILE / 2;
      const wz = h.z * TILE + TILE / 2;
      gameAudio.registerSpatial(`hearth-${this.mapId}-${h.x}-${h.z}`, "hearth", wx, 0.6, wz);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!useGameStore.getState().started || this.transitioning) return;
    if (
      [
        "KeyW", "KeyA", "KeyS", "KeyD",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
        "Digit1", "Digit2", "Digit3", "Space", "KeyI", "KeyB", "KeyE", "KeyJ", "KeyO", "F5",
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (e.code === "F5") {
      this.saveGame();
      return;
    }
    if (e.code === "KeyJ") {
      const st = useGameStore.getState();
      st.setJournalOpen(!st.journalOpen);
      return;
    }
    if (e.code === "KeyO") {
      const st = useGameStore.getState();
      st.setSettingsOpen(!st.settingsOpen);
      return;
    }
    if (e.code === "KeyI" || e.code === "KeyB") {
      if (!this.inCombat) {
        const open = !useGameStore.getState().inventoryOpen;
        useGameStore.getState().setInventoryOpen(open);
      }
      return;
    }
    if (e.code === "KeyE" || e.code === "Space") {
      if (!this.inCombat) this.interact();
      return;
    }
    if (this.inCombat) return;
    this.keys.add(e.code);
    this.inputQueue.push(e.code);
  }

  private trackGeo(geo: THREE.BufferGeometry) {
    this.disposables.push(geo);
    return geo;
  }

  private addSky() {
    // remove old sky if any - sky is on scene not worldGroup
    // rebuild simple gradient + stars each time would stack; only once
  }

  private ensureSky() {
    if ((this.scene.userData as { sky?: boolean }).sky) return;
    (this.scene.userData as { sky?: boolean }).sky = true;
    const skyGeo = this.trackGeo(new THREE.SphereGeometry(140, 24, 16));
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x0a1428) },
        bottomColor: { value: new THREE.Color(0x1a2438) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
    });
    this.disposables.push(skyMat);
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    const starGeo = this.trackGeo(new THREE.BufferGeometry());
    const starCount = 450;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.48;
      const r = 100;
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.cos(ph) * 0.65 + 18;
      positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xdde8ff, size: 0.35, sizeAttenuation: true });
    this.disposables.push(starMat);
    this.scene.add(new THREE.Points(starGeo, starMat));
  }

  private buildWorld() {
    this.ensureSky();
    const { width, height, cells } = this.map;
    const floorGeo = this.trackGeo(new THREE.PlaneGeometry(TILE, TILE));
    floorGeo.rotateX(-Math.PI / 2);
    const ceilGeo = this.trackGeo(new THREE.PlaneGeometry(TILE, TILE));
    ceilGeo.rotateX(Math.PI / 2);
    const pillarGeo = this.trackGeo(new THREE.BoxGeometry(TILE * 0.98, 3.2, TILE * 0.98));
    const buildingGeo = this.trackGeo(new THREE.BoxGeometry(TILE * 0.95, 4.2, TILE * 0.95));
    const roofGeo = this.trackGeo(new THREE.ConeGeometry(TILE * 0.72, 1.4, 4));
    const doorGeo = this.trackGeo(new THREE.BoxGeometry(TILE * 0.55, 2.4, 0.18));
    const stepGeo = this.trackGeo(new THREE.BoxGeometry(TILE * 0.8, 0.18, TILE * 0.18));
    const trunkGeo = this.trackGeo(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6));
    const foliageGeo = this.trackGeo(new THREE.ConeGeometry(1.4, 3.2, 7));
    const riverGeo = this.trackGeo(new THREE.PlaneGeometry(TILE * 0.95, TILE * 0.95));
    riverGeo.rotateX(-Math.PI / 2);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2a4a28, roughness: 0.9 });
    this.disposables.push(foliageMat);
    const secretMat = new THREE.MeshStandardMaterial({
      color: 0x4a4844,
      roughness: 0.9,
      transparent: true,
      opacity: 1,
    });
    this.disposables.push(secretMat);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.push(auraMat);

    const indoor =
      this.map.defaultZone === "dungeon" ||
      this.map.defaultZone === "crypt" ||
      this.map.defaultZone === "castle" ||
      this.map.defaultZone === "tavern";

    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[z]![x]!;
        const wx = x * TILE + TILE / 2;
        const wz = z * TILE + TILE / 2;

        // Solid structures
        if (
          cell.kind === "wall" ||
          cell.kind === "building" ||
          cell.kind === "tree" ||
          cell.kind === "secret" ||
          cell.kind === "push_wall" ||
          cell.kind === "lantern" ||
          cell.kind === "ruins" ||
          cell.kind === "cell_door" ||
          cell.kind === "river"
        ) {
          if (cell.kind === "tree") {
            const trunk = new THREE.Mesh(trunkGeo, this.mats.wood);
            trunk.position.set(wx, 1.1, wz);
            trunk.castShadow = true;
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.set(wx, 3.2, wz);
            foliage.castShadow = true;
            this.worldGroup.add(trunk, foliage);
          } else if (cell.kind === "building") {
            const body = new THREE.Mesh(buildingGeo, this.mats.timber);
            body.position.set(wx, 2.1, wz);
            body.castShadow = true;
            body.receiveShadow = true;
            const roof = new THREE.Mesh(roofGeo, this.mats.door);
            roof.position.set(wx, 4.9, wz);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            this.worldGroup.add(body, roof);
          } else if (cell.kind === "river") {
            const water = new THREE.Mesh(riverGeo, this.mats.water);
            water.position.set(wx, 0.05, wz);
            this.worldGroup.add(water);
            // bank
            const bank = new THREE.Mesh(floorGeo, this.mats.moss);
            bank.position.set(wx, 0, wz);
            this.worldGroup.add(bank);
          } else if (cell.kind === "ruins") {
            const h = 1.2 + ((x * 3 + z) % 3) * 0.5;
            const block = new THREE.Mesh(
              this.trackGeo(new THREE.BoxGeometry(TILE * 0.7, h, TILE * 0.7)),
              this.mats.ruins,
            );
            block.position.set(wx, h / 2, wz);
            block.castShadow = true;
            this.worldGroup.add(block);
          } else if (cell.kind === "cell_door") {
            const bars = new THREE.Group();
            for (let i = 0; i < 5; i++) {
              const bar = new THREE.Mesh(
                this.trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6)),
                this.mats.iron,
              );
              bar.position.set((i - 2) * 0.35, 1.3, 0);
              bars.add(bar);
            }
            bars.position.set(wx, 0, wz);
            this.worldGroup.add(bars);
          } else {
            const mat =
              cell.kind === "secret" || cell.kind === "push_wall"
                ? secretMat
                : this.map.defaultZone === "castle"
                  ? this.mats.marble
                  : this.mats.stone;
            const mesh = new THREE.Mesh(pillarGeo, mat);
            mesh.position.set(wx, 1.6, wz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.worldGroup.add(mesh);
            if (cell.kind === "secret") {
              this.secretMeshes.set(`${x},${z}`, mesh);
              const aura = new THREE.Mesh(
                this.trackGeo(new THREE.BoxGeometry(TILE * 1.05, 3.4, TILE * 1.05)),
                auraMat.clone(),
              );
              aura.position.set(wx, 1.6, wz);
              this.worldGroup.add(aura);
              this.secretAuras.set(`${x},${z}`, aura);
            }
            if (cell.kind === "push_wall") {
              this.pushMeshes.set(`${x},${z}`, mesh);
              if (cell.pushOpen) {
                mesh.position.x += TILE;
                cell.solid = false;
              }
            }
          }
          if (cell.hasTorch) this.addTorch(wx, wz, x, z);
          if (cell.hasLantern) this.addLantern(wx, wz, x, z);
          continue;
        }

        // Floors
        const floor = new THREE.Mesh(floorGeo, floorMaterial(this.mats, cell));
        floor.position.set(wx, 0, wz);
        floor.receiveShadow = true;
        this.worldGroup.add(floor);

        const needsCeil =
          indoor ||
          cell.zone === "dungeon" ||
          cell.zone === "crypt" ||
          cell.zone === "castle" ||
          cell.zone === "tavern";
        if (needsCeil) {
          const ceil = new THREE.Mesh(ceilGeo, this.mats.ceiling);
          ceil.position.set(wx, 3.2, wz);
          this.worldGroup.add(ceil);
        }

        if (cell.kind === "door" || cell.kind === "gate") {
          const door = new THREE.Mesh(
            doorGeo,
            cell.kind === "gate" ? this.mats.iron : this.mats.door,
          );
          door.position.set(wx, 1.2, wz);
          door.castShadow = true;
          this.worldGroup.add(door);
        }

        if (cell.kind === "stairs" || cell.kind === "trapdoor") {
          if (cell.kind === "stairs") {
            for (let i = 0; i < 4; i++) {
              const step = new THREE.Mesh(stepGeo, this.mats.marble);
              step.position.set(wx, 0.1 + i * 0.18, wz + 0.6 - i * 0.25);
              step.castShadow = true;
              this.worldGroup.add(step);
            }
          } else {
            const hatch = new THREE.Mesh(
              this.trackGeo(new THREE.BoxGeometry(1.2, 0.08, 1.2)),
              this.mats.moss,
            );
            hatch.position.set(wx, 0.06, wz);
            this.worldGroup.add(hatch);
            const ring = new THREE.Mesh(
              this.trackGeo(new THREE.TorusGeometry(0.25, 0.04, 6, 12)),
              this.mats.iron,
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(wx, 0.12, wz);
            this.worldGroup.add(ring);
          }
        }

        if (cell.kind === "teleporter") {
          const pad = new THREE.Mesh(
            this.trackGeo(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16)),
            this.mats.teleporter,
          );
          pad.position.set(wx, 0.08, wz);
          this.worldGroup.add(pad);
          const glow = new THREE.PointLight(0x4080ff, 0.9, 8);
          glow.position.set(wx, 0.6, wz);
          this.worldGroup.add(glow);
        }

        if (cell.kind === "banner") {
          const pole = new THREE.Mesh(
            this.trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6)),
            this.mats.iron,
          );
          pole.position.set(wx, 1.4, wz);
          const cloth = new THREE.Mesh(
            this.trackGeo(new THREE.PlaneGeometry(0.9, 1.3)),
            this.mats.banner,
          );
          cloth.position.set(wx + 0.35, 2.0, wz);
          this.worldGroup.add(pole, cloth);
        }

        if (cell.kind === "fountain") {
          const base = new THREE.Mesh(
            this.trackGeo(new THREE.CylinderGeometry(0.9, 1.1, 0.4, 12)),
            this.mats.marble,
          );
          base.position.set(wx, 0.2, wz);
          const pool = new THREE.Mesh(
            this.trackGeo(new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16)),
            this.mats.water,
          );
          pool.position.set(wx, 0.45, wz);
          this.worldGroup.add(base, pool);
        }

        if (cell.kind === "chest") {
          const g = new THREE.Group();
          const base = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.9, 0.5, 0.6)),
            this.mats.chest,
          );
          base.position.y = 0.25;
          base.castShadow = true;
          const lid = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.92, 0.18, 0.62)),
            this.mats.chest,
          );
          lid.position.set(0, 0.55, 0);
          g.add(base, lid);
          g.position.set(wx, 0, wz);
          this.worldGroup.add(g);
          this.chestMeshes.set(`${x},${z}`, g);
        }

        if (cell.enemyId) {
          const enemy = this.map.enemies.find((e) => e.id === cell.enemyId);
          if (enemy?.alive) {
            if (this.map.defaultZone === "crypt") {
              this.worldGroup.add(this.makeSkeleton(wx, wz, cell.enemyId));
            } else {
              this.worldGroup.add(this.makeEnemy(wx, wz, cell.enemyId));
            }
          }
        }

        // Crypt decorative skeletons (non-enemy)
        if (this.map.defaultZone === "crypt" && cell.kind === "rune" && (x + z) % 5 === 0 && !cell.enemyId) {
          const sk = this.makeSkeletonProp(wx + 0.6, wz - 0.4);
          this.worldGroup.add(sk);
        }
      }
    }

    // Hearths
    for (const h of this.map.hearths) {
      const wx = h.x * TILE + TILE / 2;
      const wz = h.z * TILE + TILE / 2;
      const pit = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.7, 0.85, 0.25, 10)),
        this.mats.stone,
      );
      pit.position.set(wx, 0.12, wz);
      const flame = new THREE.Mesh(
        this.trackGeo(new THREE.ConeGeometry(0.35, 0.8, 6)),
        this.mats.flame,
      );
      flame.position.set(wx, 0.65, wz);
      const hl = new THREE.PointLight(0xff8833, 1.4, 12);
      hl.position.set(wx, 1.0, wz);
      this.worldGroup.add(pit, flame, hl);
    }

    // Crypt dust particles
    if (this.map.defaultZone === "crypt") {
      this.spawnDust();
    }

    // City street lanterns along cobble (visual extras already from L cells)
  }

  private makeEnemy(wx: number, wz: number, id: string) {
    const body = new THREE.Group();
    const torso = new THREE.Mesh(
      this.trackGeo(new THREE.CapsuleGeometry(0.35, 0.7, 4, 8)),
      this.mats.enemy,
    );
    torso.position.y = 1.0;
    torso.castShadow = true;
    const head = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.28, 10, 10)),
      this.mats.enemy,
    );
    head.position.y = 1.75;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4422 });
    this.disposables.push(eyeMat);
    const eyeL = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.06, 6, 6)), eyeMat);
    eyeL.position.set(-0.1, 1.8, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    body.add(torso, head, eyeL, eyeR);
    body.position.set(wx, 0, wz);
    this.enemyMeshes.set(id, body);
    return body;
  }

  private makeSkeleton(wx: number, wz: number, id: string) {
    const g = new THREE.Group();
    const pelvis = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.45, 0.2, 0.25)),
      this.mats.skeleton,
    );
    pelvis.position.y = 0.9;
    const spine = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6)),
      this.mats.skeleton,
    );
    spine.position.y = 1.3;
    const ribs = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.5, 0.45, 0.28)),
      this.mats.skeleton,
    );
    ribs.position.y = 1.45;
    const skull = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.22, 8, 8)),
      this.mats.skeleton,
    );
    skull.position.y = 1.9;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x40ff60 });
    this.disposables.push(eyeMat);
    const e1 = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.05, 4, 4)), eyeMat);
    e1.position.set(-0.08, 1.92, 0.18);
    const e2 = e1.clone();
    e2.position.x = 0.08;
    // limbs
    for (const sx of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 5)),
        this.mats.skeleton,
      );
      leg.position.set(sx, 0.45, 0);
      g.add(leg);
      const arm = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5)),
        this.mats.skeleton,
      );
      arm.position.set(sx * 1.3, 1.4, 0);
      arm.rotation.z = sx > 0 ? -0.4 : 0.4;
      g.add(arm);
    }
    g.add(pelvis, spine, ribs, skull, e1, e2);
    g.position.set(wx, 0, wz);
    this.enemyMeshes.set(id, g);
    return g;
  }

  private makeSkeletonProp(wx: number, wz: number) {
    const g = new THREE.Group();
    const skull = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.18, 8, 8)),
      this.mats.skeleton,
    );
    skull.position.y = 0.25;
    const pile = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.5, 0.15, 0.35)),
      this.mats.skeleton,
    );
    pile.position.y = 0.08;
    g.add(skull, pile);
    g.position.set(wx, 0, wz);
    g.rotation.y = Math.random() * Math.PI;
    return g;
  }

  private spawnDust() {
    const count = 180;
    const geo = this.trackGeo(new THREE.BufferGeometry());
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const { width, height } = this.map;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * width * TILE;
      pos[i * 3 + 1] = 0.4 + Math.random() * 2.4;
      pos[i * 3 + 2] = Math.random() * height * TILE;
      vel[i * 3] = (Math.random() - 0.5) * 0.15;
      vel[i * 3 + 1] = 0.02 + Math.random() * 0.05;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, this.mats.dust);
    this.dustVel = vel;
    this.fxGroup.add(this.dust);
  }

  private addTorch(wx: number, wz: number, gx: number, gz: number) {
    const dirs = [
      { dx: 0, dz: -1 },
      { dx: 1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
    ];
    let offset = { x: 0, z: -TILE * 0.4 };
    for (const d of dirs) {
      const c = this.map.cells[gz + d.dz]?.[gx + d.dx];
      if (c && !c.solid) {
        offset = { x: d.dx * TILE * 0.42, z: d.dz * TILE * 0.42 };
        break;
      }
    }
    const group = new THREE.Group();
    const bracket = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.12, 0.4, 0.12)),
      this.mats.torchMetal,
    );
    bracket.position.y = 1.7;
    const flame = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.12, 8, 8)),
      this.mats.flame,
    );
    flame.position.y = 2.0;
    group.add(bracket, flame);
    group.position.set(wx + offset.x, 0, wz + offset.z);
    this.worldGroup.add(group);
    const light = new THREE.PointLight(0xffa040, 1.8, 20, 1.5);
    light.position.set(wx + offset.x, 2.0, wz + offset.z);
    this.scene.add(light);
    this.torches.push({
      light,
      baseIntensity: 1.8,
      phase: Math.random() * Math.PI * 2,
      x: gx,
      z: gz,
      mesh: group,
      wx: wx + offset.x,
      wy: 2.0,
      wz: wz + offset.z,
    });
  }

  private addLantern(wx: number, wz: number, gx: number, gz: number) {
    const pole = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 6)),
      this.mats.iron,
    );
    pole.position.set(wx, 1.4, wz);
    const lamp = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.18, 8, 8)),
      this.mats.flame,
    );
    lamp.position.set(wx, 2.85, wz);
    this.worldGroup.add(pole, lamp);
    const light = new THREE.PointLight(0xffcc88, 1.2, 16, 1.6);
    light.position.set(wx, 2.85, wz);
    this.scene.add(light);
    this.torches.push({
      light,
      baseIntensity: 1.2,
      phase: Math.random() * Math.PI * 2,
      x: gx,
      z: gz,
      mesh: new THREE.Group(),
      wx,
      wy: 2.85,
      wz,
    });
  }

  private cellAt(x: number, z: number) {
    return this.map.cells[z]?.[x];
  }

  private canEnter(x: number, z: number): boolean {
    const c = this.cellAt(x, z);
    if (!c) return false;
    if (c.secret && !c.secretRevealed) return false;
    if (c.pushWall && !c.pushOpen) return false;
    if (c.solid) return false;
    if (c.kind === "river") return false;
    if (c.enemyId) {
      const e = this.map.enemies.find((en) => en.id === c.enemyId);
      if (e?.alive) return false;
    }
    return true;
  }

  private tryPushWall(x: number, z: number): boolean {
    const c = this.cellAt(x, z);
    if (!c?.pushWall || c.pushOpen) return false;
    c.pushOpen = true;
    c.solid = false;
    const mesh = this.pushMeshes.get(`${x},${z}`);
    if (mesh) {
      // slide along facing direction (away from player)
      const d = DIR[this.facing];
      this.pushAnims.push({
        mesh,
        t: 0,
        dur: 0.85,
        fromX: mesh.position.x,
        toX: mesh.position.x + d.dx * TILE,
        fromZ: mesh.position.z,
        toZ: mesh.position.z + d.dz * TILE,
      });
    }
    useGameStore.getState().pushLog("The stone wall grinds aside on hidden tracks...", "loot");
    gameAudio.playDoor();
    return true;
  }

  private applySeekerVisuals(active: boolean) {
    let newlyRevealed = 0;
    for (const s of this.map.secrets) {
      const key = `${s.x},${s.z}`;
      const cell = this.cellAt(s.x, s.z);
      const mesh = this.secretMeshes.get(key);
      const aura = this.secretAuras.get(key);
      if (!cell || !mesh || !aura) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const auraMat = aura.material as THREE.MeshBasicMaterial;
      if (active) {
        mat.opacity = 0.45;
        mat.emissive = new THREE.Color(0x226688);
        mat.emissiveIntensity = 0.6;
        auraMat.opacity = 0.35;
        if (!cell.secretRevealed) newlyRevealed++;
        cell.secretRevealed = true;
        cell.solid = false;
      } else if (!cell.secretRevealed) {
        mat.opacity = 1;
        mat.emissiveIntensity = 0;
        auraMat.opacity = 0;
      } else {
        mat.opacity = 0.25;
        auraMat.opacity = 0.15;
        cell.solid = false;
      }
    }
    if (active && newlyRevealed > 0 && !this.seekerWasOn) {
      useGameStore.getState().pushLog("False walls shimmer under the Ballad...", "song");
    }
    this.seekerWasOn = active;
  }

  private tryMove(forward: boolean) {
    if (this.anim || !this.running || this.transitioning) return false;
    const d = DIR[this.facing];
    const sign = forward ? 1 : -1;
    const nx = this.gridX + d.dx * sign;
    const nz = this.gridZ + d.dz * sign;
    const target = this.cellAt(nx, nz);

    if (target?.enemyId) {
      const e = this.map.enemies.find((en) => en.id === target.enemyId);
      if (e?.alive) {
        this.beginCombat(e);
        return true;
      }
    }

    if (target?.pushWall && !target.pushOpen) {
      this.tryPushWall(nx, nz);
      return true;
    }

    if (!this.canEnter(nx, nz)) {
      useGameStore.getState().pushLog("A solid wall blocks your path.", "info");
      gameAudio.playWallBump();
      return true;
    }

    this.anim = {
      kind: "move",
      t: 0,
      dur: MOVE_DUR,
      fromX: this.gridX,
      fromZ: this.gridZ,
      toX: nx,
      toZ: nz,
      fromYaw: this.yaw,
      toYaw: this.yaw,
      fromFacing: this.facing,
      toFacing: this.facing,
    };
    return true;
  }

  private tryTurn(dir: -1 | 1) {
    if (this.anim || !this.running || this.transitioning) return false;
    const newFacing = wrapFacing(this.facing - dir);
    this.anim = {
      kind: "turn",
      t: 0,
      dur: TURN_DUR,
      fromX: this.gridX,
      fromZ: this.gridZ,
      toX: this.gridX,
      toZ: this.gridZ,
      fromYaw: this.yaw,
      toYaw: FACING_YAW[newFacing],
      fromFacing: this.facing,
      toFacing: newFacing,
    };
    return true;
  }

  private beginCombat(enemy: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    damage: number;
    alive: boolean;
    x: number;
    z: number;
    agility?: number;
    archetype?: CombatEnemy["archetype"];
    xpReward?: number;
    goldReward?: number;
    isBoss?: boolean;
    bossId?: string;
    maxStages?: number;
  }) {
    if (this.inCombat) return;
    const store = useGameStore.getState();
    if (store.party.every((p) => p.hp <= 0)) {
      store.pushLog("Your party has fallen...", "danger");
      return;
    }

    const isBoss = !!(enemy as { isBoss?: boolean }).isBoss;
    const maxStages = (enemy as { maxStages?: number }).maxStages ?? 1;
    const bossId = (enemy as { bossId?: string }).bossId;
    const ce: CombatEnemy = {
      id: `c-${enemy.id}`,
      mapEnemyId: enemy.id,
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      damage: enemy.damage,
      agility: enemy.agility ?? 10,
      archetype: enemy.archetype ?? "dungeon_wight",
      xpReward: enemy.xpReward ?? 16,
      goldReward: enemy.goldReward ?? 8,
      alive: true,
      isBoss,
      bossId,
      stage: 1,
      maxStages: isBoss ? maxStages : 1,
    };

    const foes: CombatEnemy[] = [ce];
    if (isBoss) {
      // stage-1 cultist acolytes
      foes.push({
        id: `c-${enemy.id}-a1`,
        mapEnemyId: enemy.id,
        name: "Cult Acolyte",
        hp: Math.floor(enemy.maxHp * 0.35),
        maxHp: Math.floor(enemy.maxHp * 0.35),
        damage: Math.max(4, enemy.damage - 3),
        agility: (enemy.agility ?? 10) + 2,
        archetype: "shadow_cultist",
        xpReward: 8,
        goldReward: 4,
        alive: true,
      });
    } else if (Math.random() > 0.65) {
      foes.push({
        ...ce,
        id: `c-${enemy.id}-b`,
        name: `${enemy.name} Ally`,
        hp: Math.max(8, Math.floor(enemy.hp * 0.55)),
        maxHp: Math.max(8, Math.floor(enemy.maxHp * 0.55)),
        xpReward: Math.floor((enemy.xpReward ?? 16) * 0.5),
        goldReward: Math.floor((enemy.goldReward ?? 8) * 0.5),
        isBoss: false,
        stage: 1,
        maxStages: 1,
      });
    }

    const turnQueue = buildTurnOrder(store.party, foes);
    this.inCombat = true;
    this.combatBusy = true;
    this.combatGen += 1;
    const gen = this.combatGen;
    this.anim = null;

    // Cinematic camera: face enemy tile
    const ex = enemy.x * TILE + TILE / 2;
    const ez = enemy.z * TILE + TILE / 2;
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    const targetYaw = Math.atan2(-(ex - px), -(ez - pz));
    // Approach midway
    const midX = px + (ex - px) * 0.35;
    const midZ = pz + (ez - pz) * 0.35;

    this.combatCamFrom = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      yaw: this.yaw,
      fov: this.camera.fov,
    };
    this.combatCamTo = {
      x: midX,
      y: EYE_H - 0.05,
      z: midZ,
      yaw: targetYaw,
      fov: 58,
    };
    this.combatCamT = 0;

    // Emphasize enemy mesh
    const mesh = this.enemyMeshes.get(enemy.id);
    if (mesh) {
      mesh.scale.setScalar(1.15);
      mesh.position.y = 0.1;
    }

    store.setCombat({
      active: true,
      phase: "intro",
      enemies: foes,
      turnQueue,
      turnIndex: 0,
      selectedEnemyId: ce.id,
      activeActorId: turnQueue[0]?.id ?? null,
      defendingIds: [],
      vfx: null,
      rewardSummary: null,
      subMenu: null,
    });
    store.pushLog(
      isBoss
        ? `Boss fight! ${enemy.name} enters the fray!`
        : `Combat! A ${enemy.name} bars the way!`,
      "combat",
    );
    store.setInventoryOpen(false);
    gameAudio.playSwordClang();

    // After intro camera, open select or run enemy turn
    window.setTimeout(() => {
      if (!this.inCombat || this.disposed || this.combatGen !== gen) return;
      this.combatBusy = false;
      this.advanceToReadyTurn();
    }, 700);
  }

  private advanceToReadyTurn() {
    const store = useGameStore.getState();
    if (!store.combat.active) return;

    // Skip dead actors
    let guard = 0;
    while (guard++ < 24) {
      const c = useGameStore.getState().combat;
      if (c.turnQueue.length === 0) break;
      const idx = c.turnIndex % c.turnQueue.length;
      const turn = c.turnQueue[idx]!;
      if (turn.kind === "party") {
        const m = store.party.find((p) => p.id === turn.id);
        if (m && m.hp > 0) {
          store.setCombat({
            phase: "select",
            activeActorId: turn.id,
            subMenu: null,
          });
          return;
        }
      } else {
        const e = c.enemies.find((en) => en.id === turn.id);
        if (e && e.alive) {
          store.setCombat({ phase: "enemy", activeActorId: turn.id, subMenu: null });
          void this.runEnemyTurn(e.id);
          return;
        }
      }
      store.setCombat({ turnIndex: c.turnIndex + 1 });
    }
    this.checkCombatEnd();
  }

  private nextTurn() {
    const store = useGameStore.getState();
    const c = store.combat;
    // rebuild queue if needed (dead removed conceptually by skip)
    store.setCombat({ turnIndex: c.turnIndex + 1, subMenu: null });
    this.checkCombatEnd();
    if (!useGameStore.getState().combat.active) return;
    this.advanceToReadyTurn();
  }

  private checkCombatEnd() {
    const store = useGameStore.getState();
    const c = store.combat;
    if (!c.active) return;
    if (c.enemies.every((e) => !e.alive)) {
      this.finishVictory();
      return;
    }
    if (store.party.every((p) => p.hp <= 0)) {
      store.setCombat({ phase: "defeat" });
      store.pushLog("The party is defeated...", "danger");
      store.setMessage("Your party falls. Rest at the Scarlet Bard to recover.");
      window.setTimeout(() => this.exitCombat(false), 1600);
    }
  }

  private finishVictory() {
    const store = useGameStore.getState();
    const { xp, gold, loot } = victoryRewards(store.combat.enemies);
    store.applyVictory(xp, gold, loot);
    const bosses = store.combat.enemies.filter((e) => e.isBoss);
    // kill map enemies (unique map ids)
    const killed = new Set<string>();
    for (const ce of store.combat.enemies) {
      if (killed.has(ce.mapEnemyId)) continue;
      // only kill map enemy if all combat copies of that map id that are bosses are truly dead
      killed.add(ce.mapEnemyId);
      const me = this.map.enemies.find((e) => e.id === ce.mapEnemyId);
      if (me) {
        me.alive = false;
        me.hp = 0;
        const mesh = this.enemyMeshes.get(me.id);
        if (mesh) {
          this.worldGroup.remove(mesh);
          this.enemyMeshes.delete(me.id);
        }
        const cell = this.cellAt(me.x, me.z);
        if (cell) {
          cell.enemyId = undefined;
          if (cell.kind === "enemy") cell.kind = "floor";
        }
      }
    }
    for (const b of bosses) {
      if (b.bossId === "cultist_leader") {
        store.grantMedallion();
        store.setQuestStep("return_medallion");
        store.pushLog("The Cultist Leader falls. The Eldritch Medallion is yours!", "loot");
      }
      if (b.bossId === "dungeon_warden") {
        store.setQuestStep("complete");
        store.addGold(100);
        store.pushLog(
          "The Dungeon Warden is cast down. Skara Brae is safe — demo quest complete!",
          "loot",
        );
        store.setMessage("Quest complete — Heroes of Skara Brae!");
        window.setTimeout(() => store.setMessage(null), 6000);
      }
    }
    store.setCombat({
      phase: "victory",
      rewardSummary: `+${xp} XP · +${gold}g${loot ? ` · ${loot.name}` : ""}`,
    });
    store.healParty(3);
    this.saveGame();
    this.combatGen += 1;
    const gen = this.combatGen;
    window.setTimeout(() => {
      if (this.disposed || this.combatGen !== gen) {
        // still exit if combat lingering
      }
      if (this.inCombat) this.exitCombat(true);
    }, 900);
  }

  private exitCombat(_won: boolean) {
    this.inCombat = false;
    this.combatBusy = false;
    this.combatVfx = null;
    // restore camera
    this.camera.position.set(
      this.gridX * TILE + TILE / 2,
      EYE_H,
      this.gridZ * TILE + TILE / 2,
    );
    this.camera.rotation.y = this.yaw;
    this.camera.fov = this.exploreFov;
    this.camera.updateProjectionMatrix();
    useGameStore.getState().endCombat();
    useGameStore.getState().setMessage(null);
    this.syncHud(true);
  }

  /** Public API for combat UI */
  combatAction(action: CombatAction, opts?: { itemUid?: string; songId?: "fury" | "watch" | "seeker"; targetId?: string }) {
    if (!this.inCombat || this.combatBusy) return;
    const store = useGameStore.getState();
    const c = store.combat;
    if (c.phase !== "select") return;
    const actorId = c.activeActorId;
    if (!actorId) return;
    const actor = store.party.find((p) => p.id === actorId);
    if (!actor || actor.hp <= 0) return;

    if (action === "song") {
      if (!opts?.songId) {
        store.setCombat({ subMenu: c.subMenu === "song" ? null : "song" });
        return;
      }
      this.combatBusy = true;
      store.setCombat({ phase: "animating", subMenu: null });
      const ok = store.setSong(opts.songId);
      this.spawnVfx("song", this.camera.position.clone().add(new THREE.Vector3(0, 0.2, -1)));
      if (ok) store.castFx(actor.id, "song", "Song");
      window.setTimeout(() => {
        this.combatBusy = false;
        this.nextTurn();
      }, 700);
      return;
    }

    if (action === "item") {
      if (!opts?.itemUid) {
        store.setCombat({ subMenu: c.subMenu === "item" ? null : "item" });
        return;
      }
      this.combatBusy = true;
      store.setCombat({ phase: "animating", subMenu: null });
      const item = store.inventory.find((i) => i.uid === opts.itemUid);
      store.useItem(opts.itemUid, actor.id);
      if (item?.heal) this.spawnVfx("heal", this.camera.position.clone());
      window.setTimeout(() => {
        this.combatBusy = false;
        this.nextTurn();
      }, 600);
      return;
    }

    if (action === "defend") {
      this.combatBusy = true;
      store.setCombat({
        phase: "animating",
        defendingIds: [...c.defendingIds.filter((id) => id !== actor.id), actor.id],
        subMenu: null,
      });
      store.castFx(actor.id, "buff", "Guard");
      store.pushLog(`${actor.name} raises a guard.`, "info");
      this.spawnVfx("shield", this.camera.position.clone().add(new THREE.Vector3(0, 0.3, -0.8)));
      gameAudio.playMenuConfirm();
      window.setTimeout(() => {
        this.combatBusy = false;
        this.nextTurn();
      }, 550);
      return;
    }

    if (action === "escape") {
      this.combatBusy = true;
      store.setCombat({ phase: "animating", subMenu: null });
      const chance = escapeChance(store.party, c.enemies);
      const hasSmoke = store.inventory.some((i) => i.defId === "smoke_bomb");
      const roll = Math.random();
      if (roll < chance || hasSmoke) {
        if (hasSmoke) {
          const smoke = store.inventory.find((i) => i.defId === "smoke_bomb");
          if (smoke) store.removeItem(smoke.uid);
        }
        store.pushLog("The party slips away into the shadows!", "info");
        store.setCombat({ phase: "escaped" });
        window.setTimeout(() => this.exitCombat(false), 800);
      } else {
        store.pushLog("Escape failed! The foe cuts off the path.", "danger");
        window.setTimeout(() => {
          this.combatBusy = false;
          this.nextTurn();
        }, 600);
      }
      return;
    }

    // attack / spell need target
    const targetId = opts?.targetId ?? c.selectedEnemyId ?? c.enemies.find((e) => e.alive)?.id;
    if (!targetId) return;
    const target = c.enemies.find((e) => e.id === targetId && e.alive);
    if (!target) return;

    this.combatBusy = true;
    store.setCombat({ phase: "animating", selectedEnemyId: targetId, subMenu: null });

    if (action === "attack") {
      const { damage, crit } = calcPlayerAttack(actor, target, store.attackMult);
      target.hp -= damage;
      if (target.hp <= 0) target.alive = false;
      store.setCombat({ enemies: c.enemies.map((e) => (e.id === target.id ? { ...target } : e)) });
      store.castFx(actor.id, "attack", crit ? "Crit!" : "Strike");
      store.pushLog(
        `${actor.name} strikes ${target.name} for ${damage}${crit ? " (critical!)" : ""}.`,
        "combat",
      );
      gameAudio.playSwordClang();
      this.spawnVfx("slash", this.enemyWorldPos(target));
      if (!target.alive) {
        if (this.tryBossPhase(target)) {
          /* phase continues */
        } else {
          store.pushLog(`${target.name} is defeated!`, "loot");
          gameAudio.playSpellImpact();
        }
      }
    } else if (action === "spell") {
      const spell = calcSpellDamage(actor, store.attackMult);
      if (!store.spendSp(actor.id, spell.cost)) {
        store.pushLog(`${actor.name} lacks spirit for a spell.`, "danger");
        this.combatBusy = false;
        store.setCombat({ phase: "select" });
        return;
      }
      if (actor.className === "Paladin" && Math.random() > 0.4) {
        // heal ally instead sometimes via spell button = smite; still damages
      }
      target.hp -= spell.damage;
      if (target.hp <= 0) target.alive = false;
      store.setCombat({ enemies: c.enemies.map((e) => (e.id === target.id ? { ...target } : e)) });
      store.castFx(actor.id, "spell", spell.label);
      store.pushLog(`${actor.name} casts ${spell.label} for ${spell.damage}!`, "combat");
      gameAudio.playSpellImpact();
      this.spawnVfx(
        actor.className === "Wizard" ? "fireball" : "hit",
        this.enemyWorldPos(target),
      );
      if (actor.className === "Paladin") {
        store.healMember(actor.id, 4);
        this.spawnVfx("heal", this.camera.position.clone());
      }
      if (!target.alive) {
        if (this.tryBossPhase(target)) {
          /* phase */
        } else {
          store.pushLog(`${target.name} is defeated!`, "loot");
        }
      }
    }

    window.setTimeout(() => {
      this.combatBusy = false;
      this.nextTurn();
    }, 750);
  }

  /** Multi-stage boss: revive with stronger form + adds */
  private tryBossPhase(target: CombatEnemy): boolean {
    if (!target.isBoss || !target.maxStages || (target.stage ?? 1) >= target.maxStages) {
      return false;
    }
    const store = useGameStore.getState();
    const next = (target.stage ?? 1) + 1;
    target.stage = next;
    target.alive = true;
    target.maxHp = Math.floor(target.maxHp * 1.15);
    target.hp = target.maxHp;
    target.damage = Math.floor(target.damage * 1.2);
    target.name = `${target.name.replace(/ \(Phase \d\)/, "")} (Phase ${next})`;

    const enemies = store.combat.enemies.map((e) =>
      e.id === target.id ? { ...target } : e,
    );
    // spawn phase add
    const add: CombatEnemy = {
      id: `c-phase-${next}-${Date.now()}`,
      mapEnemyId: target.mapEnemyId,
      name: next >= 3 ? "Void Shade" : "Enraged Acolyte",
      hp: 14 + next * 6,
      maxHp: 14 + next * 6,
      damage: 5 + next,
      agility: 12 + next,
      archetype: next >= 3 ? "shadow_cultist" : "dungeon_wight",
      xpReward: 10,
      goldReward: 6,
      alive: true,
    };
    enemies.push(add);
    const turnQueue = buildTurnOrder(store.party, enemies);
    store.setCombat({
      enemies,
      turnQueue,
      turnIndex: 0,
      selectedEnemyId: target.id,
    });
    store.pushLog(`${target.name.split(" (")[0]} rises in Phase ${next}!`, "danger");
    store.setMessage(`Boss Phase ${next}!`);
    window.setTimeout(() => store.setMessage(null), 2500);
    this.spawnVfx("fireball", this.enemyWorldPos(target));
    if (useGameStore.getState().graphics.dynamicLights) {
      this.pulseSpellLight(0xaa44ff, this.enemyWorldPos(target), 3.5);
    }
    gameAudio.playSpellImpact();
    return true;
  }

  private pulseSpellLight(color: number, at: THREE.Vector3, intensity = 2.8) {
    const light = new THREE.PointLight(color, intensity, 14, 1.6);
    light.position.copy(at);
    this.fxGroup.add(light);
    this.spellLights.push(light);
    window.setTimeout(() => {
      this.fxGroup.remove(light);
      this.spellLights = this.spellLights.filter((l) => l !== light);
    }, 500);
  }

  selectCombatEnemy(id: string) {
    if (!this.inCombat) return;
    useGameStore.getState().setCombat({ selectedEnemyId: id });
  }

  private enemyWorldPos(target: CombatEnemy): THREE.Vector3 {
    const me = this.map.enemies.find((e) => e.id === target.mapEnemyId);
    if (me) {
      return new THREE.Vector3(me.x * TILE + TILE / 2, 1.2, me.z * TILE + TILE / 2);
    }
    return this.camera.position.clone().add(new THREE.Vector3(0, 0.5, -2));
  }

  private spawnVfx(kind: string, at: THREE.Vector3) {
    const meshes: THREE.Object3D[] = [];
    if (kind === "slash") {
      const geo = this.trackGeo(new THREE.RingGeometry(0.3, 0.55, 16, 1, 0, Math.PI * 1.2));
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe8a0,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposables.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(at);
      m.rotation.y = this.yaw;
      m.rotation.x = Math.PI / 2;
      meshes.push(m);
      this.fxGroup.add(m);
    } else if (kind === "fireball") {
      for (let i = 0; i < 14; i++) {
        const geo = this.trackGeo(new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 6, 6));
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xff6622 : 0xffcc44,
          transparent: true,
          opacity: 0.95,
        });
        this.disposables.push(mat);
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(at).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8),
        );
        meshes.push(m);
        this.fxGroup.add(m);
      }
      const light = new THREE.PointLight(0xff6622, 2.5, 8);
      light.position.copy(at);
      meshes.push(light);
      this.fxGroup.add(light);
    } else if (kind === "shield") {
      const geo = this.trackGeo(new THREE.SphereGeometry(0.7, 16, 12));
      const mat = new THREE.MeshBasicMaterial({
        color: 0x66aaff,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
      });
      this.disposables.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(at);
      meshes.push(m);
      this.fxGroup.add(m);
    } else if (kind === "heal") {
      for (let i = 0; i < 10; i++) {
        const geo = this.trackGeo(new THREE.SphereGeometry(0.05, 4, 4));
        const mat = new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.9 });
        this.disposables.push(mat);
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.8, (Math.random() - 0.5) * 0.5));
        meshes.push(m);
        this.fxGroup.add(m);
      }
    } else if (kind === "song") {
      const geo = this.trackGeo(new THREE.TorusGeometry(0.5, 0.04, 6, 20));
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.85 });
      this.disposables.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(at);
      meshes.push(m);
      this.fxGroup.add(m);
    } else {
      const geo = this.trackGeo(new THREE.SphereGeometry(0.2, 8, 8));
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      this.disposables.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(at);
      meshes.push(m);
      this.fxGroup.add(m);
    }
    this.combatVfx = { meshes, t: 0, dur: 0.55, kind };
    useGameStore.getState().setCombat({
      vfx: { kind: kind as "slash", label: kind, until: Date.now() + 550 },
    });
    if (useGameStore.getState().graphics.dynamicLights) {
      const col =
        kind === "fireball"
          ? 0xff6622
          : kind === "shield"
            ? 0x66aaff
            : kind === "heal"
              ? 0x66ff99
              : kind === "song"
                ? 0xffd070
                : 0xffe8a0;
      this.pulseSpellLight(col, at, kind === "fireball" ? 4 : 2.2);
    }
  }

  private async runEnemyTurn(enemyId: string) {
    this.combatBusy = true;
    await new Promise((r) => setTimeout(r, 450));
    if (!this.inCombat || this.disposed) return;
    const store = useGameStore.getState();
    const c = store.combat;
    const enemy = c.enemies.find((e) => e.id === enemyId);
    if (!enemy || !enemy.alive) {
      this.combatBusy = false;
      this.nextTurn();
      return;
    }
    const living = store.party.filter((p) => p.hp > 0);
    if (living.length === 0) {
      this.combatBusy = false;
      this.checkCombatEnd();
      return;
    }
    // Prefer front-liners
    const target =
      living.find((p) => p.className === "Warrior" || p.className === "Paladin") ??
      living[Math.floor(Math.random() * living.length)]!;
    const defending = c.defendingIds.includes(target.id);
    const dmg = calcEnemyDamage(enemy, target, store.defenseMult, defending);
    store.damageMember(target.id, dmg);
    store.pushLog(`${enemy.name} hits ${target.name} for ${dmg}!`, "danger");
    gameAudio.playSwordClang();
    this.spawnVfx("hit", this.camera.position.clone().add(new THREE.Vector3(0, 0.2, -0.5)));
    // clear defend after hit
    if (defending) {
      store.setCombat({
        defendingIds: c.defendingIds.filter((id) => id !== target.id),
      });
    }
    await new Promise((r) => setTimeout(r, 650));
    this.combatBusy = false;
    this.nextTurn();
  }

  private onArriveCell(fromX: number, fromZ: number) {
    const cell = this.cellAt(this.gridX, this.gridZ);
    if (!cell) return;
    const store = useGameStore.getState();
    const from = this.cellAt(fromX, fromZ);

    gameAudio.playFootstep(surfaceFor(cell));

    if (cell.kind === "chest" && !cell.lootTaken) {
      cell.lootTaken = true;
      cell.kind = "floor";
      store.healParty(8);
      store.pushLog("You pry open a chest — healing salves and silver!", "loot");
      gameAudio.playChestOpen();
      const mesh = this.chestMeshes.get(`${this.gridX},${this.gridZ}`);
      if (mesh) {
        this.worldGroup.remove(mesh);
        this.chestMeshes.delete(`${this.gridX},${this.gridZ}`);
      }
    }

    if (cell.kind === "fountain") {
      store.healParty(3);
      store.pushLog("Cool fountain water restores the party.", "loot");
    }

    if (cell.zone === "tavern" && from?.zone !== "tavern") {
      store.pushLog("Lantern light and song — The Scarlet Bard welcomes you.", "system");
    }

    if (cell.zone !== this.lastZone) {
      gameAudio.setZone(cell.zone);
      this.lastZone = cell.zone;
    }

    // Portal transition
    if (cell.portalTo != null && cell.portalX != null && cell.portalZ != null) {
      const to = cell.portalTo;
      const tx = cell.portalX;
      const tz = cell.portalZ;
      const tf = cell.portalFacing ?? 0;
      const label = cell.portalLabel ?? `Traveling to ${to}...`;
      void this.transitionTo(to, tx, tz, tf, label);
    }
  }

  private revealFov() {
    const range = 5;
    const { width, height } = this.map;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        this.map.cells[z]![x]!.visible = false;
      }
    }
    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx * dx + dz * dz > range * range) continue;
        const x = this.gridX + dx;
        const z = this.gridZ + dz;
        if (x < 0 || z < 0 || x >= width || z >= height) continue;
        if (this.hasLos(this.gridX, this.gridZ, x, z)) {
          this.map.cells[z]![x]!.visible = true;
          this.map.cells[z]![x]!.explored = true;
          this.explored[z]![x] = true;
        }
      }
    }
  }

  private hasLos(x0: number, z0: number, x1: number, z1: number): boolean {
    let x = x0;
    let z = z0;
    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    while (true) {
      if (x === x1 && z === z1) return true;
      const cell = this.cellAt(x, z);
      const blocks =
        cell?.solid &&
        !(cell.secret && cell.secretRevealed) &&
        !(cell.pushWall && cell.pushOpen);
      if (blocks && !(x === x0 && z === z0)) return false;
      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        z += sz;
      }
    }
  }

  private processInput() {
    if (!this.running || this.anim || this.transitioning || this.inCombat) return;
    while (this.inputQueue.length > 0) {
      const code = this.inputQueue.shift()!;
      if (code === "KeyA" || code === "ArrowLeft") {
        if (this.tryTurn(1)) return;
      } else if (code === "KeyD" || code === "ArrowRight") {
        if (this.tryTurn(-1)) return;
      } else if (code === "KeyW" || code === "ArrowUp") {
        if (this.tryMove(true)) return;
      } else if (code === "KeyS" || code === "ArrowDown") {
        if (this.tryMove(false)) return;
      } else if (code === "Digit1") {
        this.castSong("fury");
        return;
      } else if (code === "Digit2") {
        this.castSong("watch");
        return;
      } else if (code === "Digit3") {
        this.castSong("seeker");
        return;
      }
    }
  }

  private updateAnim(dt: number) {
    if (!this.anim) return;
    this.anim.t += dt;
    const u = Math.min(1, this.anim.t / this.anim.dur);
    const e = easeInOut(u);
    if (this.anim.kind === "move") {
      const x = THREE.MathUtils.lerp(this.anim.fromX, this.anim.toX, e);
      const z = THREE.MathUtils.lerp(this.anim.fromZ, this.anim.toZ, e);
      this.camera.position.x = x * TILE + TILE / 2;
      this.camera.position.z = z * TILE + TILE / 2;
      this.camera.position.y = EYE_H + Math.sin(e * Math.PI) * 0.04;
    } else {
      this.yaw = lerpAngle(this.anim.fromYaw, this.anim.toYaw, e);
      this.camera.rotation.y = this.yaw;
    }
    if (u >= 1) {
      const fromX = this.anim.fromX;
      const fromZ = this.anim.fromZ;
      if (this.anim.kind === "move") {
        this.gridX = this.anim.toX;
        this.gridZ = this.anim.toZ;
        this.camera.position.set(this.gridX * TILE + TILE / 2, EYE_H, this.gridZ * TILE + TILE / 2);
        this.onArriveCell(fromX, fromZ);
        this.revealFov();
      } else {
        this.facing = this.anim.toFacing;
        this.yaw = FACING_YAW[this.facing];
        this.camera.rotation.y = this.yaw;
      }
      this.anim = null;
      this.syncHud(true);
    }
  }

  private updatePushAnims(dt: number) {
    for (let i = this.pushAnims.length - 1; i >= 0; i--) {
      const a = this.pushAnims[i]!;
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const e = easeInOut(u);
      a.mesh.position.x = THREE.MathUtils.lerp(a.fromX, a.toX, e);
      a.mesh.position.z = THREE.MathUtils.lerp(a.fromZ, a.toZ, e);
      if (u >= 1) this.pushAnims.splice(i, 1);
    }
  }

  private updateLights(t: number) {
    const zone = this.cellAt(this.gridX, this.gridZ)?.zone ?? this.map.defaultZone;

    if (zone === "dungeon") {
      this.scene.fog = this.fogDungeon;
      (this.scene.background as THREE.Color).set(0x06070a);
      this.amb.intensity = 0.16;
      this.hemi.intensity = 0.08;
      this.sun.intensity = 0.02;
      this.moon.intensity = 0.04;
      this.fill.intensity = 0.5;
      this.fill.color.set(0xffb060);
      this.renderer.toneMappingExposure = 1.0;
    } else if (zone === "crypt") {
      this.scene.fog = this.fogCrypt;
      (this.scene.background as THREE.Color).set(0x080e08);
      this.amb.intensity = 0.14;
      this.hemi.intensity = 0.12;
      this.hemi.color.set(0x40a050);
      this.sun.intensity = 0.02;
      this.moon.intensity = 0.05;
      this.fill.intensity = 0.4;
      this.fill.color.set(0x60c070);
      this.renderer.toneMappingExposure = 0.95;
    } else if (zone === "tavern") {
      this.scene.fog = this.fogDungeon;
      (this.scene.background as THREE.Color).set(0x120c08);
      this.amb.intensity = 0.35;
      this.hemi.intensity = 0.2;
      this.sun.intensity = 0.05;
      this.moon.intensity = 0.1;
      this.fill.intensity = 0.7;
      this.fill.color.set(0xffaa66);
      this.renderer.toneMappingExposure = 1.1;
    } else if (zone === "castle") {
      this.scene.fog = this.fogDungeon;
      (this.scene.background as THREE.Color).set(0x101018);
      this.amb.intensity = 0.28;
      this.hemi.intensity = 0.2;
      this.sun.intensity = 0.08;
      this.moon.intensity = 0.12;
      this.fill.intensity = 0.55;
      this.fill.color.set(0xe8d0a0);
      this.renderer.toneMappingExposure = 1.05;
    } else if (zone === "city") {
      this.scene.fog = this.fogCity;
      (this.scene.background as THREE.Color).set(0x14141c);
      this.amb.intensity = 0.42;
      this.hemi.intensity = 0.45;
      this.hemi.color.set(0x9ab8e0);
      this.sun.intensity = 0.12;
      this.moon.intensity = 0.55;
      this.fill.intensity = 0.75;
      this.fill.color.set(0xffcc88);
      this.renderer.toneMappingExposure = 1.12;
    } else {
      // wilderness — denser volumetric-style fog
      this.scene.fog = this.fogWild;
      (this.scene.background as THREE.Color).set(0x101828);
      this.amb.intensity = 0.48;
      this.hemi.intensity = 0.55;
      this.hemi.color.set(0x9ab8e0);
      this.sun.intensity = 0.12;
      this.moon.intensity = 0.75;
      this.fill.intensity = 0.85;
      this.fill.color.set(0xffcc88);
      this.renderer.toneMappingExposure = 1.15;
    }

    const ranked = this.torches
      .map((tr) => ({ tr, dist: Math.hypot(tr.x - this.gridX, tr.z - this.gridZ) }))
      .sort((a, b) => a.dist - b.dist);

    for (const tr of this.torches) {
      const flicker =
        0.85 + 0.15 * Math.sin(t * 9 + tr.phase) + 0.08 * Math.sin(t * 17 + tr.phase * 2);
      const indoorBoost =
        zone === "dungeon" || zone === "crypt" || zone === "castle" || zone === "tavern" ? 1.25 : 0.55;
      const dyn = useGameStore.getState().graphics.dynamicLights ? 1.25 : 0.85;
      tr.light.intensity = tr.baseIntensity * flicker * indoorBoost * dyn;
      const flame = tr.mesh.children[1] as THREE.Mesh | undefined;
      if (flame) flame.scale.setScalar(0.9 + 0.2 * flicker);
    }

    for (let i = 0; i < ranked.length; i++) {
      const tr = ranked[i]!.tr;
      const enable =
        (zone === "dungeon" || zone === "crypt") && i < 2 && ranked[i]!.dist < 8;
      if (tr.light.castShadow !== enable) {
        tr.light.castShadow = enable;
        if (enable) {
          tr.light.shadow.mapSize.set(512, 512);
          tr.light.shadow.bias = -0.01;
        }
      }
    }

    if (useGameStore.getState().seekerActive) {
      for (const aura of this.secretAuras.values()) {
        const m = aura.material as THREE.MeshBasicMaterial;
        m.opacity = 0.22 + 0.18 * Math.sin(t * 4);
      }
    }

    // dust drift
    if (this.dust && this.dustVel) {
      const pos = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const { width, height } = this.map;
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3] += this.dustVel[i * 3]! * 0.016;
        arr[i * 3 + 1] += this.dustVel[i * 3 + 1]! * 0.016;
        arr[i * 3 + 2] += this.dustVel[i * 3 + 2]! * 0.016;
        if (arr[i * 3 + 1]! > 3.0) arr[i * 3 + 1] = 0.3;
        if (arr[i * 3]! < 0) arr[i * 3] = width * TILE;
        if (arr[i * 3]! > width * TILE) arr[i * 3] = 0;
        if (arr[i * 3 + 2]! < 0) arr[i * 3 + 2] = height * TILE;
        if (arr[i * 3 + 2]! > height * TILE) arr[i * 3 + 2] = 0;
      }
      pos.needsUpdate = true;
    }
  }

  private updateCombatCamera(dt: number) {
    if (this.combatCamT < 1) {
      this.combatCamT = Math.min(1, this.combatCamT + dt / 0.65);
      const e = easeInOut(this.combatCamT);
      const a = this.combatCamFrom;
      const b = this.combatCamTo;
      this.camera.position.x = THREE.MathUtils.lerp(a.x, b.x, e);
      this.camera.position.y = THREE.MathUtils.lerp(a.y, b.y, e);
      this.camera.position.z = THREE.MathUtils.lerp(a.z, b.z, e);
      this.camera.rotation.y = lerpAngle(a.yaw, b.yaw, e);
      this.camera.fov = THREE.MathUtils.lerp(a.fov, b.fov, e);
      this.camera.updateProjectionMatrix();
    } else {
      // subtle breathing zoom
      const pulse = Math.sin(performance.now() / 1000 * 1.5) * 0.02;
      this.camera.position.y = this.combatCamTo.y + pulse;
    }
  }

  private updateCombatVfx(dt: number) {
    if (!this.combatVfx) return;
    this.combatVfx.t += dt;
    const u = this.combatVfx.t / this.combatVfx.dur;
    for (const m of this.combatVfx.meshes) {
      m.scale.setScalar(1 + u * 1.4);
      const mat = (m as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && "opacity" in mat) {
        (mat as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - u);
      }
      if (m instanceof THREE.PointLight) {
        m.intensity = Math.max(0, 2.5 * (1 - u));
      }
    }
    if (u >= 1) {
      for (const m of this.combatVfx.meshes) this.fxGroup.remove(m);
      this.combatVfx = null;
    }
  }

  private syncHud(force = false) {
    const now = performance.now();
    if (!force && now - this.lastHud < 80) return;
    this.lastHud = now;
    const zone = (this.cellAt(this.gridX, this.gridZ)?.zone ?? this.map.defaultZone) as Zone;
    useGameStore.getState().setPlayer(this.gridX, this.gridZ, this.facing, zone, !!this.anim);
    useGameStore.getState().setMapMeta(this.map.width, this.map.height, this.map.cells, this.explored);
    useGameStore.getState().clearExpiredCastFx();
  }

  private wireControlsTest() {
    (window as unknown as { __controlsTest?: object }).__controlsTest = {
      getYaw: () => this.yaw,
      getFacing: () => this.facing,
      getSpeed: () => (this.anim ? 1 : 0),
      getPos: () => ({ x: this.gridX, z: this.gridZ }),
      getMapId: () => this.mapId,
      isAnimating: () => !!this.anim,
      setKeys: (codes: string[]) => {
        this.keys.clear();
        for (const c of codes) this.keys.add(c);
      },
      turnLeft: () => this.inputQueue.push("KeyA"),
      turnRight: () => this.inputQueue.push("KeyD"),
      moveForward: () => this.inputQueue.push("KeyW"),
      castSong: (id: "fury" | "watch" | "seeker") => this.castSong(id),
      warp: (mapId: MapId, x: number, z: number) =>
        void this.transitionTo(mapId, x, z, 0, `Warp → ${mapId}`, true),
      startCombatWithNearest: () => {
        const e =
          this.map.enemies.find((en) => en.alive && en.isBoss) ||
          this.map.enemies.find((en) => en.alive);
        if (e) this.beginCombat(e);
      },
      listEnemies: () =>
        this.map.enemies.map((e) => ({
          id: e.id,
          name: e.name,
          alive: e.alive,
          boss: !!e.isBoss,
          x: e.x,
          z: e.z,
        })),
      combatAction: (a: CombatAction, opts?: object) => this.combatAction(a, opts as never),
      inCombat: () => this.inCombat,
      interact: () => this.interact(),
      saveGame: () => this.saveGame(),
      getQuest: () => useGameStore.getState().questStep,
      talk: () => this.talkInnkeeper(),
      getCombat: () => {
        const c = useGameStore.getState().combat;
        return {
          active: c.active,
          phase: c.phase,
          busy: this.combatBusy,
          enemies: c.enemies.map((e) => ({
            name: e.name,
            hp: e.hp,
            alive: e.alive,
            boss: !!e.isBoss,
            stage: e.stage,
          })),
          actor: c.activeActorId,
        };
      },
      /** Test helper: obliterate living combat foes */
      nukeCombat: () => {
        if (!this.inCombat) return;
        const store = useGameStore.getState();
        const enemies = store.combat.enemies.map((e) => {
          if (e.isBoss) {
            return {
              ...e,
              hp: 0,
              alive: false,
              stage: e.maxStages ?? 1,
            };
          }
          return { ...e, hp: 0, alive: false };
        });
        store.setCombat({ enemies, phase: "victory" });
        this.combatBusy = false;
        this.combatGen += 1; // invalidate intro/enemy timers
        this.finishVictory();
      },
    };
  }

  private frame() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const t = now / 1000;

    if (this.running && !this.transitioning && !this.inCombat) {
      this.processInput();
      this.updateAnim(dt);
      const seeker = useGameStore.getState().seekerActive;
      if (seeker !== this.seekerWasOn) this.applySeekerVisuals(seeker);
    }
    if (this.inCombat) {
      this.updateCombatCamera(dt);
      this.updateCombatVfx(dt);
    }
    this.updatePushAnims(dt);
    this.updateLights(t);
    this.syncHud(false);

    if (this.audioBound) {
      gameAudio.updateListener(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
        this.yaw,
      );
    }

    for (const [, mesh] of this.enemyMeshes) {
      mesh.position.y = Math.sin(t * 3 + mesh.position.x) * 0.05;
      mesh.rotation.y = t * 0.35;
    }
    for (const [, mesh] of this.npcMeshes) {
      mesh.rotation.y = Math.sin(t * 0.8) * 0.15;
    }

    // autosave every ~45s while exploring
    if (this.running && !this.inCombat) {
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer > 45) {
        this.autoSaveTimer = 0;
        this.saveGame();
      }
    }

    const g = useGameStore.getState().graphics;
    if (this.postfx) {
      this.postfx.applySettings(g);
      this.postfx.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.postfx?.setSize(w, h);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    gameAudio.stopSong();
    this.postfx?.dispose();
    this.mats.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    delete (window as unknown as { __controlsTest?: object }).__controlsTest;
  }
}
