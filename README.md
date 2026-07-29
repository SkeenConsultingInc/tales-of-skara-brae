# Tales of Skara Brae

A web-based, first-person **grid dungeon crawler** inspired by *The Bard’s Tale* — Three.js 3D, turn-based combat, multi-map world, bard songs, quests, inventory, and local save.

Play in any modern desktop browser (Chrome, Firefox, Edge, Safari).

---

## Play in a desktop browser (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

### One command

```bash
docker compose up --build
```

Then open **[http://localhost:8080](http://localhost:8080)** in your browser.

Stop with `Ctrl+C`, or in another terminal:

```bash
docker compose down
```

### Equivalent `docker` CLI

```bash
docker build -t tales-of-skara-brae .
docker run --rm -p 8080:8080 tales-of-skara-brae
```

---

## Local development (without Docker)

Requires **Node.js 22+**.

```bash
npm ci
npm run dev
# → http://localhost:8080
```

Other scripts:

| Command | Purpose |
|--------|---------|
| `npm run build` | Production build (Vercel / Nitro) |
| `DOCKER=1 npm run build` | Production build for container (`node-server`) |
| `npm start` | Run Nitro server from `.output` after Docker build |
| `npm run typecheck` | TypeScript check |

---

## Demo quest (quick path)

1. Start in **The Scarlet Bard** — press **E** to talk to Innkeeper Brann  
2. South Gate → **Outer Wilds** → moss **trapdoor** → **Forgotten Crypt**  
3. Defeat the **Cultist Leader** (multi-stage boss) → claim the **Eldritch Medallion**  
4. Return to Brann → castle **dungeon** unlocks  
5. Defeat the **Dungeon Warden**

| Key | Action |
|-----|--------|
| W A S D | Move / turn |
| E / Space | Talk / interact |
| I | Inventory |
| J | Quest journal |
| O | Graphics (bloom / DoF / AO) |
| 1 2 3 | Bard songs |
| F5 | Save |

Progress autosaves to **localStorage** in the browser.

---

## IaC & deploy layout

```
Dockerfile              # multi-stage Node 22 build → Nitro node-server on :8080
docker-compose.yml      # desktop-friendly one-shot host
deploy/k8s/
  deployment.yaml       # optional Kubernetes Deployment + Service
```

### Kubernetes (optional)

```bash
docker build -t tales-of-skara-brae:latest .
kubectl apply -f deploy/k8s/deployment.yaml
```

Point the image at your registry if the cluster cannot use a local tag.

---

## Stack

- React 19 · TypeScript · Vite · TanStack Start  
- Three.js (PBR-ish materials, post-FX, spatial audio via Web Audio API)  
- Tailwind CSS v4 · Zustand  
- Nitro (Vercel preset for cloud; `node-server` for Docker)

---

## License

Personal / demo project. Art and audio are procedural (no third-party sample packs).
