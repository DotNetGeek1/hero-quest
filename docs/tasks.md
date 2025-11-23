# Project Work Plan

This plan summarizes the current progress and the next actionable steps to reach the vertical slice outlined in `docs/project.md`.

## Done
- Core turn + movement validation with deterministic events.
- Adjacent attack resolution using supplied dice rolls, damage application, and defeat detection events.

## Next Up
- Define ranged/line-of-sight checks and integrate them into attack validation.
- Add defense/morale gates: disallow actions from defeated actors and ensure health cannot drop below zero.
- Emit richer combat log details (per-die results, critical messaging) for UI consumption.
- Introduce basic monster AI routine (move toward nearest hero, attack if adjacent).
- Expand test fixtures to cover mixed-faction turn order (heroes then monsters) and defeat-driven turn skipping.

## Later (before Phase 2 is complete)
- Model searching (traps, secret doors, treasure) with validation rules.
- Define spell and equipment schemas plus corresponding actions.
- Introduce fog-of-war/visibility helpers for the board engine.
- Document data formats for quests, tiles, and cards to keep the rules engine data-driven.
