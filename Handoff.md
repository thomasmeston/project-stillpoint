# Handoff — Project Stillpoint (Room 1 + Ship Deck)

> Last updated: 2026-06-23

## Context

Room 1 rebuilt as a browser game (Vite + TypeScript + Three.js). Godot MVP archived to `legacy/godot/`. Repo lives at https://github.com/thomasmeston/project-stillpoint.

**Package name:** `project-stillpoint` (npm). **Itch zip:** `stillpoint-itch.zip` via `npm run package:itch`.

The game now supports **multi-room loading** (`bedroom`, `pirate_ship`) with save persistence of `currentRoom` (save `version: 2`).

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
- **Multi-room core:** `Game.loadRoom(roomId)` swaps room JSON, puzzles, story, input targets, and scene background; bedroom-only features (desk/wall zoom, painting reveal, floor portal) gated by `currentRoomId`

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
- **Autosave** to localStorage on flag change, puzzle solve, inventory change, journal update, hotspot state change, player walk stop, and room transitions
- **Escape Menu** (ESC): BGM volume + mute; blocks movement and rotation while open
- **Floating Words Intro** on new game: 65 words (13 core + 52 themed), Outfit font, 8×9 grid layout, sizes 0.7–5.5 rem; click 5 to clear with tick SFX and fade-out; skipped via `intro_words_cleared` flag on load
- Fixed intro overlay CSS parse error (`hud.css` `-webkit-mask` missing `)`) that prevented intro styles from applying

### Meditate

- **Meditate** button at bottom center of HUD (inventory bar sits above it); **hidden on Ship Deck**
- Click → camera swings to close-up on player face (`PlayerMover.getHeadWorldPosition()` + facing yaw); canvas blurs; discovered journal clues and inner thoughts float on screen (intro-style drift animation via `MeditationOverlay.ts`)
- Content from `NarrativeManager.getMeditationFragments()` — journal entries, heard thoughts, examine/flag inner voice; fallback words if nothing discovered yet
- **Dedicated Return button** inside meditate overlay (`#meditate-return-btn`) — always visible, not blurred
- **Hold mechanic:** sentences stay visible while holding ball in center; screen pulses for entire hold; after **5 s** hold sentences fade and ball becomes still (stops fleeing cursor); releasing ball resets hold and brings sentences back
- **Portal unlock gate:** if player has heard **≥4 inner thoughts** (`heardThoughtIds`) and completes a 5 s center hold, overlay shows **"A door has opened."** and sets `meditation_portal_opened` flag
- **Return** (overlay button or header) or **Esc** exits and restores pre-meditate camera snapshot; if portal unlocked, bedroom floor hole appears on return
- Blocks gameplay input while active (`meditateActive`); hidden during desk/wall detail zoom

### Meditation portal → Pirate Ship (MVP)

- **Bedroom floor portal:** procedural black-hole mesh + `floor_portal` hotspot; hidden until `meditation_portal_opened`; animates open on meditate exit
- **Fall transition:** ~3 s DOM cinematic (`FallTransition.ts`) — darkens screen, streaks, swaps room mid-blackout
- **Ship Deck level** (`pirate_ship`): procedural colorful deck (mast + striped sail, wheel, crates, barrels, cannon, treasure chest); bright directional sun + sea-blue background
- **Ship puzzles:** examine wheel/mast/crates; chest padlock code **ANCHOR** (hint branded on green crate)
- **Return to Room** button in HUD view controls (next to rotate buttons) — visible only on ship; instant load back to bedroom spawn with autosave
- Ship data: `data/rooms/pirate-ship.json`, `data/puzzles/pirate-ship.json`, `data/story/pirate-ship-script.json`

### Narrative voice

- Inner voice / `thoughts` in `data/story/bedroom-script.json` rewritten to cryptic, memory-fogged tone (fragmented, uncertain, puzzle hints veiled)
- `NarrativeManager` tracks `heardThoughtIds` in save data; `getHeardThoughtCount()` for portal gate; per-room story load via `loadRoom(roomId)`
- Ship narrative in `data/story/pirate-ship-script.json` (arrival journal, crate clue, chest open)

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

Shared `isDetailZoomed` flag blocks normal input (walk, rotation, wheel zoom) while active. HUD shows **↩ Back** via `showZoomControls()`. Bedroom only.

