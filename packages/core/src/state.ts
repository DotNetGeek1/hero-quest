import {
  ActorFaction,
  ActorState,
  BoardState,
  CardCatalog,
  DiscoverableState,
  GameState,
  SearchArea,
  SearchRulesConfig,
  SearchState,
  SearchType,
  TilesRevealedEvent,
  TurnState,
  Vector2,
  VisibilityState,
  VisibilityTrigger,
  VisibilityTriggerOwner,
} from "./types";

export type CreateGameStateParams = {
  board: BoardState;
  actors: ActorState[];
  turnOrder?: string[];
  discoverables?: DiscoverableState[];
  searchConfig?: SearchRulesConfig;
  cards?: CardCatalog;
  visibility?: VisibilityState;
};

const DEFAULT_SEARCH_CONFIG: Required<SearchRulesConfig> = {
  requireHeroesOnly: true,
  requireNoEnemies: true,
  historyMode: "per-area",
};

const DEFAULT_VISIBILITY_STATE: VisibilityState = {
  mode: "global",
  visionRange: Infinity,
  discovered: {},
  triggerHistory: {},
};

const EMPTY_CARD_CATALOG: CardCatalog = {
  spells: {},
  equipment: {},
};

function normalizeSearchConfig(config?: SearchRulesConfig): Required<SearchRulesConfig> {
  return {
    requireHeroesOnly:
      config?.requireHeroesOnly ?? DEFAULT_SEARCH_CONFIG.requireHeroesOnly,
    requireNoEnemies: config?.requireNoEnemies ?? DEFAULT_SEARCH_CONFIG.requireNoEnemies,
    historyMode: config?.historyMode ?? DEFAULT_SEARCH_CONFIG.historyMode,
  };
}

export function createGameState({
  board,
  actors,
  turnOrder,
  discoverables,
  searchConfig,
  cards,
  visibility,
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
  const discoverablesById = (discoverables ?? []).reduce<Record<string, DiscoverableState>>(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {}
  );

  const normalizedSearchConfig = normalizeSearchConfig(searchConfig);
  const searchState: SearchState = {
    config: normalizedSearchConfig,
    history: {
      perArea: {},
      perHero: {},
    },
  };

  const turn: TurnState = {
    order,
    currentIndex: 0,
    movementRemaining,
  };

  const normalizedVisibility: VisibilityState = visibility
    ? {
        mode: visibility.mode ?? DEFAULT_VISIBILITY_STATE.mode,
        visionRange: visibility.visionRange ?? DEFAULT_VISIBILITY_STATE.visionRange,
        discovered: { ...visibility.discovered },
        triggerHistory: { ...(visibility.triggerHistory ?? {}) },
      }
    : {
        ...DEFAULT_VISIBILITY_STATE,
        discovered: { ...DEFAULT_VISIBILITY_STATE.discovered },
        triggerHistory: { ...DEFAULT_VISIBILITY_STATE.triggerHistory },
      };

  return {
    board,
    actors: actorsById,
    turn,
    discoverables: discoverablesById,
    searchState,
    cards:
      cards ??
      {
        spells: { ...EMPTY_CARD_CATALOG.spells },
        equipment: { ...EMPTY_CARD_CATALOG.equipment },
      },
    visibility: normalizedVisibility,
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

export function tileKey(position: Vector2): string {
  return `${position.x},${position.y}`;
}

export function findAreaContaining(board: BoardState, position: Vector2): SearchArea | undefined {
  return board.areas?.find((area) =>
    area.tiles.some((tile) => tile.x === position.x && tile.y === position.y)
  );
}

export function actorIdsInArea(state: GameState, areaId: string): string[] {
  const area = state.board.areas?.find((candidate) => candidate.id === areaId);
  if (!area) {
    return [];
  }

  return Object.values(state.actors)
    .filter((actor) =>
      area.tiles.some(
        (tile) => tile.x === actor.position.x && tile.y === actor.position.y
      )
    )
    .map((actor) => actor.id);
}

export function areaAllowsSearch(area: SearchArea, searchType: SearchType): boolean {
  if (!area.allowedSearches || area.allowedSearches.length === 0) {
    return true;
  }
  return area.allowedSearches.includes(searchType);
}

export function hasOpposingFactionInArea(
  state: GameState,
  areaId: string,
  faction: ActorFaction
): boolean {
  const ids = actorIdsInArea(state, areaId);
  return ids.some((id) => state.actors[id]?.faction !== faction && state.actors[id]?.health > 0);
}

export function hasSearchOccurred(
  state: GameState,
  areaId: string,
  actorId: string,
  searchType: SearchType
): boolean {
  const mode = state.searchState.config.historyMode ?? "per-area";
  if (mode === "per-hero") {
    const heroLog = state.searchState.history.perHero[actorId];
    return heroLog?.[areaId]?.includes(searchType) ?? false;
  }

  return state.searchState.history.perArea[areaId]?.includes(searchType) ?? false;
}

export function recordSearchOccurrence(
  searchState: SearchState,
  areaId: string,
  actorId: string,
  searchType: SearchType
) {
  const mode = searchState.config.historyMode ?? "per-area";
  if (mode === "per-hero") {
    searchState.history.perHero[actorId] = searchState.history.perHero[actorId] ?? {};
    const heroHistory = searchState.history.perHero[actorId];
    heroHistory[areaId] = heroHistory[areaId] ?? [];
    if (!heroHistory[areaId].includes(searchType)) {
      heroHistory[areaId].push(searchType);
    }
    return;
  }

  searchState.history.perArea[areaId] = searchState.history.perArea[areaId] ?? [];
  const areaHistory = searchState.history.perArea[areaId];
  if (!areaHistory.includes(searchType)) {
    areaHistory.push(searchType);
  }
}

export function getVisibilityOwnerKey(state: GameState, actorId: string): string {
  const actor = state.actors[actorId];
  if (!actor) {
    return "unknown";
  }

  switch (state.visibility.mode) {
    case "per-actor":
      return actor.id;
    case "per-faction":
      return actor.faction;
    default:
      return "global";
  }
}

export function computeVisibleTiles(
  board: BoardState,
  origin: Vector2,
  range: number
): Vector2[] {
  const visited = new Set<string>();
  const queue: { position: Vector2; distance: number }[] = [{ position: origin, distance: 0 }];
  const tiles: Vector2[] = [];

  while (queue.length > 0) {
    const current = queue.shift() as { position: Vector2; distance: number };
    const key = tileKey(current.position);
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);
    tiles.push(current.position);

    if (current.distance >= range) {
      continue;
    }

    const neighbors: Vector2[] = [
      { x: current.position.x + 1, y: current.position.y },
      { x: current.position.x - 1, y: current.position.y },
      { x: current.position.x, y: current.position.y + 1 },
      { x: current.position.x, y: current.position.y - 1 },
    ];

    neighbors.forEach((neighbor) => {
      if (!isWithinBounds(board, neighbor) || isBlocked(board, neighbor)) {
        return;
      }
      queue.push({ position: neighbor, distance: current.distance + 1 });
    });
  }

  return tiles;
}

export function getVisibleTilesForActor(state: GameState, actorId: string): Vector2[] {
  const actor = state.actors[actorId];
  if (!actor) {
    return [];
  }
  const range = Math.min(state.visibility.visionRange, state.board.width + state.board.height);
  return computeVisibleTiles(state.board, actor.position, range);
}

export function mergeVisibility(
  visibility: VisibilityState,
  ownerKey: string,
  tiles: Vector2[]
): VisibilityState {
  const current = visibility.discovered[ownerKey] ?? [];
  const merged = new Set(current);
  tiles.forEach((tile) => merged.add(tileKey(tile)));

  return {
    ...visibility,
    discovered: {
      ...visibility.discovered,
      [ownerKey]: Array.from(merged),
    },
  };
}

function getTilesForAreas(board: BoardState, areaIds: string[] = []): Vector2[] {
  if (!board.areas || board.areas.length === 0) {
    return [];
  }
  const tiles: Vector2[] = [];
  areaIds.forEach((areaId) => {
    const area = board.areas?.find((candidate) => candidate.id === areaId);
    if (area) {
      tiles.push(...area.tiles);
    }
  });
  return tiles;
}

function dedupeTiles(tiles: Vector2[]): Vector2[] {
  const seen = new Set<string>();
  const result: Vector2[] = [];
  tiles.forEach((tile) => {
    const key = tileKey(tile);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tile);
    }
  });
  return result;
}

