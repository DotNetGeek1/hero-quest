# Rules Overview

This document summarizes the core rules implemented in the digital HeroQuest-like engine.
It focuses on how the **rules engine** sees the game, not how the UI presents it.

## Core Concepts

- **Game** – Top-level container of all state (board, units, decks, quest state).
- **Actor** – Any unit that can take turns (hero or monster).
- **Action** – A discrete, rules-validated operation, e.g. `Move`, `Attack`, `CastSpell`, `Search`.
- **Turn** – Sequence of one actor's actions, governed by the turn engine.
- **Phase** – Subdivision of the round: hero phase, monster phase, etc.
- **Event** – Immutable record emitted by the rules engine when state changes.

The rules engine is **authoritative**: the board, UI, animation, and networking all react to
its events.

## Turn Structure (Default)

1. **Hero Phase**
   - Player heroes act in fixed order.
   - Each hero:
     - Start-of-turn effects
     - Movement (optional)
     - One main action (attack, cast, search, interact, or skip)
     - End-of-turn effects

2. **Monster Phase**
   - Overlord (AI or human) activates monsters, usually one by one.
   - Each monster:
     - Move up to its movement allowance
     - Attack if possible (or perform other scripted behavior)

3. **End of Round**
   - Check quest win/lose conditions.
   - Apply global effects, timers, or quest script triggers.

## Action Economy

By default, each hero turn:

- **Movement** – Up to `movement_points` along legal tiles.
- **One main action**:
  - **Attack** (melee or ranged)
  - **Cast Spell**
  - **Search** (traps, secret doors, treasure – rules define limits)
  - **Interact** (open door, use object, trigger quest-specific script)
  - **Defend / Guard** (optional variant)
- **Free actions** (no turn-ending):
  - Inspect UI
  - Rotate camera
  - Confirm info (cards, stats)

The exact limits (e.g. search once per room, once per turn, etc.) are configurable.

## Dice System

We represent dice symbolically, independent of physical art:

- **Attack die faces**: `SKULL`, `WHITE_SHIELD`, `BLACK_SHIELD`
- Heroes typically defend on `WHITE_SHIELD`, monsters on `BLACK_SHIELD`.
- Attack resolution:
  1. Roll attack dice -> count `SKULL`.
  2. Roll defense dice -> count relevant shields.
  3. Damage = `max(0, skulls - shields)`.

Dice are modeled as:

```ts
type DieFace = "SKULL" | "WHITE_SHIELD" | "BLACK_SHIELD";

interface DiceRoll {
  faces: DieFace[];
}
```

## Visibility & Line of Sight

- Line of sight (LOS) is usually straight-line, blocked by walls and closed doors.
- Opening a door reveals the room/corridor connected to it.
- Fog of war is applied on top of LOS to hide unexplored areas.

The rules engine provides:

- `getVisibleTiles(actorId)` – tiles currently visible by an actor.
- `getDiscoverableTilesOnDoorOpen(doorId)` – tiles revealed when a door is opened.

## Searching

The classic search types:

- **Search for traps**
- **Search for secret doors**
- **Search for treasure**

The engine enforces constraints:

- Only in valid locations (rooms or corridors).
- Only if no enemies present (configurable).
- Only once per room/corridor per hero or per group (configurable variant).

Search outcomes are data-driven:

- Reveal markers (traps, secret doors).
- Draw treasure card / spawn wandering monster.
- Trigger quest-specific events.

## Spells & Cards

Spells and cards are defined as data entries with:

- **Requirements** – who can use, when, and on what.
- **Effects** – one or more effect steps, referencing low-level rules operations.

Example effect primitives:

- Deal damage
- Heal or restore body/mind
- Move or teleport units
- Modify stats (temporary or permanent)
- Reveal tiles or information

## Quests & Scripts

Quests are composed of:

- **Static layout** – tiles, doors, furniture, initial monsters.
- **Hidden content** – traps, secret doors, scripted spawns.
- **Scripts** – event-driven logic:
  - When hero enters tile X
  - When monster Y dies
  - When search occurs at location Z

The rules engine exposes an **event bus** that quest scripts subscribe to.

## Determinism & Randomness

- For testing and networking, all randomness is controllable via a seed.
- Dice rolls, card draws, and random treasure use a shared RNG.
- In online play, the host or server is the source of truth for random results.

## Error Handling

All actions go through:

1. **Validation** – `validateAction(action)` returns `Ok` or `Error(code)`.
2. **Application** – `applyAction(action)` returns a list of `GameEvent`.

The UI should surface validation errors clearly, e.g.:

- "Target out of range."
- "You cannot search while monsters are present."
- "You have already cast all spells of this type."

This keeps the rules engine testable and predictable.
