# Handoff — Project Stillpoint (Room 1)

> Last updated: 2026-06-20

## Context

LonnieCrow Room 1 rebuilt as a browser game (Vite + TypeScript + Three.js). Godot MVP archived to `legacy/godot/`. Repo lives at https://github.com/thomasmeston/project-stillpoint.

## Done

- Core systems: GameState, PuzzleManager, Inventory, Narrative, SaveLoad, Audio
- Three.js isometric scene: RoomBuilder, hotspots, click-to-move
- Tiny Room Stories–style view rotation (4 walls, animated drop/rise)
- DOM HUD + four puzzle modals; full escape path wired
- Replaced the player character model with a custom 3D papercraft model (`man-papercraft.glb`) auto-rigged via Meshy AI, playing skeletal animations blended with secondary procedural breathing/idle bobbing.
- Updated the window view to display a less vibrant tropical beach scene framed from the room's perspective.
- Introduced 2D circle-to-AABB sliding collision detection on the gameplay plane, preventing the player from passing through bedroom walls or furniture props (`BedFrame`, `Desk`, `Chair`, `Bookshelf`, `Nightstand`, `Wardrobe`).
- Added stuck state detection to clean up movement animations and cancel walking when the player runs into solid obstacles.
- Built a real-time **Dev Mode** layout editor allowing developers to select props in 3D, view transparent debug hotspot boxes, select multiple objects simultaneously (via `Ctrl`/`Shift` clicks) to nudge them as a group, step backward and forward through changes using a 50-state Undo/Redo history stack (with `Ctrl+Z`/`Ctrl+Y` support), translate, rotate, and orbit props and their corresponding children, click hotspots, and PointLight source positions synchronously, immediately test character collision boundaries on the fly, persist placements in `localStorage`, and export the entire merged configuration directly to the clipboard.
- `npm run build` passes; GitHub Pages workflow present
- Agent OS registered; initial push to `project-stillpoint`
- Centered the starting room in the browser viewport, enabled middle mouse drag (mouse wheel hold) camera rotation control, and configured middle-click (mouse wheel click) to trigger a single counter-clockwise rotation
- Updated wall folding logic to raise only the two back corner walls (facing and left-adjacent) for each view index, dropping the side/front walls to guarantee props are never obstructed
- Fixed rotation sign errors in the North and South wall Y-coordinate folding equations, centered the room shell and camera target Z-bounds to Z = 0, and aligned bookshelf/door sizes and rotations to lie completely flat on the ground when folded
- Fixed camera rotation warp bug: removed absolute angle normalization at the end of camera rotation animations, allowing relative target yaw angles to accumulate indefinitely so the camera rotates smoothly in the same direction infinitely without direction-reversal artifacts.
- Expanded the orthographic camera zoom range (clamping size between 4 and 15 instead of 8 and 14) to allow players to zoom in significantly closer to inspect room details.
- Implemented a complete Web Audio API synthesizer fallback in `AudioManager.ts` that dynamically generates retro-style sound effects (short tick for clicks, dual metallic lock release for door unlocking, and a bandpass filter wind sweep for camera rotation wooshes) when physical `.ogg` audio files are absent. (Ambient bedroom hum track removed as per user request).
- Wired the camera rotation "woosh" sound effect (`playSfx('rotate')`) to trigger when starting any view rotation.
- Created a premium glassmorphic **Main Menu** overlay with 3 save slots, a slow 3D orbit camera showcase rotating the bedroom scene, and support to load, delete, or reset slots.
- Implemented **Autosave** functionality, writing slot metadata (timestamp, screenshot, game flags, inventory, journal logs, room status, player position) to local storage automatically on gameplay changes (flag changed, puzzle solved, inventory updated, journal log appended, player stopping walk, and hotspot interaction).
- Added a paused **Escape Menu** overlay (ESC key) allowing background music volume adjustment and muting using Howler, blocking all movement and keyboard rotation inputs while active.
- Added a **Floating Words Intro Sequence** overlay on new games, displaying 65 floating words (original 13 words + 52 themed synonyms/similar words, a 5x increase) using the Outfit font and subtle float animations. The "focus your mind" helper title is removed to offer a cleaner design, and words are spaced via an 8x9 grid to prevent cluttered overlaps. Sizes vary dramatically (ranging from 0.7rem to 5.5rem). The player clicks 5 words to clear the overlay, playing tick sounds and triggering a smooth fade-out. Persisted under the `intro_words_cleared` flag to skip on loaded sessions.
- **Detached desk lamp from wall fold logic.** Moved `LampBase` and `LampShade` into the `FLOOR_ONLY_PROPS` set in `RoomBuilder.ts` so they stay in place when walls animate up/down instead of being parented to a folding wall.
- **Individually clickable desk items.** Added three new desk props (`Phone`, `Sketchbook`, `CrowFigurine`) and their matching hotspots (`phone`, `sketchbook`, `lamp`) in `bedroom.json` with examine text in `bedroom-script.json`. Each is independently clickable and shows its own narrative panel.
- **Chair sit/stand interaction.** Clicking the chair hotspot triggers `handleSit()` in `Game.ts`, which walks the player to the front of the chair, then calls `PlayerMover.sitOn()`. Procedural bone animation (`animateSittingBones`) bends thighs and calves to 90°, lowers the pelvis 0.45 units, relaxes arms forward 45°, and applies a biomechanically accurate forward spine lean (30° arc via sine curve) for center-of-mass transfer during descent. Standing reverses the process with matching forward-lean momentum. The camera zooms to the desk top on sit, and resets on stand.
- **Replaced placeholder chair with poly.pizza GLB.** Downloaded the wooden chair model from [poly.pizza/m/13AL0KYItKD](https://poly.pizza/m/13AL0KYItKD) and stored it at `public/models/chair.glb` (3.1 MB). The `bedroom.json` prop entry references `models/chair.glb` with mesh loading handled by `RoomBuilder`.
- **Desk zoom interaction.** Clicking the desk while sitting triggers `zoomToDesk()`, which smoothly animates the `IsoCamera` to a top-down view (pitch −90°, yaw 0°, size 1.4) centered on the desk surface. A "↩ Back" button in the HUD (`showZoomControls`) returns to the seated isometric view via `zoomOutFromDesk()`. Input (rotation drag, wheel zoom, keyboard shortcuts) is blocked while in top-down desk mode.
- **IsoCamera `zoomTo` with pitch/yaw.** Extended `IsoCamera.zoomTo(target, size, pitch?, yaw?)` to support arbitrary pitch and yaw angles, enabling the top-down desk view transition and seated camera zoom. `resetZoom()` snaps back to the current view index defaults.

## Current state (uncommitted)

The working tree has ~1,100 lines of uncommitted changes across 11 files:

| File | Key changes |
|------|-------------|
| `data/rooms/bedroom.json` | Added Phone, Sketchbook, CrowFigurine props; lamp, phone, chair hotspots |
| `data/puzzles/bedroom.json` | Added `phone`, `lamp`, `chair` hotspot actions (examine/sit) |
| `data/story/bedroom-script.json` | Examine text for phone, lamp |
| `src/game/Game.ts` | `handleSit()`, `zoomToDesk()`, `zoomOutFromDesk()`, `standUp()`, desk click routing, `isDeskZoomed` input blocking |
| `src/game/PlayerMover.ts` | `sitOn()`, `standUp()`, bone posing (`animateSittingBones`, `animateStandingBones`), transition state machine, `FLOOR_ONLY_PROPS` lamp entries |
| `src/scene/IsoCamera.ts` | `zoomTo(target, size, pitch?, yaw?)`, `resetZoom()`, `getYawForViewIndex()` |
| `src/scene/RoomBuilder.ts` | `FLOOR_ONLY_PROPS` / `FLOOR_ONLY_HOTSPOTS` additions, GLB mesh loading for chair |
| `src/ui/HUD.ts` | `showZoomControls()` with "↩ Back" button, `onZoomBack` callback |
| `public/styles/hud.css` | Styling for zoom-back button |
| `public/models/chair.glb` | Poly.pizza wooden chair model (CC0) |
| `index.html` | Minor updates |

## Next

1. **Polish chair sit/stand.** Verify the sitting pose looks correct in the browser with the new chair GLB — the bone-animation offsets (pelvis drop of 0.45, thigh 90°, calf 90°) may need tuning relative to the specific chair mesh seat height.
2. **Desk interaction objects.** When zoomed top-down on the desk, items (lamp, phone, sketchbook, drawer) should become individually clickable with magnified hover effects or tooltips. This is the foundation for future desk-based puzzles.
3. **Add OGG audio to `public/audio/`** (click, door unlock, ambient). The synthesizer fallback covers everything for now, but real audio will feel much better.
4. **Replace remaining placeholder props with GLB art** in `public/models/` (bed, desk, nightstand, bookshelf, wardrobe).
5. **Enable GitHub Pages** on repo Settings → Pages (workflow deploys from `main`).
6. Optional: itch.io upload via `npm run package:itch`.

## Checklist

- [x] Full escape path (clock → photos → key → padlock → win)
- [x] Journal clues populate at milestones
- [x] View rotation works on all four walls; hotspots stay interactable
- [x] Walk/idle animations on click-to-move
- [x] Main Menu overlay with 3 save slots and deletion support
- [x] Auto-saving of game state on key actions and player movement
- [x] Escape Menu pause screen with Howler music volume controls
- [x] Floating Words Intro sequence on New Game (fade out and input blocking)
- [x] Desk lamp stays in place during wall folds (detached from wall parent)
- [x] Desk items (phone, sketchbook, lamp) individually clickable with examine text
- [x] Chair click → walk-to → sit with procedural bone animation
- [x] Chair replaced with poly.pizza GLB (`public/models/chair.glb`)
- [x] Desk click (while sitting) → top-down camera zoom with back button
- [x] IsoCamera supports arbitrary pitch/yaw zoom transitions
- [x] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy
- [ ] Desk interaction layer: clickable objects in top-down zoom view
- [ ] All placeholder box/cylinder props replaced with real GLB models

## Blockers / notes

- Player model: `public/models/characters/man-in-suit.glb` (CC0, Quaternius Animated Men Pack).
- Chair model: `public/models/chair.glb` (CC0, poly.pizza).
- Sitting bone offsets (pelvis −0.45, thighs 90°, calves 90°) are tuned to the papercraft model's skeleton. If the player model changes, re-tune `animateSittingBones` in `PlayerMover.ts`.
- The top-down desk zoom blocks all camera rotation and zoom inputs (`isDeskZoomed` flag in `Game.ts`). Standing up from the chair auto-resets the zoom state.
- `FLOOR_ONLY_PROPS` and `FLOOR_ONLY_HOTSPOTS` in `RoomBuilder.ts` control which objects stay grounded during wall animations. Any new desk/floor prop must be added to these sets.
