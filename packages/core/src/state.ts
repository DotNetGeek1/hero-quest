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

export function hasLineOfSight(state: GameState, from: Vector2, to: Vector2): boolean {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  if (steps === 0) return true;

  const stepX = deltaX / steps;
  const stepY = deltaY / steps;

  for (let i = 1; i < steps; i += 1) {
    const sampleX = from.x + stepX * i;
    const sampleY = from.y + stepY * i;

    const cell = { x: Math.round(sampleX), y: Math.round(sampleY) };

    if (!isWithinBounds(state.board, cell)) return false;
    if (isBlocked(state.board, cell)) return false;
    if (isOccupied(state, cell)) return false;
  }

  return true;
}

export function currentActorId(state: GameState): string | undefined {
  return state.turn.order[state.turn.currentIndex];
}

export function manhattanDistance(a: Vector2, b: Vector2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
