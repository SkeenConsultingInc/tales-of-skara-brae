export type CellKind =
  | "wall"
  | "floor"
  | "moss"
  | "marble"
  | "grass"
  | "path"
  | "tree"
  | "door"
  | "stairs"
  | "chest"
  | "enemy"
  | "torch"
  | "fountain"
  | "tavern"
  | "wood"
  | "secret"
  | "cobble"
  | "building"
  | "lantern"
  | "river"
  | "ruins"
  | "trapdoor"
  | "carpet"
  | "grate"
  | "cell_door"
  | "push_wall"
  | "teleporter"
  | "rune"
  | "gate"
  | "banner"
  | "npc";

export type Zone =
  | "dungeon"
  | "wilderness"
  | "tavern"
  | "city"
  | "castle"
  | "crypt";

export type MapId = "city" | "wilderness" | "castle" | "dungeon" | "crypt";

export interface Cell {
  kind: CellKind;
  solid: boolean;
  zone: Zone;
  hasTorch?: boolean;
  hasLantern?: boolean;
  explored?: boolean;
  visible?: boolean;
  enemyId?: string;
  lootTaken?: boolean;
  secret?: boolean;
  secretRevealed?: boolean;
  pushWall?: boolean;
  pushOpen?: boolean;
  portalTo?: MapId;
  portalX?: number;
  portalZ?: number;
  portalFacing?: Facing;
  portalLabel?: string;
}

export type Facing = 0 | 1 | 2 | 3;

export interface GridPos {
  x: number;
  z: number;
}

export type StatusEffect =
  | "poison"
  | "blessed"
  | "shield"
  | "haste"
  | "fury"
  | "ward"
  | "seeker"
  | "defend";

export type PartyClass = "Warrior" | "Paladin" | "Rogue" | "Wizard" | "Bard";

export type EquipSlot = "weapon" | "armor" | "shield" | "accessory";

export type ItemType = "weapon" | "armor" | "shield" | "accessory" | "consumable";

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  slot?: EquipSlot;
  atk?: number;
  def?: number;
  agi?: number;
  heal?: number;
  mana?: number;
  description: string;
}

export interface ItemInstance {
  uid: string;
  defId: string;
  name: string;
  type: ItemType;
  slot?: EquipSlot;
  atk?: number;
  def?: number;
  agi?: number;
  heal?: number;
  mana?: number;
  description: string;
}

export interface PartyMember {
  id: string;
  name: string;
  className: PartyClass;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  level: number;
  xp: number;
  agility: number;
  strength: number;
  statuses: StatusEffect[];
  portraitHue: number;
  portraitSat: number;
  castFx: CastFx | null;
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
}

export type CastFxKind = "buff" | "heal" | "attack" | "song" | "spell";

export interface CastFx {
  kind: CastFxKind;
  label: string;
  until: number;
}

export type BardSongId = "fury" | "watch" | "seeker" | null;

export interface BardSongDef {
  id: Exclude<BardSongId, null>;
  name: string;
  shortName: string;
  description: string;
  spCost: number;
  key: string;
}

export type LogTone = "info" | "combat" | "loot" | "system" | "danger" | "song";

export interface LogEntry {
  id: string;
  text: string;
  tone: LogTone;
  at: number;
}

export type EnemyArchetype =
  | "skeleton_knight"
  | "forest_warg"
  | "shadow_cultist"
  | "dungeon_wight"
  | "bone_warden"
  | "cultist_leader"
  | "dungeon_warden";

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  x: number;
  z: number;
  alive: boolean;
  agility: number;
  archetype: EnemyArchetype;
  xpReward: number;
  goldReward: number;
  isBoss?: boolean;
  bossId?: string;
  maxStages?: number;
}

export interface CombatEnemy {
  id: string;
  mapEnemyId: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  agility: number;
  archetype: EnemyArchetype;
  xpReward: number;
  goldReward: number;
  alive: boolean;
  isBoss?: boolean;
  bossId?: string;
  stage?: number;
  maxStages?: number;
}