| Mode | Trigger | Camera | In-zoom interaction |
|------|---------|--------|---------------------|
| **Desk** | Examine `desk` hotspot → walk to approach position → `zoomToDesk()` | Top-down (pitch −90°, size 1.4) | Click sketchbook to spread papers; click papers to inspect/dismiss |
| **Wall notes** | Examine `wall_notes` → walk → `zoomToWallNotes()` | Front-on wall (pitch 0°, size 1.15); player hidden | Click papers to inspect/dismiss |

`IsoCamera.zoomTo(target, size, pitch?, yaw?)` and `getYawForViewIndex()` support arbitrary transitions.

> **Note:** Chair sit/stand with procedural bone posing was implemented briefly (`3c7371a`) but **removed** in favor of walk-to + detail zoom. Chair hotspot is examine-only today.

### Dev Mode

Toggle from escape menu or `` ` `` key. Two tabs. **Bedroom only** (ship not supported in dev editor yet).

- **Layout:** select props/hotspots/lights (Ctrl/Shift multi-select), nudge position/rotation, 50-state undo/redo (`Ctrl+Z`/`Ctrl+Y`), copy layout JSON, reset from repo defaults, **Save Layout** → writes `data/rooms/bedroom.json` via Vite dev plugin (`/__dev/save`) or downloads JSON
- **Text:** edit examine copy and item labels/descriptions with localStorage preview overrides (`DevContentOverrides.ts`); **Save Text** → writes `data/story/bedroom-script.json` + `data/items.json`; **Exit Dev Mode** sits below Reset Text Overrides in Text tab; selecting **— select item —** clears item label/description fields

Parent/child relationships for grouped nudging defined in `DevMover.ts` `RELATIONSHIPS` map.

### Testing

- Playwright e2e:
  - `tests/e2e/desk-zoom.spec.ts` — desk examine → top-down zoom controls
  - `tests/e2e/intro.spec.ts` — intro overlay visibility/styles regression
  - `tests/e2e/meditation-portal.spec.ts` — portal gate, fall → ship, return-to-bedroom button

## Puzzle flow (escape path)

### Bedroom (Room 1)

1. Find time clue → set wall clock to **3:17** → desk drawer unlocks
2. Open desk drawer → photos + receipt
3. Examine painting → swing-open animation → wall safe revealed (`painting_moved`)
4. With photos, painting examine opens photo cipher → spell **STILL** → safe combo known
5. Wall safe padlock **STILL** → safe opens → key blade + phone
6. Combine key blade + handle (nightstand) → unlock wardrobe
7. Cipher disk + letter → door padlock **STILLPOINT** → escape

### Meditation portal (optional branch)

1. Hear **≥4 inner thoughts** (examine objects, journal milestones, flags)
2. **Meditate** → hold focus ball center **5 s** → "A door has opened."
3. **Return** → black hole appears on bedroom floor
4. Click portal → ~3 s fall → **Ship Deck**

### Ship Deck (MVP)

1. Examine stacked crates → journal clue **ANCHOR**
2. Treasure chest padlock → **ANCHOR** → chest opens (starter puzzle chain; more puzzles TBD)

## Next

1. **Ship escape chain** — expand beyond chest padlock; tie back to Project Stillpoint lore
2. **Return path polish** — optional reverse fall cinematic bedroom ← ship (today: instant **Return to Room**)
3. **Desk detail layer** — in top-down zoom, make lamp, phone, drawer, and mug individually clickable (hover/tooltips); sketchbook/papers work today
4. **Wall notes** — tie inspected papers to journal clues or a future puzzle beat (visual inspect only today)
5. **Meditate polish** — tune face close-up framing for papercraft model; filter/tokenize floating fragments for readability at high journal count
6. **Chair interaction** — decide whether to restore sit/stand bone animation or keep examine-only with walk-to-desk flow
7. **Add OGG SFX** to `public/audio/` (click, door unlock, rotate). Synth fallback works; real audio will feel better
8. **Replace remaining placeholder box/cylinder props** with GLB art (bed, desk, nightstand, bookshelf, wardrobe — chair done)
9. **Enable GitHub Pages** on repo Settings → Pages (workflow deploys from `main`)
10. Expand Playwright coverage (full escape path, wall notes zoom, full portal path with real 5 s hold)
11. **Dev Mode on ship** — layout/text editor for `pirate-ship` JSON
12. Optional: itch.io upload via `npm run package:itch`

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
- [x] Meditate hold/pulse/still-ball mechanics + portal unlock gate
- [x] Meditation portal → fall → Ship Deck level
- [x] Ship Deck: Return to Room button
- [x] Multi-room save/load (`currentRoom`, save v2)
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
- [x] Playwright desk-zoom, intro, meditation-portal smoke tests
- [x] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy
- [ ] Desk zoom: lamp / phone / drawer clickable
- [ ] Wall notes tied to puzzle/narrative beats
- [ ] All placeholder props replaced with real GLB models
- [ ] Full ship escape chain beyond MVP chest puzzle

## Key files

| Path | Purpose |
|------|---------|
| `src/game/Game.ts` | Main loop, `loadRoom()`, portal/fall/return, detail zoom, meditate, menus, autosave |
| `src/game/PlayerMover.ts` | GLB load, walk/collision, head position for meditate zoom |
| `src/game/NarrativeManager.ts` | Journal/thoughts, `getMeditationFragments()`, `getHeardThoughtCount()`, per-room story |
| `src/game/PuzzleManager.ts` | Per-room puzzles/hotspots via `loadRoom(roomId)` |
| `src/game/SaveLoad.ts` | Save v2 with `currentRoom` |
| `src/ui/MeditationOverlay.ts` | Focus ball, hold/pulse, portal message, unlock callback |
| `src/ui/HUD.ts` | Meditate/Return/Return-to-Room buttons, room title |
| `src/scene/FallTransition.ts` | ~3 s fall cinematic (bedroom → ship) |
| `src/scene/RoomBuilder.ts` | Room build by `roomId`, floor portal, ship lighting |
| `src/scene/ViewWallController.ts` | Wall rotation animation; `reset()` on room swap |
| `src/scene/DeskSketchSpread.ts` | Desk papers + sketchbook in zoom view |
| `src/scene/WallNotesCluster.ts` | Wall papers in zoom view |
| `src/scene/PaintingRevealController.ts` | Painting swing-open animation |
| `src/scene/IsoCamera.ts` | Orthographic camera, zoom/rotate, snapshot restore |
| `data/rooms/bedroom.json` | Bedroom layout, props, hotspots, spawn, floor portal |
| `data/rooms/pirate-ship.json` | Ship deck layout (procedural props) |
| `data/puzzles/bedroom.json` | Bedroom puzzles, gates, hotspot actions |
| `data/puzzles/pirate-ship.json` | Ship chest padlock puzzle |
| `data/story/bedroom-script.json` | Bedroom examine text, journal, inner voice |
| `data/story/pirate-ship-script.json` | Ship examine text, journal, inner voice |
| `scripts/vite-plugin-dev-save.ts` | Dev-only write-back to `data/` |
| `tests/e2e/meditation-portal.spec.ts` | Portal gate, fall, return-to-room e2e |

## Blockers / notes

- **Player model:** `public/models/characters/man-papercraft.glb` (custom, Meshy-rigged). Legacy Quaternius suit and other character GLBs remain in `public/models/characters/` but are unused.
- **Chair model:** `public/models/chair.glb` (CC0, [poly.pizza](https://poly.pizza/m/13AL0KYItKD)).
- **`FLOOR_ONLY_PROPS`** and **`FLOOR_ONLY_HOTSPOTS`** in `RoomBuilder.ts` control which objects stay grounded during wall animations. Add new floor/desk props and hotspots there.
- **`OBSTACLE_IDS`** in `RoomBuilder.ts` lists props that block player movement (bedroom + ship props).
- Detail zoom blocks input via `isDetailZoomed` (`isDeskZoomed || isWallNotesZoomed`) in `Game.ts`. Meditate, fall transition, ESC menu, and Dev Mode also block gameplay input.
- Dev **Save Layout / Save Text** only writes to disk when running `npm run dev` (Vite plugin). Production/preview builds fall back to JSON download. Dev mode is bedroom-only for now.
- **Return to Room** from ship is instant (no reverse fall animation). Portal from bedroom → ship uses fall cinematic.
- Agent OS registered; project context at `C:\Users\thoma\agent-os\context\projects\project-stillpoint.md`.
