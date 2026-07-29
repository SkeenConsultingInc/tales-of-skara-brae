import { createFileRoute } from "@tanstack/react-router";
import { DungeonGame } from "@/components/DungeonGame";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="w-full h-[100dvh] overflow-hidden">
      <DungeonGame />
    </main>
  );
}
