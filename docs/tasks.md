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

## Next Up
- Extend fog-of-war helpers to integrate with quest triggers (door reveals, scripted reveals).
- Broaden the spell/equipment effect language (movement, status ailments, buffs/debuffs).

## Later (before Phase 2 is complete)
- (tbd as Next Up items land)
