# Quest Editor

The quest editor is an internal tool (or future user-facing tool) to create and modify quests.

## Goals

- Visually design dungeon layouts.
- Configure monsters, traps, treasure, and scripts.
- Export to a clean data format consumed by the game.

## Core Features

- Grid-based map editor:
  - Paint tiles (floor, wall, door, furniture).
  - Assign rooms and corridors.
- Entity placement:
  - Monsters
  - Furniture
  - Traps
  - Secret doors
- Script hooks:
  - Trigger definitions (on enter tile, on search, on kill boss).
  - Effects (spawn monsters, show text, give item, open doors).

## Export Format

Example structure:

```ts
interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  map: QuestMap;
  initialMonsters: MonsterSpawn[];
  scriptedEvents: QuestEventDefinition[];
  winConditions: QuestCondition[];
  loseConditions: QuestCondition[];
}
```

The editor should validate basic constraints before export:

- No unreachable areas.
- Valid references to monsters, tiles, items.
