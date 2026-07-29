import type {
  CombatAction,
  CombatEnemy,
  CombatParticipant,
  EnemyArchetype,
  PartyMember,
  TurnEntry,
} from "./types";
import { rollLoot } from "./items";
import type { ItemInstance } from "./types";

export const ARCHETYPE_STATS: Record<
  EnemyArchetype,
  {
    name: string;
    hp: number;
    damage: number;
    agility: number;
    xp: number;
    gold: number;
    color: number;
  }
> = {
  skeleton_knight: {
    name: "Skeleton Knight",
    hp: 28,
    damage: 7,
    agility: 8,
    xp: 22,
    gold: 14,
    color: 0xd0c8b8,
  },
  forest_warg: {
    name: "Forest Warg",
    hp: 22,
    damage: 8,
    agility: 14,
    xp: 18,
    gold: 8,
    color: 0x4a3a2a,
  },
  shadow_cultist: {
    name: "Shadow Cultist",
    hp: 20,
    damage: 6,
    agility: 11,
    xp: 20,
    gold: 16,
    color: 0x3a2a4a,
  },
  dungeon_wight: {
    name: "Dungeon Wight",
    hp: 26,
    damage: 7,
    agility: 9,
    xp: 19,
    gold: 12,
    color: 0x5a6a5a,
  },
  bone_warden: {
    name: "Bone Warden",
    hp: 34,
    damage: 9,
    agility: 7,
    xp: 28,
    gold: 20,
    color: 0xe8e0d0,
  },
  cultist_leader: {
    name: "Cultist Leader",
    hp: 36,
    damage: 9,
    agility: 12,
    xp: 80,
    gold: 60,
    color: 0x5a2080,
  },
  dungeon_warden: {
    name: "Dungeon Warden",
    hp: 48,
    damage: 11,
    agility: 9,
    xp: 120,
    gold: 100,
    color: 0x8a3030,
  },
};

export function archetypeForName(name: string, mapDefault?: string): EnemyArchetype {
  const n = name.toLowerCase();
  if (n.includes("wolf") || n.includes("warg") || n.includes("bandit")) return "forest_warg";
  if (n.includes("skeleton") || n.includes("bone")) return "skeleton_knight";
  if (n.includes("cult") || n.includes("shade") || n.includes("cutpurse")) return "shadow_cultist";
  if (n.includes("cultist leader") || n.includes("high cultist")) return "cultist_leader";
  if (n.includes("dungeon warden") || n.includes("the warden")) return "dungeon_warden";
  if (n.includes("warden") || n.includes("jailer")) return "bone_warden";
  if (mapDefault === "crypt") return "skeleton_knight";
  if (mapDefault === "wilderness") return "forest_warg";
  if (mapDefault === "city") return "shadow_cultist";
  return "dungeon_wight";
}

export function equipBonus(m: PartyMember): { atk: number; def: number; agi: number } {
  let atk = 0,
    def = 0,
    agi = 0;
  for (const slot of ["weapon", "armor", "shield", "accessory"] as const) {
    const it = m.equipment[slot];
    if (!it) continue;
    atk += it.atk ?? 0;
    def += it.def ?? 0;
    agi += it.agi ?? 0;
  }
  return { atk, def, agi };
}

export function effectiveAgi(m: PartyMember): number {
  const base = m.agility + equipBonus(m).agi;
  return m.statuses.includes("haste") ? base + 4 : base;
}

export function buildTurnOrder(
  party: PartyMember[],
  enemies: CombatEnemy[],
): TurnEntry[] {
  const parts: CombatParticipant[] = [
    ...party
      .filter((p) => p.hp > 0)
      .map((p) => ({
        kind: "party" as const,
        id: p.id,
        name: p.name,
        agility: effectiveAgi(p),
      })),
    ...enemies
      .filter((e) => e.alive)
      .map((e) => ({
        kind: "enemy" as const,
        id: e.id,
        name: e.name,
        agility: e.agility,
      })),
  ];
  parts.sort((a, b) => b.agility - a.agility || a.name.localeCompare(b.name));
  return parts.map((p) => ({ kind: p.kind, id: p.id }));
}

export function xpToLevel(level: number): number {
  return 40 + level * 28;
}

