import type { Cell, CellKind, EnemyDef, Facing, MapId, Zone } from "../types";
import { archetypeForName, ARCHETYPE_STATS } from "../combatLogic";
import { MAP_NAMES } from "../types";

/**
 * Shared legend (all maps):
 * # wall / B timber building   * torch wall   L lantern wall
 * . stone floor   , moss   M marble   c carpet   W wood
 * ~ grass   = path/cobble   T tree   R river   U ruins
 * D door   G gate   I iron cell door   V grate
 * S stairs/portal (uses portal overlay)   K trapdoor
 * C chest   E enemy   F fountain   H tavern tile
 * X secret wall (Seeker)   P push wall (animates open)
 * O teleporter   N rune floor   A banner post
 * @ player default start on that map
 */

export interface PortalLink {
  x: number;
  z: number;
  toMap: MapId;
  toX: number;
  toZ: number;
  toFacing?: Facing;
  label: string;
  /** If true, cell is walkable portal tile; else interact/step on special kind */
  walkable?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  defaultZone: Zone;
  raw: string[];
  portals: PortalLink[];
  enemyNames?: string[];
}

export interface BuiltMap {
  id: MapId;
  name: string;
  width: number;
  height: number;
  cells: Cell[][];
  start: { x: number; z: number; facing: Facing };
  enemies: EnemyDef[];
  fountains: { x: number; z: number }[];
  hearths: { x: number; z: number }[];
  secrets: { x: number; z: number }[];
  pushWalls: { x: number; z: number }[];
  teleporters: { x: number; z: number }[];
  lanterns: { x: number; z: number }[];
  defaultZone: Zone;
}

// ─── Map definitions ─────────────────────────────────────────────────

const CITY: MapDef = {
  id: "city",
  name: MAP_NAMES.city,
  defaultZone: "city",
  enemyNames: ["Street Cutpurse", "Drunk Guard"],
  portals: [
    // South gate to wilderness
    { x: 12, z: 22, toMap: "wilderness", toX: 9, toZ: 2, toFacing: 2, label: "South Gate → Outer Wilds" },
    // North castle gates
    { x: 10, z: 2, toMap: "castle", toX: 8, toZ: 14, toFacing: 0, label: "Castle Hargrove Gates" },
    { x: 11, z: 2, toMap: "castle", toX: 9, toZ: 14, toFacing: 0, label: "Castle Hargrove Gates" },
  ],
  raw: [
    // 0................1.........2...
    // 0123456789012345678901234567
    "############################", // 0
    "####BBBB##GG##BBBB##########", // 1  castle wall + gates
    "####B..B##..##B..B##########", // 2
    "####B..B======B..B####BBBB##", // 3
    "####BBBB======BBBB####B..B##", // 4
    "########======########B..B##", // 5
    "###BBBB#======#BBBB###BBBB##", // 6
    "###B..B#======#B..B#########", // 7
    "###B..B========B..B##BBBB###", // 8
    "###BBBB========BBBB##BYHB###", // 9  Scarlet Bard + innkeeper Y
    "########========#####BHBH###", // 10
    "###BBBB#========#BBBB#HHHH##", // 11
    "###B..B#========#B..B#B@HB##", // 12  start inside tavern
    "###B..B#========#B..B#BBBB##", // 13
    "###BBBB#========#BBBB#######", // 14
    "########========####BBBB####", // 15
    "###BBBB#========####B..B####", // 16
    "###B..B#========####B..B####", // 17
    "###B..B#========####BBBB####", // 18
    "###BBBB#========############", // 19
    "########========####BBBB####", // 20
    "########========####B..B####", // 21
    "########====D===####B..B####", // 22  south door/gate
    "####################BBBB####", // 23
    "############################", // 24
  ],
};

