import { Action, ActorState, DieFace, GameState, Vector2 } from "./types";
import { applyAction, validateAction } from "./rules";
import {
  currentActorId,
  isBlocked,
  isWithinBounds,
  manhattanDistance,
} from "./state";

const DIRECTIONS: Vector2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export type MonsterAiOptions = {
  rollAttackDice?: (args: { attackerId: string; dice: number }) => DieFace[];
  rollDefenseDice?: (args: { targetId: string; dice: number }) => DieFace[];
};

const defaultAttackRoller = ({
  dice,
}: {
  attackerId: string;
  dice: number;
}): DieFace[] => Array.from({ length: dice }, () => "skull");

const defaultDefenseRoller = ({
  dice,
}: {
  targetId: string;
  dice: number;
}): DieFace[] => Array.from({ length: dice }, () => "white-shield");

function isTileAvailable(state: GameState, target: Vector2, moverId: string): boolean {
  if (!isWithinBounds(state.board, target) || isBlocked(state.board, target)) {
    return false;
  }

  return !Object.values(state.actors).some(
    (actor) =>
      actor.id !== moverId &&
      actor.health > 0 &&
      actor.position.x === target.x &&
      actor.position.y === target.y
  );
}

function findNearestHero(state: GameState, monster: ActorState | undefined): ActorState | undefined {
  if (!monster) {
    return undefined;
  }

  return Object.values(state.actors)
    .filter((actor) => actor.faction === "hero" && actor.health > 0)
    .sort(
      (a, b) =>
        manhattanDistance(monster.position, a.position) -
        manhattanDistance(monster.position, b.position)
    )[0];
}

function nextStepTowardTarget(
  state: GameState,
  monster: ActorState,
  target: ActorState,
  visited: Set<string>
): Vector2 | null {
  const candidates = DIRECTIONS.map((dir) => ({
    x: monster.position.x + dir.x,
    y: monster.position.y + dir.y,
  }))
    .filter((candidate) => isTileAvailable(state, candidate, monster.id))
    .sort(
      (a, b) =>
        manhattanDistance(a, target.position) - manhattanDistance(b, target.position)
    );

  for (const candidate of candidates) {
    const key = `${candidate.x},${candidate.y}`;
    if (!visited.has(key)) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

export function planMonsterTurn(
  state: GameState,
  monsterId: string,
  options: MonsterAiOptions = {}
): Action[] {
  const monster = state.actors[monsterId];
  if (!monster || monster.faction !== "monster" || monster.health <= 0) {
    return [];
  }

  if (currentActorId(state) !== monsterId) {
    return [];
  }

  const target = findNearestHero(state, monster);
  if (!target) {
    return [];
  }

  const rollAttackDice = options.rollAttackDice ?? defaultAttackRoller;
  const rollDefenseDice = options.rollDefenseDice ?? defaultDefenseRoller;

  const actions: Action[] = [];
  let workingState = state;
  const visited = new Set<string>([`${monster.position.x},${monster.position.y}`]);

  while (true) {
    const mover = workingState.actors[monsterId];
    const defender = workingState.actors[target.id];
    if (!mover || !defender) {
      return actions;
    }

    const distance = manhattanDistance(mover.position, defender.position);
    if (distance <= 1) {
      break;
    }

    const remaining =
      workingState.turn.movementRemaining[monsterId] ?? mover.movement;
    if (remaining <= 0) {
      break;
    }

    const nextStep = nextStepTowardTarget(workingState, mover, defender, visited);
    if (!nextStep) {
      break;
    }

    const moveAction: Action = { type: "move", actorId: monsterId, to: nextStep };
    const validation = validateAction(workingState, moveAction);
    if (!validation.ok) {
      break;
    }

    visited.add(`${nextStep.x},${nextStep.y}`);
    const result = applyAction(workingState, moveAction);
    workingState = result.state;
    actions.push(moveAction);
  }

  const attacker = workingState.actors[monsterId];
  const defender = workingState.actors[target.id];

  if (!attacker || !defender) {
    return actions;
  }

  if (manhattanDistance(attacker.position, defender.position) === 1) {
    const attackAction: Action = {
      type: "attack",
      attackerId: attacker.id,
      targetId: defender.id,
      attackRoll: rollAttackDice({ attackerId: attacker.id, dice: attacker.attackDice }),
      defenseRoll: rollDefenseDice({ targetId: defender.id, dice: defender.defenseDice }),
    };

    if (validateAction(workingState, attackAction).ok) {
      actions.push(attackAction);
    }
  }

  return actions;
}
