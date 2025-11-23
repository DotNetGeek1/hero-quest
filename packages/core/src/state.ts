import {
  ActorState,
  BoardState,
  GameState,
  TurnState,
  Vector2,
} from "./types";

export type CreateGameStateParams = {
  board: BoardState;
  actors: ActorState[];
  turnOrder?: string[];
};

export function createGameState({
  board,
  actors,
  turnOrder,
}: CreateGameStateParams): GameState {
  const actorsById = actors.reduce<Record<string, ActorState>>((acc, actor) => {
    acc[actor.id] = actor;
    return acc;
  }, {});
  const order = turnOrder ?? actors.map((actor) => actor.id);
  const movementRemaining = order.reduce<Record<string, number>>((acc, id) => {
    const actor = actorsById[id];
    acc[id] = actor?.movement ?? 0;
    return acc;
  }, {});

  const turn: TurnState = {
    order,
    currentIndex: 0,
    movementRemaining,
  };

  return {
    board,
    actors: actorsById,
    turn,
  };
}

export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function isWithinBounds(board: BoardState, position: Vector2): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < board.width &&
    position.y < board.height
  );
}

export function isBlocked(board: BoardState, position: Vector2): boolean {
  return board.blocked.some((tile) => tile.x === position.x && tile.y === position.y);
}

export function isOccupied(state: GameState, position: Vector2): boolean {
  return Object.values(state.actors).some(
    (actor) => actor.position.x === position.x && actor.position.y === position.y
  );
}

export function currentActorId(state: GameState): string | undefined {
  return state.turn.order[state.turn.currentIndex];
}

export function manhattanDistance(a: Vector2, b: Vector2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function hasLineOfSight(
  board: BoardState,
  from: Vector2,
  to: Vector2
): boolean {
  if (!isWithinBounds(board, from) || !isWithinBounds(board, to)) {
    return false;
  }

  if (from.x === to.x && from.y === to.y) {
    return true;
  }

  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    if (x0 === x1 && y0 === y1) {
      break;
    }

    if (isBlocked(board, { x: x0, y: y0 })) {
      return false;
    }
  }

  return true;
}