const WILDERNESS: MapDef = {
  id: "wilderness",
  name: MAP_NAMES.wilderness,
  defaultZone: "wilderness",
  enemyNames: ["Forest Wolf", "Bandit Scout", "Moss Troll"],
  portals: [
    // North to city
    { x: 9, z: 1, toMap: "city", toX: 12, toZ: 21, toFacing: 0, label: "Road to Skara Brae" },
    // Trapdoor to crypt
    { x: 17, z: 16, toMap: "crypt", toX: 6, toZ: 5, toFacing: 2, label: "Moss-covered trapdoor → Forgotten Crypt" },
    // Ruined arch near castle approach (east)
    { x: 22, z: 8, toMap: "castle", toX: 2, toZ: 8, toFacing: 1, label: "Overgrown postern → Castle grounds" },
  ],
  raw: [
    "TTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T~~~~~~==@~~~~~~~~~~~~~~~T",
    "T~~~~~====~~~~~~~~~~~~~~~T",
    "T~~~~==~~==~~~~TTTT~~~~~~T",
    "T~~~==~~~~==~~TUUUUT~~~~~T",
    "T~~==~~~~~~==TUUUUUUT~~~~T",
    "T~==~~~RRR~~=U.....U=~~~~T",
    "T==~~~~RRR~~~U..E..U=~~~~T",
    "T=~~~~~RRR~~~~U....U=====T",
    "T=~~~~~~R~~~~~~UUUUT~~~~=T",
    "T=~~~~~~~~~~~~~~~~~~~~~==T",
    "T=~~~~TTTT~~~~~~~~~~~~~~=T",
    "T=~~~T~~~~T~~~~TTTT~~~~~=T",
    "T=~~T~~~~~~T~~T~~~~T~~~~=T",
    "T=~~T~~E~~~T~~T~~~~T~~~~=T",
    "T=~~T~~~~~~T~~T~~~~T~~~~=T",
    "T=~~~T~~~~T~~~T..K.T~~~~=T",
    "T=~~~~TTTT~~~~~TTT~~~~~~=T",
    "T=~~~~~~~~~~~~~~~~~~~~~~=T",
    "T=~~~~~C~~~~~~~~~~E~~~~~=T",
    "T==~~~~~~~~~~~~~~~~~~~~==T",
    "T~==~~~~~~~~~~~~~~~~==~~~T",
    "T~~==================~~~~T",
    "T~~~~~~~~~~~~~~~~~~~~~~~~T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTT",
  ],
};

const CASTLE: MapDef = {
  id: "castle",
  name: MAP_NAMES.castle,
  defaultZone: "castle",
  enemyNames: ["Castle Guard", "Hound of Hargrove"],
  portals: [
    // South exit to city gates
    { x: 8, z: 15, toMap: "city", toX: 11, toZ: 3, toFacing: 2, label: "Exit to Skara Brae" },
    { x: 9, z: 15, toMap: "city", toX: 12, toZ: 3, toFacing: 2, label: "Exit to Skara Brae" },
    // West postern to wilderness
    { x: 1, z: 8, toMap: "wilderness", toX: 21, toZ: 8, toFacing: 3, label: "Postern to Outer Wilds" },
    // Stairs down to dungeon
    { x: 8, z: 3, toMap: "dungeon", toX: 8, toZ: 12, toFacing: 0, label: "Stairs into the dungeons" },
  ],
  raw: [
    "##################", // 0
    "###*...A.....*####", // 1
    "###..ccccccc..####", // 2
    "###..cccSccc..*###", // 3  S stairs down
    "###..ccccccc..####", // 4
    "###..cccAccc..####", // 5
    "###*..ccccc...*###", // 6
    "###....###....####", // 7
    "#......###......##", // 8  west postern corridor
    "###....###....*###", // 9
    "###..ccccccc..####", // 10
    "###..ccccccc..####", // 11
    "###*..c...c...*###", // 12
    "###....E.E....####", // 13
    "###..ccccccc..####", // 14
    "###....D.D....####", // 15  south doors to city
    "##################", // 16
  ],
};

