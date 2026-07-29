import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  onCommand: (code: string) => void;
  visible: boolean;
}

function Btn({
  label,
  onPress,
  children,
  className = "",
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[var(--radius-md)] glass-panel flex items-center justify-center text-fg active:scale-95 transition-transform duration-150 border-border ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      {children}
    </button>
  );
}

export function TouchControls({ onCommand, visible }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-28 left-3 right-3 sm:bottom-32 pointer-events-none z-20 flex justify-between items-end">
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <Btn label="Forward" onPress={() => onCommand("KeyW")}>
          <ChevronUp className="w-6 h-6" />
        </Btn>
        <div className="flex gap-1.5">
          <Btn label="Turn left" onPress={() => onCommand("KeyA")}>
            <ChevronLeft className="w-6 h-6" />
          </Btn>
          <Btn label="Back" onPress={() => onCommand("KeyS")}>
            <ChevronDown className="w-6 h-6" />
          </Btn>
          <Btn label="Turn right" onPress={() => onCommand("KeyD")}>
            <ChevronRight className="w-6 h-6" />
          </Btn>
        </div>
      </div>
    </div>
  );
}
