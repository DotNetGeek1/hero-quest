# Interaction Flows

High-level UX flows for common actions.

## Moving a Hero

1. Player selects hero (click portrait or token).
2. Movement range highlights on board.
3. Player clicks target tile or drags path.
4. UI sends `MoveAction`.
5. On success:
   - Board updates.
   - Movement animation plays.
   - Remaining movement points updated.

## Attacking

1. Player selects hero.
2. Player chooses `Attack` action.
3. Valid targets highlight.
4. Player clicks a target.
5. UI sends `AttackAction`.
6. On success:
   - Dice are rolled and shown.
   - Combat animation plays.
   - Log records outcome.

## Casting a Spell

1. Player selects hero with spells.
2. Player opens spell panel.
3. Player selects a spell (showing description and range).
4. Valid targets or areas highlight.
5. Player selects target.
6. UI sends `CastSpellAction`.
7. Engine resolves; animations + log show result.

## Searching

1. Player selects hero.
2. Player chooses `Search` → `Traps`, `Secret Doors`, or `Treasure`.
3. UI sends `SearchAction`.
4. Engine validates:
   - If invalid, show prompt (e.g. "You cannot search now.").
   - If valid, reveal markers / draw treasure.
5. Log and board update accordingly.

## Opening Doors / Interacting

1. Player selects hero.
2. Player hovers over door or object; context UI shows possible interaction.
3. Player clicks `Open` / `Interact`.
4. UI sends `OpenDoorAction` or `InteractAction`.
5. Engine resolves:
   - Tiles/rooms revealed.
   - Monsters spawned.
   - Scripted text shown.

These flows should remain short and predictable, with minimal clicks per action.
