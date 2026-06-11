# Context Chain

## Current Phase

**Phase:** Room 1 MVP playable  
**Sprint/Focus:** Bedroom escape — full puzzle chain + narrative  
**Target:** itch-ready vertical slice

## Recent Progress

- Godot 4 project scaffolded with autoloads and data-driven puzzles
- Bedroom built from JSON (procedural shell + hotspots)
- Four puzzles wired: clock, photo cipher, key combine, padlock
- Narrative: examine, journal, thoughts, ending

## Active Work

**Focus:** Room 1 complete — polish and play-test  
**Status:** Implementation complete; verify in Godot editor  
**Owner:** Cody

### Next Up

1. Play-test full escape path in Godot F5
2. Replace procedural props with CC0 kit + custom GLB hero props
3. Add OGG audio files

## Critical Decisions

**2025-12-10 - Engine**
- **Decided:** Godot 4.x
- **Why:** Isometric 3D, open, fast iteration
- **Impact:** All scenes/scripts use GDScript

**2026-06-10 - Narrative tone**
- **Decided:** Grounded psychological thriller (Project Stillpoint)
- **Why:** User preference
- **Impact:** Story JSON, examine copy, ending

**2026-06-10 - Art pipeline**
- **Decided:** Hybrid CC0 shell + custom hero props
- **Why:** Ship speed + unique story objects
- **Impact:** Procedural MVP; GLB drop-in path documented

## Active Blockers

None — requires Godot 4.3+ installed locally for play-test.

## Quick Links

- `ProjectPlan.md` — architecture
- `Handoff.md` — session handoff
- `data/puzzles/bedroom.json` — puzzle logic
- `data/story/bedroom-script.json` — narrative

**Last Updated:** 2026-06-10
