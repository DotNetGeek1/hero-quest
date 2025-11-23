# Project: Digital Dungeon Quest (HeroQuest-like)

> Internal codename. Mechanically based on HeroQuest, implemented as a digital tabletop with animations and quality-of-life features.

---

## 1. Vision & Scope

**Goal:**  
Create a faithful digital adaptation of the HeroQuest-style tabletop dungeon crawler that:

- Keeps **board-game clarity**: grid board, visible dice, cards, turn order, etc.
- Adds **lightweight but satisfying juice**: battle animations, spell VFX, card-draw animations, ambient dungeon feel.
- Supports **single-player + co-op**, with a human or AI-controlled “Zargon/Morcar” (game master).

**Non-goals (for now):**

- Not trying to become a full CRPG with free camera, open world, or complex inventories.
- No rules redesign from scratch; start with classic rules, then add optional variants.

---

## 2. Design Pillars

1. **Tabletop-first**  
   Everything should be understandable as if it were happening on a physical board: grid, pieces, cards, dice.

2. **Readable over pretty**  
   Animations and VFX must never obscure core information (health, position, line of sight, dice results).

3. **Fast turns**  
   Minimal click friction. Common actions should be 1–2 clicks or hotkeys.

4. **Moddable-ish**  
   Data-driven quests, monsters, heroes, cards so new content can be added via JSON/ YAML/whatever later.

---

## 3. High-Level Architecture

Think in layers/engines:

1. **Rules Engine** – Game rules, actions, validation, dice logic.
2. **Turn & Phase Engine** – Whose turn is it, what state the game is in.
3. **Board / Map Engine** – Grid, tiles, doors, fog of war, LOS, pathfinding.
4. **Combat Engine** – Attack resolution, defense, damage, death.
5. **Characters & Progression Engine** – Heroes, monsters, stats, equipment, leveling (if added).
6. **Cards & Spell Engine** – Decks, draws, spell casting, cooldown/usage rules.
7. **AI / Zargon Engine** – Either AI-driven overlord or UI for a human to control monsters/events.
8. **Animation & VFX Layer** – Not gameplay-critical, just visual/audio feedback.
9. **UI / UX Layer** – HUD, action menus, dice displays, card views, log.
10. **Persistence Engine** – Saves, campaign progress, quest states.
11. **Networking Layer (optional later)** – Sync state across clients for co-op / remote play.
12. **Tools & Editors** – Quest editor, map editor, card/spell editor, debugging panel.

Each of these should be **logically separable** in code and in docs.

---

## 4. Systems / Engines Breakdown

### 4.1 Rules Engine

**Responsibilities:**

- Implement core HeroQuest rules:
  - Movement allowance
  - Attack/defense rolls
  - Searching (traps, secret doors, treasure)
  - Line of sight
  - Spell usage
- Validate actions: `canMove`, `canAttack`, `canOpenDoor`, `canSearch`, `canCastSpell`.
- Apply rule outcomes: damage, reveal tiles, spawn monsters, add/remove cards, etc.
- Provide a **pure, deterministic API** where possible (easy to test).

**Docs:**

- `/docs/rules/overview.md`
- `/docs/rules/actions.md`
- `/docs/rules/searching-and-los.md`

---

### 4.2 Turn & Phase Engine

**Responsibilities:**

- Turn order: heroes → monsters → heroes → ...
- Phases per turn (example):
  - Start of turn (status effects, draw, etc.)
  - Movement phase
  - Action phase (attack, cast, search, interact)
  - End-of-turn checks
- States for UI & animations: “awaiting_input”, “resolving_action”, “animating”, “dialogue”, etc.
- Initiative/turn order might be simple (fixed hero order + monsters) initially.

**Docs:**

- `/docs/engines/turn-engine.md`

---

### 4.3 Board / Map Engine

**Responsibilities:**

- Represent board as **grid** (2D array of tiles).
- Tile types: floor, wall, door (closed/open), furniture, trap, secret door, etc.
- Fog of war / visibility (based on line of sight).
- Pathfinding (basic A* or similar).
- Handle interactions:
  - Opening doors
  - Triggering traps
  - Revealing rooms

**Docs:**

- `/docs/engines/map-engine.md`
- `/docs/data/tiles-and-rooms.md`

---

### 4.4 Combat Engine

**Responsibilities:**

