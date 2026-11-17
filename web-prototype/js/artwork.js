import { getRevealTiles } from './reveal.js';

const grids = new WeakMap();

export function updateArtworkMask(gridElement, state, initialLoad = false) {
  const tiles = getRevealTiles(state);
  const key = `${state.mode}:${tiles.map(tile => tile.cardId).join(',')}`;
  let grid = grids.get(gridElement);
  const isNew = !grid || grid.key !== key;
  if (isNew) {
    gridElement.replaceChildren();
    gridElement.className = `artwork-grid ${state.mode}`;
    const cells = tiles.map(tile => {
      const cell = gridElement.ownerDocument.createElement('div');
      cell.className = 'mask-cell';
      cell.dataset.cardId = tile.cardId;
      gridElement.appendChild(cell);
      return cell;
    });
    grid = { key, cells };
    grids.set(gridElement, grid);
  }
  tiles.forEach((tile, index) => {
    const cell = grid.cells[index];
    cell.style.transition = initialLoad || isNew ? 'none' : '';
    cell.classList.toggle('revealed', tile.removed);
  });
}
