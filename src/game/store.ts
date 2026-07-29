import { create } from "zustand";
import type {
  BardSongId,
  CastFxKind,
  CombatEnemy,
  CombatState,
  EquipSlot,
  Facing,
  GameHudState,
  GraphicsSettings,
  ItemInstance,
  LogEntry,
  LogTone,
  MapId,
  PartyMember,
  QuestStep,
  StatusEffect,
  Zone,
} from "./types";
import { MAP_NAMES, EMPTY_COMBAT as EMPTY_C, DEFAULT_GRAPHICS } from "./types";
import { gameAudio } from "./audio";
import { starterEquipment, starterInventory, makeItem } from "./items";
import { grantXp, equipBonus } from "./combatLogic";
import { clearSave, hasSave, loadSave, writeSave, type SaveGame } from "./save";

const defaultParty = (): PartyMember[] => {
  const base: Omit<PartyMember, "equipment">[] = [
    {
      id: "p1",
      name: "Aric",
      className: "Warrior",
      hp: 46,
      maxHp: 46,
      sp: 10,
      maxSp: 10,
      level: 1,
      xp: 0,
      agility: 8,
      strength: 14,
      statuses: ["shield"],
      portraitHue: 18,
      portraitSat: 42,
      castFx: null,
    },
    {
      id: "p2",
      name: "Seren",
      className: "Paladin",
      hp: 40,
      maxHp: 40,
      sp: 22,
      maxSp: 22,
      level: 1,
      xp: 0,
      agility: 7,
      strength: 12,
      statuses: ["blessed"],
      portraitHue: 48,
      portraitSat: 36,
      castFx: null,
    },
    {
      id: "p3",
      name: "Thorne",
      className: "Rogue",
      hp: 30,
      maxHp: 32,
      sp: 20,
      maxSp: 22,
      level: 1,
      xp: 0,
      agility: 16,
      strength: 9,
      statuses: ["haste"],
      portraitHue: 140,
      portraitSat: 30,
      castFx: null,
    },
    {
      id: "p4",
      name: "Mira",
      className: "Wizard",
      hp: 24,
      maxHp: 28,
      sp: 38,
      maxSp: 42,
      level: 1,
      xp: 0,
      agility: 10,
      strength: 6,
      statuses: [],
      portraitHue: 210,
      portraitSat: 38,
      castFx: null,
    },
    {
      id: "p5",
      name: "Lirael",
      className: "Bard",
      hp: 28,
      maxHp: 30,
      sp: 34,
      maxSp: 36,
      level: 1,
      xp: 0,
      agility: 12,
      strength: 8,
      statuses: [],
      portraitHue: 300,
      portraitSat: 28,
      castFx: null,
    },
  ];
  return base.map((m) => ({
    ...m,
    equipment: starterEquipment(m.className),
  }));
};

interface GameStore extends GameHudState {
  setStarted: (v: boolean) => void;
  setPlayer: (x: number, z: number, facing: Facing, zone: Zone, isMoving: boolean) => void;
  setMapMeta: (w: number, h: number, cells: GameHudState["cells"], explored: boolean[][]) => void;
  pushLog: (text: string, tone?: LogTone) => void;
  updateParty: (party: PartyMember[]) => void;
  damageParty: (amount: number) => void;
  damageMember: (id: string, amount: number) => void;
  healParty: (amount: number) => void;
  healMember: (id: string, amount: number) => void;
  setMessage: (msg: string | null) => void;
  setAudioReady: (v: boolean) => void;
  setMapId: (id: MapId) => void;
  setTransitioning: (v: boolean) => void;
  castFx: (memberId: string, kind: CastFxKind, label: string) => void;
  clearExpiredCastFx: () => void;
  setSong: (id: BardSongId) => boolean;
  stopSong: () => void;
  spendBardSp: (cost: number) => boolean;
  spendSp: (memberId: string, cost: number) => boolean;
  getAttackMult: () => number;
  getDefenseMult: () => number;
  setCombat: (c: Partial<CombatState> | ((prev: CombatState) => CombatState)) => void;
  endCombat: () => void;
  setInventoryOpen: (v: boolean) => void;
  equipItem: (memberId: string, itemUid: string) => boolean;
  unequipItem: (memberId: string, slot: EquipSlot) => boolean;
  useItem: (itemUid: string, memberId?: string) => boolean;
  addGold: (n: number) => void;
  addItem: (item: ItemInstance) => void;
  removeItem: (uid: string) => void;
  applyVictory: (xp: number, gold: number, loot: ItemInstance | null) => void;
  setQuestStep: (step: QuestStep) => void;
  setHasMedallion: (v: boolean) => void;
  setDungeonUnlocked: (v: boolean) => void;
  grantMedallion: () => void;
  setGraphics: (partial: Partial<GraphicsSettings>) => void;
  setSettingsOpen: (v: boolean) => void;
  setJournalOpen: (v: boolean) => void;
  persist: (payload: Omit<SaveGame, "version" | "savedAt">) => boolean;
  markSaveAvailable: () => void;
  wipeSave: () => void;
  hydrateFromSave: (save: SaveGame) => void;
  reset: () => void;
}

