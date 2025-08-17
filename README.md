# Threadweaver

Compose a living city. Paint the sky. Talk to NPCs. Learn their story as though it mattered. Wander the vibe.

---

## Why this exists

Threadweaver is a tiny love‑letter to the characters games overlook. “NPC” started as a design term (non‑player character) but—let’s be honest—Gen Z slang sometimes uses “NPC” to mean background people, low‑key irrelevant, just vibing on autopilot. Threadweaver flips that. Here, the city is woven from those background lives. Gossip matters. Rent is late. Someone’s planning a speakeasy. You listen, tease, solve a riddle, and a life moves one step.

## Features

- Cinematic Three.js city with a default sunset (pink/orange) mood
- First‑person movement (WASD + Space) and visible hand
- Raycast chat: look toward a pedestrian, press `E`
- Live world controls (toggle with the gear button or `H`):
  - Sky color, fog, ambient/sun, neon accents
  - City ⇄ Nature mix, building density, tree density
  - People/car density, streetlight density, road spacing, world size
- NPCs with personality and arcs
  - Each has mood, family status, partner name (sometimes), hobby, stress, pet, favorites, and a gossip thread
  - First line is short and sometimes abrupt (“Busy. What?”)
  - Replies stay concise (1–2 lines), unpredictable in tone, and occasionally end with a tiny hook/riddle
  - Small arc progression each turn (in‑memory)
- Real‑time chat via OpenAI Responses API (not Chat Completions)

## Quickstart

1) Install deps and run the server
```bash
npm install
PORT=4000 npm run dev
```
2) Open `http://localhost:4000`

3) Controls
- `Enter` button or click canvas: lock pointer
- `W/A/S/D` to move, `Space` to jump
- `E` to talk to the pedestrian you’re looking at (or nearest in front)
- `H` (or the ⚙︎ button) to toggle the settings sidebar
- While typing in chat, movement keys are ignored so you can type freely

## Environment

Create a `.env` with:
```
OPENAI_API_KEY=sk-...
# Optional if your key is org/project‑scoped
OPENAI_ORG_ID=org_...
OPENAI_PROJECT_ID=proj_...
# Optional model override (default: gpt-4o-mini)
OPENAI_MODEL=gpt-4o
```
The server loads `.env` from the project root and falls back to `public/.env` if needed.

Health check (no secrets): `GET /api/health`

## Architecture

- Frontend: HTML/CSS + Three.js (PointerLock, custom city, raycasting)
- Backend: Node.js + Express
- Realtime chat: OpenAI Responses API `POST /v1/responses` with `model` + `input`
- NPC memory: in‑memory map (per‑process). Swap to file/SQLite for persistence across restarts.

Project layout:
```
public/
  index.html, styles.css, main.js
server.js
```

## Gameplay loop

- Roam the city → spot someone → press `E`.
- Short, unpredictable replies—some sweet, some brusque, some riddling.
- Learn tiny life threads: family drama, rent stress, partner names, rumors.
- Use the sidebar to change the world’s vibe while you play.

## Troubleshooting

- “PointerLockControls: Unable to use Pointer Lock API”
  - Click the canvas or `Enter` button to lock pointer (must follow user gesture). Close DevTools focus if needed.
- “Missing OPENAI_API_KEY” or `/api/chat` 500
  - Ensure `.env` is loaded (root or `public/.env`), then restart: `PORT=4000 npm run dev`
  - Test your key directly:
    ```bash
    curl -sS https://api.openai.com/v1/responses \
      -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"model":"gpt-4o-mini","input":"Say hello in one short sentence."}'
    ```
  - If your org requires a specific model, set `OPENAI_MODEL` (e.g., `gpt-4o`) and optionally `OPENAI_ORG_ID`/`OPENAI_PROJECT_ID`.
- “EADDRINUSE: 3000”
  - Free the port and relaunch on 4000:
    ```bash
    lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs -r kill -9
    PORT=4000 npm run dev
    ```

## Roadmap (ideas)
- Persistent NPC memory (file/SQLite)
- Codex of discovered characters and solved riddles
- Photo mode + postcard export
- Day/night cycle with weather presets switcher
- Better crowd behaviors and pathing

## Deploy / GitHub

Push to GitHub ([repo link](https://github.com/J0YY/threadweaver.git)):
```bash
git init
git add .
git commit -m "feat: initial Threadweaver city + NPC chat"
git branch -M main
git remote add origin https://github.com/J0YY/threadweaver.git
git push -u origin main
```

## License
MIT
