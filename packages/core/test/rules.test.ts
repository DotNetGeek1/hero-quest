import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGameState,
  currentActorId,
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
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["black-shield", "white-shield"],
    };

    const { state: nextState, events } = applyAction(state, attackAction);

    expect(nextState.actors["monster-1"].health).toBe(2);
    expect(events[0]).toEqual({
      type: "attackResolved",
      attackerId: "hero-1",
      targetId: "monster-1",
      attackRoll: ["skull", "skull", "skull"],
      defenseRoll: ["black-shield", "white-shield"],
      damage: 1,
      targetHealth: 2,
      targetDefeated: false,
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
    expect(validateAction(state, tooFar)).toEqual({ ok: false, reason: "Target is not adjacent" });

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
