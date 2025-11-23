# Project Work Plan

This plan summarizes the current progress and the next actionable steps to reach the vertical slice outlined in `docs/project.md`.

## Done
- Core turn + movement validation with deterministic events.
- Adjacent attack resolution using supplied dice rolls, damage application, and defeat detection events.
- Defense/morale gating prevents defeated actors from acting and ensures defeated actors are skipped when advancing turns.
- Added tests covering defeat-driven turn skipping and zero-floor damage outcomes.
- Integrated ranged attack ranges + line-of-sight validation helpers into the rules engine.
- Expanded `attackResolved` combat logs with hit/block counts and critical metadata for UI consumers.
- Added a basic monster AI planner that walks toward the nearest hero and attacks when adjacent.
- Added regression tests for multi-hero multi-monster turn orders to ensure faction sequencing stays intact.
- Modeled room/corridor search actions (traps, secret doors, treasure) including discoverables, validation rules, fog-of-war reveals, and regression tests.
- Defined spell/equipment schemas with actionable `castSpell`/`useEquipment` flows plus deterministic effect application and coverage.
- Introduced reusable fog-of-war helpers (vision range BFS, visibility ownership, discovery merging) for the board engine.
- Documented board/tile/card data formats so quests stay data-driven.
- Hooked quest visibility triggers (doors, scripts) into the fog-of-war system via a dedicated rules action so door/script reveals emit consistent tile events and respect trigger history.
- Extended spell/equipment effect handling with status duration ticking at end-of-turn so buffs/debuffs expire cleanly and revert their stat modifiers.
- Added explicit door entities plus an `openDoor` action that enforces adjacency/locking rules, toggles passability, and automatically fires linked quest visibility triggers.
- Expanded quest triggers so door/script contexts can spawn actors, drop treasure/furniture payloads, and enqueue deterministic dialog entries alongside reveal events.

## Next Up
- Introduce interact/use-object actions so spawned furniture and quest props can drive follow-up scripts without piggybacking on doors.
- Add a lightweight quest objective tracker that listens to rule events (spawns, defeats, searches) and surfaces win/lose progress for future UI.

## Later (before Phase 2 is complete)
- (tbd as Next Up items land)