function resolveVisibilityOwnerKeys(
  state: GameState,
  owner?: VisibilityTriggerOwner
): string[] {
  if (!owner) {
    return ["global"];
  }

  if (owner.type === "global") {
    return ["global"];
  }

  if (owner.type === "actor") {
    return [getVisibilityOwnerKey(state, owner.actorId)];
  }

  if (state.visibility.mode === "per-faction") {
    return [owner.faction];
  }

  if (state.visibility.mode === "per-actor") {
    const matchingActors = Object.values(state.actors).filter(
      (actor) => actor.faction === owner.faction && actor.health > 0
    );
    return matchingActors.map((actor) => actor.id);
  }

  return ["global"];
}

function recordVisibilityTrigger(visibility: VisibilityState, triggerId: string): VisibilityState {
  return {
    ...visibility,
    triggerHistory: {
      ...visibility.triggerHistory,
      [triggerId]: true,
    },
  };
}

function applyTilesReveal(
  visibility: VisibilityState,
  ownerKey: string,
  tiles: Vector2[]
): { visibility: VisibilityState; newlyRevealed: Vector2[] } {
  const before = new Set(visibility.discovered[ownerKey] ?? []);
  const nextVisibility = mergeVisibility(visibility, ownerKey, tiles);
  const newlyRevealed = tiles.filter((tile) => !before.has(tileKey(tile)));
  return { visibility: nextVisibility, newlyRevealed };
}

export function triggerVisibilityReveal(
  state: GameState,
  trigger: VisibilityTrigger
): { state: GameState; events: TilesRevealedEvent[] } {
  const nextState = cloneGameState(state);
  if (nextState.visibility.triggerHistory[trigger.id]) {
    return { state: nextState, events: [] };
  }

  const areaTiles = getTilesForAreas(nextState.board, trigger.areaIds ?? []);
  const tiles = dedupeTiles([...(trigger.tiles ?? []), ...areaTiles]);
  nextState.visibility = recordVisibilityTrigger(nextState.visibility, trigger.id);

  if (tiles.length === 0) {
    return { state: nextState, events: [] };
  }

  const ownerKeys = resolveVisibilityOwnerKeys(nextState, trigger.owner);
  const events: TilesRevealedEvent[] = [];

  ownerKeys.forEach((ownerKey) => {
    const { visibility, newlyRevealed } = applyTilesReveal(nextState.visibility, ownerKey, tiles);
    nextState.visibility = visibility;
    if (newlyRevealed.length > 0) {
      events.push({
        type: "tilesRevealed",
        ownerKey,
        tiles: newlyRevealed,
        source: trigger.source,
        triggerId: trigger.id,
      });
    }
  });

  return { state: nextState, events };
}
