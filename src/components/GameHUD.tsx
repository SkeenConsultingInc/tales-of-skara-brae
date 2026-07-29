import { Minimap } from "./Minimap";
import { PartyBar } from "./PartyBar";
import { LogPanel } from "./LogPanel";
import { SongPanel } from "./SongPanel";
import { useGameStore } from "@/game/store";
import type { BardSongId, Zone } from "@/game/types";
import { Coins, Backpack, BookOpen, Settings, Save } from "lucide-react";
import { questInfo } from "@/game/quest";

const ZONE_LABEL: Record<Zone, string> = {
  wilderness: "Moonlit Woods",
  dungeon: "Dungeon Depths",
  tavern: "The Scarlet Bard",
  city: "City Streets",
  castle: "Grand Halls",
  crypt: "Ancient Tombs",
};

interface Props {
  onCastSong: (id: Exclude<BardSongId, null>) => void;
  onSave?: () => void;
}

export function GameHUD({ onCastSong, onSave }: Props) {
  const zone = useGameStore((s) => s.zone);
  const mapName = useGameStore((s) => s.mapName);
  const started = useGameStore((s) => s.started);
  const message = useGameStore((s) => s.message);
  const isMoving = useGameStore((s) => s.isMoving);
  const activeSong = useGameStore((s) => s.activeSong);
  const attackMult = useGameStore((s) => s.attackMult);
  const defenseMult = useGameStore((s) => s.defenseMult);
  const transitioning = useGameStore((s) => s.transitioning);
  const gold = useGameStore((s) => s.gold);
  const setInventoryOpen = useGameStore((s) => s.setInventoryOpen);
  const questStep = useGameStore((s) => s.questStep);
  const setJournalOpen = useGameStore((s) => s.setJournalOpen);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const quest = questInfo(questStep);

  if (!started) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-4">
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col gap-2 items-start">
          <div className="glass-panel rounded-[var(--radius-md)] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-[10px] uppercase tracking-[0.16em] text-muted"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {mapName}
              </p>
              <span className="text-[10px] text-torch flex items-center gap-0.5 tabular-nums">
                <Coins className="w-3 h-3" /> {gold}
              </span>
            </div>
            <p className="text-xs text-fg mt-0.5">
              {ZONE_LABEL[zone]}
              {isMoving ? " · stepping" : ""}
            </p>
            {activeSong && (
              <p className="text-[10px] text-torch mt-1 tabular-nums">
                Song active
                {attackMult > 1 ? ` · ATK ×${attackMult.toFixed(2)}` : ""}
                {defenseMult < 1 ? ` · DMG ×${defenseMult.toFixed(2)}` : ""}
              </p>
            )}
            <p className="text-[10px] text-accent mt-1.5 leading-snug max-w-[14rem]">
              {quest.objective}
            </p>
          </div>
          <SongPanel onCast={onCastSong} />
          <div className="pointer-events-auto flex flex-wrap gap-1.5 relative z-30">
            <button
              type="button"
              className="glass-panel rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 text-xs text-fg min-h-11 hover:border-accent border border-transparent"
              onClick={() => setInventoryOpen(true)}
            >
              <Backpack className="w-4 h-4 text-accent" />
              Pack
            </button>
            <button
              type="button"
              className="glass-panel rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 text-xs text-fg min-h-11 hover:border-accent border border-transparent"
              onClick={() => setJournalOpen(true)}
            >
              <BookOpen className="w-4 h-4 text-accent" />
              Quest
            </button>
            <button
              type="button"
              className="glass-panel rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 text-xs text-fg min-h-11 hover:border-accent border border-transparent"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 text-accent" />
              GFX
            </button>
            {onSave && (
              <button
                type="button"
                className="glass-panel rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 text-xs text-fg min-h-11 hover:border-accent border border-transparent"
                onClick={onSave}
              >
                <Save className="w-4 h-4 text-accent" />
                Save
              </button>
            )}
          </div>
        </div>
        <div className="pointer-events-auto">
          <Minimap />
        </div>
      </div>

      {transitioning && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)_70%,transparent)] backdrop-blur-[2px]">
          <p
            className="text-sm text-fg tracking-wide animate-fade-rise"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Crossing the threshold…
          </p>
        </div>
      )}

      {message && (
        <div className="absolute inset-x-0 top-1/3 flex justify-center px-4">
          <div className="glass-panel rounded-[var(--radius-lg)] px-5 py-4 max-w-md text-center animate-fade-rise">
            <p
              className="text-sm sm:text-base text-fg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {message}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end justify-between">
        <div className="flex-1 flex justify-center sm:justify-start order-2 sm:order-1">
          <PartyBar />
        </div>
        <div className="pointer-events-auto order-1 sm:order-2 flex justify-end">
          <LogPanel />
        </div>
      </div>
    </div>
  );
}
