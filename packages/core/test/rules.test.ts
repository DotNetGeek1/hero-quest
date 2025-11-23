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
      attackRange: 1,
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
      attackRange: 1,
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

  it("validates ranged attacks with line of sight and range constraints", () => {
    const boardDimensions = { width: 6, height: 3 };

    const buildRangedState = (blocked: { x: number; y: number }[], monsterX: number) =>
      createGameState({
        board: { ...boardDimensions, blocked },
        actors: [
          {
            id: "hero-archer",
            name: "Elf",
            faction: "hero" as const,
            position: { x: 0, y: 0 },
            movement: 6,
            attackDice: 2,
            attackRange: 4,
            defenseDice: 2,
            health: 5,
            maxHealth: 5,
          },
          {
            id: "monster-1",
            name: "Goblin",
            faction: "monster" as const,
            position: { x: monsterX, y: 0 },
            movement: 5,
            attackDice: 2,
            attackRange: 1,
            defenseDice: 2,
            health: 3,
            maxHealth: 3,
          },
        ],
        turnOrder: ["hero-archer", "monster-1"],
      });

    const action: Action = {
      type: "attack",
      attackerId: "hero-archer",
      targetId: "monster-1",
      attackRoll: ["skull", "skull"],
      defenseRoll: ["white-shield", "black-shield"],
    };

    const blockedState = buildRangedState([{ x: 1, y: 0 }], 4);
    expect(validateAction(blockedState, action)).toEqual({
      ok: false,
      reason: "Line of sight is blocked",
    });

    const openState = buildRangedState([], 4);
    expect(validateAction(openState, action)).toEqual({ ok: true });

    const outOfRangeState = buildRangedState([], 5);
    expect(validateAction(outOfRangeState, action)).toEqual({
      ok: false,
      reason: "Target is beyond attack range",
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
        attackRange: 1,
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
        attackRange: 1,
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
        attackRange: 1,
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

  it("cycles through explicit mixed hero then monster turn order", () => {
    const board = { width: 6, height: 6, blocked: [] };
    const actors = [
      {
        id: "hero-1",
        name: "Barbarian",
        faction: "hero" as const,
        position: { x: 0, y: 0 },
        movement: 4,
        attackDice: 3,
        attackRange: 1,
        defenseDice: 2,
        health: 8,
        maxHealth: 8,
      },
      {
        id: "hero-2",
        name: "Elf",
        faction: "hero" as const,
        position: { x: 1, y: 0 },
        movement: 6,
        attackDice: 2,
        attackRange: 4,
        defenseDice: 2,
        health: 6,
        maxHealth: 6,
      },
      {
        id: "monster-1",
        name: "Goblin",
        faction: "monster" as const,
        position: { x: 4, y: 4 },
        movement: 5,
        attackDice: 2,
        attackRange: 1,
        defenseDice: 2,
        health: 3,
        maxHealth: 3,
      },
      {
        id: "monster-2",
        name: "Orc",
        faction: "monster" as const,
        position: { x: 5, y: 5 },
        movement: 6,
        attackDice: 3,
        attackRange: 1,
        defenseDice: 2,
        health: 4,
        maxHealth: 4,
      },
    ];

    let state = createGameState({
      board,
      actors,
      turnOrder: ["hero-1", "hero-2", "monster-1", "monster-2"],
    });

    const expectations = [
      { current: "hero-1", next: "hero-2" },
      { current: "hero-2", next: "monster-1" },
      { current: "monster-1", next: "monster-2" },
      { current: "monster-2", next: "hero-1" },
    ];

    expectations.forEach(({ current, next }) => {
      expect(currentActorId(state)).toBe(current);
      const { state: updated, events } = applyAction(state, {
        type: "endTurn",
        actorId: current,
      });
      expect(events[0]).toEqual({
        type: "turnEnded",
        previousActorId: current,
        nextActorId: next,
      });
      expect(currentActorId(updated)).toBe(next);
      expect(updated.turn.movementRemaining[next]).toBe(updated.actors[next].movement);
      state = updated;
    });
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
        attackSuccesses: 3,
        defenseSuccesses: 2,
        critical: true,
      targetHealth: 2,
      targetDefeated: false,
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
        damage: 3,
        attackSuccesses: 3,
        defenseSuccesses: 0,
        critical: true,
      targetHealth: 0,
      targetDefeated: true,
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

  describe("search actions", () => {
    function buildSearchScenario(options?: { perHero?: boolean; extraHero?: boolean }) {
      const board = {
        width: 4,
        height: 4,
        blocked: [],
        areas: [
          {
            id: "room-1",
            name: "Entry",
            kind: "room" as const,
            tiles: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 1 },
            ],
          },
        ],
      };

      const baseActors = [
        {
          id: "hero-1",
          name: "Barbarian",
          faction: "hero" as const,
          position: { x: 0, y: 0 },
          movement: 4,
          attackDice: 3,
          attackRange: 1,
          defenseDice: 2,
          health: 8,
          maxHealth: 8,
        },
        {
          id: "monster-1",
          name: "Goblin",
          faction: "monster" as const,
          position: { x: 1, y: 0 },
          movement: 5,
          attackDice: 2,
          attackRange: 1,
          defenseDice: 2,
          health: 3,
          maxHealth: 3,
        },
      ];

      if (options?.extraHero) {
        baseActors.push({
          id: "hero-2",
          name: "Elf",
          faction: "hero" as const,
          position: { x: 0, y: 1 },
          movement: 6,
          attackDice: 2,
          attackRange: 4,
          defenseDice: 2,
          health: 6,
          maxHealth: 6,
        });
      }

      return createGameState({
        board,
        actors: baseActors,
        discoverables: [
          {
            id: "trap-1",
            areaId: "room-1",
            type: "trap",
            position: { x: 1, y: 1 },
            revealed: false,
          },
          {
            id: "treasure-1",
            areaId: "room-1",
            type: "treasure",
            position: { x: 0, y: 1 },
            revealed: false,
          },
        ],
        searchConfig: options?.perHero ? { historyMode: "per-hero" } : undefined,
      });
    }

    it("requires rooms to be clear before searching and records discoveries", () => {
      const state = buildSearchScenario();
      const searchAction: Action = { type: "search", actorId: "hero-1", searchType: "traps" };

      expect(validateAction(state, searchAction)).toEqual({
        ok: false,
        reason: "You cannot search while enemies are present",
      });

      state.actors["monster-1"].health = 0;
      expect(validateAction(state, searchAction)).toEqual({ ok: true });

      const { state: afterSearch, events } = applyAction(state, searchAction);
      expect(afterSearch.discoverables["trap-1"].revealed).toBe(true);
      expect(events[0]).toMatchObject({
        type: "searchPerformed",
        actorId: "hero-1",
        discoveries: [{ id: "trap-1", type: "trap" }],
      });

      expect(() => applyAction(afterSearch, searchAction)).toThrow(
        "This area has already been searched for that"
      );
    });

    it("supports per-hero search history when configured", () => {
      const state = buildSearchScenario({ perHero: true, extraHero: true });
      state.actors["monster-1"].health = 0;

      const heroOneSearch: Action = { type: "search", actorId: "hero-1", searchType: "treasure" };
      const heroTwoSearch: Action = { type: "search", actorId: "hero-2", searchType: "treasure" };

      const { state: afterFirst } = applyAction(state, heroOneSearch);
      expect(afterFirst.discoverables["treasure-1"].revealed).toBe(true);

      const { state: heroTwoTurn } = applyAction(afterFirst, {
        type: "endTurn",
        actorId: "hero-1",
      });

      expect(() => applyAction(heroTwoTurn, heroTwoSearch)).not.toThrow();
    });
  });

  describe("spell and equipment actions", () => {
    it("casts a healing spell on an ally within range", () => {
      const board = { width: 4, height: 4, blocked: [] };
      const actors = [
        {
          id: "hero-1",
          name: "Wizard",
          faction: "hero" as const,
          position: { x: 0, y: 0 },
          movement: 5,
          attackDice: 2,
          attackRange: 2,
          defenseDice: 2,
          health: 5,
          maxHealth: 5,
          knownSpells: ["heal-ally"],
        },
        {
          id: "hero-2",
          name: "Barbarian",
          faction: "hero" as const,
          position: { x: 0, y: 1 },
          movement: 4,
          attackDice: 3,
          attackRange: 1,
          defenseDice: 2,
          health: 3,
          maxHealth: 6,
        },
      ];

      const cards = {
        spells: {
          "heal-ally": {
            id: "heal-ally",
            name: "Healing Water",
            school: "water",
            target: { type: "ally", range: 4 },
            effects: [{ type: "heal", amount: 3 }],
          },
        },
        equipment: {},
      };

      const state = createGameState({ board, actors, cards });
      const action: Action = {
        type: "castSpell",
        casterId: "hero-1",
        spellId: "heal-ally",
        targetId: "hero-2",
      };

      const { state: afterSpell, events } = applyAction(state, action);
      expect(afterSpell.actors["hero-2"].health).toBe(6);
      expect(events[0]).toEqual({
        type: "spellCast",
        casterId: "hero-1",
        spellId: "heal-ally",
        targetId: "hero-2",
        effects: [{ type: "heal", amount: 3 }],
      });
    });

    it("consumes a damaging consumable when used", () => {
      const board = { width: 4, height: 4, blocked: [] };
      const actors = [
        {
          id: "hero-1",
          name: "Alchemist",
          faction: "hero" as const,
          position: { x: 0, y: 0 },
          movement: 5,
          attackDice: 2,
          attackRange: 1,
          defenseDice: 2,
          health: 5,
          maxHealth: 5,
          equipment: ["fire-bomb"],
        },
        {
          id: "monster-1",
          name: "Fimir",
          faction: "monster" as const,
          position: { x: 1, y: 0 },
          movement: 5,
          attackDice: 3,
          attackRange: 1,
          defenseDice: 2,
          health: 3,
          maxHealth: 3,
        },
      ];

      const cards = {
        spells: {},
        equipment: {
          "fire-bomb": {
            id: "fire-bomb",
            name: "Fire Bomb",
            slot: "consumable" as const,
            target: { type: "enemy", range: 2, requiresLineOfSight: true },
            effects: [{ type: "damage", amount: 2 }],
            consumable: true,
          },
        },
      };

      const state = createGameState({ board, actors, cards });
      const action: Action = {
        type: "useEquipment",
        actorId: "hero-1",
        equipmentId: "fire-bomb",
        targetId: "monster-1",
      };

      const { state: afterUse, events } = applyAction(state, action);
      expect(afterUse.actors["monster-1"].health).toBe(1);
      expect(afterUse.actors["hero-1"].equipment).not.toContain("fire-bomb");
      expect(events[0]).toEqual({
        type: "equipmentUsed",
        actorId: "hero-1",
        equipmentId: "fire-bomb",
        targetId: "monster-1",
        effects: [{ type: "damage", amount: 2 }],
        consumed: true,
      });
    });
  });
});
