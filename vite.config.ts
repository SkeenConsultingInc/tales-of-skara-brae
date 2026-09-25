import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// Keep `nitro` gated to `build` (the Vercel deploy target): enabled in dev it
// opens a second dev-server port, which breaks the single-port preview.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(command === "build"
      ? [nitro({ preset: process.env.DOCKER === "1" ? "node-server" : "vercel" })]
      : []),
    viteReact(),
  ],
}));