export interface CombatParticipant {
  kind: "party" | "enemy";
  id: string;
  name: string;
  agility: number;
}

export interface TurnEntry {
  kind: "party" | "enemy";
  id: string;
}

export type CombatAction =
  | "attack"
  | "spell"
  | "song"
  | "defend"
  | "item"
  | "escape";

export type CombatPhase =
  | "idle"
  | "intro"
  | "select"
  | "animating"
  | "enemy"
  | "victory"
  | "defeat"
  | "escaped";

export type CombatVfxKind = "slash" | "fireball" | "shield" | "heal" | "song" | "hit" | "none";

export interface CombatState {
  active: boolean;
  phase: CombatPhase;
  enemies: CombatEnemy[];
  turnQueue: TurnEntry[];
  turnIndex: number;
  selectedEnemyId: string | null;
  activeActorId: string | null;
  defendingIds: string[];
  vfx: { kind: CombatVfxKind; label: string; until: number } | null;
  rewardSummary: string | null;
  subMenu: null | "song" | "item";
}

export type FootSurface =
  | "stone"
  | "wood"
  | "mud"
  | "grass"
  | "marble"
  | "cobble"
  | "carpet";

export type QuestStep =
  | "arrive_tavern"
  | "seek_crypt"
  | "slay_cultist"
  | "return_medallion"
  | "storm_dungeon"
  | "complete";

export interface GraphicsSettings {
  bloom: boolean;
  depthOfField: boolean;
  ambientOcclusion: boolean;
  dynamicLights: boolean;
}

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  bloom: true,
  depthOfField: false,
  ambientOcclusion: true,
  dynamicLights: true,
};

export type ActiveSongSave = BardSongId;

export interface GameHudState {
  party: PartyMember[];
  log: LogEntry[];
  player: GridPos;
  facing: Facing;
  zone: Zone;
  mapId: MapId;
  mapName: string;
  isMoving: boolean;
  explored: boolean[][];
  mapW: number;
  mapH: number;
  cells: Cell[][];
  started: boolean;
  message: string | null;
  activeSong: BardSongId;
  attackMult: number;
  defenseMult: number;
  seekerActive: boolean;
  audioReady: boolean;
  transitioning: boolean;
  gold: number;
  inventory: ItemInstance[];
  combat: CombatState;
  inventoryOpen: boolean;
  questStep: QuestStep;
  hasMedallion: boolean;
  dungeonUnlocked: boolean;
  questComplete: boolean;
  graphics: GraphicsSettings;
  settingsOpen: boolean;
  journalOpen: boolean;
  saveAvailable: boolean;
  lastSaveAt: number | null;
}

export const BARD_SONGS: BardSongDef[] = [
  {
    id: "fury",
    name: "Falkentyne's Fury",
    shortName: "Fury",
    description: "Upbeat combat cadence. Party attack power rises.",
    spCost: 6,
    key: "1",
  },
  {
    id: "watch",
    name: "Wayland's Watch",
    shortName: "Watch",
    description: "Calm ward melody. Incoming damage is reduced.",
    spCost: 6,
    key: "2",
  },
  {
    id: "seeker",
    name: "Seeker's Ballad",
    shortName: "Seeker",
    description: "Chime melody reveals hidden walls and secret doors.",
    spCost: 8,
    key: "3",
  },
];

export const MAP_NAMES: Record<MapId, string> = {
  city: "Skara Brae",
  wilderness: "Outer Wilds",
  castle: "Castle Hargrove",
  dungeon: "Hargrove Dungeon",
  crypt: "Forgotten Crypt",
};

export const EMPTY_COMBAT: CombatState = {
  active: false,
  phase: "idle",
  enemies: [],
  turnQueue: [],
  turnIndex: 0,
  selectedEnemyId: null,
  activeActorId: null,
  defendingIds: [],
  vfx: null,
  rewardSummary: null,
  subMenu: null,
};
