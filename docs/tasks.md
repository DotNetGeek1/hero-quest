# Project Work Plan

This plan summarizes the current progress and the next actionable steps to reach the vertical slice outlined in `docs/project.md`.

## Done
- Core turn + movement validation with deterministic events.
- Adjacent attack resolution using supplied dice rolls, damage application, and defeat detection events.
- Defense/morale gating prevents defeated actors from acting and ensures defeated actors are skipped when advancing turns.
- Added tests covering defeat-driven turn skipping and zero-floor damage outcomes.
- Line-of-sight aware ranged validation keeps shots honest around blocked tiles and range limits.
- Combat events include per-roll summaries, net hits, and critical messaging for UI consumption.
- Introduced a basic monster AI routine that paths toward the nearest hero, attacks when adjacent, and ends its turn.
- Expanded fixtures to cover mixed hero/monster turn ordering rather than a single pairing.

## Next Up
- Model searching (traps, secret doors, treasure) with validation rules.
- Define spell and equipment schemas plus corresponding actions.
- Introduce fog-of-war/visibility helpers for the board engine.
- Document data formats for quests, tiles, and cards to keep the rules engine data-driven.

## Later (before Phase 2 is complete)
- Implement treasure/spell deck shuffling/drawing hooks that feed into the rules engine.
- Expand monster AI with threat evaluation (prefer weaker heroes, respect blockers, avoid lethal paths).
- Start documenting quest scripting and trigger hooks so map data can drive encounters.