- Attack resolution:
  - Roll attack dice
  - Roll defense dice
  - Calculate hits/misses, damage, death
- Support:
  - Melee vs ranged
  - Modifiers from equipment/spells
- Feed results to:
  - Animation system (who hit whom, for how much)
  - Log system
  - UI (floating numbers, etc.)

**Docs:**

- `/docs/engines/combat-engine.md`

---

### 4.5 Characters & Progression Engine

**Responsibilities:**

- Data structures for:
  - Heroes (Barbarian, Dwarf, Elf, Wizard, etc.)
  - Monsters (Goblins, Orcs, Fimirs, Chaos Warriors, etc.)
- Stats: Attack dice, defend dice, body, mind, movement, etc.
- Equipment:
  - Weapons, armor, artifacts.
- Optional: Long-term progression (gold, upgrades between quests).

**Docs:**

- `/docs/data/characters.md`
- `/docs/data/monsters.md`
- `/docs/data/equipment.md`

---

### 4.6 Cards & Spell Engine

**Responsibilities:**

- Decks:
  - Treasure deck
  - Equipment deck (if used this way)
  - Spell groups (Fire, Water, Earth, Air, Chaos, etc.)
- Operations:
  - Shuffle, draw, discard.
- Card resolution hooks:
  - “When drawn, run this effect.”
  - UI: show card, animate draw.
- Data-driven card definitions: JSON/YAML with cost, restrictions, effect script.

**Docs:**

- `/docs/engines/card-engine.md`
- `/docs/data/spells-and-cards.md`

---

### 4.7 AI / Zargon Engine

**Modes:**

1. **Human Overlord Mode**
   - UI to place monsters, trigger traps, spawn events.
   - Override/confirm some rule decisions.

2. **AI Overlord Mode**
   - Basic monster AI:
     - Move towards nearest hero in LOS.
     - Attack if possible, else move closer or hold.
   - Trigger scripted events on quest markers.

**Docs:**

- `/docs/engines/ai-overlord.md`

---

### 4.8 Animation & VFX Layer

**Responsibilities:**

- Piece movement animations (slide, hop, etc.).
- Attack animations: swing, projectile, impact.
- Spell VFX: particles, light, overlays.
- Card animations: draw, flip, discard.
- Cameras: slight zoom or pan to focus on actions.
- Must be **decoupled** from rules: animations consume an event stream from the rules engine.

**Docs:**

- `/docs/engines/animation-layer.md`

---

### 4.9 UI / UX Layer

**Key elements:**

- Hero HUD: health, mind, equipped items, available spells.
- Turn indicator: whose turn, what phase.
- Action menu: move, attack, cast, search, open, use, end turn.
- Dice display: show rolls as physical-looking dice or clear icons.
- Log: text history of actions.
- Card viewer: browse hand/spells.

**Docs:**

- `/docs/ui/layouts.md`
- `/docs/ui/interaction-flows.md`

---

### 4.10 Persistence Engine

**Responsibilities:**

- Save/load:
  - Current quest state
  - Hero stats/equipment
  - Campaign progress
- Data format: JSON or similar.
- Versioning: simple version field for future migration.

**Docs:**

- `/docs/engines/persistence.md`

---

### 4.11 Networking Layer (Later Phase)

**Responsibilities:**

- Sync turn-based game state between players.
- One host as authority (or server).
- Handle player roles:
  - Hero clients
  - Overlord client
- Turn lockstep: state only advances when all required inputs received.

**Docs:**

- `/docs/engines/networking.md`

---

### 4.12 Tools & Editors

**Nice-to-have but powerful:**

- **Quest Editor**:
  - Place rooms, corridors, doors, furniture.
  - Script events (when hero enters tile X, spawn monsters Y, show text Z).
- **Card Editor**:
  - Add new treasure, spells, items.
- **Debug Tools**:
  - Teleport units, force dice rolls, reveal map.

**Docs:**

- `/docs/tools/quest-editor.md`
- `/docs/tools/card-editor.md`

---

## 5. Mapping to HeroQuest Mechanics

### 5.1 Heroes & Monsters

- Heroes have fixed base stats + equipment modifiers.
- Monsters defined mostly by attack/defense dice, body, mind, movement.

### 5.2 Movement & Actions

- Roll movement dice (or fixed movement if using variants).
- Move orthogonally on the grid.
- Common rule: one action per turn (attack OR cast OR search).

