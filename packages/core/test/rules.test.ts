import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGameState,
  currentActorId,
  planMonsterTurn,
  rulesEngine,
  validateAction,
} from "../src";
import { Action, GameState } from "../src/types";

type SetupOptions = {
  blocked?: { x: number; y: number }[];
};

function buildGameState(options: SetupOptions = {}): GameState {
  const board = { width: 5, height: 5, blocked: options.blocked ?? [] };
  const actors = [
    {
      id: "hero-1",
      name: "Barbarian",
      faction: "hero" as const,
      position: { x: 0, y: 0 },
      movement: 4,
      attackDice: 3,
      defenseDice: 2,
      health: 8,
      maxHealth: 8,
    },
    {
      id: "monster-1",
      name: "Goblin",
      faction: "monster" as const,
      position: { x: 2, y: 2 },
      movement: 5,
      attackDice: 2,
      defenseDice: 2,
      health: 3,
      maxHealth: 3,
    },
  ];
  return createGameState({ board, actors });
}

describe("rulesEngine.validateAction", () => {
  it("rejects moves when not the actor's turn", () => {
    const state = buildGameState();
    const action: Action = { type: "move", actorId: "monster-1", to: { x: 1, y: 0 } };
    const result = validateAction(state, action);
    expect(result.ok).toBe(false);
  });

  it("rejects actions initiated by defeated actors", () => {
    const state = buildGameState();
    state.actors["hero-1"].health = 0;

    const moveAction: Action = { type: "move", actorId: "hero-1", to: { x: 1, y: 0 } };
    expect(validateAction(state, moveAction)).toEqual({ ok: false, reason: "Actor is defeated" });

    const attackAction: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["black-shield", "white-shield"],
    };
    expect(validateAction(state, attackAction)).toEqual({ ok: false, reason: "Attacker is defeated" });

    const endTurnAction: Action = { type: "endTurn", actorId: "hero-1" };
    expect(validateAction(state, endTurnAction)).toEqual({ ok: false, reason: "Actor is defeated" });
  });

  it("rejects moves that exceed remaining movement", () => {
    const state = buildGameState();
    const action: Action = { type: "move", actorId: "hero-1", to: { x: 4, y: 1 } };
    const result = validateAction(state, action);
    expect(result).toEqual({ ok: false, reason: "Not enough movement remaining" });
  });

  it("rejects moves into blocked or occupied tiles", () => {
    const state = buildGameState({ blocked: [{ x: 1, y: 0 }] });
    const blockedAction: Action = { type: "move", actorId: "hero-1", to: { x: 1, y: 0 } };
    expect(validateAction(state, blockedAction)).toEqual({
      ok: false,
      reason: "Destination is blocked",
    });

    const occupiedAction: Action = { type: "move", actorId: "hero-1", to: { x: 2, y: 2 } };
    expect(validateAction(state, occupiedAction)).toEqual({
      ok: false,
      reason: "Another actor already occupies that tile",
    });
  });

  it("validates line-of-sight for ranged attacks", () => {
    const board = { width: 5, height: 5, blocked: [{ x: 0, y: 1 }] };
    const actors = [
      {
        id: "hero-1",
        name: "Archer",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 4,
        attackDice: 3,
        attackRange: 3,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
      {
        id: "monster-1",
        name: "Goblin",
        faction: "monster" as const,
        position: { x: 0, y: 3 },
        movement: 5,
        attackDice: 2,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
    ];

    const blockedState = createGameState({ board, actors });
    const rangedAttack: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["white-shield", "white-shield"],
    };

    expect(validateAction(blockedState, rangedAttack)).toEqual({
      ok: false,
      reason: "No line of sight to target",
    });

    const clearBoard = { ...board, blocked: [] };
    const clearState = createGameState({ board: clearBoard, actors });
    expect(validateAction(clearState, rangedAttack)).toEqual({ ok: true });
  });

  it("rejects ranged attempts beyond weapon range", () => {
    const board = { width: 5, height: 5, blocked: [] };
    const actors = [
      {
        id: "hero-1",
        name: "Crossbow",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 4,
        attackDice: 3,
        attackRange: 2,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
      {
        id: "monster-1",
        name: "Orc",
        faction: "monster" as const,
        position: { x: 0, y: 3 },
        movement: 5,
        attackDice: 2,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
    ];

    const state = createGameState({ board, actors });
    const attack: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["white-shield", "white-shield"],
    };

    expect(validateAction(state, attack)).toEqual({ ok: false, reason: "Target is out of range" });
  });
});

describe("rulesEngine.applyAction", () => {
  it("moves an actor and emits an event without mutating the original state", () => {
    const state = buildGameState();
    const action: Action = { type: "move", actorId: "hero-1", to: { x: 1, y: 0 } };
    const result = applyAction(state, action);

    expect(result.state.actors["hero-1"].position).toEqual({ x: 1, y: 0 });
    expect(result.events[0]).toMatchObject({ type: "move", actorId: "hero-1" });
    expect(state.actors["hero-1"].position).toEqual({ x: 0, y: 0 });
  });

  it("spends movement and prevents overspending in the same turn", () => {
    const state = buildGameState();
    const firstMove: Action = { type: "move", actorId: "hero-1", to: { x: 1, y: 0 } };
    const afterFirst = applyAction(state, firstMove).state;
    expect(afterFirst.turn.movementRemaining["hero-1"]).toBe(3);

    const invalidSecondMove: Action = { type: "move", actorId: "hero-1", to: { x: 4, y: 2 } };
    expect(() => applyAction(afterFirst, invalidSecondMove)).toThrow("Not enough movement remaining");
  });

  it("advances the turn order and resets movement on endTurn", () => {
    const state = buildGameState();
    const result = applyAction(state, { type: "endTurn", actorId: "hero-1" });
    expect(result.events[0]).toEqual({
      type: "turnEnded",
      previousActorId: "hero-1",
      nextActorId: "monster-1",
    });

    expect(currentActorId(result.state)).toBe("monster-1");
    expect(result.state.turn.movementRemaining["monster-1"]).toBe(5);
  });

  it("skips defeated actors when advancing turns", () => {
    const board = { width: 5, height: 5, blocked: [] };
    const actors = [
      {
        id: "hero-1",
        name: "Barbarian",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 4,
        attackDice: 3,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
      {
        id: "hero-2",
        name: "Dwarf",
        faction: "hero" as const,
        position: { x: 1, y: 0 },
        movement: 5,
        attackDice: 3,
        defenseDice: 3,
        health: 0,
        maxHealth: 6,
      },
      {
        id: "monster-1",
        name: "Goblin",
        faction: "monster" as const,
        position: { x: 2, y: 2 },
        movement: 5,
        attackDice: 2,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
    ];
    const state = createGameState({ board, actors });

    const { state: resultState, events } = applyAction(state, {
      type: "endTurn",
      actorId: "hero-1",
    });

    expect(events[0]).toEqual({
      type: "turnEnded",
      previousActorId: "hero-1",
      nextActorId: "monster-1",
    });
    expect(currentActorId(resultState)).toBe("monster-1");
    expect(resultState.turn.movementRemaining["monster-1"]).toBe(5);
  });

  it("cycles through mixed hero and monster turn order", () => {
    const board = { width: 6, height: 6, blocked: [] };
    const actors = [
      {
        id: "hero-1",
        name: "Barbarian",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 4,
        attackDice: 3,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
      {
        id: "hero-2",
        name: "Elf",
        faction: "hero" as const,
        position: { x: 1, y: 0 },
        movement: 5,
        attackDice: 3,
        defenseDice: 3,
        health: 6,
        maxHealth: 6,
      },
      {
        id: "monster-1",
        name: "Goblin",
        faction: "monster" as const,
        position: { x: 2, y: 2 },
        movement: 5,
        attackDice: 2,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
      {
        id: "monster-2",
        name: "Orc",
        faction: "monster" as const,
        position: { x: 3, y: 3 },
        movement: 6,
        attackDice: 3,
        defenseDice: 2,
        health: 4,
        maxHealth: 4,
      },
    ];

    const state = createGameState({ board, actors });

    const afterHero1 = applyAction(state, { type: "endTurn", actorId: "hero-1" }).state;
    expect(currentActorId(afterHero1)).toBe("hero-2");
    expect(afterHero1.turn.movementRemaining["hero-2"]).toBe(5);

    const afterHero2 = applyAction(afterHero1, { type: "endTurn", actorId: "hero-2" }).state;
    expect(currentActorId(afterHero2)).toBe("monster-1");
    expect(afterHero2.turn.movementRemaining["monster-1"]).toBe(5);

    const afterMonster1 = applyAction(afterHero2, {
      type: "endTurn",
      actorId: "monster-1",
    }).state;
    expect(currentActorId(afterMonster1)).toBe("monster-2");
    expect(afterMonster1.turn.movementRemaining["monster-2"]).toBe(6);

    const afterMonster2 = applyAction(afterMonster1, {
      type: "endTurn",
      actorId: "monster-2",
    }).state;
    expect(currentActorId(afterMonster2)).toBe("hero-1");
    expect(afterMonster2.turn.movementRemaining["hero-1"]).toBe(4);
  });

  it("resolves an attack using provided dice rolls and emits an event", () => {
    const state = applyAction(buildGameState(), {
      type: "move",
      actorId: "hero-1",
      to: { x: 2, y: 1 },
    }).state;
    const attackAction: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "white-shield"],
      defenseRoll: ["black-shield", "white-shield"],
    };

    const { state: nextState, events } = applyAction(state, attackAction);

    expect(nextState.actors["monster-1"].health).toBe(3);
    expect(events[0]).toEqual({
      type: "attackResolved",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "white-shield"],
      defenseRoll: ["black-shield", "white-shield"],
      attackSkulls: 2,
      defenseShields: 2,
      netHits: 0,
      damage: 0,
      targetHealth: 3,
      targetDefeated: false,
      critical: false,
      message: "Barbarian hits Goblin for 0 damage.",
    });
  });

  it("does not drop target health below zero and marks defeat", () => {
    const state = applyAction(buildGameState(), {
      type: "move",
      actorId: "hero-1",
      to: { x: 2, y: 1 },
    }).state;

    const { state: nextState, events } = applyAction(state, {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["skull", "skull"],
    });

    expect(nextState.actors["monster-1"].health).toBe(0);
    expect(events[0]).toEqual({
      type: "attackResolved",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["skull", "skull"],
      attackSkulls: 3,
      defenseShields: 0,
      netHits: 3,
      damage: 3,
      targetHealth: 0,
      targetDefeated: true,
      critical: true,
      message: "Barbarian lands a critical hit on Goblin!",
    });
  });

  it("rejects invalid attack setups including distance and roll counts", () => {
    const state = buildGameState();
    const tooFar: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["white-shield", "white-shield"],
    };
    expect(validateAction(state, tooFar)).toEqual({ ok: false, reason: "Target is out of range" });

    const adjacentMove: Action = { type: "move", actorId: "hero-1", to: { x: 2, y: 1 } };
    const afterMove = applyAction(state, adjacentMove).state;
    const wrongDiceCount: Action = {
      type: "attack",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull"],
      defenseRoll: ["white-shield"],
    };
    expect(validateAction(afterMove, wrongDiceCount)).toEqual({
      ok: false,
      reason: "Attack roll count does not match attack dice",
    });
  });
});

describe("planMonsterTurn", () => {
  it("moves toward the nearest hero, attacks, and ends the turn", () => {
    const board = { width: 6, height: 6, blocked: [] };
    const actors = [
      {
        id: "monster-1",
        name: "Orc",
        faction: "monster" as const,
        position: { x: 3, y: 0 },
        movement: 2,
        attackDice: 3,
        defenseDice: 2,
        health: 4,
        maxHealth: 4,
      },
      {
        id: "hero-1",
        name: "Wizard",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 5,
        attackDice: 2,
        defenseDice: 1,
        health: 5,
        maxHealth: 5,
      },
      {
        id: "hero-2",
        name: "Elf",
        faction: "hero" as const,
        position: { x: 4, y: 4 },
        movement: 6,
        attackDice: 2,
        defenseDice: 2,
        health: 6,
        maxHealth: 6,
      },
    ];

    const state = createGameState({ board, actors, turnOrder: ["monster-1", "hero-1", "hero-2"] });
    const actions = planMonsterTurn(state);

    expect(actions.map((action) => action.type)).toEqual(["move", "attack", "endTurn"]);
    const afterActions = actions.reduce((working, action) => applyAction(working, action).state, state);

    expect(afterActions.actors["monster-1"].position).toEqual({ x: 1, y: 0 });
    expect(afterActions.actors["hero-1"].health).toBe(3);
    expect(currentActorId(afterActions)).toBe("hero-1");
  });
});
