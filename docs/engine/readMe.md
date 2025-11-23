## Engine Notes

### Monster AI

- `packages/core` exposes `planMonsterTurn(state, monsterId, options)` to script basic overlord behavior.
- The helper:
  - Finds the nearest conscious hero using Manhattan distance.
  - Issues a series of one-tile move actions (respecting blockers and remaining movement) until adjacent.
  - Emits an attack action with supplied dice rolls once adjacency is reached.
- Consumers can override the dice rolling callbacks to plug in deterministic seeds or UI-driven rolls.
