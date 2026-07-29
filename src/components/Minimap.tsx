import type { ReactNode } from "react";
import { useGameStore } from "@/game/store";
import type { Facing } from "@/game/types";

const CELL = 7;

function facingArrow(facing: Facing): string {
  return ["N", "E", "S", "W"][facing]!;
}

export function Minimap() {
  const cells = useGameStore((s) => s.cells);
  const explored = useGameStore((s) => s.explored);
  const player = useGameStore((s) => s.player);
  const facing = useGameStore((s) => s.facing);
  const mapW = useGameStore((s) => s.mapW);
  const mapH = useGameStore((s) => s.mapH);
  const seeker = useGameStore((s) => s.seekerActive);
  const mapName = useGameStore((s) => s.mapName);

  if (!mapW || !mapH || cells.length === 0) {
    return (
      <div className="glass-panel rounded-[var(--radius-lg)] p-3 w-[168px] h-[168px] flex items-center justify-center">
        <span className="text-muted text-xs tracking-wide">Map sealed</span>
      </div>
    );
  }

  const viewR = 9;
  const minX = Math.max(0, player.x - viewR);
  const maxX = Math.min(mapW - 1, player.x + viewR);
  const minZ = Math.max(0, player.z - viewR);
  const maxZ = Math.min(mapH - 1, player.z + viewR);
  const vw = maxX - minX + 1;
  const vh = maxZ - minZ + 1;

  const tiles: ReactNode[] = [];
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = cells[z]?.[x];
      const exp = explored[z]?.[x] || cell?.explored;
      const vis = cell?.visible;
      if (!exp) {
        tiles.push(
          <div
            key={`${x}-${z}`}
            style={{
              width: CELL,
              height: CELL,
              background: "color-mix(in oklab, #000 70%, transparent)",
            }}
          />,
        );
        continue;
      }

      let bg = "#2a2824";
      if (cell?.secret) bg = seeker || cell.secretRevealed ? "#3a6a80" : "#3a3834";
      else if (cell?.pushWall && !cell.pushOpen) bg = "#4a4840";
      else if (cell?.solid) {
        if (cell.kind === "tree") bg = "#1a3020";
        else if (cell.kind === "building") bg = "#5a4030";
        else if (cell.kind === "river") bg = "#2a5070";
        else if (cell.kind === "ruins") bg = "#5a5550";
        else bg = "#3a3834";
      } else if (cell?.kind === "grass") bg = "#2a4a30";
      else if (cell?.kind === "path" || cell?.kind === "cobble") bg = "#5a4a30";
      else if (cell?.kind === "marble" || cell?.kind === "carpet") bg = cell.kind === "carpet" ? "#6a3040" : "#6a6864";
      else if (cell?.kind === "moss") bg = "#3a4a32";
      else if (cell?.kind === "door" || cell?.kind === "gate") bg = "#5a4030";
      else if (cell?.kind === "stairs" || cell?.kind === "trapdoor") bg = "#8a8070";
      else if (cell?.kind === "chest" && !cell.lootTaken) bg = "#8a7020";
      else if (cell?.kind === "fountain") bg = "#3a6a8a";
      else if (cell?.kind === "tavern" || cell?.kind === "wood") bg = "#5a3a20";
      else if (cell?.kind === "teleporter") bg = "#3060d0";
      else if (cell?.kind === "rune") bg = "#2a5a30";
      else if (cell?.kind === "grate") bg = "#4a4a50";
      else bg = "#3a3830";

      if (cell?.enemyId && cell.visible) bg = "#6a3030";
      if (cell?.portalTo && vis) bg = "#7a6a40";
      if (!vis) bg = `color-mix(in oklab, ${bg} 45%, #000)`;

      const isPlayer = x === player.x && z === player.z;
      tiles.push(
        <div
          key={`${x}-${z}`}
          className="relative"
          style={{ width: CELL, height: CELL, background: bg }}
        >
          {isPlayer && (
            <span
              className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold leading-none text-accent"
              style={{ textShadow: "0 0 4px #c4b8a0" }}
            >
              {facingArrow(facing)}
            </span>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="glass-panel rounded-[var(--radius-lg)] p-3 select-none">
      <div className="flex items-center justify-between mb-2 px-0.5 gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {mapName}
        </span>
        <span className="text-[10px] text-subtle tabular-nums shrink-0">
          {player.x},{player.z}
        </span>
      </div>
      <div
        className="rounded-[var(--radius-sm)] overflow-hidden border border-border"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${vw}, ${CELL}px)`,
          width: vw * CELL,
          height: vh * CELL,
        }}
      >
        {tiles}
      </div>
    </div>
  );
}
