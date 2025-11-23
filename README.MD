# Hero Quest

This repository follows the monorepo structure described in `TECH_STACK.md` to separate pure game rules from UI. The initial implementation focuses on the core rules engine for turn order and movement with comprehensive unit tests.

## Getting Started

1. Install dependencies (pnpm is recommended):

   ```bash
   pnpm install
   ```

2. Run tests for all workspaces:

   ```bash
   pnpm test
   ```

## Current Progress

- `packages/core` implements deterministic game state creation, validation, and application for movement and turn transitions.
- Combat resolution now emits richer `attackResolved` events (hit/block counts, critical flag) using supplied dice rolls.
- Line-of-sight helpers gate ranged attacks so they respect blocking tiles and configured ranges.
- A basic monster AI routine (`planMonsterTurn`) moves monsters toward the nearest hero and attacks when adjacent.
- Doors are modeled as first-class entities with an `openDoor` action that enforces adjacency/locking rules, unblocks tiles, and fires associated quest visibility triggers.
- Quest triggers can now spawn reinforcements, drop treasure/furniture payloads, and enqueue dialog entries in response to door or scripted events.
- Vitest coverage spans movement, turn rotation (including mixed hero/monster orders), ranged validation, combat logs, and AI planning outcomes.
