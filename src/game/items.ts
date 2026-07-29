import type { EquipSlot, ItemDef, ItemInstance, PartyClass } from "./types";

export const ITEM_CATALOG: Record<string, ItemDef> = {
  iron_sword: {
    id: "iron_sword",
    name: "Iron Longsword",
    type: "weapon",
    slot: "weapon",
    atk: 4,
    description: "Reliable steel for front-line work.",
  },
  steel_blade: {
    id: "steel_blade",
    name: "Steel Blade",
    type: "weapon",
    slot: "weapon",
    atk: 7,
    description: "Well-balanced blade of Hargrove forge.",
  },
  rogue_daggers: {
    id: "rogue_daggers",
    name: "Twin Daggers",
    type: "weapon",
    slot: "weapon",
    atk: 3,
    agi: 2,
    description: "Light blades that favor speed.",
  },
  oak_staff: {
    id: "oak_staff",
    name: "Oak Staff",
    type: "weapon",
    slot: "weapon",
    atk: 2,
    description: "Channels arcane sparks with a solid thump.",
  },
  lute_blade: {
    id: "lute_blade",
    name: "Songsteel Rapier",
    type: "weapon",
    slot: "weapon",
    atk: 3,
    description: "A thin blade that rings when drawn.",
  },
  leather_armor: {
    id: "leather_armor",
    name: "Hardened Leather",
    type: "armor",
    slot: "armor",
    def: 2,
    description: "Supple protection for long roads.",
  },
  chain_mail: {
    id: "chain_mail",
    name: "Chain Mail",
    type: "armor",
    slot: "armor",
    def: 4,
    description: "Interlocked rings mute glancing blows.",
  },
  plate_vest: {
    id: "plate_vest",
    name: "Plate Cuirass",
    type: "armor",
    slot: "armor",
    def: 6,
    description: "Heavy plates bearing Hargrove's crest.",
  },
  mage_robe: {
    id: "mage_robe",
    name: "Scholar's Robe",
    type: "armor",
    slot: "armor",
    def: 1,
    description: "Woven with faint ward threads.",
  },
  wood_shield: {
    id: "wood_shield",
    name: "Oak Shield",
    type: "shield",
    slot: "shield",
    def: 2,
    description: "Banded timber, light enough to raise quickly.",
  },
  kite_shield: {
    id: "kite_shield",
    name: "Kite Shield",
    type: "shield",
    slot: "shield",
    def: 4,
    description: "A tower of steel for the steadfast.",
  },
  lucky_charm: {
    id: "lucky_charm",
    name: "Lucky Charm",
    type: "accessory",
    slot: "accessory",
    agi: 1,
    description: "A scratched coin that still brings fortune.",
  },
  runestone: {
    id: "runestone",
    name: "Emerald Runestone",
    type: "accessory",
    slot: "accessory",
    atk: 1,
    def: 1,
    description: "Crypt-green glow hums against the skin.",
  },
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    type: "consumable",
    heal: 18,
    description: "Restores vitality in a single gulp.",
  },
  mana_potion: {
    id: "mana_potion",
    name: "Spirit Tonic",
    type: "consumable",
    mana: 14,
    description: "Clears the mind; restores spirit.",
  },
  smoke_bomb: {
    id: "smoke_bomb",
    name: "Smoke Bomb",
    type: "consumable",
    description: "Cloud cover for a hasty escape.",
  },
  eldritch_medallion: {
    id: "eldritch_medallion",
    name: "Eldritch Medallion",
    type: "accessory",
    slot: "accessory",
    atk: 2,
    def: 1,
    agi: 1,
    description: "A cold disc etched with green runes — stolen from Skara Brae's vault.",
  },
};

let uid = 1;
export function makeItem(defId: string): ItemInstance {
  const def = ITEM_CATALOG[defId];
  if (!def) throw new Error(`Unknown item ${defId}`);
  return {
    uid: `it${uid++}`,
    defId,
    name: def.name,
    type: def.type,
    slot: def.slot,
    atk: def.atk,
    def: def.def,
    agi: def.agi,
    heal: def.heal,
    mana: def.mana,
    description: def.description,
  };
}

export function starterInventory(): ItemInstance[] {
  return [
    makeItem("health_potion"),
    makeItem("health_potion"),
    makeItem("mana_potion"),
    makeItem("smoke_bomb"),
    makeItem("steel_blade"),
    makeItem("lucky_charm"),
  ];
}

export function starterEquipment(className: PartyClass): Partial<Record<EquipSlot, ItemInstance>> {
  switch (className) {
    case "Warrior":
      return {
        weapon: makeItem("iron_sword"),
        armor: makeItem("chain_mail"),
        shield: makeItem("wood_shield"),
      };
    case "Paladin":
      return {
        weapon: makeItem("iron_sword"),
        armor: makeItem("chain_mail"),
        shield: makeItem("kite_shield"),
      };
    case "Rogue":
      return {
        weapon: makeItem("rogue_daggers"),
        armor: makeItem("leather_armor"),
        accessory: makeItem("lucky_charm"),
      };
    case "Wizard":
      return {
        weapon: makeItem("oak_staff"),
        armor: makeItem("mage_robe"),
        accessory: makeItem("runestone"),
      };
    case "Bard":
      return {
        weapon: makeItem("lute_blade"),
        armor: makeItem("leather_armor"),
      };
  }
}

export const LOOT_POOL = [
  "health_potion",
  "mana_potion",
  "steel_blade",
  "plate_vest",
  "kite_shield",
  "runestone",
  "lucky_charm",
  "smoke_bomb",
] as const;

export function rollLoot(rng = Math.random): ItemInstance | null {
  if (rng() > 0.55) return null;
  const id = LOOT_POOL[Math.floor(rng() * LOOT_POOL.length)]!;
  return makeItem(id);
}
