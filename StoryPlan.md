# Story Implementation Plan — Project Stillpoint

> Last updated: 2026-07-02  
> Narrative design + content roadmap. Mechanics and build status: [`ProjectPlan.md`](ProjectPlan.md), [`Handoff.md`](Handoff.md).

## Logline

A man who isolated himself for years built a private religion from a crow’s gifts—straw, then random small objects—each ascribed cosmic meaning. After a brain injury he wakes with total amnesia, locked in his bedroom. Reconstructing his “clue map” slowly unlocks something else: a past life with a grown daughter and old friends he abandoned, remembered in fragments until he can choose what leaving the room means.

## Design thesis

| Track | Player experience | Writing voice |
|-------|-------------------|---------------|
| **A — Delusion / crow scraps** | Rebuild his cosmology; solve puzzles that were once “sacred” | Grand, paranoid-sincere, pattern-obsessed |
| **B — Memory / past life** | Recognize people and warmth he forgot | Soft, specific, sensory, sad |
| **Gap — Amnesia** | Uncertainty which track an object belongs to | “I know this mattered. I don’t know which kind.” |

**Win condition (narrative):** Not only escape the room, but remember enough of both tracks to understand what he lost and what “Stillpoint” named—the instant life stopped moving, not just a puzzle word.

**Optional lore layer (keep compatible):** Project Stillpoint / sleep-lab paperwork can remain as **filed metaphor** (how his mind or the world labels the breakdown), literal trial, or both. Do not force one reading in UI copy until late game.

---

## Canonical backstory (authoritative for content)

### Before isolation

- Rich life: family, friends, warmth.
- **Daughter** (now adult): has not spoken to him in years.
- Happy memories exist but are blurred—guilt, time, and the spiral made them hard to face.

### Isolation spiral

- Self-imposed seclusion for a long time.
- Obsession with secrets of the universe; everything becomes significant.
- **Crow** appears at the **bedroom window**, leaves a **straw**—first relic.
- Crow returns with **small random objects**; he catalogs them and builds a philosophy / pattern of the universe.
- Wall notes, sketchbook, receipts, and props in the room are artifacts of this system.

### Inciting injury

- Brain injury → **complete amnesia**.
- Wakes **locked in the bedroom**; no clear exit, no memory of barricading or why.

### Present (game start)

- Disorientation, fuzzy body sense, locked door.
- Room full of evidence he no longer understands.
- Two parallel unlocks: **religion scraps** (puzzle path) and **past life** (emotional path).

---

## Dual read: props and beats

Use every major bedroom prop with **two readings**. Examine/journal/thought text upgrades as memory flags fire.

| Asset / hotspot | Delusion read (Track A) | Memory read (Track B) | Primary files |
|-----------------|-------------------------|------------------------|---------------|
| Window | Crow’s threshold; universe delivers | Street, visitors, daughter’s route, friends at the door | `bedroom-script.json`, room props |
| Sketchbook (crow) | Messenger; STILL → POINT | Drew with daughter; she loved birds | `bedroom-script.json`, `DeskSketchSpread` |
| Wall notes | Cosmic ledger, diagrams | Crossed-out phone numbers, “call her”, friend names | `WallNotesCluster`, story JSON |
| Photos / receipt | STILL cipher; Stillpoint Lab | Faces he avoids; real place/event he missed | `bedroom-script.json`, puzzles |
| Calendar 3:17 | Sacred minute | Missed appointment (recital, wedding, doctor—pick one) | journal + examine |
| Painting (oak) | Symbol in his system | Family home, park, friends gathering | examine + journal upgrade |
| Nightstand / key handle | “Handle where you rest” clue | Domestic object from before spiral | examine + thought |
| Phone (safe) | Another catalogued relic | Voicemail / unread thread from daughter | items + examine + optional audio |
| Crow figurine | Idol of the messenger | Gift from daughter before silence | prop + examine |
| Wardrobe / letter | Consent to Stillpoint trial | Legal/medical paper OR metaphor for “consent to forget people” | examine + letter text |
| Door / locks | He stacked locks to protect clues | He shut the world out; locks hold him now | thoughts, `on_flag` |

