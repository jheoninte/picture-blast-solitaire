export function canRemoveCard(centerValue, cardValue) {
  const difference = Math.abs(centerValue - cardValue);
  return difference === 1 || difference === 12;
}

export function getPlayableCardIds(state) {
  return state.cards
    .filter(card => !card.removed && canRemoveCard(state.center, card.value))
    .map(card => card.id);
}

export function getGameStatus(state) {
  if (state.removed >= state.totalCards) {
    return 'cleared';
  }
  const playableIds = getPlayableCardIds(state);
  if (playableIds.length > 0) {
    return 'playing';
  }
  if (state.deck.length > 0) {
    return 'blocked';
  }
  return 'failed';
}

export function drawNextCenterCard(state) {
  if (getGameStatus(state) !== 'blocked') {
    return state;
  }
  const nextCard = state.deck[0];
  const newDeck = state.deck.slice(1);
  return {
    ...state,
    center: nextCard.value,
    deck: newDeck
  };
}

export function attemptRemoveCard(state, cardId) {
  const card = state.cards.find(card => card.id === cardId);
  if (!card || card.removed || !canRemoveCard(state.center, card.value)) {
    return state;
  }

  const newCards = state.cards.map(card =>
    card.id === cardId ? { ...card, removed: true } : card
  );

  return {
    ...state,
    center: card.value,
    removed: state.removed + 1,
    cards: newCards
  };
}
