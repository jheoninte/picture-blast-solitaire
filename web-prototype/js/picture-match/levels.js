import { generateClearSequence } from './rules.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativeAsset(assetPath) {
  return typeof assetPath === 'string' &&
    assetPath.length <= 240 &&
    /^\.\/assets\/picture-match\/[a-zA-Z0-9_/-]+\.png$/.test(assetPath) &&
    !assetPath.includes('..') &&
    assetPath.endsWith('.png');
}

export function parseArtworkManifest(rawData) {
  if (!isRecord(rawData) || rawData.version !== 1 || !Array.isArray(rawData.artworks) ||
      rawData.artworks.length === 0 || rawData.artworks.length > 100 ||
      rawData.releaseApproved !== false || rawData.halfWidth !== 128 || rawData.halfHeight !== 176) {
    throw new Error('Invalid picture-match artwork manifest');
  }
  const seenIds = new Set();
  const artworks = rawData.artworks.map(entry => {
    if (!isRecord(entry) ||
        typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 80 ||
        !/^[a-zA-Z0-9_-]+$/.test(entry.id) ||
        typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 100 ||
        !isSafeRelativeAsset(entry.top) || !isSafeRelativeAsset(entry.bottom)) {
      throw new Error('Invalid artwork entry in manifest');
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate artwork id: ${entry.id}`);
    }
    seenIds.add(entry.id);
    return {
      id: entry.id,
      title: entry.title,
      top: entry.top,
      bottom: entry.bottom
    };
  });

  return {
    version: 1,
    releaseApproved: rawData.releaseApproved === true,
    halfWidth: Number.isInteger(rawData.halfWidth) ? rawData.halfWidth : 128,
    halfHeight: Number.isInteger(rawData.halfHeight) ? rawData.halfHeight : 176,
    artworks
  };
}

export function parsePictureMatchLevels(rawData, manifest) {
  if (!isRecord(rawData) || rawData.version !== 1 || !Array.isArray(rawData.levels) ||
      rawData.levels.length === 0) {
    throw new Error('Invalid picture-match levels pack');
  }
  const validArtIds = new Set(manifest.artworks.map(art => art.id));
  const usedLevelIds = new Set();

  return rawData.levels.map(level => {
    if (!isRecord(level) ||
        typeof level.id !== 'string' || !level.id.trim() || level.id.length > 80 ||
        !/^[a-zA-Z0-9_-]+$/.test(level.id) ||
        typeof level.title !== 'string' || !level.title.trim() || level.title.length > 100) {
      throw new Error('Invalid level identity');
    }
    if (usedLevelIds.has(level.id)) {
      throw new Error(`Duplicate level id: ${level.id}`);
    }
    usedLevelIds.add(level.id);

    if (level.mode !== 'main' && level.mode !== 'boss') {
      throw new Error(`Invalid level mode: ${level.id}`);
    }
    if (!Number.isInteger(level.columns) || level.columns < 2 || level.columns > 8 ||
        !Number.isInteger(level.rows) || level.rows < 2 || level.rows > 8) {
      throw new Error(`Invalid grid dimensions: ${level.id}`);
    }
    const expectedCount = level.columns * level.rows;
    if (expectedCount % 2 !== 0 || !Array.isArray(level.cards) || level.cards.length !== expectedCount) {
      throw new Error(`Invalid card count in level: ${level.id}`);
    }

    const usedCardIds = new Set();
    const balanceByArt = new Map();
    const cards = level.cards.map(card => {
      if (!isRecord(card) ||
          typeof card.id !== 'string' || !card.id.trim() || card.id.length > 64 ||
          !/^[a-zA-Z0-9_-]+$/.test(card.id) ||
          !validArtIds.has(card.artId) ||
          (card.half !== 'top' && card.half !== 'bottom')) {
        throw new Error(`Invalid card entry in level: ${level.id}`);
      }
      if (usedCardIds.has(card.id)) {
        throw new Error(`Duplicate card id in level ${level.id}: ${card.id}`);
      }
      usedCardIds.add(card.id);

      const current = balanceByArt.get(card.artId) || { top: 0, bottom: 0 };
      current[card.half] += 1;
      balanceByArt.set(card.artId, current);

      return {
        id: card.id,
        artId: card.artId,
        half: card.half
      };
    });

    for (const [artId, counts] of balanceByArt.entries()) {
      if (counts.top !== counts.bottom) {
        throw new Error(`Unbalanced top/bottom halves for ${artId} in level ${level.id}`);
      }
    }

    const normalizedLevel = {
      id: level.id,
      title: level.title,
      mode: level.mode,
      columns: level.columns,
      rows: level.rows,
      cards
    };

    generateClearSequence(normalizedLevel);
    return normalizedLevel;
  });
}

export function createPictureMatchState(levelData, previousOptions = null) {
  const cards = levelData.cards.map(card => ({
    id: card.id,
    artId: card.artId,
    half: card.half,
    removed: false
  }));
  return {
    levelId: levelData.id,
    mode: levelData.mode,
    columns: levelData.columns,
    rows: levelData.rows,
    cards,
    cardOrder: cards.map(card => card.id),
    selectedCardId: null,
    options: {
      soundOn: typeof previousOptions?.soundOn === 'boolean' ? previousOptions.soundOn : true
    }
  };
}

export async function loadPictureMatchContent(
  manifestUrl = new URL('../../data/picture-match-artworks.json', import.meta.url),
  levelsUrl = new URL('../../data/picture-match-levels.json', import.meta.url)
) {
  const [manifestRes, levelsRes] = await Promise.all([
    fetch(manifestUrl),
    fetch(levelsUrl)
  ]);
  if (!manifestRes.ok || !levelsRes.ok) {
    throw new Error('Failed to load picture match resources');
  }
  const manifest = parseArtworkManifest(await manifestRes.json());
  const levels = parsePictureMatchLevels(await levelsRes.json(), manifest);
  await Promise.all(manifest.artworks.flatMap(art => [art.top, art.bottom]).map(loadArtworkImage));
  return { manifest, levels };
}

function loadArtworkImage(source) {
  return new Promise((resolve, reject) => {
    const artworkImage = new Image();
    const timer = setTimeout(() => finish(new Error('Artwork loading timed out')), 12000);
    function finish(error) {
      clearTimeout(timer);
      artworkImage.onload = null;
      artworkImage.onerror = null;
      if (error) reject(error);
      else resolve();
    }
    artworkImage.onload = () => {
      if (artworkImage.naturalWidth !== 128 || artworkImage.naturalHeight !== 176) finish(new Error('Invalid artwork dimensions'));
      else finish();
    };
    artworkImage.onerror = () => finish(new Error('Artwork unavailable'));
    artworkImage.src = new URL(source, new URL('../../', import.meta.url)).href;
  });
}