const DUNGEON: MapDef = {
  id: "dungeon",
  name: MAP_NAMES.dungeon,
  defaultZone: "dungeon",
  enemyNames: ["Dungeon Wight", "Chained Ghoul", "Jailer"],
  portals: [
    // Stairs up to castle
    { x: 8, z: 13, toMap: "castle", toX: 9, toZ: 4, toFacing: 2, label: "Stairs up to Castle Hargrove" },
    // Teleporter to crypt
    { x: 14, z: 3, toMap: "crypt", toX: 6, toZ: 10, toFacing: 0, label: "Blue teleporter → Forgotten Crypt" },
    // Teleporter back from side room
    { x: 3, z: 2, toMap: "crypt", toX: 3, toZ: 3, toFacing: 1, label: "Faint teleporter shimmer" },
  ],
  raw: [
    "################", // 0
    "#*I..I#....#*..#", // 1
    "#I...I#..O.#...#", // 2
    "#I.E.I#....#..O#", // 3
    "#I...I##P###...#", // 4
    "#IIII#.....#.C.#", // 5
    "#....#..E..#...#", // 6
    "#*...V.....V..*#", // 7
    "#....#.....#...#", // 8
    "#.C..###P###...#", // 9
    "#....#.....#.Z.#", // 10  Z = Dungeon Warden
    "#*...#..X..#..*#", // 11
    "#....#.....#...#", // 12
    "#....D..S..D...#", // 13
    "################", // 14
  ],
};

const CRYPT: MapDef = {
  id: "crypt",
  name: MAP_NAMES.crypt,
  defaultZone: "crypt",
  enemyNames: ["Crypt Skeleton", "Bone Warden", "Shade"],
  portals: [
    // Trapdoor exit up to wilderness
    { x: 6, z: 4, toMap: "wilderness", toX: 18, toZ: 15, toFacing: 0, label: "Trapdoor up to Outer Wilds" },
    // Teleporter to dungeon locked until quest — still present
    { x: 6, z: 10, toMap: "dungeon", toX: 14, toZ: 3, toFacing: 2, label: "Blue teleporter → Hargrove Dungeon" },
    { x: 3, z: 3, toMap: "dungeon", toX: 3, toZ: 2, toFacing: 2, label: "Faint teleporter shimmer" },
  ],
  raw: [
    "##############", // 0
    "#*NN..NN..NN*#", // 1
    "#N..........N#", // 2
    "#N.O....E...N#", // 3
    "#N....K.....N#", // 4
    "#N..........N#", // 5
    "#NN..##..##NN#", // 6
    "#....#E..#...#", // 7
    "#*...#...#..*#", // 8
    "#....#####...#", // 9
    "#N....O.....N#", // 10
    "#N..Z....C..N#", // 11  Z = Cultist Leader boss
    "#*NN..NN..NN*#", // 12
    "##############", // 13
  ],
};

export const ALL_MAP_DEFS: Record<MapId, MapDef> = {
  city: CITY,
  wilderness: WILDERNESS,
  castle: CASTLE,
  dungeon: DUNGEON,
  crypt: CRYPT,
};

// ─── Parser ──────────────────────────────────────────────────────────

