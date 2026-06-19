# Handoff — Project Stillpoint (Room 1)

> Last updated: 2026-06-19

## Context

LonnieCrow Room 1 rebuilt as a browser game (Vite + TypeScript + Three.js). Godot MVP archived to `legacy/godot/`. Repo lives at https://github.com/thomasmeston/project-stillpoint.

## Done

- Core systems: GameState, PuzzleManager, Inventory, Narrative, SaveLoad, Audio
- Three.js isometric scene: RoomBuilder, hotspots, click-to-move
- Tiny Room Stories–style view rotation (4 walls, animated drop/rise)
- DOM HUD + four puzzle modals; full escape path wired
- Quaternius **Man in Suit** character with walk/idle animations
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
- Added a **Floating Words Intro Sequence** overlay on new games, displaying 13 floating words (fuzzy, tired, memory, gone, etc.) using the Outfit font and subtle float animations. The player must click 5 words to clear the intro, playing tick sounds and causing the rest of the words/overlay to fade out. Persisted under the `intro_words_cleared` flag to skip on loaded sessions.

## Next

1. Add OGG audio to `public/audio/` (click, door unlock, ambient)
2. Replace placeholder room props with GLB art in `public/models/`
3. Enable GitHub Pages on repo Settings → Pages (workflow deploys from `main`)
4. Optional: itch.io upload via `npm run package:itch`

## Checklist

- [x] Full escape path (clock → photos → key → padlock → win)
- [x] Journal clues populate at milestones
- [x] View rotation works on all four walls; hotspots stay interactable
- [x] Walk/idle animations on click-to-move
- [x] Main Menu overlay with 3 save slots and deletion support
- [x] Auto-saving of game state on key actions and player movement
- [x] Escape Menu pause screen with Howler music volume controls
- [x] Floating Words Intro sequence on New Game (fade out and input blocking)
- [x] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy

## Blockers / notes

- Player model: `public/models/characters/man-in-suit.glb` (CC0, Quaternius Animated Men Pack).
