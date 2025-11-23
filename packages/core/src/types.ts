export type Vector2 = {
  x: number;
  y: number;
};

export type ActorFaction = "hero" | "monster";

export type ActorState = {
  id: string;
  name: string;
  faction: ActorFaction;
  position: Vector2;
  movement: number;
  attackDice: number;
  defenseDice: number;
  health: number;
  maxHealth: number;
};

export type BoardState = {
  width: number;
  height: number;
  blocked: Vector2[];
};

export type TurnState = {
  order: string[];
  currentIndex: number;
  movementRemaining: Record<string, number>;
};

export type GameState = {
  turn: TurnState;
  actors: Record<string, ActorState>;
  board: BoardState;
};

export type MoveAction = {
  type: "move";
  actorId: string;
  to: Vector2;
};

export type EndTurnAction = {
  type: "endTurn";
  actorId: string;
};

export type DieFace = "skull" | "white-shield" | "black-shield";

export type AttackAction = {
  type: "attack";
  attackerId: string;
  targetId: string;
  attackRoll: DieFace[];
  defenseRoll: DieFace[];
};

export type Action = MoveAction | AttackAction | EndTurnAction;

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type MoveEvent = {
  type: "move";
  actorId: string;
  from: Vector2;
  to: Vector2;
};

export type TurnEndedEvent = {
  type: "turnEnded";
  previousActorId: string;
  nextActorId: string;
};

export type AttackResolvedEvent = {
  type: "attackResolved";
  attackerId: string;
  targetId: string;
  attackRoll: DieFace[];
  defenseRoll: DieFace[];
  damage: number;
  targetHealth: number;
  targetDefeated: boolean;
};

export type GameEvent = MoveEvent | TurnEndedEvent | AttackResolvedEvent;

export interface RulesEngine {
  validateAction(state: GameState, action: Action): ValidationResult;
  applyAction(
    state: GameState,
    action: Action
  ): { state: GameState; events: GameEvent[] };
}
