import { attemptRemoveCard, drawNextCenterCard, getGameStatus } from './rules.js';

const suitSymbols = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRank(value) {
  return Number.isInteger(value) && value >= 1 && value <= 13;
}

function parseLevel(input) {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim() ||
      typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('Invalid level identity');
  }
  if (input.mode !== 'main' && input.mode !== 'boss') {
    throw new Error(`Invalid mode: ${input.id}`);
  }
  const cardCount = input.mode === 'boss' ? 9 : 25;
  const deckCount = input.mode === 'boss' ? 8 : 16;
  if (!isRank(input.startingCenterCard) || !Array.isArray(input.cards) ||
      input.cards.length !== cardCount || !Array.isArray(input.deck) ||
      input.deck.length !== deckCount) {
    throw new Error(`Invalid board or deck: ${input.id}`);
  }
  const cards = input.cards.map(card => {
    if (!isRecord(card) || !isRank(card.value) ||
        !Object.hasOwn(suitSymbols, card.suit)) {
      throw new Error(`Invalid card: ${input.id}`);
    }
    return { value: card.value, suit: card.suit };
  });
  const deck = input.deck.map(value => {
    if (!isRank(value)) throw new Error(`Invalid deck rank: ${input.id}`);
    return value;
  });
  if (!Array.isArray(input.solution) || input.solution.length < cardCount ||
      input.solution.length > cardCount + deckCount) {
    throw new Error(`Invalid solution: ${input.id}`);
  }
  const solution = input.solution.map(action => {
    if (!isRecord(action)) throw new Error(`Invalid action: ${input.id}`);
    if (action.type === 'draw') return { type: 'draw' };
    if (action.type !== 'remove' || typeof action.cardId !== 'string' ||
        !/^board_(0|[1-9]\d*)$/.test(action.cardId) ||
        Number(action.cardId.slice(6)) >= cardCount) {
      throw new Error(`Invalid action: ${input.id}`);
    }
    return { type: 'remove', cardId: action.cardId };
  });
  return {
    id: input.id,
    title: input.title,
    mode: input.mode,
    startingCenterCard: input.startingCenterCard,
    cards,
    deck,
    solution
  };
}

export function createFixedGameState(levelData, previousOptions = null) {
  const level = parseLevel(levelData);
  const cards = level.cards.map((card, index) => ({
    id: `board_${index}`,
    value: card.value,
    suit: suitSymbols[card.suit],
    color: card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black',
    removed: false
  }));
  const deck = level.deck.map((value, index) => ({
    id: `deck_${index}`,
    value,
    suit: '♠',
    color: 'black',
    removed: false
  }));
  return {
    mode: level.mode,
    center: level.startingCenterCard,
    removed: 0,
    totalCards: cards.length,
    cards,
    deck,
    options: { soundOn: true, imageRef: null, ...previousOptions }
  };
}

export function parseLevels(data) {
  if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.levels) ||
      data.levels.length === 0) {
    throw new Error('Invalid level pack');
  }
  const levels = data.levels.map(parseLevel);
  const usedIds = new Set();
  for (const level of levels) {
    if (usedIds.has(level.id)) throw new Error(`Duplicate level id: ${level.id}`);
    usedIds.add(level.id);
    let state = createFixedGameState(level);
    for (const action of level.solution) {
      const nextState = action.type === 'draw'
        ? drawNextCenterCard(state)
        : attemptRemoveCard(state, action.cardId);
      if (nextState === state) throw new Error(`Illegal solution move: ${level.id}`);
      state = nextState;
    }
    if (getGameStatus(state) !== 'cleared') {
      throw new Error(`Incomplete solution: ${level.id}`);
    }
  }
  return levels;
}

export async function loadLevels(url = new URL('../data/levels.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load level pack');
  return parseLevels(await response.json());
}
