
# Tech Stack & Implementation Plan

## Overview
This project is a **web-based digital tabletop RPG** inspired by HeroQuest.  
Architecture separates **core game logic** from **web rendering/UI** to keep everything clean and testable.

---

## Languages & Tools
- **TypeScript**
- **Vite**
- **React**
- **Babylon.js**
- **Vitest/Jest**
- **ESLint + Prettier**
- **pnpm package manager**

---

## Project Structure
```
/
├─ PROJECT.md
├─ TECH_STACK.md
├─ docs/
├─ packages/
│  ├─ core/         # Pure logic
│  ├─ client-web/   # React + Babylon.js
│  └─ shared/       # Optional shared types
└─ assets/
```

---

## packages/core (Pure Logic)
### Responsibilities
- Game state
- Rules engine
- Turn engine
- Combat engine
- Map engine
- Card engine
- AI
- Quest scripting hooks

### Example Types
```ts
interface GameState {
  turn: TurnState;
  actors: Record<string, ActorState>;
  board: BoardState;
  decks: DeckState;
  quest: QuestState;
  visibility: VisibilityState;
  rng: RngState;
}
```

```ts
export interface RulesEngine {
  validateAction(state: GameState, action: Action): ValidationResult;
  applyAction(state: GameState, action: Action): {
    state: GameState;
    events: GameEvent[];
  };
}
```

---

## packages/client-web (React + Babylon.js)
### Responsibilities
- 3D board rendering
- HUD + UI
- Animations
- Input → dispatch actions
- Sync with core logic

### Example Canvas Component
```tsx
export const BoardCanvas = ({ gameState, onAction }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    engine.runRenderLoop(() => scene.render());
    return () => engine.dispose();
  }, []);

  return <canvas ref={canvasRef} />;
};
```

---

## State Management
Use **Zustand**:

```ts
export const useGameStore = create((set, get) => ({
  state: createInitialGameState(),
  events: [],
  dispatch: (action) =>
    set((s) => {
      const out = rulesEngine.applyAction(s.state, action);
      s.state = out.state;
      s.events.push(...out.events);
    }),
}));
```

---

## Implementation Phases
### Phase 1 — Skeleton
- Monorepo init
- Render grid
- Basic hero/monster meshes

### Phase 2 — Movement & Turns
- Pathfinding
- Turn order
- Basic AI

### Phase 3 — Combat
- Dice
- Attack resolution
- Animations

### Phase 4 — Spells & Searches
- LOS + fog-of-war
- Spells + treasures

### Phase 5 — Quest Loading
- JSON quests
- Scripted triggers

### Phase 6 — Networking (Optional)
- Host-authoritative sync

---

## Summary
This tech stack:
- Makes core rules **pure + testable**
- Uses **Babylon.js** for fast 3D board rendering
- Uses **React** for flexible HUD/UI
- Scales cleanly to **networking and modding**
