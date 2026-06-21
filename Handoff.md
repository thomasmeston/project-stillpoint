# Handoff — Project Stillpoint (Room 1)

> Last updated: 2026-06-20

## Context

Room 1 rebuilt as a browser game (Vite + TypeScript + Three.js). Godot MVP archived to `legacy/godot/`. Repo lives at https://github.com/thomasmeston/project-stillpoint.

**Package name:** `project-stillpoint` (npm). **Itch zip:** `stillpoint-itch.zip` via `npm run package:itch`.

## Done

### Core gameplay

- Core systems: GameState, PuzzleManager, Inventory, Narrative, SaveLoad, Audio
- Three.js isometric scene: RoomBuilder, hotspots, click-to-move
- Tiny Room Stories–style view rotation (4 walls, animated drop/rise)
- DOM HUD + four puzzle modals; full escape path wired
- 2D circle-to-AABB sliding collision on the gameplay plane (walls + furniture props)
- Stuck-state detection cancels walk animation when blocked by obstacles
- `npm run build` passes; GitHub Pages workflow present
- **Branding cleanup:** all "Lonnie" / "Lonnie Crow" references removed from repo; player is second-person "you"

### Player & camera

- Player model: custom papercraft GLB (`public/models/characters/man-papercraft.glb`), Meshy AI–rigged, with skeletal walk/idle and procedural breathing/idle bob
- Spawn beside the bed (`spawn.player`: −1.35, 0, 1.05)
- Centered room in viewport; middle-mouse drag for camera orbit; middle-click triggers one counter-clockwise rotation
- Wall folding raises only the two back corner walls per view; side/front walls drop so props stay visible
- Fixed rotation sign errors in North/South wall folding; room shell and camera Z-bounds centered at Z = 0
- Fixed camera rotation warp bug (relative yaw accumulates without normalization snap)
- Orthographic zoom range 4–15 (was 8–14)
- **`IsoCamera.captureSnapshot()` / `restoreSnapshot()`** for saving and restoring camera state (used by Meditate)

### Audio & menus

- Web Audio synthesizer fallback in `AudioManager.ts` for missing `.ogg` SFX (click, door unlock, rotate woosh)
- Background music: `public/audio/Glass Rain Drift.mp3` via Howler at 20% default volume
- Camera rotation woosh (`playSfx('rotate')`) on view rotation start
- Glassmorphic **Main Menu** with 3 save slots, orbit camera showcase, load/delete/reset
- **Autosave** to localStorage on flag change, puzzle solve, inventory change, journal update, hotspot state change, and player walk stop
- **Escape Menu** (ESC): BGM volume + mute; blocks movement and rotation while open
- **Floating Words Intro** on new game: 65 words (13 core + 52 themed), Outfit font, 8×9 grid layout, sizes 0.7–5.5 rem; click 5 to clear with tick SFX and fade-out; skipped via `intro_words_cleared` flag on load

### Meditate

- **Meditate** button at bottom center of HUD (inventory bar sits above it)
- Click → camera swings to close-up on player face (`PlayerMover.getHeadWorldPosition()` + facing yaw); canvas blurs; discovered journal clues and inner thoughts float on screen (intro-style drift animation via `MeditationOverlay.ts`)
- Content from `NarrativeManager.getMeditationFragments()` — journal entries, heard thoughts, examine/flag inner voice; fallback words if nothing discovered yet
- **Return** button (same control) or **Esc** exits and restores pre-meditate camera snapshot
- Blocks gameplay input while active (`meditateActive`); hidden during desk/wall detail zoom

### Narrative voice

- Inner voice / `thoughts` in `data/story/bedroom-script.json` rewritten to cryptic, memory-fogged tone (fragmented, uncertain, puzzle hints veiled)
- `NarrativeManager` tracks `heardThoughtIds` in save data; examine/flag thoughts now resolve to display text correctly in HUD toast

### Room art & interactables

