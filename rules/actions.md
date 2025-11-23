# Actions

This document defines the core action types exposed by the rules engine.

An **action** is a request to change game state. The engine:

1. Validates it (`validateAction`).
2. Applies it (`applyAction`), emitting events.

## Action Base Type

Conceptual TypeScript-like pseudocode:

```ts
type ActionType =
  | "MOVE"
  | "ATTACK"
  | "CAST_SPELL"
  | "SEARCH"
  | "OPEN_DOOR"
  | "INTERACT"
  | "END_TURN";

interface BaseAction {
  id: string;          // unique per action
  type: ActionType;
  actorId: string;     // hero or monster
}
```

Each action subtype adds payload fields.

### MOVE

```ts
interface MoveAction extends BaseAction {
  type: "MOVE";
  path: TileCoord[]; // ordered list of grid positions
}
```

**Rules:**

- Path length ≤ available movement points.
- Path cannot pass through walls, closed doors, or blocking units.
- No diagonal moves unless explicitly allowed.
- Traps along the path may trigger.

### ATTACK

```ts
interface AttackAction extends BaseAction {
  type: "ATTACK";
  targetId: string;
  weaponId?: string; // optional if default weapon
}
```

**Rules:**

- Target must be in range (melee or ranged).
- Must have line of sight if ranged.
- Actor must have an available attack action this turn.
- May require specific weapon/equipment.

### CAST_SPELL

```ts
interface CastSpellAction extends BaseAction {
  type: "CAST_SPELL";
  spellId: string;
  targetId?: string;
  targetArea?: TileCoord[];
}
```

**Rules:**

- Actor must know the spell and have it unused (or have remaining uses).
- Spell requirements must be met (range, LOS, target type).
- Some spells may not require a target (self-buff, global effect).

### SEARCH

```ts
type SearchKind = "TRAPS" | "SECRET_DOORS" | "TREASURE";

interface SearchAction extends BaseAction {
  type: "SEARCH";
  kind: SearchKind;
}
```

**Rules:**

- Only in valid context (room/corridor).
- Only if search not already performed according to quest rules.
- Usually not allowed if enemies are present.

### OPEN_DOOR

```ts
interface OpenDoorAction extends BaseAction {
  type: "OPEN_DOOR";
  doorId: string;
}
```

**Rules:**

- Actor must be adjacent to the door tile.
- Door must be closed and not locked/barricaded.
- Triggers room reveal, spawns monsters, etc.

### INTERACT

```ts
interface InteractAction extends BaseAction {
  type: "INTERACT";
  objectId: string;
}
```

**Rules:**

- Interaction rules are quest-specific:
  - Pull a lever
  - Read an inscription
  - Use a special artifact on an altar
- The engine passes this to the quest script system.

### END_TURN

```ts
interface EndTurnAction extends BaseAction {
  type: "END_TURN";
}
```

**Rules:**

- Actor cannot end turn while mid-resolution of another action.
- Some statuses might auto-trigger at end of turn.

## Validation

All actions use:

```ts
type ValidationResult =
  | { ok: true }
  | { ok: false; errorCode: string; message?: string };
```

Common error codes:

- `NOT_ACTORS_TURN`
- `ACTION_NOT_ALLOWED_IN_PHASE`
- `INSUFFICIENT_MOVEMENT`
- `TARGET_OUT_OF_RANGE`
- `TARGET_NOT_VISIBLE`
- `ALREADY_SEARCHED`
- `SPELL_NOT_AVAILABLE`
- `INVALID_DOOR`
- `BLOCKED_PATH`

## Events Emitted

Each successful action emits events, e.g.:

- `ActorMoved`
- `AttackResolved`
- `SpellCast`
- `TilesRevealed`
- `DoorOpened`
- `SearchResolved`
- `TurnEnded`

Animation, UI, and networking consume these events to stay in sync.
