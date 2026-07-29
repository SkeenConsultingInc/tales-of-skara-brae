import { useState } from "react";
import { X, Coins, Package } from "lucide-react";
import { useGameStore } from "@/game/store";
import type { EquipSlot, ItemInstance, PartyMember } from "@/game/types";
import { equipBonus } from "@/game/combatLogic";

const SLOTS: { id: EquipSlot; label: string }[] = [
  { id: "weapon", label: "Weapon" },
  { id: "armor", label: "Armor" },
  { id: "shield", label: "Shield" },
  { id: "accessory", label: "Accessory" },
];

function ItemCard({
  item,
  onClick,
  active,
}: {
  item: ItemInstance;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[var(--radius-sm)] border px-2 py-1.5 min-h-11 transition-colors ${
        active
          ? "border-accent bg-accent/15"
          : "border-border bg-surface/70 hover:border-muted"
      }`}
    >
      <p className="text-[11px] text-fg font-medium truncate">{item.name}</p>
      <p className="text-[10px] text-muted capitalize">{item.type}</p>
      <p className="text-[10px] text-subtle mt-0.5">
        {item.atk ? `+${item.atk} ATK ` : ""}
        {item.def ? `+${item.def} DEF ` : ""}
        {item.agi ? `+${item.agi} AGI ` : ""}
        {item.heal ? `+${item.heal} HP ` : ""}
        {item.mana ? `+${item.mana} SP` : ""}
      </p>
    </button>
  );
}

function PaperDoll({
  member,
  onUnequip,
}: {
  member: PartyMember;
  onUnequip: (slot: EquipSlot) => void;
}) {
  const bonus = equipBonus(member);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-[var(--radius-md)] h-28 flex items-center justify-center relative overflow-hidden border border-border"
        style={{
          background: `linear-gradient(160deg, hsl(${member.portraitHue} ${member.portraitSat}% 22%), hsl(${member.portraitHue} 20% 10%))`,
        }}
      >
        <span
          className="text-4xl font-semibold text-fg/80"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {member.name[0]}
        </span>
        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-fg/80 flex justify-between">
          <span>
            ATK +{bonus.atk} · DEF +{bonus.def}
          </span>
          <span>AGI +{bonus.agi}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {SLOTS.map(({ id, label }) => {
          const it = member.equipment[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => it && onUnequip(id)}
              className="rounded-[var(--radius-sm)] border border-border bg-bg/50 px-2 py-2 min-h-11 text-left hover:border-muted"
            >
              <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
              <p className="text-[11px] text-fg truncate">{it?.name ?? "— empty —"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InventoryScreen() {
  const open = useGameStore((s) => s.inventoryOpen);
  const party = useGameStore((s) => s.party);
  const inventory = useGameStore((s) => s.inventory);
  const gold = useGameStore((s) => s.gold);
  const setOpen = useGameStore((s) => s.setInventoryOpen);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipItem = useGameStore((s) => s.unequipItem);
  const useItem = useGameStore((s) => s.useItem);

  const [memberId, setMemberId] = useState(party[0]?.id ?? "p1");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  if (!open) return null;

  const member = party.find((p) => p.id === memberId) ?? party[0]!;
  const selected = inventory.find((i) => i.uid === selectedUid) ?? null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[color-mix(in_oklab,var(--color-bg)_72%,transparent)] backdrop-blur-sm">
      <div className="glass-panel rounded-[var(--radius-xl)] w-full max-w-3xl max-h-[90dvh] overflow-hidden flex flex-col shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <h2
              className="text-sm font-semibold text-fg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Inventory & Equipment
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-torch flex items-center gap-1 tabular-nums">
              <Coins className="w-3.5 h-3.5" /> {gold}
            </span>
            <button
              type="button"
              className="p-2 rounded-[var(--radius-sm)] hover:bg-surface min-h-11 min-w-11 flex items-center justify-center"
              onClick={() => setOpen(false)}
              aria-label="Close inventory"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-3 pt-3 overflow-x-auto">
          {party.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setMemberId(p.id)}
              className={`px-3 py-2 rounded-full text-xs min-h-11 shrink-0 border ${
                p.id === member.id
                  ? "border-accent bg-accent/20 text-fg"
                  : "border-border text-muted"
              }`}
            >
              {p.name} · Lv{p.level}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 p-4 overflow-y-auto flex-1">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
              Paper doll · click slot to unequip
            </p>
            <PaperDoll member={member} onUnequip={(slot) => unequipItem(member.id, slot)} />
            <div className="mt-3 text-[11px] text-subtle space-y-0.5">
              <p>
                HP {member.hp}/{member.maxHp} · SP {member.sp}/{member.maxSp}
              </p>
              <p>
                STR {member.strength} · AGI {member.agility} · XP {member.xp}
              </p>
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
              Pack · click item, then equip / use
            </p>
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto max-h-[40vh] pr-1">
              {inventory.length === 0 && (
                <p className="text-xs text-muted col-span-2">Pack is empty.</p>
              )}
              {inventory.map((it) => (
                <ItemCard
                  key={it.uid}
                  item={it}
                  active={it.uid === selectedUid}
                  onClick={() => setSelectedUid(it.uid === selectedUid ? null : it.uid)}
                />
              ))}
            </div>

            {selected && (
              <div className="mt-3 glass-panel rounded-[var(--radius-md)] p-3">
                <p className="text-xs text-fg font-medium">{selected.name}</p>
                <p className="text-[11px] text-muted mt-1">{selected.description}</p>
                <div className="flex gap-2 mt-3">
                  {selected.slot && (
                    <button
                      type="button"
                      className="flex-1 min-h-11 rounded-[var(--radius-sm)] bg-accent/90 text-accent-fg text-xs font-medium"
                      onClick={() => {
                        equipItem(member.id, selected.uid);
                        setSelectedUid(null);
                      }}
                    >
                      Equip on {member.name}
                    </button>
                  )}
                  {selected.type === "consumable" && (
                    <button
                      type="button"
                      className="flex-1 min-h-11 rounded-[var(--radius-sm)] bg-success/80 text-accent-fg text-xs font-medium"
                      onClick={() => {
                        useItem(selected.uid, member.id);
                        setSelectedUid(null);
                      }}
                    >
                      Use
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
