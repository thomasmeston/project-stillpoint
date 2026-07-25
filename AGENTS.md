# AGENTS.md — Project Stillpoint

> Harness-neutral handoff for Cody, Cloud Cody, or any coding agent.
> Last updated: 2026-07-25

## What this is

Browser isometric escape room (hub-and-spoke): wake amnesiac in a locked bedroom, dual-read crow-cosmology vs memory, Meditate to open portal levels (Ship first), earn lessons that re-gate the bedroom escape. Final padlock **STILLPOINT**. Full pitch: `README.md`. Narrative design: `StoryPlan.md`.

**GitHub:** https://github.com/thomasmeston/project-stillpoint  
**Local path:** `C:\Users\thoma\OneDrive\Documents\GitHub\project-stillpoint`  
**Agent OS:** `C:\Users\thoma\agent-os\context\projects\project-stillpoint.md`

## Stack

| Layer | Tech |
|-------|------|
| Build | Vite 6, TypeScript |
| 3D | Three.js (isometric room, click-to-move) |
| Audio | Howler (+ Web Audio synth SFX fallback) |
| Content | JSON under `data/` |
| Character | Papercraft GLB — `public/models/characters/man-papercraft.glb` |
| Legacy | Godot MVP archived in `legacy/godot/` — do not maintain |

## Read first (in order)

1. `Handoff.md` — current goal, done, next
2. `README.md` — setup, controls, puzzle flow, deploy
3. `data/puzzles/bedroom.json` — puzzle solutions, gates, item uses
4. `data/story/bedroom-script.json` — examine text, journal, thoughts, ending
5. `data/rooms/bedroom.json` — room layout, props, hotspots, lighting
6. `src/game/Game.ts` — main loop, input, puzzle UI wiring
7. `src/scene/ViewWallController.ts` — Tiny Room Stories–style wall rotation

## Key paths

| Path | Purpose |
|------|---------|
| `src/game/` | GameState, PuzzleManager, Inventory, Narrative, PlayerMover, Audio, SaveLoad |
| `src/scene/` | RoomBuilder, IsoCamera, ViewWallController, Hotspot, WallFace |
| `src/ui/` | DOM HUD, puzzle modals (clock, photo cipher, padlock) |
| `data/` | Puzzles, story, room layout, items (JSON) |
| `public/models/characters/` | Player GLB + future props |
| `public/audio/` | SFX/music drop-in (optional) |
| `legacy/godot/` | Archived Godot MVP — reference only |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deploy on push to `main` |

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build → dist/
npm run preview      # serve dist locally
npm run package:itch # build + stillpoint-itch.zip
```

## Verification profile

| Check | Command | When required |
|-------|---------|---------------|
| Typecheck + build | `npm run build` | Any TS/game logic change |
| Local play smoke | `npm run dev` — walk, examine, one puzzle step | Gameplay/UI changes |
| Full escape | Complete clock → photos → key → padlock → win | Before calling slice done |
| Preview build | `npm run build && npm run preview` — no console errors | Deploy or asset path changes |
| GitHub Pages | Push to `main`; workflow builds `dist/` | Deploy-related changes |

**Rule:** Don't claim puzzle feel is correct from build alone — browser play-through is the gate.

## Controls

| Input | Action |
|-------|--------|
| Left click (floor) | Walk |
| Left click (object) | Examine / take / use |
| Inventory bar | Select item, then click target |
| Journal (top-right) | Open clue log |
| ↺ / ↻ or Q/E or ←/→ | Rotate view (walls animate) |
| Shift + mouse wheel | Rotate view |
| Mouse wheel | Zoom |
| Middle mouse drag | Pan camera |

## Puzzle flow (escape path)

1. Find time clue → set wall clock to **3:17** → open desk drawer
2. Rearrange photo backs → spell **STILL** → reveal wall safe → get key blade
3. Use key blade on wardrobe → unlock wardrobe
4. Use cipher disk + letter → door padlock **STILLPOINT** → escape

## Architecture notes

- **View rotation:** Four fixed isometric poses (north/east/south/west). Opposite wall drops; facing + side walls stay up. Props/hotspots animate with walls (`ViewWallController`, `IsoCamera`).
- **Player:** `PlayerMover` loads GLB via `GLTFLoader`; `AnimationMixer` crossfades idle/walk clips (`HumanArmature|Man_Idle`, `HumanArmature|Man_Walk`).
- **Data-driven:** Puzzle/narrative/room content lives in JSON — prefer editing `data/` over hardcoding.
- **Deploy:** `base: './'` in `vite.config.ts` for GitHub Pages + itch.io relative paths.

## Conventions

- Only commit when Thomas explicitly asks.
- Minimize diff; match existing Three.js/TS patterns in `src/game/` and `src/scene/`.
- Do not revive or maintain `legacy/godot/` unless explicitly requested.
- Large assets in `public/` — avoid unnecessary churn; note CC-BY when not CC0.
- Wall-parented Dev Mode edits: use wall **rest pose**, never folded `wall.position`.
- `localStorage` `dev_room_layout_*` overrides room JSON — retire/rename props when re-placing.

## Active work

See `Handoff.md` and Agent OS slice **A-002** in `C:\Users\thoma\agent-os\memory\active-work.md`.
Next: portal-level depth; cork/wall-notes narrative; Pages confirm; remaining placeholder GLBs.

## Agent OS registration

Project context: `C:\Users\thoma\agent-os\context\projects\project-stillpoint.md`
