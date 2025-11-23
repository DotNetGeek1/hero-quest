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
  attackRange: number;
  defenseDice: number;
  health: number;
  maxHealth: number;
  knownSpells?: string[];
  equipment?: string[];
  statusEffects?: StatusEffectState[];
};

export type BoardAreaKind = "room" | "corridor" | "exterior";

export type SearchType = "traps" | "secret-doors" | "treasure";

export type SearchArea = {
  id: string;
  name: string;
  kind: BoardAreaKind;
  tiles: Vector2[];
  allowedSearches?: SearchType[];
};

export type VisibilityMode = "global" | "per-faction" | "per-actor";

export type VisibilityState = {
  mode: VisibilityMode;
  visionRange: number;
  discovered: Record<string, string[]>;
  triggerHistory: Record<string, boolean>;
};

export type VisibilityTriggerOwner =
  | { type: "actor"; actorId: string }
  | { type: "faction"; faction: ActorFaction }
  | { type: "global" };

export type VisibilityRevealSource = "search" | "door" | "script";

export type VisibilityTrigger = {
  id: string;
  source: Exclude<VisibilityRevealSource, "search">;
  owner?: VisibilityTriggerOwner;
  areaIds?: string[];
  tiles?: Vector2[];
};

export type QuestVisibilityTrigger =
  | (VisibilityTrigger & { source: "door"; doorId: string })
  | (VisibilityTrigger & { source: "script"; scriptId: string });

export type QuestVisibilityTriggerContext =
  | { type: "door"; doorId: string }
  | { type: "script"; scriptId: string };

export type DiscoverableType = "trap" | "secret-door" | "treasure";

export type DiscoverableState = {
  id: string;
  areaId: string;
  type: DiscoverableType;
  position: Vector2;
  revealed: boolean;
  data?: Record<string, unknown>;
};

export type SearchHistoryMode = "per-area" | "per-hero";

export type SearchRulesConfig = {
  requireHeroesOnly?: boolean;
  requireNoEnemies?: boolean;
  historyMode?: SearchHistoryMode;
};

export type SearchHistory = {
  perArea: Record<string, SearchType[]>;
  perHero: Record<string, Record<string, SearchType[]>>;
};

export type SearchState = {
  config: SearchRulesConfig;
  history: SearchHistory;
};

export type BoardState = {
  width: number;
  height: number;
  blocked: Vector2[];
  areas?: SearchArea[];
  visibilityTriggers?: QuestVisibilityTrigger[];
};

export type TurnState = {
  order: string[];
  currentIndex: number;
  movementRemaining: Record<string, number>;
};

export type SpellEffect =
  | { type: "damage"; amount: number }
  | { type: "heal"; amount: number }
  | {
      type: "move";
      delta?: Vector2;
      destination?: Vector2;
      ignoreCollisions?: boolean;
    }
  | { type: "buff"; stat: StatusModifierStat; amount: number }
  | { type: "status"; effect: StatusEffectState }
  | {
      type: "statusModifier";
      stat: StatusModifierStat;
      amount: number;
      duration: number;
      id?: string;
      name?: string;
      tags?: string[];
    }
  | {
      type: "cleanse";
      statusIds?: string[];
      tags?: string[];
      removeAll?: boolean;
    };

export type StatusModifierStat = "attackDice" | "defenseDice" | "movement" | "maxHealth";

export type StatusEffectState = {
  id: string;
  name: string;
  duration: number;
  modifiers?: Partial<Record<StatusModifierStat, number>>;
  tags?: string[];
};

export type TargetingProfile = {
  type: "self" | "ally" | "enemy";
  range: number;
  requiresLineOfSight?: boolean;
};

export type SpellDefinition = {
  id: string;
  name: string;
  school: string;
  target: TargetingProfile;
  effects: SpellEffect[];
};

export type EquipmentSlot = "weapon" | "armor" | "trinket" | "consumable";

export type EquipmentDefinition = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  target: TargetingProfile;
  effects: SpellEffect[];
  consumable?: boolean;
};

export type CardCatalog = {
  spells: Record<string, SpellDefinition>;
  equipment: Record<string, EquipmentDefinition>;
};

export type GameState = {
  turn: TurnState;
  actors: Record<string, ActorState>;
  board: BoardState;
  discoverables: Record<string, DiscoverableState>;
  searchState: SearchState;
  cards: CardCatalog;
  visibility: VisibilityState;
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

export type SearchAction = {
  type: "search";
  actorId: string;
  searchType: SearchType;
};

export type CastSpellAction = {
  type: "castSpell";
  casterId: string;
  spellId: string;
  targetId?: string;
};

export type UseEquipmentAction = {
  type: "useEquipment";
  actorId: string;
  equipmentId: string;
  targetId?: string;
};

export type Action =
  | MoveAction
  | AttackAction
  | EndTurnAction
  | SearchAction
  | CastSpellAction
  | UseEquipmentAction;

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
  attackSuccesses: number;
  defenseSuccesses: number;
  critical: boolean;
  targetHealth: number;
  targetDefeated: boolean;
};

export type SearchDiscovery = {
  id: string;
  type: DiscoverableType;
  position: Vector2;
};

export type SearchPerformedEvent = {
  type: "searchPerformed";
  actorId: string;
  areaId: string;
  searchType: SearchType;
  discoveries: SearchDiscovery[];
};

export type TilesRevealedEvent = {
  type: "tilesRevealed";
  ownerKey: string;
  tiles: Vector2[];
  source: VisibilityRevealSource;
  triggerId?: string;
};

export type SpellCastEvent = {
  type: "spellCast";
  casterId: string;
  spellId: string;
  targetId?: string;
  effects: SpellEffect[];
};

export type EquipmentUsedEvent = {
  type: "equipmentUsed";
  actorId: string;
  equipmentId: string;
  targetId?: string;
  effects: SpellEffect[];
  consumed: boolean;
};

export type GameEvent =
  | MoveEvent
  | TurnEndedEvent
  | AttackResolvedEvent
  | SearchPerformedEvent
  | TilesRevealedEvent
  | SpellCastEvent
  | EquipmentUsedEvent;

export interface RulesEngine {
  validateAction(state: GameState, action: Action): ValidationResult;
  applyAction(
    state: GameState,
    action: Action
  ): { state: GameState; events: GameEvent[] };
}
