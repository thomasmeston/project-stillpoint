# Handoff — Project Stillpoint (Room 1 + Ship Deck)

> Last updated: 2026-06-27 (bedroom props, inventory rail, dev lighting tab)

## Context

Room 1 rebuilt as a browser game (Vite + TypeScript + Three.js). Godot MVP archived to `legacy/godot/`. Repo lives at https://github.com/thomasmeston/project-stillpoint.

**Game vision & level roadmap:** [`ProjectPlan.md`](ProjectPlan.md) — bedroom hub, meditation portals, ≥4 levels, lessons feed back to bedroom, final door win.

**Package name:** `project-stillpoint` (npm). **Itch zip:** `stillpoint-itch.zip` via `npm run package:itch`.

The game now supports **multi-room loading** (`bedroom`, `pirate_ship`, `level_2`, `level_3`, `level_4`) with save persistence of `currentRoom` (save `version: 2`).

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
- **Multi-room core:** `Game.loadRoom(roomId)` swaps room JSON, puzzles, story, input targets, and scene background; bedroom-only features (desk/wall zoom, painting reveal, data-driven portals) gated by `currentRoomId`

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
- **Escape Menu** (ESC): BGM volume + mute, **Load Game** (opens save-slot picker with Back to Game / Esc cancel); blocks movement and rotation while open
- **Floating Words Intro** on new game: 65 words (13 core + 52 themed), Outfit font, 8×9 grid layout, sizes 0.7–5.5 rem; click 5 to clear with tick SFX and fade-out; skipped via `intro_words_cleared` flag on load
- Fixed intro overlay CSS parse error (`hud.css` `-webkit-mask` missing `)`) that prevented intro styles from applying

### Meditate

- **Meditate** button in header controls; **hidden on Ship Deck**
- Click → camera swings to close-up on player face (`PlayerMover.getHeadWorldPosition()` + facing yaw); canvas blurs; discovered journal clues and inner thoughts float on screen (intro-style drift animation via `MeditationOverlay.ts`)
- Content from `NarrativeManager.getMeditationFragments()` — journal entries, heard thoughts, examine/flag inner voice; fallback words if nothing discovered yet
- **Dedicated Return button** inside meditate overlay (`#meditate-return-btn`) — always visible, not blurred
- **Hold mechanic:** sentences stay visible while holding ball in center; screen pulses for entire hold; after **5 s** hold sentences fade and ball becomes still (stops fleeing cursor); releasing ball resets hold and brings sentences back
- **Portal unlock gate:** player must **inspect the wall clock** once (`clock_inspected`); then **Meditate** is always available in the bedroom. Completing a **5 s** center hold sets `meditation_portal_opened` and reveals the **ship portal only** (`portal_ship`). Garden / Cavern / Observatory portals appear as `lesson_2` / `lesson_3` / `lesson_4` are earned
- **Return** (overlay button or header) or **Esc** exits and restores pre-meditate camera snapshot; newly revealed portals animate in on return
- Blocks gameplay input while active (`meditateActive`); hidden during desk/wall detail zoom

### Hub-and-spoke MVP (4 portals + lesson gating)

- **Four data-driven portals** in bedroom (`portals` array in `bedroom.json`): floor ship portal + wall portals to Garden, Cavern, Observatory; black disc meshes with **swirl particle effect** (`PortalSwirlParticles.ts`); hidden until revealed; solved portals dim but stay re-enterable
- **Progressive reveal:** meditation → `portal_ship`; `lesson_2` → `portal_garden`; `lesson_3` → `portal_cavern`; `lesson_4` → `portal_observatory`
- **`Game.enterPortal(targetRoom)`** — blur/fade transition to any portal level; **`syncPortals()`** restores reveal + solved state on load
- **Lesson → bedroom re-gates:**
  - `lesson_1` (Ship Deck chest **ANCHOR**) → `wall_clock`
  - `lesson_2` (Garden chest **GROWTH**) → `painting` examine (still needs `desk_drawer_unlocked`)
  - `lesson_3` (Cavern chest **REST**) → `assembled_key` use on `wardrobe`
  - `lesson_4` (Observatory chest **STILL**) → `door` padlock (+ existing `cipher_disk`)
