# Card & Spell Editor

The card editor manages data for:

- Treasure cards
- Equipment cards
- Spell definitions
- Artifacts

## Features

- Create, edit, and delete cards.
- Validate card effects:
  - Check referenced effectDefinitionIds exist.
  - Ensure costs and requirements are sensible.
- Preview card layout (for UI).

## Workflow

1. Designer creates/edits card.
2. Editor ensures the data conforms to schema.
3. Cards are exported into JSON/YAML bundles:
   - `treasure_cards.json`
   - `equipment_cards.json`
   - `spells.json`

These bundles are loaded at game startup.