### 5.3 Line of Sight & Doors

- LOS blocked by walls and closed doors.
- Opening a door reveals the room / corridor area and any monsters/furniture inside.

### 5.4 Traps & Secret Doors

- Hidden until:
  - Stepped on (trap triggers).
  - Revealed by a search (trap marker / secret door appears).
- The map data should specify hidden triggers and their revealed states.

### 5.5 Treasure & Searches

- Searching a room/corridor:
  - Draw treasure card (or predefined treasure in quest notes).
  - Chance of traps or wandering monsters.

### 5.6 Quests & Campaign

- Each quest:
  - Initial board layout.
  - Pre-placed monsters/furniture.
  - Secret notes (hidden content).
  - Win/lose conditions.
- Campaign:
  - Sequence of quests
  - Gold, items, upgrades carry between quests.

---

## 6. Development Phases

### Phase 0 – Planning & Tech Spike

- Decide tech stack (engine/language).
- Set up repo structure:
  - `/docs`
  - `/src`
  - `/assets`
  - `/tests`
- Lock in baseline rule set (classic HeroQuest).

**Deliverables:**

- This `PROJECT.md`
- Initial data schemas (tiles, units, cards).

---

### Phase 1 – Core Board & Turn Skeleton

- Implement:
  - Board/grid rendering.
  - Basic unit placement (heroes, monsters).
  - Turn system with simple hero + monster turns.
- Stub Rules:
  - Movement without collisions/jank.
  - End-turn logic.

**Playable state:**  
You can move heroes around a board in turn order, no combat yet.

---

### Phase 2 – Combat & Basic Rules

- Implement:
  - Attack/defense dice rolls.
  - Damage and death.
  - Search basics (dangerously simplified).
- Add basic monster AI (move + attack nearest hero).
- Add text log and minimal UI for actions.

**Playable state:**  
You can clear a simple room of monsters with core rules functioning.

---

### Phase 3 – Full Rules & Content Pipeline

- Fill out:
  - Traps, secret doors, treasure deck.
  - Spells and spell casting.
  - Quest loading from external data.
- Implement fog of war + LOS.
- Build format for quests (JSON/YAML + map).

**Playable state:**  
At least 1–3 full quests that feel close to the tabletop game.

---

### Phase 4 – Animation, VFX & Polish Pass 1

- Add:
  - Piece movement animations.
  - Attack + spell VFX.
  - Card draw/flip animations.
  - Ambient audio and music hooks.
- UX improvements:
  - Tooltips, hotkeys, clearer prompts.

**Playable state:**  
Feels like a “real” digital board game now, not a prototype.

---

### Phase 5 – Networking / Online Co-op (Optional)

- Add:
  - Lobby / join game.
  - Player roles (heroes vs overlord).
  - Network sync of actions/turns.
- Latency-tolerant design: everything is turn-based, so exploit that.

---

### Phase 6 – Polish, Balancing, Mod Support

- Balance tweaks (monsters, spells, treasure frequency).
- Bug fixing, performance.
- Expose:
  - Quest file format
  - Card/spell format
  - Possibly lightweight mod hooks.

---

## 7. Documentation Index (Codex)

Proposed structure for `/docs`:

- `PROJECT.md` – This file.
- `rules/`
  - `overview.md`
  - `actions.md`
  - `searching-and-los.md`
- `engines/`
  - `rules-engine.md`
  - `turn-engine.md`
  - `map-engine.md`
  - `combat-engine.md`
  - `card-engine.md`
  - `ai-overlord.md`
  - `animation-layer.md`
  - `persistence.md`
  - `networking.md`
- `data/`
  - `characters.md`
  - `monsters.md`
  - `equipment.md`
  - `spells-and-cards.md`
  - `tiles-and-rooms.md`
- `tools/`
  - `quest-editor.md`
  - `card-editor.md`
- `ui/`
  - `layouts.md`
  - `interaction-flows.md`

---

## 8. Next Steps

1. Confirm/adjust the engine breakdown so it matches the chosen tech stack.
2. Implement a tiny vertical slice:
   - One room
   - 1 hero vs 1 monster
   - Move → Attack → Dice → Animation → Death
3. Start filling out individual engine docs as you implement them, not after.

If something feels “too big”, we cut it into a smaller engine or phase. The Barbarian doesn’t overthink; he just starts swinging — we’ll iterate as we go.