- Window view: muted tropical beach texture (`public/images/beach.png`) on `WindowGlass`
- **Oak tree painting:** procedural canvas texture (`OakTreePaintingArt.ts`); **swing-open animation** on first examine (`PaintingRevealController.ts`) sets `painting_moved` and reveals wall safe
- **Wall notes cluster:** ~30 procedural cryptic papers pinned on north wall (`WallNotesCluster.ts`, `CrypticPaperArt.ts`); examine hotspot walks player in and enters detail zoom
- **Desk sketch spread:** procedural papers + sketchbook on desk surface (`DeskSketchSpread.ts`); visible during desk detail zoom — toggle sketchbook open/close, inspect individual papers
- **Procedural props:** bedside lamp (`BedsideLampProp.ts`), desk mug with pens (`DeskMugProp.ts`)
- **Chair GLB:** poly.pizza wooden chair at `public/models/chair.glb` (CC0)
- Desk lamp detached from wall fold logic (`LampBase`, `LampShade` in `FLOOR_ONLY_PROPS`)
- Individual desk/nightstand props in room data: `Phone`, `Sketchbook`, `CrowFigurine` with examine hotspots and narrative text
- **Phone-in-safe puzzle:** phone prop hidden in wall safe until unlocked; `syncSafeVisuals()` toggles safe/phone visibility; phone added to inventory on safe open

### Detail zoom modes

Shared `isDetailZoomed` flag blocks normal input (walk, rotation, wheel zoom) while active. HUD shows **↩ Back** via `showZoomControls()`.

| Mode | Trigger | Camera | In-zoom interaction |
|------|---------|--------|---------------------|
| **Desk** | Examine `desk` hotspot → walk to approach position → `zoomToDesk()` | Top-down (pitch −90°, size 1.4) | Click sketchbook to spread papers; click papers to inspect/dismiss |
| **Wall notes** | Examine `wall_notes` → walk → `zoomToWallNotes()` | Front-on wall (pitch 0°, size 1.15); player hidden | Click papers to inspect/dismiss |

`IsoCamera.zoomTo(target, size, pitch?, yaw?)` and `getYawForViewIndex()` support arbitrary transitions.

> **Note:** Chair sit/stand with procedural bone posing was implemented briefly (`3c7371a`) but **removed** in favor of walk-to + detail zoom. Chair hotspot is examine-only today.

### Dev Mode