let logSeq = 0;

function songStatus(id: Exclude<BardSongId, null>): StatusEffect {
  if (id === "fury") return "fury";
  if (id === "watch") return "ward";
  return "seeker";
}

function stripSongStatuses(statuses: StatusEffect[]): StatusEffect[] {
  return statuses.filter((s) => s !== "fury" && s !== "ward" && s !== "seeker");
}

export const useGameStore = create<GameStore>((set, get) => ({
  party: defaultParty(),
  log: [
    {
      id: "boot",
      text: "Dawn over Skara Brae. Castle Hargrove looms north; wild roads lead south.",
      tone: "system",
      at: Date.now(),
    },
  ],
  player: { x: 0, z: 0 },
  facing: 0,
  zone: "city",
  mapId: "city",
  mapName: MAP_NAMES.city,
  isMoving: false,
  explored: [],
  mapW: 0,
  mapH: 0,
  cells: [],
  started: false,
  message: null,
  activeSong: null,
  attackMult: 1,
  defenseMult: 1,
  seekerActive: false,
  audioReady: false,
  transitioning: false,
  gold: 40,
  inventory: starterInventory(),
  combat: { ...EMPTY_C },
  inventoryOpen: false,
  questStep: "arrive_tavern",
  hasMedallion: false,
  dungeonUnlocked: false,
  questComplete: false,
  graphics: { ...DEFAULT_GRAPHICS },
  settingsOpen: false,
  journalOpen: false,
  saveAvailable: typeof localStorage !== "undefined" && hasSave(),
  lastSaveAt: null,

  setStarted: (v) => set({ started: v }),

  setPlayer: (x, z, facing, zone, isMoving) =>
    set({ player: { x, z }, facing, zone, isMoving }),

  setMapMeta: (w, h, cells, explored) => set({ mapW: w, mapH: h, cells, explored }),

  setMapId: (id: MapId) => set({ mapId: id, mapName: MAP_NAMES[id] }),

  setTransitioning: (v: boolean) => set({ transitioning: v }),

  pushLog: (text, tone = "info") => {
    const entry: LogEntry = {
      id: `l${++logSeq}`,
      text,
      tone,
      at: Date.now(),
    };
    const log = [...get().log, entry].slice(-48);
    set({ log });
  },

  updateParty: (party) => set({ party }),

  damageParty: (amount) => {
    const def = get().defenseMult;
    const scaled = amount * def;
    const party = get().party.map((m, i) => {
      if (m.hp <= 0) return m;
      if (i !== 0 && Math.random() > 0.55) return m;
      const eq = equipBonus(m);
      const dmg = Math.max(
        1,
        Math.round(scaled * (0.7 + Math.random() * 0.5) - eq.def * 0.4),
      );
      return { ...m, hp: Math.max(0, m.hp - dmg) };
    });
    set({ party });
  },

  damageMember: (id, amount) => {
    set({
      party: get().party.map((m) =>
        m.id === id ? { ...m, hp: Math.max(0, m.hp - amount) } : m,
      ),
    });
  },

  healParty: (amount) => {
    const party = get().party.map((m) => ({
      ...m,
      hp: Math.min(m.maxHp, m.hp + amount),
      sp: Math.min(m.maxSp, m.sp + Math.floor(amount / 2)),
    }));
    set({ party });
  },

  healMember: (id, amount) => {
    set({
      party: get().party.map((m) =>
        m.id === id
          ? {
              ...m,
              hp: Math.min(m.maxHp, m.hp + amount),
            }
          : m,
      ),
    });
  },

  setMessage: (msg) => set({ message: msg }),

  setAudioReady: (v) => set({ audioReady: v }),

  castFx: (memberId, kind, label) => {
    const until = Date.now() + 1400;
    const party = get().party.map((m) =>
      m.id === memberId ? { ...m, castFx: { kind, label, until } } : m,
    );
    set({ party });
  },

  clearExpiredCastFx: () => {
    const now = Date.now();
    const party = get().party;
    if (!party.some((m) => m.castFx && m.castFx.until <= now)) return;
    set({
      party: party.map((m) =>
        m.castFx && m.castFx.until <= now ? { ...m, castFx: null } : m,
      ),
    });
  },

  spendBardSp: (cost) => {
    const party = get().party;
    const bard = party.find((m) => m.className === "Bard");
    if (!bard || bard.sp < cost) return false;
    set({
      party: party.map((m) =>
        m.className === "Bard" ? { ...m, sp: m.sp - cost } : m,
      ),
    });
    return true;
  },

  spendSp: (memberId, cost) => {
    const m = get().party.find((p) => p.id === memberId);
    if (!m || m.sp < cost) return false;
    set({
      party: get().party.map((p) =>
        p.id === memberId ? { ...p, sp: p.sp - cost } : p,
      ),
    });
    return true;
  },

  setSong: (id) => {
    const prev = get().activeSong;
    if (id === null) {
      get().stopSong();
      return true;
    }
    if (prev === id) {
      get().stopSong();
      get().pushLog("The song fades into silence.", "song");
      return true;
    }

    const costs: Record<string, number> = { fury: 6, watch: 6, seeker: 8 };
    const cost = costs[id] ?? 6;
    if (!get().spendBardSp(cost)) {
      get().pushLog("Lirael needs more spirit to perform.", "danger");
      gameAudio.playWallBump();
      return false;
    }

    const st = songStatus(id);
    const party: PartyMember[] = get().party.map((m) => {
      const base = stripSongStatuses(m.statuses);
      return {
        ...m,
        statuses: base.includes(st) ? base : [...base, st],
      };
    });

    const attackMult = id === "fury" ? 1.35 : 1;
    const defenseMult = id === "watch" ? 0.65 : 1;
    const seekerActive = id === "seeker";

    set({ party, activeSong: id, attackMult, defenseMult, seekerActive });
    gameAudio.playSong(id);

    const bard = party.find((m) => m.className === "Bard");
    if (bard) {
      get().castFx(
        bard.id,
        "song",
        id === "fury" ? "Fury" : id === "watch" ? "Watch" : "Seeker",
      );
    }

    if (id === "fury") {
      get().pushLog("Lirael strikes up Falkentyne's Fury — blades sing louder!", "song");
    } else if (id === "watch") {
      get().pushLog("Wayland's Watch settles over the party like a soft shield.", "song");
    } else {
      get().pushLog("Seeker's Ballad shimmers — secrets may show themselves.", "song");
    }

    return true;
  },

  stopSong: () => {
    gameAudio.stopSong();
    const party: PartyMember[] = get().party.map((m) => ({
      ...m,
      statuses: stripSongStatuses(m.statuses),
    }));
    set({
      party,
      activeSong: null,
      attackMult: 1,
      defenseMult: 1,
      seekerActive: false,
    });
  },

  getAttackMult: () => get().attackMult,
  getDefenseMult: () => get().defenseMult,

  setCombat: (c) => {
    const prev = get().combat;
    const next = typeof c === "function" ? c(prev) : { ...prev, ...c };
    set({ combat: next });
  },

  endCombat: () => set({ combat: { ...EMPTY_C } }),

  setInventoryOpen: (v) => set({ inventoryOpen: v }),

  equipItem: (memberId, itemUid) => {
    const inv = get().inventory;
    const item = inv.find((i) => i.uid === itemUid);
    if (!item || !item.slot) return false;
    const slot = item.slot;
    const party = get().party.map((m) => {
      if (m.id !== memberId) return m;
      const prev = m.equipment[slot];
      const equipment = { ...m.equipment, [slot]: item };
      return { ...m, equipment };
    });
    const member = get().party.find((m) => m.id === memberId);
    if (!member) return false;
    const prev = member.equipment[slot];
    let nextInv = inv.filter((i) => i.uid !== itemUid);
    if (prev) nextInv = [...nextInv, prev];
    set({ party, inventory: nextInv });
    get().pushLog(`${member.name} equips ${item.name}.`, "loot");
    gameAudio.playMenuConfirm();
    return true;
  },

  unequipItem: (memberId, slot) => {
    const member = get().party.find((m) => m.id === memberId);
    if (!member) return false;
    const item = member.equipment[slot];
    if (!item) return false;
    const party = get().party.map((m) => {
      if (m.id !== memberId) return m;
      const equipment = { ...m.equipment };
      delete equipment[slot];
      return { ...m, equipment };
    });
    set({ party, inventory: [...get().inventory, item] });
    get().pushLog(`${member.name} removes ${item.name}.`, "info");
    return true;
  },

  useItem: (itemUid, memberId) => {
    const item = get().inventory.find((i) => i.uid === itemUid);
    if (!item || item.type !== "consumable") return false;
    const targetId = memberId ?? get().party.find((p) => p.hp > 0 && p.hp < p.maxHp)?.id ?? get().party[0]?.id;
    if (!targetId) return false;
    if (item.heal) {
      get().healMember(targetId, item.heal);
      get().castFx(targetId, "heal", "Potion");
      get().pushLog(`${item.name} restores ${item.heal} HP.`, "loot");
    } else if (item.mana) {
      set({
        party: get().party.map((m) =>
          m.id === targetId
            ? { ...m, sp: Math.min(m.maxSp, m.sp + (item.mana ?? 0)) }
            : m,
        ),
      });
      get().pushLog(`${item.name} restores spirit.`, "loot");
    } else if (item.defId === "smoke_bomb") {
      get().pushLog("Smoke billows — use Escape for a clean getaway!", "info");
    }
    set({ inventory: get().inventory.filter((i) => i.uid !== itemUid) });
    gameAudio.playMenuConfirm();
    return true;
  },

  addGold: (n) => set({ gold: get().gold + n }),

  addItem: (item) => set({ inventory: [...get().inventory, item] }),

  removeItem: (uid) => set({ inventory: get().inventory.filter((i) => i.uid !== uid) }),

  applyVictory: (xp, gold, loot) => {
    const party = grantXp(get().party, xp);
    set({ party, gold: get().gold + gold });
    if (loot) {
      get().addItem(loot);
      get().pushLog(`Loot found: ${loot.name}!`, "loot");
    }
    get().pushLog(`Victory! +${xp} XP · +${gold} gold`, "loot");
  },

  setQuestStep: (step) =>
    set({ questStep: step, questComplete: step === "complete" }),

  setHasMedallion: (v) => set({ hasMedallion: v }),

  setDungeonUnlocked: (v) => set({ dungeonUnlocked: v }),

  grantMedallion: () => {
    if (get().hasMedallion) return;
    const med = makeItem("eldritch_medallion");
    set({
      hasMedallion: true,
      inventory: [...get().inventory, med],
      questStep: "return_medallion",
    });
    get().pushLog("You seize the Eldritch Medallion! Return it to Innkeeper Brann.", "loot");
  },

  setGraphics: (partial) =>
    set({ graphics: { ...get().graphics, ...partial } }),

  setSettingsOpen: (v) => set({ settingsOpen: v, journalOpen: v ? false : get().journalOpen }),

  setJournalOpen: (v) => set({ journalOpen: v, settingsOpen: v ? false : get().settingsOpen }),

  persist: (payload) => {
    const ok = writeSave({
      version: 1,
      savedAt: Date.now(),
      ...payload,
    });
    if (ok) {
      set({ saveAvailable: true, lastSaveAt: Date.now() });
      get().pushLog("Progress saved.", "system");
    } else {
      get().pushLog("Could not write save data.", "danger");
    }
    return ok;
  },

  markSaveAvailable: () => set({ saveAvailable: hasSave() }),

  wipeSave: () => {
    clearSave();
    set({ saveAvailable: false, lastSaveAt: null });
  },

  hydrateFromSave: (save) => {
    set({
      party: save.party,
      gold: save.gold,
      inventory: save.inventory,
      questStep: save.questStep,
      hasMedallion: save.hasMedallion,
      dungeonUnlocked: save.dungeonUnlocked,
      questComplete: save.questComplete,
      graphics: { ...DEFAULT_GRAPHICS, ...save.graphics },
      activeSong: save.activeSong,
      attackMult: save.attackMult,
      defenseMult: save.defenseMult,
      seekerActive: save.seekerActive,
      mapId: save.mapId,
      mapName: MAP_NAMES[save.mapId],
      zone: save.zone,
      player: save.player,
      facing: save.facing,
      saveAvailable: true,
      lastSaveAt: save.savedAt,
    });
  },

  reset: () => {
    gameAudio.stopSong();
    set({
      party: defaultParty(),
      log: [
        {
          id: `l${++logSeq}`,
          text: "A new expedition begins under pale moonlight.",
          tone: "system",
          at: Date.now(),
        },
      ],
      started: false,
      message: null,
      activeSong: null,
      attackMult: 1,
      defenseMult: 1,
      seekerActive: false,
      mapId: "city",
      mapName: MAP_NAMES.city,
      zone: "city",
      transitioning: false,
      gold: 40,
      inventory: starterInventory(),
      combat: { ...EMPTY_C },
      inventoryOpen: false,
      questStep: "arrive_tavern",
      hasMedallion: false,
      dungeonUnlocked: false,
      questComplete: false,
      graphics: { ...DEFAULT_GRAPHICS },
      settingsOpen: false,
      journalOpen: false,
      lastSaveAt: null,
    });
  },
}));

// re-export for consumers
export type { CombatEnemy };