export function grantXp(party: PartyMember[], totalXp: number): PartyMember[] {
  const alive = party.filter((p) => p.hp > 0);
  if (alive.length === 0) return party;
  const share = Math.max(1, Math.floor(totalXp / alive.length));
  return party.map((p) => {
    if (p.hp <= 0) return p;
    let xp = p.xp + share;
    let level = p.level;
    let maxHp = p.maxHp;
    let maxSp = p.maxSp;
    let agility = p.agility;
    let strength = p.strength;
    let hp = p.hp;
    let sp = p.sp;
    let need = xpToLevel(level);
    while (xp >= need && level < 20) {
      xp -= need;
      level += 1;
      maxHp += 4;
      maxSp += 2;
      agility += 1;
      strength += 1;
      hp = maxHp;
      sp = Math.min(maxSp, sp + 4);
      need = xpToLevel(level);
    }
    return { ...p, xp, level, maxHp, maxSp, agility, strength, hp, sp };
  });
}

export function calcPlayerAttack(
  actor: PartyMember,
  target: CombatEnemy,
  attackMult: number,
): { damage: number; crit: boolean } {
  const eq = equipBonus(actor);
  const base =
    6 +
    Math.floor(actor.strength * 0.6) +
    eq.atk +
    (actor.className === "Rogue" ? 2 : 0) +
    (actor.className === "Warrior" ? 3 : 0);
  const variance = Math.floor(Math.random() * 5);
  const crit = Math.random() < 0.12 + effectiveAgi(actor) * 0.005;
  let damage = Math.round((base + variance) * attackMult * (crit ? 1.6 : 1));
  damage = Math.max(1, damage - Math.floor(target.damage * 0.05));
  return { damage, crit };
}

export function calcSpellDamage(
  actor: PartyMember,
  attackMult: number,
): { damage: number; cost: number; label: string } {
  if (actor.className === "Wizard") {
    return {
      damage: Math.round((12 + actor.level * 2 + Math.random() * 6) * attackMult),
      cost: 8,
      label: "Dragon Breath",
    };
  }
  if (actor.className === "Paladin") {
    return {
      damage: Math.round((8 + actor.level + Math.random() * 4) * attackMult),
      cost: 6,
      label: "Holy Smite",
    };
  }
  if (actor.className === "Bard") {
    return {
      damage: Math.round((7 + actor.level + Math.random() * 3) * attackMult),
      cost: 5,
      label: "Sonic Bolt",
    };
  }
  return {
    damage: Math.round((6 + actor.level + Math.random() * 3) * attackMult),
    cost: 4,
    label: "Focus Strike",
  };
}

export function calcEnemyDamage(
  enemy: CombatEnemy,
  target: PartyMember,
  defenseMult: number,
  defending: boolean,
): number {
  const eq = equipBonus(target);
  const raw = enemy.damage + Math.floor(Math.random() * 4);
  let dmg = raw * defenseMult - eq.def * 0.5;
  if (target.statuses.includes("shield")) dmg *= 0.85;
  if (target.statuses.includes("ward")) dmg *= 0.8;
  if (defending) dmg *= 0.45;
  if (target.className === "Paladin") dmg *= 0.9;
  return Math.max(1, Math.round(dmg));
}

export function victoryRewards(enemies: CombatEnemy[]): {
  xp: number;
  gold: number;
  loot: ItemInstance | null;
} {
  let xp = 0;
  let gold = 0;
  for (const e of enemies) {
    xp += e.xpReward;
    gold += e.goldReward + Math.floor(Math.random() * 4);
  }
  return { xp, gold, loot: rollLoot() };
}

export function escapeChance(party: PartyMember[], enemies: CombatEnemy[]): number {
  const avgAgi =
    party.filter((p) => p.hp > 0).reduce((s, p) => s + effectiveAgi(p), 0) /
    Math.max(1, party.filter((p) => p.hp > 0).length);
  const avgEnemy =
    enemies.filter((e) => e.alive).reduce((s, e) => s + e.agility, 0) /
    Math.max(1, enemies.filter((e) => e.alive).length);
  return Math.min(0.85, Math.max(0.2, 0.45 + (avgAgi - avgEnemy) * 0.03));
}

export type CombatActionResult =
  | { ok: true; log: string; tone?: "combat" | "loot" | "danger" | "song" | "info" }
  | { ok: false; reason: string };

export function actionNeedsTarget(action: CombatAction): boolean {
  return action === "attack" || action === "spell";
}
