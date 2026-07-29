import { BookOpen, X, Check } from "lucide-react";
import { useGameStore } from "@/game/store";
import { QUEST_STAGES, questIndex } from "@/game/quest";

export function QuestJournal() {
  const open = useGameStore((s) => s.journalOpen);
  const step = useGameStore((s) => s.questStep);
  const hasMedallion = useGameStore((s) => s.hasMedallion);
  const dungeonUnlocked = useGameStore((s) => s.dungeonUnlocked);
  const setOpen = useGameStore((s) => s.setJournalOpen);
  const idx = questIndex(step);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[color-mix(in_oklab,var(--color-bg)_72%,transparent)] backdrop-blur-sm">
      <div className="glass-panel rounded-[var(--radius-xl)] w-full max-w-lg max-h-[85dvh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h2
              className="text-sm font-semibold text-fg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Quest Journal
            </h2>
          </div>
          <button
            type="button"
            className="p-2 min-h-11 min-w-11 flex items-center justify-center"
            onClick={() => setOpen(false)}
            aria-label="Close journal"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          <p className="text-xs text-muted">
            Demo storyline · {hasMedallion ? "Medallion in pack · " : ""}
            {dungeonUnlocked ? "Dungeon unsealed" : "Dungeon sealed"}
          </p>
          {QUEST_STAGES.map((s, i) => {
            const done = i < idx || step === "complete";
            const current = s.id === step;
            return (
              <div
                key={s.id}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 ${
                  current
                    ? "border-accent bg-accent/10"
                    : done
                      ? "border-border opacity-70"
                      : "border-border/60 opacity-45"
                }`}
              >
                <div className="flex items-center gap-2">
                  {done && step === "complete" ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : done && i < idx ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-muted inline-block" />
                  )}
                  <p
                    className="text-xs font-medium text-fg"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.title}
                  </p>
                </div>
                <p className="text-[11px] text-muted mt-1 pl-5">{s.objective}</p>
                {current && (
                  <p className="text-[11px] text-torch mt-1.5 pl-5">{s.hint}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
