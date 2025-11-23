import { describe, expect, it } from "vitest";
import { createGameState, planMonsterTurn } from "../src";
import { GameState } from "../src/types";

const board = { width: 6, height: 6, blocked: [] };

const diceOptions = {
  rollAttackDice: ({ dice }: { attackerId: string; dice: number }) =>
    Array(dice).fill("skull"),
  rollDefenseDice: ({ dice }: { targetId: string; dice: number }) =>
    Array(dice).fill("white-shield"),
};

function buildState(monsterPos: { x: number; y: number }, heroPos: { x: number; y: number }): GameState {
  return createGameState({
    board,
    actors: [
      {
        id: "monster-1",
        name: "Orc",
        faction: "monster" as const,
        position: monsterPos,
        movement: 4,
        attackDice: 2,
        attackRange: 1,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
      {
        id: "hero-1",
        name: "Barbarian",
        faction: "hero" as const,
        position: heroPos,
        movement: 6,
        attackDice: 3,
        attackRange: 1,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
    ],
    turnOrder: ["monster-1", "hero-1"],
  });
}

describe("planMonsterTurn", () => {
  it("attacks immediately when already adjacent to a hero", () => {
    const state = buildState({ x: 2, y: 2 }, { x: 2, y: 3 });
    const actions = planMonsterTurn(state, "monster-1", diceOptions);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "attack",
      attackerId: "monster-1",
      targetId: "hero-1",
    });
  });

  it("moves toward the nearest hero and attacks after closing the gap", () => {
    const state = buildState({ x: 2, y: 0 }, { x: 2, y: 4 });
    const actions = planMonsterTurn(state, "monster-1", diceOptions);

    // Multiple single-tile moves followed by an attack.
    expect(actions.slice(0, -1)).toEqual([
      { type: "move", actorId: "monster-1", to: { x: 2, y: 1 } },
      { type: "move", actorId: "monster-1", to: { x: 2, y: 2 } },
      { type: "move", actorId: "monster-1", to: { x: 2, y: 3 } },
    ]);

    const finalAction = actions[actions.length - 1];
    expect(finalAction).toMatchObject({
      type: "attack",
      attackerId: "monster-1",
      targetId: "hero-1",
    });
  });
});
