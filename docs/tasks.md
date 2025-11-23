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

## Next Up
- Model searching (traps, secret doors, treasure) with validation rules.
- Define spell and equipment schemas plus corresponding actions.
- Introduce fog-of-war/visibility helpers for the board engine.
- Document data formats for quests, tiles, and cards to keep the rules engine data-driven.

## Later (before Phase 2 is complete)
- (tbd as Next Up items land)
