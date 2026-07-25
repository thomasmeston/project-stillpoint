# Project Stillpoint

A browser isometric escape room about amnesia, obsession, and what you locked yourself away from.

You wake in a locked bedroom with no memory of how you got there. The room is dense with evidence — wall notes, a cork board of crow “gifts,” a sketchbook, a typewriter, photographs, and a door that will not open until you understand enough. Every object can read two ways: as part of a private cosmology built from scraps left by a crow, or as a fragment of a life (family, friends, a daughter) you abandoned and forgot.

**How it plays:** Click-to-move exploration in a Tiny Room Stories–style room — four fixed isometric views with walls that fold so you can see into the space. Examine, take, and combine items; keep clues in a journal; listen for inner thoughts. **Meditate** after inspecting the wall clock: hold focus to open portals into mythologized memory-levels (Ship Deck first; Garden, Cavern, and Observatory unlock as you progress). Lessons you earn on those decks feed back into the bedroom and re-gate the classic escape path. The final padlock word is **STILLPOINT** — escape is mechanical, but the story is about what leaving the room means.

**Repo:** https://github.com/thomasmeston/project-stillpoint  
**Stack:** Vite 6, TypeScript, Three.js, Howler  
**Status:** Bedroom hub + Ship Deck playable; further portal levels and narrative dual-reads still expanding.

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
| Meditate (header) | Face close-up; hold focus to open portals (bedroom) |
| ↺ / ↻ or Q/E or ←/→ | Rotate view (walls animate) |
| Shift + mouse wheel | Rotate view |
| Mouse wheel | Zoom |
| Middle mouse drag | Pan / orbit camera |
| Esc | Escape menu (volume, load) |

## Escape path (bedroom)

1. Inspect the clock → Meditate → open the Ship portal → learn **ANCHOR** (unlocks using the clock)
2. Set wall clock to **3:17** → open desk drawer
3. Rearrange photo backs → spell **STILL** → wall safe → key blade (later lessons unlock key assembly / wardrobe / door gates)
4. Cipher disk + letter → door padlock **STILLPOINT** → escape (door also requires all four lessons)

## Project layout

```
src/          TypeScript game code
data/         Puzzles, story, room layout (JSON)
public/       Models, audio, static assets
docs/         Narrative extras
legacy/godot/ Archived Godot MVP (reference only)
```

## Data-driven content

- `data/puzzles/bedroom.json` — puzzle solutions, gates, item uses
- `data/story/bedroom-script.json` — examine text, journal, thoughts, ending
- `data/rooms/bedroom.json` — room layout, props, hotspots, lighting
- `data/rooms/pirate-ship.json` — Ship Deck layout
- `data/items.json` — inventory item definitions
- `StoryPlan.md` — dual-track narrative design

## Deploy

Push to `main` triggers GitHub Pages workflow (`.github/workflows/deploy-pages.yml`).

## Verification

1. `npm run dev` → bedroom walk, meditate → ship portal, return; one bedroom puzzle step
2. Journal / thoughts update at clue milestones
3. `npm run build && npm run preview` loads without console errors
