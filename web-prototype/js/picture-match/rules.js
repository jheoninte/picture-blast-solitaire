export function canMatchCards(firstCard, secondCard) {
  if (!firstCard || !secondCard) return false;
  if (firstCard.removed || secondCard.removed) return false;
  if (firstCard.id === secondCard.id) return false;
  if (typeof firstCard.artId !== 'string' || !firstCard.artId) return false;
  if (firstCard.artId !== secondCard.artId) return false;
  return (firstCard.half === 'top' && secondCard.half === 'bottom') ||
         (firstCard.half === 'bottom' && secondCard.half === 'top');
}

export function getRemainingCards(state) {
  const cardMap = new Map(state.cards.map(card => [card.id, card]));
  return state.cardOrder
    .map(cardId => cardMap.get(cardId))
    .filter(card => card && !card.removed);
}

export function getMatchStatus(state) {
  const remainingCount = state.cards.filter(card => !card.removed).length;
  return remainingCount === 0 ? 'cleared' : 'playing';
}

export function getProgressCounts(state) {
  const totalPairs = Math.floor(state.cards.length / 2);
  const removedCount = state.cards.filter(card => card.removed).length;
  const completedPairs = Math.floor(removedCount / 2);
  return {
    completedPairs,
    totalPairs,
    remainingCards: state.cards.length - removedCount
  };
}

export function selectCard(state, cardId) {
  const target = state.cards.find(card => card.id === cardId);
  if (!target || target.removed) {
    return { state, outcome: 'ignored', matchedPair: null };
  }

  if (state.selectedCardId === cardId) {
    return {
      state: { ...state, selectedCardId: null },
      outcome: 'deselected',
      matchedPair: null
    };
  }

  if (!state.selectedCardId) {
    return {
      state: { ...state, selectedCardId: cardId },
      outcome: 'selected',
      matchedPair: null
    };
  }

  const previous = state.cards.find(card => card.id === state.selectedCardId);
  if (!previous || previous.removed) {
    return {
      state: { ...state, selectedCardId: cardId },
      outcome: 'selected',
      matchedPair: null
    };
  }

  if (canMatchCards(previous, target)) {
    const nextCards = state.cards.map(card =>
      card.id === previous.id || card.id === target.id
        ? { ...card, removed: true }
        : card
    );
    return {
      state: {
        ...state,
        cards: nextCards,
        selectedCardId: null
      },
      outcome: 'matched',
      matchedPair: {
        artId: target.artId,
        firstId: previous.id,
        secondId: target.id
      }
    };
  }

  return {
    state: {
      ...state,
      selectedCardId: cardId
    },
    outcome: 'mismatch',
    matchedPair: null
  };
}

export function findHintPair(state) {
  const remaining = getRemainingCards(state);
  const topsByArt = new Map();
  const bottomsByArt = new Map();

  for (const card of remaining) {
    if (card.half === 'top') {
      if (!topsByArt.has(card.artId)) topsByArt.set(card.artId, card.id);
    } else if (card.half === 'bottom') {
      if (!bottomsByArt.has(card.artId)) bottomsByArt.set(card.artId, card.id);
    }
  }

  for (const [artId, topId] of topsByArt.entries()) {
    const bottomId = bottomsByArt.get(artId);
    if (bottomId) {
      return [topId, bottomId];
    }
  }
  return null;
}

export function shuffleRemainingCards(state, randomFn) {
  const cardMap = new Map(state.cards.map(card => [card.id, card]));
  const activePositions = [];
  const activeIds = [];

  state.cardOrder.forEach((cardId, index) => {
    const card = cardMap.get(cardId);
    if (card && !card.removed) {
      activePositions.push(index);
      activeIds.push(cardId);
    }
  });

  if (activeIds.length <= 1) {
    return { ...state, selectedCardId: null };
  }

  const shuffledIds = [...activeIds];
  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const randomValue = randomFn();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) throw new Error('Invalid shuffle random value');
    const swapIndex = Math.floor(randomValue * (index + 1));
    const temp = shuffledIds[index];
    shuffledIds[index] = shuffledIds[swapIndex];
    shuffledIds[swapIndex] = temp;
  }

  const nextOrder = [...state.cardOrder];
  activePositions.forEach((boardIndex, slotIndex) => {
    nextOrder[boardIndex] = shuffledIds[slotIndex];
  });

  return {
    ...state,
    cardOrder: nextOrder,
    selectedCardId: null
  };
}

export function generateClearSequence(levelData) {
  let simState = {
    cards: levelData.cards.map(card => ({ ...card, removed: false })),
    cardOrder: levelData.cards.map(card => card.id),
    selectedCardId: null
  };
  const steps = [];
  while (getMatchStatus(simState) !== 'cleared') {
    const pair = findHintPair(simState);
    if (!pair) {
      throw new Error(`Unsolvable level configuration: ${levelData.id}`);
    }
    const firstStep = selectCard(simState, pair[0]);
    simState = firstStep.state;
    const secondStep = selectCard(simState, pair[1]);
    if (secondStep.outcome !== 'matched') {
      throw new Error(`Failed replay match in level: ${levelData.id}`);
    }
    simState = secondStep.state;
    steps.push(pair);
  }
  return steps;
}
