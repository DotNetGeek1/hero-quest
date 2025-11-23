import {
  Action,
  GameEvent,
  GameState,
  MoveAction,
  ValidationResult,
} from "./types";
import {
  cloneGameState,
  currentActorId,
  isBlocked,
  isOccupied,
  isWithinBounds,
  manhattanDistance,
} from "./state";

function validateMove(state: GameState, action: MoveAction): ValidationResult {
  const actor = state.actors[action.actorId];
  if (!actor) {
    return { ok: false, reason: "Actor not found" };
  }

  if (currentActorId(state) !== action.actorId) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  if (!isWithinBounds(state.board, action.to)) {
    return { ok: false, reason: "Destination is outside the board" };
  }

  if (isBlocked(state.board, action.to)) {
    return { ok: false, reason: "Destination is blocked" };
  }

  const distance = manhattanDistance(actor.position, action.to);
  const remaining = state.turn.movementRemaining[action.actorId] ?? actor.movement;
  if (distance === 0) {
    return { ok: false, reason: "Actor must move to a new tile" };
  }

  if (distance > remaining) {
    return { ok: false, reason: "Not enough movement remaining" };
  }

  if (isOccupied(state, action.to)) {
    return { ok: false, reason: "Another actor already occupies that tile" };
  }

  return { ok: true };
}

export function validateAction(state: GameState, action: Action): ValidationResult {
  switch (action.type) {
    case "move":
      return validateMove(state, action);
    case "endTurn":
      if (!state.actors[action.actorId]) {
        return { ok: false, reason: "Actor not found" };
      }
      if (currentActorId(state) !== action.actorId) {
        return { ok: false, reason: "It is not this actor's turn" };
      }
      return { ok: true };
    default:
      return { ok: false, reason: "Unknown action" };
  }
}

function applyMove(state: GameState, action: MoveAction) {
  const nextState = cloneGameState(state);
  const actor = nextState.actors[action.actorId];
  const from = { ...actor.position };
  const distance = manhattanDistance(from, action.to);

  actor.position = action.to;
  nextState.turn.movementRemaining[action.actorId] =
    (nextState.turn.movementRemaining[action.actorId] ?? actor.movement) - distance;

  const events: GameEvent[] = [
    {
      type: "move",
      actorId: actor.id,
      from,
      to: action.to,
    },
  ];

  return { state: nextState, events };
}

export function applyAction(
  state: GameState,
  action: Action
): { state: GameState; events: GameEvent[] } {
  const validation = validateAction(state, action);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  switch (action.type) {
    case "move":
      return applyMove(state, action);
    case "endTurn": {
      const nextState = cloneGameState(state);
      const previousActorId = currentActorId(nextState) as string;
      nextState.turn.currentIndex =
        (nextState.turn.currentIndex + 1) % nextState.turn.order.length;
      const newActorId = currentActorId(nextState) as string;
      const newActor = nextState.actors[newActorId];
      nextState.turn.movementRemaining[newActorId] = newActor.movement;

      return {
        state: nextState,
        events: [
          {
            type: "turnEnded",
            previousActorId,
            nextActorId: newActorId,
          },
        ],
      };
    }
    default:
      return { state, events: [] };
  }
}

export const rulesEngine = { validateAction, applyAction };
