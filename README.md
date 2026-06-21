# Project Stillpoint — Room 1

Browser-based escape room: you wake trapped in a bedroom and must solve puzzles to escape while uncovering the truth about Project Stillpoint.

**Repo:** https://github.com/thomasmeston/project-stillpoint
**Stack:** Vite 6, TypeScript, Three.js, Howler

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve dist/
npm run package:itch  # build + stillpoint-itch.zip
```

## Controls

| Input | Action |
|-------|--------|
| Left click (floor) | Walk |
| Left click (object) | Examine / take / use |
| Inventory bar | Select item, then click target |
| Journal (top-right) | Open clue log |
| Middle mouse drag or ↺ / ↻ or Q/E or ←/→ | Rotate view |
| Shift + mouse wheel | Rotate view |
| Mouse wheel | Zoom |

## Puzzle flow

1. Find time clue → set wall clock to **3:17** → open desk drawer
2. Rearrange photo backs → spell **STILL** → reveal wall safe → get key blade
3. Combine key blade + handle → unlock wardrobe
4. Use cipher disk + letter → door padlock **STILLPOINT** → escape

## Project layout

```
src/          TypeScript game code
data/         Puzzles, story, room layout (JSON)
public/       Static assets (audio, future GLB models)
legacy/godot/ Archived Godot MVP (reference only)
```

## Data-driven content

- `data/puzzles/bedroom.json` — puzzle solutions, gates, item uses
- `data/story/bedroom-script.json` — examine text, journal, thoughts, ending
- `data/rooms/bedroom.json` — room layout, props, hotspots, lighting
- `data/items.json` — inventory and combine rules

## Deploy

Push to `main` triggers GitHub Pages workflow (`.github/workflows/deploy-pages.yml`).

## Verification

1. `npm run dev` → complete escape path without skips
2. Journal entries populate at clue milestones
3. `npm run build && npm run preview` loads without console errors
