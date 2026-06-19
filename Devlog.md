# Devlog

## 2025-12-10
- Added initial planning docs.

## 2026-06-10
- Godot 4 Room 1 MVP (archived to `legacy/godot/`).

## 2026-06-11
- Rebuilt as browser game: Vite + TypeScript + Three.js + Howler.
- Ported JSON data; `npm run build` green.

## 2026-06-19
- Added Main Menu with a 3D orbit camera showcase and 3 customizable save slots (load, delete, reset).
- Implemented state-based autosaving of player position, inventory, journal, flags, and hotspot visibility on all key interactions and movement completion.
- Created an Escape Pause Menu with Howler background music volume and mute controls.
- Created a Floating Words Intro sequence on starting a New Game, showing 13 interactive floating words that players click to progress, with grid-based collision avoidance and input blocking.

### Checklist
- [x] Full escape in `npm run dev`
- [x] Preview build works

