# Handoff — Project Stillpoint (Room 1)

> Last updated: 2026-06-10

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

## Next

1. Play-test full escape path in browser (`npm run dev`)
2. Add OGG audio to `public/audio/` (click, door unlock, ambient)
3. Replace placeholder room props with GLB art in `public/models/`
4. Enable GitHub Pages on repo Settings → Pages (workflow deploys from `main`)
5. Optional: itch.io upload via `npm run package:itch`

## Checklist

- [ ] Full escape path (clock → photos → key → padlock → win)
- [ ] Journal clues populate at milestones
- [ ] View rotation works on all four walls; hotspots stay interactable
- [ ] Walk/idle animations on click-to-move
- [ ] `npm run build && npm run preview` — no console errors
- [ ] GitHub Pages live after first deploy

## Blockers / notes

- Local folder is still named `LonnieCrowV1`; GitHub remote is `project-stillpoint`.
- Player model: `public/models/characters/man-in-suit.glb` (CC0, Quaternius Animated Men Pack).
