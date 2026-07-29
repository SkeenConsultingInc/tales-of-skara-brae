import { useGameStore } from "@/game/store";
import type { CastFxKind, StatusEffect } from "@/game/types";
import { Heart, Sparkles, Shield, Wind, Cross, Swords, Eye } from "lucide-react";

const STATUS_ICON: Record<StatusEffect, { label: string; Icon: typeof Shield }> = {
  poison: { label: "Poison", Icon: Cross },
  blessed: { label: "Blessed", Icon: Sparkles },
  shield: { label: "Shield", Icon: Shield },
  haste: { label: "Haste", Icon: Wind },
  fury: { label: "Fury", Icon: Swords },
  ward: { label: "Ward", Icon: Shield },
  seeker: { label: "Seeker", Icon: Eye },
  defend: { label: "Defend", Icon: Shield },
};

const CAST_COLOR: Record<CastFxKind, string> = {
  buff: "var(--color-accent)",
  heal: "var(--color-success)",
  attack: "var(--color-hp)",
  song: "var(--color-torch)",
  spell: "var(--color-sp)",
};

function Portrait({
  hue,
  sat,
  name,
  castFx,
}: {
  hue: number;
  sat: number;
  name: string;
  castFx: { kind: CastFxKind; label: string } | null;
}) {
  const initial = name[0] ?? "?";
  return (
    <div
      className="portrait-ring w-10 h-10 sm:w-11 sm:h-11 rounded-[var(--radius-sm)] shrink-0 flex items-center justify-center relative overflow-hidden"
      style={{
        background: `linear-gradient(145deg, hsl(${hue} ${sat}% 28%), hsl(${hue} ${sat + 8}% 14%))`,
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 35% 30%, hsl(${hue} 40% 55%), transparent 55%)`,
        }}
      />
      <span
        className="relative text-sm font-semibold text-fg/90"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {initial}
      </span>
      {castFx && (
        <span
          className="cast-fx-burst absolute inset-0 flex items-center justify-center"
          style={{ ["--cast-color" as string]: CAST_COLOR[castFx.kind] }}
        >
          <span className="cast-fx-ring" />
          <span
            className="absolute text-[9px] font-semibold tracking-wide uppercase"
            style={{ color: CAST_COLOR[castFx.kind], fontFamily: "var(--font-display)" }}
          >
            {castFx.label}
          </span>
        </span>
      )}
    </div>
  );
}

export function PartyBar() {
  const party = useGameStore((s) => s.party);

  return (
    <div className="glass-panel rounded-[var(--radius-xl)] px-2 py-1.5 sm:px-3 sm:py-2 w-full max-w-5xl overflow-x-auto">
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 min-w-[520px] sm:min-w-0">
        {party.map((m) => {
          const hpPct = Math.round((m.hp / m.maxHp) * 100);
          const spPct = Math.round((m.sp / m.maxSp) * 100);
          const low = m.hp / m.maxHp < 0.3;
          return (
            <div
              key={m.id}
              className={`flex gap-2 items-center min-w-0 rounded-[var(--radius-md)] px-1 py-0.5 ${
                m.castFx ? "cast-member-glow" : ""
              }`}
              style={
                m.castFx
                  ? { ["--cast-color" as string]: CAST_COLOR[m.castFx.kind] }
                  : undefined
              }
            >
              <Portrait
                hue={m.portraitHue}
                sat={m.portraitSat}
                name={m.name}
                castFx={m.castFx}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className="text-[11px] sm:text-xs font-semibold truncate text-fg"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {m.name}
                  </span>
                  <span className="text-[9px] text-subtle shrink-0">Lv{m.level} {m.className}</span>
                </div>
                <div className="mt-0.5 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 text-hp shrink-0" strokeWidth={2.5} />
                    <div className="h-1.5 flex-1 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="hp-bar-fill h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${hpPct}%`,
                          animation: low ? "bar-pulse 1.2s ease-in-out infinite" : undefined,
                        }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-muted w-6 text-right">
                      {m.hp}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-sp shrink-0" strokeWidth={2.5} />
                    <div className="h-1.5 flex-1 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="sp-bar-fill h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${spPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-muted w-6 text-right">
                      {m.sp}
                    </span>
                  </div>
                </div>
                {m.statuses.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {m.statuses.map((s) => {
                      const meta = STATUS_ICON[s];
                      const Icon = meta.Icon;
                      return (
                        <span
                          key={s}
                          title={meta.label}
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[var(--radius-xs)] bg-surface-elevated border border-border text-muted"
                        >
                          <Icon className="w-2 h-2" />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
