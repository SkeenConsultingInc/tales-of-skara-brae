import { Settings, X, Save } from "lucide-react";
import { useGameStore } from "@/game/store";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-3 min-h-11 text-left hover:border-muted"
    >
      <div>
        <p className="text-xs text-fg font-medium">{label}</p>
        <p className="text-[10px] text-muted mt-0.5">{hint}</p>
      </div>
      <span
        className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-fg transition-transform ${
            checked ? "left-5" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

interface Props {
  onSave: () => void;
  onGraphicsChange: () => void;
}

export function SettingsPanel({ onSave, onGraphicsChange }: Props) {
  const open = useGameStore((s) => s.settingsOpen);
  const graphics = useGameStore((s) => s.graphics);
  const setGraphics = useGameStore((s) => s.setGraphics);
  const setOpen = useGameStore((s) => s.setSettingsOpen);
  const lastSaveAt = useGameStore((s) => s.lastSaveAt);

  if (!open) return null;

  const set = (key: keyof typeof graphics, v: boolean) => {
    setGraphics({ [key]: v });
    onGraphicsChange();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[color-mix(in_oklab,var(--color-bg)_72%,transparent)] backdrop-blur-sm">
      <div className="glass-panel rounded-[var(--radius-xl)] w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            <h2
              className="text-sm font-semibold text-fg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Settings
            </h2>
          </div>
          <button
            type="button"
            className="p-2 min-h-11 min-w-11 flex items-center justify-center"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Post-processing
          </p>
          <Toggle
            label="Bloom"
            hint="Soft glow on torches, runes, and spell light"
            checked={graphics.bloom}
            onChange={(v) => set("bloom", v)}
          />
          <Toggle
            label="Depth of Field"
            hint="Cinematic edge blur away from center focus"
            checked={graphics.depthOfField}
            onChange={(v) => set("depthOfField", v)}
          />
          <Toggle
            label="Ambient Occlusion"
            hint="Subtle contact shadowing in corners and walls"
            checked={graphics.ambientOcclusion}
            onChange={(v) => set("ambientOcclusion", v)}
          />
          <Toggle
            label="Dynamic Spell Lights"
            hint="Temporary point lights on strikes and magic"
            checked={graphics.dynamicLights}
            onChange={(v) => set("dynamicLights", v)}
          />

          <div className="pt-3 border-t border-border mt-3">
            <button
              type="button"
              onClick={onSave}
              className="w-full min-h-11 rounded-[var(--radius-md)] bg-accent text-accent-fg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Progress
            </button>
            <p className="text-[10px] text-subtle mt-2 text-center">
              Autosaves ~45s · F5 manual
              {lastSaveAt
                ? ` · Last: ${new Date(lastSaveAt).toLocaleTimeString()}`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
