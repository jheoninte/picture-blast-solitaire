export function calculateReveal(removedCount, totalCards) {
  if (totalCards <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((removedCount / totalCards) * 100)));
}

export function getRevealTiles(state) {
  return state.cards.map(card => {
    const index = Number(card.id.slice(6));
    return { cardId: card.id, index, removed: card.removed === true };
  }).sort((first, second) => first.index - second.index);
}