**New content required:** explicit **straw** artifact (prop or journal/backstory entry); **crow gift ledger** (wall notes or dedicated examine/journal chain).

---

## Portal levels as mythologized memories

Past-him named inner worlds when the spiral peaked. Player initially reads them as “lessons”; later entries clarify they are **memories dressed as cosmology**.

| Room ID | Padlock word | Delusion chapter (A) | Memory peek (B) — draft |
|---------|--------------|----------------------|-------------------------|
| `pirate_ship` | ANCHOR | First proof the outside world sends messages | Trip with friends / “we’re not drifting” / daughter on water |
| `level_2` (Garden) | GROWTH | Pattern spreads; every object connects | Her childhood, backyard, growth he wasn’t there for |
| `level_3` (Cavern) | REST | Still point in darkness; end of searching | Year he stopped answering; exhaustion before injury |
| `level_4` (Observatory) | STILL | Ultimate secret; name of the system | Quiet moment with daughter or friends; stars; **Stillpoint = last still day** |

Each portal completion should grant:

1. Existing `lesson_N` flag + puzzle unlock (mechanics—keep).
2. **New:** `memory_N` or journal tier upgrade with one concrete past-life detail (name withheld until schedule says otherwise).

Files: `data/story/level_*-script.json`, `data/story/bedroom-script.json` (`on_flag` / journal), optional `data/story/memory-unlocks.json` if we outgrow one file.

---

## Memory unlock schedule (phased narrative)

Map **delusion beats** (existing puzzle flags) to **memory peeks** (new journal/thought/examine tiers).

### Phase 1 — Disorientation (game start)

| Trigger | Track A | Track B |
|---------|---------|---------|
| First click / `opening_thought` | Body wrong, walking hurts | — |
| After intro words / `wake_beside_bed` | Room feels staged | — |
| First examines (bed, window, desk) | Physical description only | No names; sensory almost-memories optional |

**Deliverable:** Rewrite opening/wake/examines in `bedroom-script.json` to match crow/amnesia premise (keep puzzle-facing facts where needed).

### Phase 2 — Delusion ledger surfaces

| Trigger | Track A | Track B |
|---------|---------|---------|
| `clock_inspected` | Clock as axis of his system | — |
| `desk_drawer_unlocked` | STILL / Stillpoint receipt as scripture | Photo: “Faces. Familiar weight.” |
| `photo_cipher_solved` | STILL as cosmic prefix | Receipt place ties to real location from past |
| Wall notes / sketchbook examines | Object catalog, STILL → POINT | One crossed-out name or “call her” (no full reveal) |

**Deliverable:** Wall note content pass; sketchbook margin copy; journal entry upgrades keyed to flags.

### Phase 3 — First named memory peek

| Trigger | Track B content (example slot) |
|---------|-------------------------------|
| `painting_moved` or `safe_found` | Sensory flash: laughter, child’s voice—not yet a name |
| `lesson_1` (ship return) | Friend or trip fragment in new journal entry |

**Deliverable:** `journal_entries` additions + `NarrativeManager` if tiered examines needed.

### Phase 4 — Portal returns deepen past

| Trigger | Track B |
|---------|---------|
| `lesson_2` | Garden memory: home, her age, specific object |
| `lesson_3` | Cavern memory: last call unanswered, friend’s message |
| `lesson_4` | Observatory: daughter + stars; **Stillpoint** double meaning |
| `all_lessons_learned` | “Four lessons / four worlds” → “Four places I hid from one person” (rewrite thought) |

**Deliverable:** Per-level story scripts + bedroom reactions on return (`Game.ts` optional one-shot thought on `loadRoom('bedroom')` after lesson flags).

### Phase 5 — Contradiction / integration

