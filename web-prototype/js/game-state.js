export function createCard(id, randomFn = Math.random) {
  const value = 1 + Math.floor(randomFn() * 13);
  const suit = ['♠', '♥', '♣', '♦'][Math.floor(randomFn() * 4)];
  const color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
  return { id, value, suit, color, removed: false };
}

export function initGameState(mode, previousOptions = null, randomFn = Math.random) {
  const isBoss = mode === 'boss';
  const totalCards = isBoss ? 9 : 25;
  const deckSize = isBoss ? 8 : 16;

  const cards = Array.from({ length: totalCards }, (_, index) => createCard(`board_${index}`, randomFn));
  const deck = Array.from({ length: deckSize }, (_, index) => createCard(`deck_${index}`, randomFn));

  return {
    mode,
    center: 7,
    removed: 0,
    totalCards,
    cards,
    deck,
    options: previousOptions || {
      soundOn: true,
      imageRef: null
    }
  };
}
