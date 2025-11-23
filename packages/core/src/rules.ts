import {
  ActorState,
  Action,
  AttackAction,
  AttackResolvedEvent,
  CastSpellAction,
  DieFace,
  DiscoverableType,
  EquipmentUsedEvent,
  GameEvent,
  GameState,
  MoveAction,
  SearchAction,
  SearchPerformedEvent,
  SearchType,
  SpellCastEvent,
  SpellEffect,
  StatusEffectState,
  StatusModifierStat,
  TargetingProfile,
  TriggerQuestVisibilityAction,
  UseEquipmentAction,
  ValidationResult,
} from "./types";
import {
  cloneGameState,
  currentActorId,
  findAreaContaining,
  areaAllowsSearch,
  hasOpposingFactionInArea,
  hasSearchOccurred,
  recordSearchOccurrence,
  hasLineOfSight,
  isBlocked,
  isOccupied,
  isWithinBounds,
  manhattanDistance,
  mergeVisibility,
  getVisibilityOwnerKey,
  tileKey,
  triggerQuestVisibility,
  findQuestVisibilityTriggers,
} from "./state";

function countFaces(roll: DieFace[], face: DieFace): number {
  return roll.filter((value) => value === face).length;
}

const SEARCH_TYPE_TO_DISCOVERABLE: Record<SearchType, DiscoverableType> = {
  traps: "trap",
  "secret-doors": "secret-door",
  treasure: "treasure",
};

function discoverableMatchesSearch(searchType: SearchType, discoverableType: DiscoverableType) {
  return SEARCH_TYPE_TO_DISCOVERABLE[searchType] === discoverableType;
}

function resolveTargetActor(
  state: GameState,
  sourceId: string,
  targetId: string | undefined,
  profile: TargetingProfile
): { ok: true; target: ActorState } | { ok: false; reason: string } {
  const source = state.actors[sourceId];
  if (!source) {
    return { ok: false, reason: "Source actor not found" };
  }

  if (profile.type === "self") {
    if (targetId && targetId !== sourceId) {
      return { ok: false, reason: "Spell target must be self" };
    }
    return { ok: true, target: source };
  }

  if (!targetId) {
    return { ok: false, reason: "Target is required" };
  }

  const target = state.actors[targetId];
  if (!target) {
    return { ok: false, reason: "Target not found" };
  }

  if (target.health <= 0) {
    return { ok: false, reason: "Target is defeated" };
  }

  if (profile.type === "ally" && target.faction !== source.faction) {
    return { ok: false, reason: "Target must be an ally" };
  }

  if (profile.type === "enemy" && target.faction === source.faction) {
    return { ok: false, reason: "Target must be an enemy" };
  }

  const distance = manhattanDistance(source.position, target.position);
  if (distance > profile.range) {
    return { ok: false, reason: "Target is beyond range" };
  }

  if (profile.requiresLineOfSight && !hasLineOfSight(state.board, source.position, target.position)) {
    return { ok: false, reason: "Line of sight is blocked" };
  }

  return { ok: true, target };
}

function applyStatAdjustment(target: ActorState, stat: StatusModifierStat, delta: number) {
  switch (stat) {
    case "movement":
      target.movement = Math.max(0, target.movement + delta);
      break;
    case "attackDice":
      target.attackDice = Math.max(0, target.attackDice + delta);
      break;
    case "defenseDice":
      target.defenseDice = Math.max(0, target.defenseDice + delta);
      break;
    case "maxHealth":
      target.maxHealth = Math.max(1, target.maxHealth + delta);
      target.health = Math.min(target.health, target.maxHealth);
      break;
    default:
      break;
  }
}

function applyMoveEffect(state: GameState, target: ActorState, effect: Extract<SpellEffect, { type: "move" }>) {
  const destination =
    effect.destination ??
    (effect.delta
      ? {
          x: target.position.x + effect.delta.x,
          y: target.position.y + effect.delta.y,
        }
      : undefined);

  if (!destination) {
    return;
  }

  if (destination.x === target.position.x && destination.y === target.position.y) {
    return;
  }

  if (!isWithinBounds(state.board, destination)) {
    return;
  }

  if (!effect.ignoreCollisions) {
    if (isBlocked(state.board, destination)) {
      return;
    }

    const occupied = Object.values(state.actors).some(
      (actor) =>
        actor.id !== target.id &&
        actor.health > 0 &&
        actor.position.x === destination.x &&
        actor.position.y === destination.y
    );

    if (occupied) {
      return;
    }
  }

  target.position = destination;
}

