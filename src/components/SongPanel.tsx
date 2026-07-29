import { Music, Shield, Swords, Sparkles } from "lucide-react";
import { BARD_SONGS, type BardSongId } from "@/game/types";
import { useGameStore } from "@/game/store";
import { gameAudio } from "@/game/audio";

const ICONS = {
  fury: Swords,
  watch: Shield,
  seeker: Sparkles,
} as const;

interface Props {
  onCast: (id: Exclude<BardSongId, null>) => void;
}

export function SongPanel({ onCast }: Props) {
  const active = useGameStore((s) => s.activeSong);
  const bard = useGameStore((s) => s.party.find((p) => p.className === "Bard"));

  return (
    <div className="glass-panel rounded-[var(--radius-lg)] p-2.5 pointer-events-auto w-full max-w-[220px]">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <Music className="w-3.5 h-3.5 text-accent" />
        <span
          className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Bard Songs
        </span>
        {bard && (
          <span className="ml-auto text-[10px] tabular-nums text-subtle">SP {bard.sp}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {BARD_SONGS.map((song) => {
          const Icon = ICONS[song.id];
          const isActive = active === song.id;
          return (
            <button
              key={song.id}
              type="button"
              title={song.description}
              onClick={() => {
                gameAudio.playMenuClick();
                onCast(song.id);
              }}
              className={`flex items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left border transition-colors duration-150 ${
                isActive
                  ? "border-accent/50 bg-accent/15 text-fg"
                  : "border-border bg-surface/40 text-muted hover:text-fg hover:border-border-strong"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] shrink-0 ${
                  isActive ? "bg-accent text-accent-fg" : "bg-surface-elevated text-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {song.shortName}
                  </span>
                  <span className="text-[10px] text-subtle tabular-nums">[{song.key}]</span>
                </span>
                <span className="block text-[10px] text-subtle leading-snug line-clamp-2">
                  {song.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