- **Final door** requires all four lessons + cipher disk before padlock **STILLPOINT** win
- **Return to Room** button visible on all portal levels; crossfade back to bedroom; portals remain open

### Meditation portal → levels

- **Fall transition:** ~3 s DOM cinematic (`FallTransition.ts`) — darkens screen, streaks, swaps room mid-blackout
- **Ship Deck** (`pirate_ship`): procedural deck; chest padlock **ANCHOR** → `lesson_1`
- **Garden** (`level_2`): thin procedural garden; chest **GROWTH** → `lesson_2`
- **Cavern** (`level_3`): crystal cavern; chest **REST** → `lesson_3`
- **Observatory** (`level_4`): star dome; chest **STILL** → `lesson_4` + `all_lessons_learned` thought
- Level data: `data/rooms/{level}.json`, `data/puzzles/{level}.json`, `data/story/{level}-script.json`

### Narrative voice

- Inner voice / `thoughts` in `data/story/bedroom-script.json` rewritten to cryptic, memory-fogged tone (fragmented, uncertain, puzzle hints veiled)
- `NarrativeManager` tracks `heardThoughtIds` in save data; `getHeardThoughtCount()` for portal gate; per-room story load via `loadRoom(roomId)`
- Ship narrative in `data/story/pirate-ship-script.json` (arrival journal, crate clue, chest open)

### Room art & interactables

- Window view: muted tropical beach texture (`public/images/beach.png`) on `WindowGlass`
- **Oak tree painting:** procedural canvas texture (`OakTreePaintingArt.ts`); **swing-open animation** on first examine (`PaintingRevealController.ts`) sets `painting_moved` and reveals wall safe
- **Wall notes cluster:** ~30 procedural cryptic papers pinned on north wall (`WallNotesCluster.ts`, `CrypticPaperArt.ts`); examine hotspot walks player in and enters detail zoom
- **Desk sketch spread:** procedural papers + sketchbook on desk surface (`DeskSketchSpread.ts`); visible during desk detail zoom — toggle sketchbook open/close, inspect individual papers
- **Sketchbook prop:** canvas-textured closed notebook on desk (`SketchbookProp.ts`) — cover, spine, page edges, elastic band, feather sketch
- **Procedural props:** bedside lamp (`BedsideLampProp.ts`), desk mug with pens (`DeskMugProp.ts`), **calendar scrap on bed** (`CalendarScrapProp.ts`), **nightstand reading lamp** (`NightstandReadingLightProp.ts`)
- **Chair GLB:** poly.pizza wooden chair at `public/models/chair.glb` (CC0)
- **Desk GLB:** Quaternius desk at `public/models/desk-quaternius.glb` (CC0; alternate `desk-kenney.glb` in repo)
- **Nightstand GLB:** Quaternius nightstand with drawer at `public/models/nightstand-quaternius.glb` (CC0; alternates `nightstand-kenney.glb`, `nightstand-quaternius-simple.glb` in repo for A/B)
- **Crow figurine GLB:** Quaternius bird tinted `crow_art` at `public/models/crow-quaternius.glb` (CC0) on desk
- Desk lamp detached from wall fold logic (`LampBase`, `LampShade` in `FLOOR_ONLY_PROPS`); `reading_lamp` in `bedroom.json` lighting for nightstand clip lamp
- Individual desk/nightstand props in room data: `Phone`, `Sketchbook`, `CrowFigurine`, `CalendarScrap` with examine/pickup hotspots and narrative text; calendar scrap prop hides on pickup
- **Phone-in-safe puzzle:** phone prop hidden in wall safe until unlocked; `syncSafeVisuals()` toggles safe/phone visibility; phone added to inventory on safe open

### UI & narrative presentation

- **Examine panel:** centered bottom panel with eye icon header, **×** dismiss (top-right), auto-closes when player walks away from the examined hotspot
- **Inventory rail:** semi-transparent **left-side** strip (`#inventory-rail`); each item shows a **3D shape preview** (rendered from `ItemMeshFactory` / `ItemPreviewRenderer`); hover solidifies slot; click opens **close-up inspect** overlay; **Use on object** arms item for hotspot use; calendar scrap inspect shows readable **March calendar** with **17** circled and **3:17** margin note (`calendarScrapInspect.ts`)
- **Inner thoughts:** floating sentence overlay (`ThoughtOverlay.ts`) — words fade in staggered, whole sentence drifts; click to dismiss; room-level opening/wake thoughts editable in dev Text tab
- **Walk-to interact:** all hotspot clicks walk the player to a standoff position before examine/puzzle action (floor ~1.2 m, wall ~1.05 m)