function removeStatusEffects(
  target: ActorState,
  predicate: (status: StatusEffectState) => boolean
) {
  if (!target.statusEffects || target.statusEffects.length === 0) {
    return;
  }

  const remaining: StatusEffectState[] = [];
  target.statusEffects.forEach((status) => {
    if (predicate(status)) {
      if (status.modifiers) {
        Object.entries(status.modifiers).forEach(([stat, amount]) => {
          if (typeof amount === "number") {
            applyStatAdjustment(target, stat as StatusModifierStat, -amount);
          }
        });
      }
      return;
    }
    remaining.push(status);
  });
  target.statusEffects = remaining;
}

function applyStatusEffect(
  target: ActorState,
  effect: Extract<SpellEffect, { type: "status" }>["effect"]
) {
  target.statusEffects = target.statusEffects ?? [];
  removeStatusEffects(target, (existing) => existing.id === effect.id);

  const stored: StatusEffectState = {
    ...effect,
    modifiers: effect.modifiers ? { ...effect.modifiers } : undefined,
    tags: effect.tags ? [...effect.tags] : undefined,
  };

  target.statusEffects.push(stored);

  if (effect.modifiers) {
    Object.entries(effect.modifiers).forEach(([stat, amount]) => {
      if (typeof amount === "number") {
        applyStatAdjustment(target, stat as StatusModifierStat, amount);
      }
    });
  }
}

function applyStatusModifierEffect(
  target: ActorState,
  effect: Extract<SpellEffect, { type: "statusModifier" }>
) {
  const status: StatusEffectState = {
    id: effect.id ?? `modifier:${effect.stat}`,
    name:
      effect.name ??
      (effect.amount >= 0 ? `Boost ${effect.stat}` : `Weaken ${effect.stat}`),
    duration: effect.duration,
    modifiers: { [effect.stat]: effect.amount },
    tags: effect.tags ? [...effect.tags] : undefined,
  };
  applyStatusEffect(target, status);
}

function applyCleanseEffect(
  target: ActorState,
  effect: Extract<SpellEffect, { type: "cleanse" }>
) {
  const statusIds = effect.statusIds ? new Set(effect.statusIds) : undefined;
  const tagFilters = effect.tags ? new Set(effect.tags) : undefined;
  const removeAll = effect.removeAll || (!statusIds && !tagFilters);

  removeStatusEffects(target, (status) => {
    if (removeAll) {
      return true;
    }
    if (statusIds && statusIds.has(status.id)) {
      return true;
    }
    if (tagFilters && status.tags) {
      return status.tags.some((tag) => tagFilters.has(tag));
    }
    return false;
  });
}

function tickActorStatusEffects(target: ActorState) {
  if (!target.statusEffects || target.statusEffects.length === 0) {
    return;
  }

  target.statusEffects.forEach((status) => {
    if (Number.isFinite(status.duration)) {
      status.duration = Math.max(0, status.duration - 1);
    }
  });

  removeStatusEffects(
    target,
    (status) => Number.isFinite(status.duration) && status.duration <= 0
  );
}

