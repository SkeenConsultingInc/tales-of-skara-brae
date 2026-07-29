import { useEffect, useRef, useState, useCallback } from "react";
import { DungeonEngine } from "@/game/engine";
import { GameHUD } from "./GameHUD";
import { TouchControls } from "./TouchControls";
import { CombatUI } from "./CombatUI";
import { InventoryScreen } from "./InventoryScreen";
import { QuestJournal } from "./QuestJournal";
import { SettingsPanel } from "./SettingsPanel";
import { useGameStore } from "@/game/store";
import { hasSave } from "@/game/save";
import type { BardSongId, CombatAction } from "@/game/types";

export function DungeonGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DungeonEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const started = useGameStore((s) => s.started);
  const zone = useGameStore((s) => s.zone);
  const combatActive = useGameStore((s) => s.combat.active);
  const inventoryOpen = useGameStore((s) => s.inventoryOpen);
  const questStep = useGameStore((s) => s.questStep);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    setCanContinue(hasSave());
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = new DungeonEngine(host);
    engineRef.current = engine;
    setReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const begin = useCallback((continueSave = false) => {
    void engineRef.current?.start({ continueSave });
  }, []);

  const onCommand = useCallback((code: string) => {
    engineRef.current?.queueInput(code);
  }, []);

  const onCastSong = useCallback((id: Exclude<BardSongId, null>) => {
    engineRef.current?.castSong(id);
  }, []);

  const onCombatAction = useCallback(
    (
      action: CombatAction,
      opts?: { itemUid?: string; songId?: "fury" | "watch" | "seeker"; targetId?: string },
    ) => {
      engineRef.current?.combatAction(action, opts);
    },
    [],
  );

  const onSelectEnemy = useCallback((id: string) => {
    engineRef.current?.selectCombatEnemy(id);
  }, []);

  const onSave = useCallback(() => {
    engineRef.current?.saveGame();
  }, []);

  const onGraphicsChange = useCallback(() => {
    engineRef.current?.applyGraphicsFromStore();
  }, []);

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-bg overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" />

      {!combatActive && <GameHUD onCastSong={onCastSong} onSave={onSave} />}
      {combatActive && (
        <CombatUI onAction={onCombatAction} onSelectEnemy={onSelectEnemy} />
      )}
      <InventoryScreen />
      <QuestJournal />
      <SettingsPanel onSave={onSave} onGraphicsChange={onGraphicsChange} />
      <TouchControls
        onCommand={onCommand}
        visible={started && isTouch && !combatActive && !inventoryOpen}
      />

      {started && !isTouch && !combatActive && (
        <div className="absolute bottom-[7.5rem] left-4 z-10 pointer-events-none hidden md:block">
          <div className="glass-panel rounded-[var(--radius-md)] px-3 py-2 text-[11px] text-muted space-y-0.5">
            <p>
              <kbd className="text-fg">W A S D</kbd> move ·{" "}
              <kbd className="text-fg">E</kbd> talk
            </p>
            <p>
              <kbd className="text-fg">I</kbd> pack · <kbd className="text-fg">J</kbd> journal ·{" "}
              <kbd className="text-fg">O</kbd> settings
            </p>
            <p className="text-subtle">
              {zone} · quest: {questStep.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      )}

      {!started && ready && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)_78%,transparent)] backdrop-blur-sm p-4">
          <div className="glass-panel rounded-[var(--radius-xl)] max-w-md w-full p-6 sm:p-8 text-center animate-fade-rise">
            <p
              className="text-[10px] uppercase tracking-[0.2em] text-muted mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Demo questline
            </p>
            <h1
              className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tales of Skara Brae
            </h1>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Begin at The Scarlet Bard. Innkeeper Brann needs the Eldritch Medallion
              recovered from cultists in the Overgrown Crypt — then face the Dungeon Warden
              beneath Castle Hargrove.
            </p>
            <ul className="text-left text-xs text-subtle space-y-1.5 mb-6 mx-auto max-w-xs">
              <li>
                <span className="text-fg">E</span> — talk to NPCs
              </li>
              <li>
                <span className="text-fg">J</span> — quest journal ·{" "}
                <span className="text-fg">O</span> — graphics
              </li>
              <li>
                <span className="text-fg">F5</span> — save (autosave on)
              </li>
            </ul>
            <button
              type="button"
              onClick={() => begin(false)}
              className="w-full min-h-11 rounded-[var(--radius-md)] bg-accent text-accent-fg font-medium text-sm tracking-wide hover:brightness-110 transition"
            >
              Begin Expedition
            </button>
            {canContinue && (
              <button
                type="button"
                onClick={() => begin(true)}
                className="w-full min-h-11 mt-2 rounded-[var(--radius-md)] border border-border text-fg text-sm hover:border-accent transition"
              >
                Continue Save
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
