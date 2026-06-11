# Project Plan - Low-Poly Isometric Puzzle Game

## Overview
- Engine: Godot 4.x (orthographic isometric camera, 3D low-poly, fast iteration).
- Core loop: point-and-click navigation, hotspot interactions, data-driven puzzles, minimal UI (tooltip, inventory bar).
- Art style: flat colors, unshaded materials, tiny kitbash set.

## Architecture (high level)
- Scene root: `Main.tscn` loads room scenes and UI.
- Camera rig: orthographic camera pitched 30–45° with pan/zoom limits.
- Input: click-to-move and click-to-interact; raycast to `Area3D` hotspots.
- Navigation: room-specific navmesh; mover follows target with simple velocity-based steering.
- Interaction: hotspots emit interaction events; puzzles resolved via `PuzzleManager`.
- Puzzles: declarative data (JSON/Tres). Conditions → consequences; minimal scripting per puzzle.
- Inventory: data-driven items, simple add/remove/use; UI shows active items.
- Save/load: serialize puzzle/inventory/player state to Dictionary; slot-based saves.

## Data-Driven Design
- Data directory: `data/`
  - `data/puzzles/room-1.json` (conditions, consequences, hotspots)
  - `data/rooms/room-1.json` (spawn points, nav mesh refs, prop layout)
  - `data/items.json` (item ids, labels, usage flags)
- Rules:
  - No hardcoded puzzle logic in scenes; scenes only reference ids.
  - Kebab-case filenames for data; ids are lowercase-with-dashes.

## Key Scripts (Godot)
- `scripts/CameraIso.gd`: positions/tilts orthographic camera; bounds clamp.
- `scripts/PlayerInput.gd`: handles click-to-move and interaction dispatch.
- `scripts/Interaction.gd`: hotspot areas, emits signals with target ids.
- `scripts/PuzzleManager.gd`: loads puzzle JSON/Tres, evaluates conditions, triggers effects.
- `scripts/Inventory.gd`: manages items, emits change signals.
- `scripts/SaveLoad.gd`: serializes/deserializes state.
- `scripts/RoomLoader.gd`: loads `RoomX.tscn`, applies room data config.

## Assets
- `assets/kit/` low-poly GLB set (floor tile, wall, door, lever, crate, pedestal).
- Materials: unshaded, limited palette; color swaps over textures.

## Testing
- Manual checklist per feature (movement, interaction, puzzle resolution, save/load).
- Headless GDScript tests for `PuzzleManager` and `Inventory` once scaffolding exists.

## Near-Term Tasks (for IC_Agent)
1) ~~Scaffold Godot project~~ — done (2026-06-10)
2) ~~Room 1 bedroom MVP~~ — playable puzzle chain + narrative
3) Import CC0 kit + custom hero GLBs (see `assets/kit/`, `assets/props/`)
4) Add OGG audio (`audio/README.md`)
5) Play-test full escape path in Godot F5

## Decisions to Track
- Engine: Godot 4.x (simplicity, open, good isometric support) — revisit only if blockers.
- Data format: JSON for puzzles/rooms/items; Tres acceptable later if performance/tooling benefits.