function applyEffectsToActor(state: GameState, target: ActorState, effects: SpellEffect[]) {
  effects.forEach((effect) => {
    switch (effect.type) {
      case "damage":
        target.health = Math.max(0, target.health - effect.amount);
        break;
      case "heal":
        target.health = Math.min(target.maxHealth, target.health + effect.amount);
        break;
      case "move":
        applyMoveEffect(state, target, effect);
        break;
      case "buff":
        applyStatAdjustment(target, effect.stat, effect.amount);
        break;
      case "status":
        applyStatusEffect(target, effect.effect);
        break;
      case "statusModifier":
        applyStatusModifierEffect(target, effect);
        break;
      case "cleanse":
        applyCleanseEffect(target, effect);
        break;
      default:
        break;
    }
  });
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
  const range = attacker.attackRange ?? 1;

  if (distance === 0) {
    return { ok: false, reason: "Target is not valid" };
  }

  if (range <= 1) {
    if (distance !== 1) {
      return { ok: false, reason: "Target is not adjacent" };
    }
  } else {
    if (distance > range) {
      return { ok: false, reason: "Target is beyond attack range" };
    }
    if (distance > 1 && !hasLineOfSight(state.board, attacker.position, target.position)) {
      return { ok: false, reason: "Line of sight is blocked" };
    }
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

function validateSearch(state: GameState, action: SearchAction): ValidationResult {
  const actor = state.actors[action.actorId];
  if (!actor) {
    return { ok: false, reason: "Actor not found" };
  }

  if (actor.health <= 0) {
    return { ok: false, reason: "Actor is defeated" };
  }

  if (currentActorId(state) !== actor.id) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  if (state.searchState.config.requireHeroesOnly && actor.faction !== "hero") {
    return { ok: false, reason: "Only heroes may search" };
  }

  const area = findAreaContaining(state.board, actor.position);
  if (!area) {
    return { ok: false, reason: "Actor is not inside a searchable area" };
  }

  if (!areaAllowsSearch(area, action.searchType)) {
    return { ok: false, reason: "This search type is not allowed here" };
  }

  if (
    state.searchState.config.requireNoEnemies &&
    hasOpposingFactionInArea(state, area.id, actor.faction)
  ) {
    return { ok: false, reason: "You cannot search while enemies are present" };
  }

  if (hasSearchOccurred(state, area.id, actor.id, action.searchType)) {
    return { ok: false, reason: "This area has already been searched for that" };
  }

  return { ok: true };
}

function validateCastSpell(state: GameState, action: CastSpellAction): ValidationResult {
  const caster = state.actors[action.casterId];
  if (!caster) {
    return { ok: false, reason: "Caster not found" };
  }
  if (caster.health <= 0) {
    return { ok: false, reason: "Caster is defeated" };
  }
  if (currentActorId(state) !== caster.id) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  const spell = state.cards.spells[action.spellId];
  if (!spell) {
    return { ok: false, reason: "Spell is not defined" };
  }

  if (!caster.knownSpells || !caster.knownSpells.includes(action.spellId)) {
    return { ok: false, reason: "Caster does not know this spell" };
  }

  const targeting = resolveTargetActor(state, caster.id, action.targetId, spell.target);
  if (!targeting.ok) {
    return targeting;
  }

  return { ok: true };
}

function validateUseEquipment(state: GameState, action: UseEquipmentAction): ValidationResult {
  const actor = state.actors[action.actorId];
  if (!actor) {
    return { ok: false, reason: "Actor not found" };
  }
  if (actor.health <= 0) {
    return { ok: false, reason: "Actor is defeated" };
  }
  if (currentActorId(state) !== actor.id) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  const equipment = state.cards.equipment[action.equipmentId];
  if (!equipment) {
    return { ok: false, reason: "Equipment is not defined" };
  }

  if (!actor.equipment || !actor.equipment.includes(action.equipmentId)) {
    return { ok: false, reason: "Actor does not have this equipment" };
  }

  const targeting = resolveTargetActor(state, actor.id, action.targetId, equipment.target);
  if (!targeting.ok) {
    return targeting;
  }

  return { ok: true };
}

function validateTriggerQuestVisibility(
  state: GameState,
  action: TriggerQuestVisibilityAction
): ValidationResult {
  const actor = state.actors[action.actorId];
  if (!actor) {
    return { ok: false, reason: "Actor not found" };
  }
  if (actor.health <= 0) {
    return { ok: false, reason: "Actor is defeated" };
  }
  if (currentActorId(state) !== actor.id) {
    return { ok: false, reason: "It is not this actor's turn" };
  }

  const triggers = findQuestVisibilityTriggers(state.board, action.context);
  if (triggers.length === 0) {
    return { ok: false, reason: "No matching visibility triggers" };
  }

  return { ok: true };
}

export function validateAction(state: GameState, action: Action): ValidationResult {
  switch (action.type) {
    case "move":
      return validateMove(state, action);
    case "attack":
      return validateAttack(state, action);
    case "search":
      return validateSearch(state, action);
    case "castSpell":
      return validateCastSpell(state, action);
    case "useEquipment":
      return validateUseEquipment(state, action);
    case "triggerQuestVisibility":
      return validateTriggerQuestVisibility(state, action);
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

function applySearch(state: GameState, action: SearchAction) {
  const nextState = cloneGameState(state);
  const actor = nextState.actors[action.actorId];
  const area = findAreaContaining(nextState.board, actor.position);
  if (!area) {
    throw new Error("Actor is not inside a searchable area");
  }

  const discoveries = Object.values(nextState.discoverables).filter(
    (discoverable) =>
      discoverable.areaId === area.id &&
      discoverableMatchesSearch(action.searchType, discoverable.type) &&
      !discoverable.revealed
  );

  discoveries.forEach((discoverable) => {
    discoverable.revealed = true;
  });

  recordSearchOccurrence(nextState.searchState, area.id, actor.id, action.searchType);

  const ownerKey = getVisibilityOwnerKey(nextState, actor.id);
  const previouslyVisible = new Set(nextState.visibility.discovered[ownerKey] ?? []);
  nextState.visibility = mergeVisibility(nextState.visibility, ownerKey, area.tiles);
  const newlyRevealed = area.tiles.filter((tile) => !previouslyVisible.has(tileKey(tile)));

  const events: GameEvent[] = [
    {
      type: "searchPerformed",
      actorId: actor.id,
      areaId: area.id,
      searchType: action.searchType,
      discoveries: discoveries.map((item) => ({
        id: item.id,
        type: item.type,
        position: item.position,
      })),
    } satisfies SearchPerformedEvent,
  ];

  if (newlyRevealed.length > 0) {
    events.push({
      type: "tilesRevealed",
      ownerKey,
      tiles: newlyRevealed,
      source: "search",
      triggerId: `search:${area.id}:${action.searchType}`,
    });
  }

  return { state: nextState, events };
}

function applyCastSpell(state: GameState, action: CastSpellAction) {
  const nextState = cloneGameState(state);
  const caster = nextState.actors[action.casterId];
  const spell = nextState.cards.spells[action.spellId];
  if (!caster || !spell) {
    throw new Error("Invalid spell cast");
  }

  const targeting = resolveTargetActor(nextState, caster.id, action.targetId, spell.target);
  if (!targeting.ok) {
    throw new Error(targeting.reason);
  }

    applyEffectsToActor(nextState, targeting.target, spell.effects);

  const events: GameEvent[] = [
    {
      type: "spellCast",
      casterId: caster.id,
      spellId: spell.id,
      targetId: targeting.target.id,
      effects: spell.effects,
    } satisfies SpellCastEvent,
  ];

  return { state: nextState, events };
}

function applyUseEquipment(state: GameState, action: UseEquipmentAction) {
  const nextState = cloneGameState(state);
  const actor = nextState.actors[action.actorId];
  const equipment = nextState.cards.equipment[action.equipmentId];
  if (!actor || !equipment) {
    throw new Error("Invalid equipment usage");
  }

  const targeting = resolveTargetActor(nextState, actor.id, action.targetId, equipment.target);
  if (!targeting.ok) {
    throw new Error(targeting.reason);
  }

    applyEffectsToActor(nextState, targeting.target, equipment.effects);

  let consumed = false;
  if (equipment.consumable && actor.equipment) {
    const index = actor.equipment.indexOf(action.equipmentId);
    if (index >= 0) {
      actor.equipment.splice(index, 1);
      consumed = true;
    }
  }

  const events: GameEvent[] = [
    {
      type: "equipmentUsed",
      actorId: actor.id,
      equipmentId: equipment.id,
      targetId: targeting.target.id,
      effects: equipment.effects,
      consumed,
    } satisfies EquipmentUsedEvent,
  ];

  return { state: nextState, events };
}

function applyTriggerQuestVisibility(state: GameState, action: TriggerQuestVisibilityAction) {
  const result = triggerQuestVisibility(state, action.context);
  return { state: result.state, events: result.events };
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
    case "search":
      return applySearch(state, action);
    case "castSpell":
      return applyCastSpell(state, action);
    case "useEquipment":
      return applyUseEquipment(state, action);
    case "triggerQuestVisibility":
      return applyTriggerQuestVisibility(state, action);
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
          attackSuccesses: attackSkulls,
          defenseSuccesses: defenseShields,
          critical: damage > 0 && attackSkulls === attacker.attackDice,
        targetHealth: target.health,
        targetDefeated: target.health === 0,
      };

      return { state: nextState, events: [attackEvent] };
    }
    case "endTurn": {
      const nextState = cloneGameState(state);
      const previousActorId = currentActorId(nextState) as string;
      const previousActor = nextState.actors[previousActorId];
      if (previousActor) {
        tickActorStatusEffects(previousActor);
      }
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