| Trigger | Both tracks |
|---------|-------------|
| `key_assembled` / wardrobe | Delusion: key to truth. Memory: key to closet where her gift was kept |
| `wardrobe_open` / letter | Stillpoint consent **and** “I signed something to stop feeling” |
| `door_unlocked` | Door opens on STILLPOINT passphrase |

**Deliverable:** Rewrite `stillpoint_letter`, `ending_journal`, `ending` body for dual-read; phone/voicemail if implemented.

### Phase 6 — Ending

| Element | Intent |
|---------|--------|
| Hallway / “Session complete” | Keep or soften—can read as facility **or** metaphor for surfacing |
| Final journal | He remembers daughter + friends **enough**; crow system was both madness and the only companion |
| Player takeaway | Choice to leave = willingness to remember people, not just solve cosmology |

**Deliverable:** `bedroom-script.json` → `ending`, `ending_journal`; optional epilogue examine on phone.

---

## Crow gift ledger (content to author)

Define **5–7 gifts** including straw. Map each to a room prop or journal-only entry.

| # | Object | In-room prop? | Delusion meaning | Memory meaning | Status |
|---|--------|---------------|------------------|----------------|--------|
| 1 | Straw | TBD (desk/window sill) | First axis / universe speaks | Wedding bar, her drink, trivial day he made sacred | **Not in game** |
| 2 | Crow figurine | `CrowFigurine` | Messenger idol | Her gift before silence | Partial (prop exists) |
| 3 | — | Photos | Faces as cipher | Family/friends | Partial |
| 4 | — | Phone | Catalog #N | Voicemail from daughter | Partial (mechanic only) |
| 5 | — | Sketchbook | Doctrine | Drew together | Partial |
| 6+ | TBD | Portal loot / notes | Per-level myth | Per-level memory | MVP thin |

Fill names (daughter, friend, place) in a **private character sheet** before final dialogue pass.

---

## Character sheet (fill before final copy)

| Field | Value (TBD) |
|-------|-------------|
| Daughter — name | |
| Daughter — last contact (years + circumstance) | |
| Friend — name | |
| Happy memory — one concrete scene | |
| Reason for isolation (single sentence) | |
| Missed event tied to 3:17 | |
| Injury — implied cause (fall, etc.) | |
| Stillpoint — literal lab vs metaphor (primary read) | |

---

## Technical implementation map

### Content-only (no engine changes)

- [ ] Rewrite `data/story/bedroom-script.json` — opening, thoughts, examines, journal, ending per phases above
- [ ] Rewrite `data/story/pirate-ship-script.json` + `level_2/3/4-script.json` — dual-read openings and lesson journals
- [ ] Add straw prop or examine-only entry in `data/rooms/bedroom.json`
- [ ] Wall note strings in `WallNotesCluster` / `CrypticPaperArt` — mix ledger + memory crumbs
- [ ] `data/items.json` — phone description, optional voicemail item text
- [ ] Empty slots: `nightstand_musings`, crow gift entries

### Light engine (prefer if rewrites need it)

- [ ] **Tiered examine text** — same hotspot, different `body`/`thought` after `memory_N` or `lesson_N` flags (`NarrativeManager.getExamine` + story schema `examines[id].tiers[]` or `examines_after_flag`)
- [ ] **Journal entry upgrades** — replace or append journal body when flag set
- [ ] **Return-home barks** — `Game.loadRoom('bedroom')` fires one thought when `lesson_N` newly set (optional)
- [ ] **Meditation fragments** — blend Track A scraps + Track B memories in `getMeditationFragments()` by flag tier

### Art / props (optional)

- [ ] Straw mesh or desk clutter prop
- [ ] Photo textures with ambiguous faces (later)
- [ ] Crow at window sill (silhouette decal or static prop)

### Docs sync

- [ ] Update `ProjectPlan.md` Vision + tone to match StoryPlan (replace outdated “≥4 thoughts → four portals” where still stale)
- [ ] Update `Handoff.md` narrative section when Phase 1 ships
- [ ] README one-line pitch

---