function kindFromChar(ch: string): {
  kind: CellKind;
  solid: boolean;
  hasTorch?: boolean;
  hasLantern?: boolean;
  enemy?: boolean;
  secret?: boolean;
  pushWall?: boolean;
} {
  switch (ch) {
    case "#":
      return { kind: "wall", solid: true };
    case "B":
      return { kind: "building", solid: true };
    case "*":
      return { kind: "wall", solid: true, hasTorch: true };
    case "L":
      return { kind: "lantern", solid: true, hasLantern: true };
    case "X":
      return { kind: "secret", solid: true, secret: true };
    case "P":
      return { kind: "push_wall", solid: true, pushWall: true };
    case "T":
      return { kind: "tree", solid: true };
    case ".":
      return { kind: "floor", solid: false };
    case ",":
      return { kind: "moss", solid: false };
    case "M":
      return { kind: "marble", solid: false };
    case "c":
      return { kind: "carpet", solid: false };
    case "W":
      return { kind: "wood", solid: false };
    case "H":
      return { kind: "tavern", solid: false };
    case "F":
      return { kind: "fountain", solid: false };
    case "~":
      return { kind: "grass", solid: false };
    case "=":
      return { kind: "cobble", solid: false };
    case "R":
      return { kind: "river", solid: true };
    case "U":
      return { kind: "ruins", solid: true };
    case "D":
      return { kind: "door", solid: false };
    case "G":
      return { kind: "gate", solid: false };
    case "I":
      return { kind: "cell_door", solid: true };
    case "V":
      return { kind: "grate", solid: false };
    case "S":
      return { kind: "stairs", solid: false };
    case "K":
      return { kind: "trapdoor", solid: false };
    case "O":
      return { kind: "teleporter", solid: false };
    case "N":
      return { kind: "rune", solid: false };
    case "A":
      return { kind: "banner", solid: false };
    case "C":
      return { kind: "chest", solid: false };
    case "E":
      return { kind: "enemy", solid: false, enemy: true };
    case "Z":
      return { kind: "enemy", solid: false, enemy: true };
    case "Y":
      return { kind: "npc", solid: false };
    case "@":
      return { kind: "tavern", solid: false };
    default:
      return { kind: "wall", solid: true };
  }
}

function zoneForKind(kind: CellKind, defaultZone: Zone): Zone {
  if (kind === "tavern" || kind === "wood" || kind === "npc") return "tavern";
  if (kind === "grass" || kind === "path" || kind === "tree" || kind === "river" || kind === "ruins")
    return "wilderness";
  if (kind === "cobble" || kind === "building" || kind === "lantern" || kind === "gate") return "city";
  if (kind === "carpet" || kind === "banner") return "castle";
  if (kind === "rune") return "crypt";
  if (kind === "cell_door" || kind === "grate" || kind === "push_wall" || kind === "teleporter")
    return defaultZone === "crypt" ? "crypt" : "dungeon";
  return defaultZone;
}

