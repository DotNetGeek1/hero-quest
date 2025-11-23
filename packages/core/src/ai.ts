import { applyAction, validateAction } from "./rules";
import { currentActorId, isBlocked, isWithinBounds, manhattanDistance } from "./state";
import { Action, ActorState, DieFace, GameState, Vector2 } from "./types";

const DIRECTIONS: Vector2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function occupiedByOther(state: GameState, position: Vector2, ignoreActorId?: string) {
  return Object.values(state.actors).some(
    (actor) =>
      actor.id !== ignoreActorId &&
      actor.position.x === position.x &&
      actor.position.y === position.y
  );
}

function isWalkable(state: GameState, position: Vector2, ignoreActorId?: string) {
  if (!isWithinBounds(state.board, position)) return false;
  if (isBlocked(state.board, position)) return false;
  if (occupiedByOther(state, position, ignoreActorId)) return false;
  return true;
}

function neighbors(position: Vector2): Vector2[] {
  return DIRECTIONS.map((dir) => ({ x: position.x + dir.x, y: position.y + dir.y }));
}

function findPath(
  state: GameState,
  start: Vector2,
  goal: Vector2,
  ignoreActorId?: string
): Vector2[] | null {
  const queue: Vector2[][] = [[start]];
  const visited = new Set<string>([`${start.x},${start.y}`]);

  while (queue.length) {
    const path = queue.shift() as Vector2[];
    const current = path[path.length - 1];

    if (current.x === goal.x && current.y === goal.y) {
      return path;
    }

    for (const neighbor of neighbors(current)) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (visited.has(key)) continue;
      if (!isWalkable(state, neighbor, ignoreActorId)) continue;

      visited.add(key);
      queue.push([...path, neighbor]);
    }
  }

  return null;
}

function closestHero(monster: ActorState, heroes: ActorState[]) {
  return heroes
    .filter((hero) => hero.health > 0)
    .sort((a, b) => {
      const distA = manhattanDistance(monster.position, a.position);
      const distB = manhattanDistance(monster.position, b.position);
      if (distA === distB) return a.id.localeCompare(b.id);
      return distA - distB;
    })[0];
}

function defaultRoll(count: number, face: DieFace): DieFace[] {
  return Array.from({ length: count }, () => face);
}

export function generateDefaultAttackRoll(count: number): DieFace[] {
  return defaultRoll(count, "skull");
}

export function generateDefaultDefenseRoll(count: number): DieFace[] {
  return defaultRoll(count, "white-shield");
}

export function planMonsterTurn(state: GameState): Action[] {
  const actorId = currentActorId(state);
  const actor = actorId ? state.actors[actorId] : undefined;

  if (!actor || actor.faction !== "monster" || actor.health <= 0) {
    return [];
  }

  const heroes = Object.values(state.actors).filter((candidate) => candidate.faction === "hero");
  if (heroes.length === 0) {
    return [{ type: "endTurn", actorId: actor.id }];
  }

  const target = closestHero(actor, heroes);
  if (!target) {
    return [{ type: "endTurn", actorId: actor.id }];
  }

  const actions: Action[] = [];
  let workingState: GameState = state;

  const movementRemaining =
    workingState.turn.movementRemaining[actor.id] ?? workingState.actors[actor.id].movement;

  const distanceToTarget = manhattanDistance(actor.position, target.position);
  if (distanceToTarget > 1 && movementRemaining > 0) {
    const candidateAdjacency = neighbors(target.position).filter((pos) =>
      isWalkable(workingState, pos, actor.id)
    );

    const pathOptions = candidateAdjacency
      .map((pos) => findPath(workingState, actor.position, pos, actor.id))
      .filter((path): path is Vector2[] => Boolean(path))
      .sort((a, b) => a.length - b.length);

    const bestPath = pathOptions[0];
    if (bestPath && bestPath.length > 1) {
      const stepsToTake = Math.min(movementRemaining, bestPath.length - 1);
      const destination = bestPath[stepsToTake];
      const moveAction: Action = { type: "move", actorId: actor.id, to: destination };

      if (validateAction(workingState, moveAction).ok) {
        const result = applyAction(workingState, moveAction);
        workingState = result.state;
        actions.push(moveAction);
      }
    }
  }

  const updatedActor = workingState.actors[actor.id];
  const updatedTarget = workingState.actors[target.id];
  const adjacent = manhattanDistance(updatedActor.position, updatedTarget.position) === 1;

  if (adjacent) {
    const attackAction: Action = {
      type: "attack",
      attackerId: actor.id,
      targetId: target.id,
      attackRoll: generateDefaultAttackRoll(updatedActor.attackDice),
      defenseRoll: generateDefaultDefenseRoll(updatedTarget.defenseDice),
    };

    if (validateAction(workingState, attackAction).ok) {
      const result = applyAction(workingState, attackAction);
      workingState = result.state;
      actions.push(attackAction);
    }
  }

  const endTurnAction: Action = { type: "endTurn", actorId: actor.id };
  if (validateAction(workingState, endTurnAction).ok) {
    actions.push(endTurnAction);
  }

  return actions;
}