### Detail zoom modes

Shared `isDetailZoomed` flag blocks normal input (walk, rotation, wheel zoom) while active. HUD shows **↩ Back** via `showZoomControls()`. Bedroom only.

| Mode | Trigger | Camera | In-zoom interaction |
|------|---------|--------|---------------------|
| **Desk** | Examine `desk` hotspot → walk to approach position → `zoomToDesk()` | Top-down (pitch −90°, size 1.4) | Click sketchbook to spread papers; click papers to inspect/dismiss |
| **Wall notes** | Examine `wall_notes` → walk → `zoomToWallNotes()` | Front-on wall (pitch 0°, size 1.15); player hidden | Click papers to inspect/dismiss |

`IsoCamera.zoomTo(target, size, pitch?, yaw?)` and `getYawForViewIndex()` support arbitrary transitions.

> **Note:** Chair sit/stand with procedural bone posing was implemented briefly (`3c7371a`) but **removed** in favor of walk-to + detail zoom. Chair hotspot is examine-only today.

### Dev Mode

Toggle from escape menu or `` ` `` key. **Four tabs.** **Level-aware** — follows current room via `DevLevelConfig.ts` (bedroom, ship, garden, cavern, observatory).

- **Layout:** select props (Ctrl/Shift multi-select), nudge position/rotation, 50-state undo/redo (`Ctrl+Z`/`Ctrl+Y`), copy layout JSON, reset from repo defaults, **Save Layout** → writes `data/rooms/{level}.json` via Vite dev plugin (`/__dev/save`) or downloads JSON
- **Hotspots:** click orange hotspot boxes or use dropdown; nudge **position** (X/Y/Z) and **size** (X/Y/Z); keyboard arrows/PageUp-Down move; `[`/`]` `{`/`}` `-`/`+` scale; undo/redo shared with Layout; saved with **Save Layout**
- **Lighting:** pick `lamp`, `window`, or `reading_lamp` (or click lamp / nightstand reading light props); edit color + brightness (0–3); undo/redo; persisted in layout draft + **Save Layout** (`bedroom.json` `lighting` block)
- **Text:** edit room opening/wake inner voices, per-hotspot examine copy, and item labels/descriptions with localStorage preview overrides (`DevContentOverrides.ts`); **Save Text** → writes `data/story/{level}-script.json` + `data/items.json` (items bedroom only); **Exit Dev Mode** in Text tab

Parent/child relationships for grouped prop nudging defined in `DevMover.ts` `RELATIONSHIPS` map. Hotspot debug boxes visible in **Hotspots** and **Text** tabs.

### Testing

- Playwright e2e:
  - `tests/e2e/desk-zoom.spec.ts` — desk examine → top-down zoom controls
  - `tests/e2e/intro.spec.ts` — intro overlay visibility/styles regression
  - `tests/e2e/meditation-portal.spec.ts` — 4-portal reveal, enterPortal routing, return-to-bedroom, lesson gates, garden level load

## Puzzle flow (escape path)

### Bedroom (Room 1)

1. Find time clue → set wall clock to **3:17** → desk drawer unlocks
2. Open desk drawer → photos + receipt
3. Examine painting → swing-open animation → wall safe revealed (`painting_moved`)
4. With photos, painting examine opens photo cipher → spell **STILL** → safe combo known
5. Wall safe padlock **STILL** → safe opens → key blade + phone
6. Combine key blade + handle (nightstand) → unlock wardrobe
7. Cipher disk + letter → door padlock **STILLPOINT** → escape

### Hub-and-spoke loop (MVP)

1. **Inspect wall clock** (examine-only first click) → unlocks meditation portal path
2. **Meditate** → hold focus ball **5 s** → `meditation_portal_opened` → **ship portal** appears
3. Visit each portal level → solve one padlock chest → earn `lesson_N` → corresponding bedroom portal unlocks
4. Lessons unlock bedroom beats in order: clock → painting/safe chain → wardrobe key → final door
5. Door padlock **STILLPOINT** → win (requires all lessons + cipher disk)

### Bedroom escape chain (lesson-gated)

1. **Ship** → `lesson_1` → wall clock **3:17** → desk drawer
2. Open drawer → photos + receipt
3. **Garden** → `lesson_2` → painting examine → swing-open → safe chain
4. Photo cipher **STILL** → safe **STILL** → key blade + phone
5. Combine key blade + handle → **Cavern** → `lesson_3` → wardrobe key use
6. Cipher disk + letter → **Observatory** → `lesson_4` → door padlock **STILLPOINT** → escape

### Per-level puzzles (thin MVP)

| Level | Padlock | Lesson flag |
|-------|---------|-------------|
| Ship Deck | ANCHOR | `lesson_1` |
| Garden | GROWTH | `lesson_2` |
| Cavern | REST | `lesson_3` |
| Observatory | STILL | `lesson_4` |

## Next

1. **Flesh out each portal level** — distinct worlds, multi-step puzzle chains, custom art/audio (MVP uses thin procedural shells)
2. **Return path polish** — optional reverse fall cinematic bedroom ← levels (today: instant **Return to Room** at blackout)
3. **Desk detail layer** — in top-down zoom, make lamp, phone, drawer, and mug individually clickable (hover/tooltips); sketchbook/papers work today
4. **Wall notes** — tie inspected papers to journal clues or a future puzzle beat (visual inspect only today)
5. **Meditate polish** — tune face close-up framing for papercraft model; filter/tokenize floating fragments for readability at high journal count
6. **Add OGG SFX** to `public/audio/` (click, door unlock, rotate). Synth fallback works; real audio will feel better
7. **Replace remaining placeholder box/cylinder props** with GLB art (bed, bookshelf, wardrobe — chair, nightstand, desk done)
8. **Enable GitHub Pages** on repo Settings → Pages (workflow deploys from `main`)
9. Expand Playwright coverage (full escape path with real 5 s meditate hold, all four portal round-trips)
10. ~~**Dev Mode on portal levels**~~ — layout/text/hotspots editor now level-aware; polish UX on ship/garden levels
11. Optional: itch.io upload via `npm run package:itch`

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
- [x] Meditate: clock-inspect gate → ship portal unlock via 5 s hold; other portals per lesson
- [x] Hub-and-spoke MVP: progressive portal reveal, 4 thin levels, lesson re-gates, final door requires all lessons
- [x] Nightstand GLB with drawer (`public/models/nightstand-quaternius.glb`)
- [x] Portal swirl particles on revealed portal discs
- [x] Examine panel UX (eye icon, × dismiss, walk-away auto-close)
- [x] Floating thought overlay + walk-to-all-hotspots
- [x] Dev Mode: Layout + Hotspots + Lighting + Text tabs; level-aware save (`DevLevelConfig.ts`)
- [x] Desk GLB (`public/models/desk-quaternius.glb`)
- [x] Calendar scrap bed prop + crow figurine GLB + sketchbook cover texture
- [x] Nightstand reading lamp (procedural) + dev lighting for `reading_lamp`
- [x] Left-side inventory rail with 3D item previews + inspect overlay
- [x] Escape menu Load Game → save-slot screen (Back / Esc cancel)
- [x] Chair GLB (`public/models/chair.glb`)
- [x] Dev Mode layout + text + hotspot editor with save-to-repo (dev server)
- [x] Playwright desk-zoom, intro, meditation-portal smoke tests
- [x] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy
- [ ] Desk zoom: lamp / phone / drawer clickable
- [ ] Wall notes tied to puzzle/narrative beats
- [ ] All placeholder props replaced with real GLB models
- [ ] Full ship/garden/cavern/observatory worlds with multi-puzzle chains and custom art

## Key files

| Path | Purpose |
|------|---------|
| `src/game/Game.ts` | Main loop, `loadRoom()`, portal/fall/return, detail zoom, meditate, menus, autosave |
| `src/game/PlayerMover.ts` | GLB load, walk/collision, head position for meditate zoom |
| `src/game/NarrativeManager.ts` | Journal/thoughts, `getMeditationFragments()`, `getHeardThoughtCount()`, per-room story |
| `src/game/PuzzleManager.ts` | Per-room puzzles/hotspots via `loadRoom(roomId)` |
| `src/game/SaveLoad.ts` | Save v2 with `currentRoom` |
| `src/ui/MeditationOverlay.ts` | Focus ball, hold/pulse, portal message, unlock callback |
| `src/ui/HUD.ts` | Examine panel, inventory rail + item inspect, meditate/return buttons |
| `src/ui/itemVisuals.ts` | Rail/inspect 3D previews; calendar scrap HTML inspect |
| `src/ui/ItemMeshFactory.ts` | Inventory item shape meshes for preview renders |
| `src/scene/SketchbookProp.ts` | Canvas-textured desk sketchbook |
| `src/scene/CalendarScrapProp.ts` | Torn calendar scrap on bed |
| `src/scene/NightstandReadingLightProp.ts` | Clip lamp on nightstand |
| `src/ui/ThoughtOverlay.ts` | Floating inner-thought sentence display |
| `src/scene/PortalSwirlParticles.ts` | Additive swirl on portal discs |
| `src/scene/RoomBuilder.ts` | Room build by `roomId`, portals + particles, per-level lighting |
| `src/game/DevLevelConfig.ts` | Dev mode level registry (room/story/puzzle paths) |
| `src/game/DevMover.ts` | Dev layout/hotspot/text editor |
| `src/scene/FallTransition.ts` | ~3 s fall cinematic (bedroom ↔ portal levels) |
| `src/scene/ViewWallController.ts` | Wall rotation animation; `reset()` on room swap |
| `src/scene/DeskSketchSpread.ts` | Desk papers + sketchbook in zoom view |
| `src/scene/WallNotesCluster.ts` | Wall papers in zoom view |
| `src/scene/PaintingRevealController.ts` | Painting swing-open animation |
| `src/scene/IsoCamera.ts` | Orthographic camera, zoom/rotate, snapshot restore |
| `data/rooms/bedroom.json` | Bedroom layout, props, hotspots, spawn, `portals` array |
| `data/rooms/pirate-ship.json` | Ship deck layout |
| `data/rooms/level_2.json` | Garden (thin MVP) |
| `data/rooms/level_3.json` | Cavern (thin MVP) |
| `data/rooms/level_4.json` | Observatory (thin MVP) |
| `data/puzzles/bedroom.json` | Bedroom puzzles, gates, hotspot actions |
| `data/puzzles/pirate-ship.json` | Ship chest padlock puzzle |
| `data/story/bedroom-script.json` | Bedroom examine text, journal, inner voice |
| `data/story/pirate-ship-script.json` | Ship examine text, journal, inner voice |
| `scripts/vite-plugin-dev-save.ts` | Dev-only write-back to `data/` |
| `tests/e2e/meditation-portal.spec.ts` | 4-portal reveal, enterPortal, return, lesson gates e2e |

## Blockers / notes

- **Player model:** `public/models/characters/man-papercraft.glb` (custom, Meshy-rigged). Legacy Quaternius suit and other character GLBs remain in `public/models/characters/` but are unused.
- **Chair model:** `public/models/chair.glb` (CC0, [poly.pizza](https://poly.pizza/m/13AL0KYItKD)).
- **`FLOOR_ONLY_PROPS`** and **`FLOOR_ONLY_HOTSPOTS`** in `RoomBuilder.ts` control which objects stay grounded during wall animations. Add new floor/desk props and hotspots there.
- **`OBSTACLE_IDS`** in `RoomBuilder.ts` lists props that block player movement (bedroom + ship props).
- Detail zoom blocks input via `isDetailZoomed` (`isDeskZoomed || isWallNotesZoomed`) in `Game.ts`. Meditate, fall transition, ESC menu, and Dev Mode also block gameplay input.
- Dev **Save Layout / Save Text** only writes to disk when running `npm run dev` (Vite plugin). Production/preview builds fall back to JSON download. Dev mode follows **current room** (all five MVP levels).
- **Return to Room** from any portal level is instant at blackout (no reverse fall animation). Portals stay open after return.
- Agent OS registered; project context at `C:\Users\thoma\agent-os\context\projects\project-stillpoint.md`.
