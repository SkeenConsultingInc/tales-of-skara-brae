import type {
  ActiveSongSave,
  Facing,
  GraphicsSettings,
  ItemInstance,
  MapId,
  PartyMember,
  QuestStep,
  Zone,
} from "./types";
import { DEFAULT_GRAPHICS } from "./types";

const SAVE_KEY = "tales-of-skara-brae-v1";

export interface PersistedEnemy {
  id: string;
  alive: boolean;
  hp: number;
}

export interface SaveGame {
  version: 1;
  savedAt: number;
  party: PartyMember[];
  gold: number;
  inventory: ItemInstance[];
  questStep: QuestStep;
  hasMedallion: boolean;
  dungeonUnlocked: boolean;
  questComplete: boolean;
  mapId: MapId;
  player: { x: number; z: number };
  facing: Facing;
  zone: Zone;
  explored: Partial<Record<MapId, boolean[][]>>;
  enemies: Partial<Record<MapId, PersistedEnemy[]>>;
  graphics: GraphicsSettings;
  activeSong: ActiveSongSave;
  attackMult: number;
  defenseMult: number;
  seekerActive: boolean;
}

export function defaultGraphics(): GraphicsSettings {
  return { ...DEFAULT_GRAPHICS };
}

export function loadSave(): SaveGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveGame;
    if (!data || data.version !== 1 || !data.party?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveGame): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  return !!loadSave();
}