Toggle from escape menu or `` ` `` key. Two tabs:

- **Layout:** select props/hotspots/lights (Ctrl/Shift multi-select), nudge position/rotation, 50-state undo/redo (`Ctrl+Z`/`Ctrl+Y`), copy layout JSON, reset from repo defaults, **Save Layout** → writes `data/rooms/bedroom.json` via Vite dev plugin (`/__dev/save`) or downloads JSON
- **Text:** edit examine copy and item labels/descriptions with localStorage preview overrides (`DevContentOverrides.ts`); **Save Text** → writes `data/story/bedroom-script.json` + `data/items.json`; **Exit Dev Mode** sits below Reset Text Overrides in Text tab; selecting **— select item —** clears item label/description fields

Parent/child relationships for grouped nudging defined in `DevMover.ts` `RELATIONSHIPS` map.

### Testing

- Playwright e2e: `tests/e2e/desk-zoom.spec.ts` — desk examine → top-down zoom controls (intro skipped programmatically)

## Puzzle flow (escape path)

1. Find time clue → set wall clock to **3:17** → desk drawer unlocks
2. Open desk drawer → photos + receipt
3. Examine painting → swing-open animation → wall safe revealed (`painting_moved`)
4. With photos, painting examine opens photo cipher → spell **STILL** → safe combo known
5. Wall safe padlock **STILL** → safe opens → key blade + phone
6. Combine key blade + handle (nightstand) → unlock wardrobe
7. Cipher disk + letter → door padlock **STILLPOINT** → escape

## Next

1. **Desk detail layer** — in top-down zoom, make lamp, phone, drawer, and mug individually clickable (hover/tooltips); sketchbook/papers work today
2. **Wall notes** — tie inspected papers to journal clues or a future puzzle beat (visual inspect only today)
3. **Meditate polish** — tune face close-up framing for papercraft model; filter/tokenize floating fragments for readability at high journal count
4. **Chair interaction** — decide whether to restore sit/stand bone animation or keep examine-only with walk-to-desk flow
5. **Add OGG SFX** to `public/audio/` (click, door unlock, rotate). Synth fallback works; real audio will feel better
6. **Replace remaining placeholder box/cylinder props** with GLB art (bed, desk, nightstand, bookshelf, wardrobe — chair done)
7. **Enable GitHub Pages** on repo Settings → Pages (workflow deploys from `main`)
8. Expand Playwright coverage (full escape path, wall notes zoom, meditate)
9. Optional: itch.io upload via `npm run package:itch`

## Checklist

- [x] Full escape path (clock → photos → painting → safe → key → padlock → win)
- [x] Journal clues populate at milestones
- [x] View rotation on all four walls; hotspots stay interactable
- [x] Walk/idle animations on click-to-move
- [x] Main Menu with 3 save slots
- [x] Autosave on key gameplay events
- [x] Escape Menu with BGM controls
- [x] Floating Words intro on new game
- [x] Meditate: face zoom, blur, floating discovered clues/thoughts
- [x] Cryptic inner-voice rewrite in `bedroom-script.json`
- [x] Desk lamp stays grounded during wall folds
- [x] Desk items individually examinable (phone, sketchbook, lamp, chair)
- [x] Desk examine → walk-to → top-down zoom with back button
- [x] Desk sketchbook spread + paper inspect in zoom view
- [x] Wall notes examine → zoom + paper inspect
- [x] Painting swing-open reveal + phone-in-safe flow
- [x] Procedural painting, papers, mug, bedside lamp
- [x] Chair GLB (`public/models/chair.glb`)
- [x] Dev Mode layout + text editor with save-to-repo (dev server)
- [x] Playwright desk-zoom smoke test
- [x] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy
- [ ] Desk zoom: lamp / phone / drawer clickable
- [ ] Wall notes tied to puzzle/narrative beats
- [ ] All placeholder props replaced with real GLB models

## Key files

| Path | Purpose |
|------|---------|
| `src/game/Game.ts` | Main loop, detail zoom, meditate, painting/safe flow, menus, autosave |
| `src/game/PlayerMover.ts` | GLB load, walk/collision, head position for meditate zoom |
| `src/game/NarrativeManager.ts` | Journal/thoughts, `getMeditationFragments()`, save data |
| `src/ui/MeditationOverlay.ts` | Floating clue/thought overlay during meditate |
| `src/game/DevMover.ts` | Dev layout + text editor UI |
| `src/game/DevSave.ts` | Serialize layout/content; POST to `/__dev/save` |
| `src/scene/DeskSketchSpread.ts` | Desk papers + sketchbook in zoom view |
| `src/scene/WallNotesCluster.ts` | Wall papers in zoom view |
| `src/scene/PaintingRevealController.ts` | Painting swing-open animation |
| `src/scene/RoomBuilder.ts` | Room build, GLB load, `FLOOR_ONLY_*` sets, safe/phone sync |
| `src/scene/ViewWallController.ts` | Wall rotation animation |
| `src/scene/IsoCamera.ts` | Orthographic camera, zoom/rotate, snapshot restore |
| `data/rooms/bedroom.json` | Layout, props, hotspots, spawn |
| `data/puzzles/bedroom.json` | Puzzles, gates, hotspot actions |
| `data/story/bedroom-script.json` | Examine text, journal, inner voice |
| `scripts/vite-plugin-dev-save.ts` | Dev-only write-back to `data/` |
| `tests/e2e/desk-zoom.spec.ts` | Desk zoom Playwright smoke |

## Blockers / notes

- **Player model:** `public/models/characters/man-papercraft.glb` (custom, Meshy-rigged). Legacy Quaternius suit and other character GLBs remain in `public/models/characters/` but are unused.
- **Chair model:** `public/models/chair.glb` (CC0, [poly.pizza](https://poly.pizza/m/13AL0KYItKD)).
- **`FLOOR_ONLY_PROPS`** and **`FLOOR_ONLY_HOTSPOTS`** in `RoomBuilder.ts` control which objects stay grounded during wall animations. Add new floor/desk props and hotspots there.
- Detail zoom blocks input via `isDetailZoomed` (`isDeskZoomed || isWallNotesZoomed`) in `Game.ts`. Meditate, ESC menu, and Dev Mode also block gameplay input.
- Dev **Save Layout / Save Text** only writes to disk when running `npm run dev` (Vite plugin). Production/preview builds fall back to JSON download.
- Agent OS registered; project context at `C:\Users\thoma\agent-os\context\projects\project-stillpoint.md`.