## Implementation phases (recommended order)

### Phase 0 — Authoring lock-in (1 session)

- Fill character sheet (daughter name, friend, missed event, injury read).
- Finalize crow gift table (5–7 rows).
- Decide primary Stillpoint read (metaphor vs literal vs both).

### Phase 1 — Bedroom voice pass (content)

- Rewrite `opening_thought`, `wake_beside_bed`, core examines (window, sketchbook, wall_notes, bed, door).
- Add straw reference (prop or journal).
- Rewrite ending + `ending_journal` for dual-layer reveal.
- Fix `nightstand_musings` and phone examine copy.

**Acceptance:** New game → first 10 minutes of examines/thoughts match logline; escape path still solvable.

### Phase 2 — Memory schedule (content)

- Add journal entries keyed to `lesson_1`–`lesson_4`, `painting_moved`, `wardrobe_open`.
- Portal level script pass (openings + lesson journals with memory peeks).
- Rewrite `all_lessons_learned` thought.

**Acceptance:** Full hub loop playable; each portal return adds one past-life journal line.

### Phase 3 — Tiered content (code + content, if needed)

- Schema for flag-gated examine/journal tiers.
- Wire 3–5 hotspots with upgraded text after memory flags.

**Acceptance:** Re-examining photos/sketchbook/phone after `lesson_2` shows new copy.

### Phase 4 — Wall notes & meditation blend

- Procedural note pool: delusion lines + memory crumbs; flag-weighted selection.
- Meditation overlay pulls from heard thoughts + memory journal tier.

**Acceptance:** Meditate after two lessons shows mix of cosmology and family fragments.

### Phase 5 — Polish & test

- Playwright: no broken examine selectors; spot-check journal list after flags.
- Full read-through for tone consistency (second person, no puzzle spoilers in Track B too early).

---

## Tone & style guide (for all new copy)

- **Second person** (“you”), present tense for examines; thoughts can be fragmented.
- Track A: capitalized Truth, patterns, the crow as messenger; never wink at “it’s fake” too early.
- Track B: concrete nouns (smell, weather, nickname), short sentences; sadness without melodrama.
- Amnesia: “I wrote this” / “I don’t remember writing this” pairs.
- Avoid naming the daughter in Phase 1–2 unless using placeholder `[NAME]` until sheet filled.
- Puzzle fairness: Track A text may hint mechanics; Track B text must not block solvability.

---

## Relationship to existing puzzle graph

Keep [`data/puzzles/bedroom.json`](data/puzzles/bedroom.json) gating intact unless design explicitly changes:

- Clock → drawer → photos → painting/safe → key → wardrobe → door STILLPOINT
- `lesson_1`–`lesson_4` re-gates clock, painting, wardrobe, door
- Meditation → ship portal first; other portals lesson-gated

Story work **layers on** flags and hotspots; do not remove puzzle dependencies without a design pass in `ProjectPlan.md`.

---

## Open decisions

| # | Question | Options |
|---|----------|---------|
| 1 | Daughter’s name in shipping build | Real name vs initial-only vs player-agnostic “she” |
| 2 | Phone interactable | Examine-only vs playable voicemail after safe |
| 3 | Crow on window | Lore-only vs visible prop/sprite |
| 4 | Ending reunion | Implied (hallway) vs text epilogue vs post-credits line |
| 5 | Stillpoint paperwork | Real trial / pure metaphor / ambiguous until end |

---

## Related files

| Path | Role |
|------|------|
| `StoryPlan.md` | This document |
| `ProjectPlan.md` | Mechanics, hub loop, architecture |
| `Handoff.md` | Build status, checklist |
| `data/story/bedroom-script.json` | Primary narrative data |
| `data/story/*-script.json` | Portal level voice |
| `src/game/NarrativeManager.ts` | Examine, journal, thoughts, meditation fragments |
| `src/scene/WallNotesCluster.ts` | Pinned note content |
| `data/rooms/bedroom.json` | Props for straw, figurine, phone placement |
