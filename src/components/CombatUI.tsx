import {
  Swords,
  Sparkles,
  Music2,
  Shield,
  FlaskConical,
  DoorOpen,
  ChevronRight,
} from "lucide-react";
import { useGameStore } from "@/game/store";
import { BARD_SONGS } from "@/game/types";
import type { CombatAction } from "@/game/types";

interface Props {
  onAction: (action: CombatAction, opts?: { itemUid?: string; songId?: "fury" | "watch" | "seeker"; targetId?: string }) => void;
  onSelectEnemy: (id: string) => void;
}

const ACTIONS: {
  id: CombatAction;
  label: string;
  hint: string;
  Icon: typeof Swords;
}[] = [
  { id: "attack", label: "Attack", hint: "Physical strike", Icon: Swords },
  { id: "spell", label: "Spell", hint: "Class power", Icon: Sparkles },
  { id: "song", label: "Bard Song", hint: "Buff party", Icon: Music2 },
  { id: "defend", label: "Defend", hint: "Raise guard", Icon: Shield },
  { id: "item", label: "Item", hint: "Use consumable", Icon: FlaskConical },
  { id: "escape", label: "Escape", hint: "Flee battle", Icon: DoorOpen },
];

export function CombatUI({ onAction, onSelectEnemy }: Props) {
  const combat = useGameStore((s) => s.combat);
  const party = useGameStore((s) => s.party);
  const inventory = useGameStore((s) => s.inventory);
  const attackMult = useGameStore((s) => s.attackMult);
  const defenseMult = useGameStore((s) => s.defenseMult);

  if (!combat.active) return null;

  const actor = party.find((p) => p.id === combat.activeActorId);
  const selecting = combat.phase === "select" && actor;
  const consumables = inventory.filter((i) => i.type === "consumable");

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top: encounter banner + turn order */}
      <div className="flex flex-col items-center gap-2">
        <div className="glass-panel rounded-[var(--radius-lg)] px-4 py-2 text-center pointer-events-none">
          <p
            className="text-[10px] uppercase tracking-[0.18em] text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Turn-based encounter
          </p>
          <p className="text-sm text-fg mt-0.5">
            {combat.phase === "intro" && "Camera locking on…"}
            {combat.phase === "select" && actor && `${actor.name}'s turn`}
            {combat.phase === "animating" && "Resolving…"}
            {combat.phase === "enemy" && "Enemy turn"}
            {combat.phase === "victory" && (combat.rewardSummary ?? "Victory!")}
            {combat.phase === "defeat" && "Defeat"}
            {combat.phase === "escaped" && "Escaped"}
          </p>
          {(attackMult > 1 || defenseMult < 1) && (
            <p className="text-[10px] text-torch mt-1">
              {attackMult > 1 ? `ATK ×${attackMult.toFixed(2)} ` : ""}
              {defenseMult < 1 ? `DMG ×${defenseMult.toFixed(2)}` : ""}
            </p>
          )}
        </div>

        {/* Initiative strip */}
        <div className="flex gap-1 flex-wrap justify-center max-w-full">
          {combat.turnQueue.slice(0, 10).map((t, i) => {
            const isActive = combat.turnQueue[combat.turnIndex % combat.turnQueue.length]?.id === t.id &&
              i === combat.turnIndex % combat.turnQueue.length;
            // simpler: highlight by activeActorId
            const active = t.id === combat.activeActorId;
            const label =
              t.kind === "party"
                ? party.find((p) => p.id === t.id)?.name ?? "?"
                : combat.enemies.find((e) => e.id === t.id)?.name ?? "?";
            return (
              <span
                key={`${t.id}-${i}`}
                className={`text-[10px] px-2 py-1 rounded-full border ${
                  active
                    ? "border-accent bg-accent/20 text-fg"
                    : "border-border text-muted bg-surface/60"
                }`}
              >
                {label.split(" ")[0]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Enemy cards */}
      <div className="flex justify-center gap-2 pointer-events-auto flex-wrap">
        {combat.enemies.map((e) => {
          const selected = e.id === combat.selectedEnemyId;
          const pct = Math.max(0, (e.hp / e.maxHp) * 100);
          return (
            <button
              key={e.id}
              type="button"
              disabled={!e.alive}
              onClick={() => onSelectEnemy(e.id)}
              className={`glass-panel rounded-[var(--radius-md)] px-3 py-2 min-w-[9rem] text-left transition-shadow ${
                selected ? "ring-1 ring-accent shadow-[var(--shadow-glow)]" : ""
              } ${!e.alive ? "opacity-40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-fg truncate">{e.name}</span>
                {selected && <ChevronRight className="w-3 h-3 text-accent shrink-0" />}
              </div>
              <p className="text-[10px] text-muted capitalize mt-0.5">
                {e.archetype.replace(/_/g, " ")}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-hp transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-subtle mt-1 tabular-nums">
                {Math.max(0, e.hp)}/{e.maxHp}
              </p>
            </button>
          );
        })}
      </div>

      {/* Action wheel */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 w-full max-w-3xl mx-auto">
        <div className="flex gap-1.5 w-full overflow-x-auto pb-1 justify-center">
          {party.map((m) => {
            const active = m.id === combat.activeActorId;
            const hpPct = (m.hp / m.maxHp) * 100;
            return (
              <div
                key={m.id}
                className={`glass-panel rounded-[var(--radius-sm)] px-2 py-1.5 min-w-[4.5rem] shrink-0 ${
                  active ? "ring-1 ring-accent" : ""
                } ${m.hp <= 0 ? "opacity-40" : ""}`}
              >
                <p className="text-[10px] text-fg truncate">{m.name}</p>
                <div className="mt-1 h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-hp" style={{ width: `${hpPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {combat.subMenu === "song" && selecting && (
          <div className="glass-panel rounded-[var(--radius-lg)] p-2 flex flex-wrap gap-2 justify-center max-w-md">
            {BARD_SONGS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="px-3 py-2 rounded-[var(--radius-md)] bg-surface border border-border text-xs text-fg hover:border-accent min-h-11"
                onClick={() => onAction("song", { songId: s.id })}
              >
                {s.shortName}
              </button>
            ))}
            <button
              type="button"
              className="px-3 py-2 text-xs text-muted"
              onClick={() => onAction("song")}
            >
              Cancel
            </button>
          </div>
        )}
        {combat.subMenu === "item" && selecting && (
          <div className="glass-panel rounded-[var(--radius-lg)] p-2 flex flex-wrap gap-2 justify-center max-w-md max-h-40 overflow-y-auto">
            {consumables.length === 0 && (
              <p className="text-xs text-muted px-2">No consumables</p>
            )}
            {consumables.map((it) => (
              <button
                key={it.uid}
                type="button"
                className="px-3 py-2 rounded-[var(--radius-md)] bg-surface border border-border text-xs text-fg hover:border-accent min-h-11"
                onClick={() => onAction("item", { itemUid: it.uid })}
              >
                {it.name}
              </button>
            ))}
            <button
              type="button"
              className="px-3 py-2 text-xs text-muted"
              onClick={() => onAction("item")}
            >
              Cancel
            </button>
          </div>
        )}

        <div
          className={`grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-xl ${
            selecting ? "opacity-100" : "opacity-50 pointer-events-none"
          }`}
        >
          {ACTIONS.map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onAction(id)}
              className="glass-panel rounded-[var(--radius-md)] px-2 py-2.5 flex flex-col items-center gap-1 min-h-11 hover:border-accent border border-transparent transition-colors"
              title={hint}
            >
              <Icon className="w-4 h-4 text-accent" />
              <span className="text-[11px] text-fg font-medium">{label}</span>
            </button>
          ))}
        </div>
        {actor && selecting && (
          <p className="text-[10px] text-muted">
            Acting: <span className="text-fg">{actor.name}</span> · Lv{actor.level} ·{" "}
            {actor.className}
          </p>
        )}
      </div>
    </div>
  );
}
