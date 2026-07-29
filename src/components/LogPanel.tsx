import { useEffect, useRef } from "react";
import { useGameStore } from "@/game/store";
import type { LogTone } from "@/game/types";

const TONE_CLASS: Record<LogTone, string> = {
  info: "text-muted",
  combat: "text-fg log-line-glow",
  loot: "text-accent log-line-glow",
  system: "text-subtle",
  danger: "text-danger",
  song: "text-torch log-line-glow",
};

export function LogPanel() {
  const log = useGameStore((s) => s.log);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <div className="glass-panel rounded-[var(--radius-lg)] w-full max-w-sm flex flex-col overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5 border-b border-border flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Chronicle
        </span>
        <span className="text-[10px] text-subtle tabular-nums">{log.length}</span>
      </div>
      <div
        ref={ref}
        className="px-3 py-2 max-h-24 sm:max-h-32 overflow-y-auto space-y-1.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {log.map((entry) => (
          <p
            key={entry.id}
            className={`text-[11px] sm:text-xs leading-snug ${TONE_CLASS[entry.tone]}`}
          >
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
}
