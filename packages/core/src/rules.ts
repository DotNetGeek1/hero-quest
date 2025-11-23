import {
  Action,
  AttackAction,
  AttackResolvedEvent,
  DieFace,
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

function countFaces(roll: DieFace[], face: DieFace): number {
  return roll.filter((value) => value === face).length;
}

function validateAttack(state: GameState, action: AttackAction): ValidationResult {
  const attacker = state.actors[action.attackerId];
  const target = state.actors[action.targetId];

  if (!attacker) {
    return { ok: false, reason: "Attacker not found" };
  }

  if (attacker.health <= 0) {
    return { ok: false, reason: "Attacker is defeated" };
  }

  if (!target) {
    return { ok: false, reason: "Target not found" };
  }

  if (currentActorId(state) !== action.attackerId) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  const distance = manhattanDistance(attacker.position, target.position);
  if (distance !== 1) {
    return { ok: false, reason: "Target is not adjacent" };
  }

  if (target.health <= 0) {
    return { ok: false, reason: "Target is already defeated" };
  }

  if (action.attackRoll.length !== attacker.attackDice) {
    return { ok: false, reason: "Attack roll count does not match attack dice" };
  }

  if (action.defenseRoll.length !== target.defenseDice) {
    return { ok: false, reason: "Defense roll count does not match defense dice" };
  }

  return { ok: true };
}

function validateMove(state: GameState, action: MoveAction): ValidationResult {
  const actor = state.actors[action.actorId];
  if (!actor) {
    return { ok: false, reason: "Actor not found" };
  }

  if (actor.health <= 0) {
    return { ok: false, reason: "Actor is defeated" };
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
    case "attack":
      return validateAttack(state, action);
    case "endTurn":
      if (!state.actors[action.actorId]) {
        return { ok: false, reason: "Actor not found" };
      }
      if (state.actors[action.actorId].health <= 0) {
        return { ok: false, reason: "Actor is defeated" };
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
    case "attack": {
      const nextState = cloneGameState(state);
      const attacker = nextState.actors[action.attackerId];
      const target = nextState.actors[action.targetId];

      const attackSkulls = countFaces(action.attackRoll, "skull");
      const defenseShields =
        countFaces(action.defenseRoll, "white-shield") +
        countFaces(action.defenseRoll, "black-shield");

      const damage = Math.max(0, attackSkulls - defenseShields);
      target.health = Math.max(0, target.health - damage);

      const attackEvent: AttackResolvedEvent = {
        type: "attackResolved",
        attackerId: attacker.id,
        targetId: target.id,
        attackRoll: action.attackRoll,
        defenseRoll: action.defenseRoll,
        damage,
        targetHealth: target.health,
        targetDefeated: target.health === 0,
      };

      return { state: nextState, events: [attackEvent] };
    }
    case "endTurn": {
      const nextState = cloneGameState(state);
      const previousActorId = currentActorId(nextState) as string;
      const orderLength = nextState.turn.order.length;

      for (let step = 1; step <= orderLength; step += 1) {
        const candidateIndex =
          (nextState.turn.currentIndex + step) % nextState.turn.order.length;
        const candidateId = nextState.turn.order[candidateIndex];
        const candidate = nextState.actors[candidateId];

        if (candidate && candidate.health > 0) {
          nextState.turn.currentIndex = candidateIndex;
          break;
        }
      }

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
