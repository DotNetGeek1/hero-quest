# Searching & Line of Sight

This document describes how searching and line of sight (LOS) work in the engine.

## Line of Sight (LOS)

LOS is used for:

- Ranged attacks
- Spell targeting
- Revealing tiles and monsters
- Determining what the player can see

### LOS Model

- The board is a 2D grid of tiles.
- Walls and closed doors **block** LOS.
- Open doors and furniture generally do **not** block LOS, unless configured.
- LOS is typically calculated from the center of one tile to the center of another.

Implementation notes:

- Use a grid-ray algorithm (e.g. Bresenham-based).
- If any wall tile fully blocks the ray, LOS fails.
- Edge cases (diagonal gaps) can be tuned per rule-set.

The rules engine exposes:

```ts
function hasLineOfSight(from: TileCoord, to: TileCoord): boolean;
function visibleTilesFrom(source: TileCoord, maxRange?: number): TileCoord[];
```

## Fog of War & Visibility

Fog of war is built on top of LOS:

- A tile can be **unexplored**, **discovered but not visible**, or **visible**.
- Monsters and objects may only spawn or become visible when a tile is revealed.
- UI and AI both respect these visibility states.

Event-driven flow:

1. Actor opens a door.
2. Engine determines which tiles are revealed.
3. Emit `TilesRevealed` and `MonstersSpawned` events.

## Searching

There are three classic search types:

- Search for **traps**
- Search for **secret doors**
- Search for **treasure**

### Search Context

The engine needs:

- Current hero tile.
- Connected area (room or corridor) the hero is in.
- Search history for that area.

```ts
interface SearchContext {
  areaId: string;           // room or corridor identifier
  hasMonsters: boolean;     // visible enemies in area
  alreadySearched: boolean; // according to configured rules
}
```

### Search Rules

Default constraints (configurable):

- Only one search of a given type per area.
- Cannot search if visible monsters in the same area.
- Must be inside the area (not in doorway or wall).

If search is valid:

- For traps/secret doors:
  - Reveal all relevant markers in the area.
  - Emit `TrapRevealed` / `SecretDoorRevealed` events.
- For treasure:
  - Either:
    - Use quest-defined treasure (if specified), OR
    - Draw from treasure deck and resolve its effect.

### Treasure Search Outcomes

Possible outcomes:

- Gold or loot (added to hero inventory or party pool).
- Potion or temporary buff.
- Trap (immediate effect, e.g. arrow, pit).
- Wandering monster (spawn + immediate attack or move).

Treasure cards are data-driven; the engine just executes their effects.

### Quest-Specific Searches

Quests can override or hook into search resolution:

- Custom text descriptions.
- Special items only present in that area.
- Conditional outcomes (e.g. only if hero carries a certain artifact).

Quest scripts listen to search-related events:

- `SearchPerformed`
- `TreasureResolved`
- `TrapTriggered`
