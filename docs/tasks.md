# Project Work Plan

This plan summarizes the current progress and the next actionable steps to reach the vertical slice outlined in `docs/project.md`.

## Done
- Core turn + movement validation with deterministic events.
- Adjacent attack resolution using supplied dice rolls, damage application, and defeat detection events.
- Defense/morale gating prevents defeated actors from acting and ensures defeated actors are skipped when advancing turns.
- Added tests covering defeat-driven turn skipping and zero-floor damage outcomes.

## Next Up
- Define ranged/line-of-sight checks and integrate them into attack validation.
- Emit richer combat log details (per-die results, critical messaging) for UI consumption.
- Introduce basic monster AI routine (move toward nearest hero, attack if adjacent).
- Expand test fixtures to cover mixed-faction turn order (heroes then monsters) beyond the base hero/monster pairing.

## Later (before Phase 2 is complete)
- Model searching (traps, secret doors, treasure) with validation rules.
- Define spell and equipment schemas plus corresponding actions.
- Introduce fog-of-war/visibility helpers for the board engine.
- Document data formats for quests, tiles, and cards to keep the rules engine data-driven.