export function buildMap(id: MapId, enemyIdPrefix = ""): BuiltMap {
  const def = ALL_MAP_DEFS[id];
  const height = def.raw.length;
  const width = Math.max(...def.raw.map((r) => r.length));
  const cells: Cell[][] = [];
  const enemies: EnemyDef[] = [];
  const fountains: { x: number; z: number }[] = [];
  const secrets: { x: number; z: number }[] = [];
  const pushWalls: { x: number; z: number }[] = [];
  const teleporters: { x: number; z: number }[] = [];
  const lanterns: { x: number; z: number }[] = [];
  let start = { x: 2, z: 2, facing: 0 as Facing };
  let enemyIdx = 0;
  const names = def.enemyNames ?? ["Foe"];

  for (let z = 0; z < height; z++) {
    const row: Cell[] = [];
    const line = def.raw[z]!.padEnd(width, "#");
    for (let x = 0; x < width; x++) {
      const ch = line[x] ?? "#";
      const parsed = kindFromChar(ch);
      if (ch === "@") start = { x, z, facing: 0 };

      let enemyId: string | undefined;
      if (parsed.enemy) {
        enemyId = `${enemyIdPrefix}${id}-e${enemyIdx}`;
        {
          const isBoss = ch === "Z";
          let ename = names[enemyIdx % names.length]!;
          let arch = archetypeForName(ename, id);
          let bossId: string | undefined;
          let maxStages: number | undefined;
          if (isBoss && id === "crypt") {
            ename = "Cultist Leader";
            arch = "cultist_leader";
            bossId = "cultist_leader";
            maxStages = 3;
          } else if (isBoss && id === "dungeon") {
            ename = "Dungeon Warden";
            arch = "dungeon_warden";
            bossId = "dungeon_warden";
            maxStages = 2;
          } else if (isBoss) {
            ename = "Elite Foe";
            bossId = `boss-${id}`;
            maxStages = 2;
          }
          const st = ARCHETYPE_STATS[arch];
          const bonus = enemyIdx * 3 + (id === "crypt" ? 4 : 0) + (isBoss ? 8 : 0);
          enemies.push({
            id: enemyId,
            name: isBoss ? ename : ename.includes("Skeleton") || ename.includes("Bone") ? st.name : ename,
            hp: st.hp + bonus,
            maxHp: st.hp + bonus,
            damage: st.damage + Math.floor(enemyIdx / 2) + (isBoss ? 2 : 0),
            x,
            z,
            alive: true,
            agility: st.agility,
            archetype: arch,
            xpReward: st.xp + enemyIdx * 2 + (isBoss ? 40 : 0),
            goldReward: st.gold + enemyIdx + (isBoss ? 30 : 0),
            isBoss,
            bossId,
            maxStages,
          });
        }
        enemyIdx++;
      }

      if (ch === "F") fountains.push({ x, z });
      if (parsed.secret) secrets.push({ x, z });
      if (parsed.pushWall) pushWalls.push({ x, z });
      if (ch === "O") teleporters.push({ x, z });
      if (parsed.hasLantern) lanterns.push({ x, z });

      let kind: CellKind = parsed.kind;
      if (ch === "C") kind = "chest";
      if (ch === "E") kind = "enemy";

      row.push({
        kind,
        solid: parsed.solid,
        zone: zoneForKind(kind === "enemy" || kind === "chest" ? "floor" : kind, def.defaultZone),
        hasTorch: parsed.hasTorch,
        hasLantern: parsed.hasLantern,
        explored: false,
        visible: false,
        enemyId,
        lootTaken: false,
        secret: parsed.secret,
        secretRevealed: false,
        pushWall: parsed.pushWall,
        pushOpen: false,
      });
    }
    cells.push(row);
  }

  // Apply portal overlays
  for (const p of def.portals) {
    const cell = cells[p.z]?.[p.x];
    if (!cell) continue;
    cell.portalTo = p.toMap;
    cell.portalX = p.toX;
    cell.portalZ = p.toZ;
    cell.portalFacing = p.toFacing ?? 0;
    cell.portalLabel = p.label;
    // ensure portal tiles walkable unless solid building
    if (cell.kind === "gate" || cell.kind === "stairs" || cell.kind === "trapdoor" || cell.kind === "teleporter" || cell.kind === "door") {
      cell.solid = false;
    }
  }

  // Tavern hearths: center of H tiles
  let hx = 0,
    hz = 0,
    hn = 0;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (cells[z]![x]!.kind === "tavern") {
        hx += x;
        hz += z;
        hn++;
        cells[z]![x]!.zone = "tavern";
      }
    }
  }
  const hearths = hn > 0 ? [{ x: Math.round(hx / hn), z: Math.round(hz / hn) }] : [];

  // Zone refine for walls adjacent to outdoor
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const c = cells[z]![x]!;
      if (c.kind === "building") c.zone = "city";
      if (c.kind === "cobble") c.zone = c.zone === "tavern" ? "tavern" : "city";
      if (c.kind === "river" || c.kind === "ruins" || c.kind === "tree") c.zone = "wilderness";
      if (c.kind === "carpet" || c.kind === "banner") c.zone = "castle";
      if (c.kind === "rune") c.zone = "crypt";
    }
  }

  return {
    id: def.id,
    name: def.name,
    width,
    height,
    cells,
    start,
    enemies,
    fountains,
    hearths,
    secrets,
    pushWalls,
    teleporters,
    lanterns,
    defaultZone: def.defaultZone,
  };
}

export const TILE = 4;

/** Keep explored state across visits */
export type ExploredCache = Partial<Record<MapId, boolean[][]>>;

export function emptyExplored(map: BuiltMap): boolean[][] {
  return Array.from({ length: map.height }, () => Array.from({ length: map.width }, () => false));
}
