import type { QuestStep } from "./types";

export interface QuestStageInfo {
  id: QuestStep;
  title: string;
  objective: string;
  hint: string;
}

export const QUEST_STAGES: QuestStageInfo[] = [
  {
    id: "arrive_tavern",
    title: "The Scarlet Bard",
    objective: "Speak with Innkeeper Brann about the stolen medallion.",
    hint: "Stand near Brann in the tavern and press E or Space.",
  },
  {
    id: "seek_crypt",
    title: "Road to the Overgrown Crypt",
    objective: "Travel south through the Outer Wilds to the moss-covered trapdoor.",
    hint: "Exit Skara Brae by the South Gate, follow the forest path east to the ruins and trapdoor.",
  },
  {
    id: "slay_cultist",
    title: "Cultist Leader",
    objective: "Defeat the Cultist Leader in the Forgotten Crypt and reclaim the Eldritch Medallion.",
    hint: "The leader waits deeper in the crypt — a multi-stage battle. Prepare potions.",
  },
  {
    id: "return_medallion",
    title: "Return to Brann",
    objective: "Bring the Eldritch Medallion back to Innkeeper Brann.",
    hint: "Trapdoor up to the wilds, road north to Skara Brae, then into The Scarlet Bard.",
  },
  {
    id: "storm_dungeon",
    title: "Hargrove's Depths",
    objective: "Castle dungeon gates open — defeat the Dungeon Warden below Hargrove.",
    hint: "North through Castle Hargrove gates, take the marble stairs down, find the Warden.",
  },
  {
    id: "complete",
    title: "Heroes of Skara Brae",
    objective: "The demo questline is complete. Explore freely or start a new save.",
    hint: "Thanks for playing — wander the maps, gear up, and fight remaining foes.",
  },
];

export function questIndex(step: QuestStep): number {
  return Math.max(0, QUEST_STAGES.findIndex((s) => s.id === step));
}

export function questInfo(step: QuestStep): QuestStageInfo {
  return QUEST_STAGES.find((s) => s.id === step) ?? QUEST_STAGES[0]!;
}
