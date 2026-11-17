const VALID_ASSET_KEYS = new Set(['prototype-default']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseArtworks(rawData, levels) {
  if (!isRecord(rawData) || rawData.version !== 1 || !Array.isArray(rawData.artworks)) {
    throw new Error('Invalid artwork catalog');
  }
  const levelMap = new Map(levels.map((level, order) => [level.id, { level, order }]));
  if (rawData.artworks.length !== levelMap.size) {
    throw new Error('Artwork catalog count mismatch');
  }

  const seenIds = new Set();
  const seenLevelIds = new Set();
  const validated = [];

  for (const entry of rawData.artworks) {
    if (!isRecord(entry) ||
        typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 100 ||
        typeof entry.levelId !== 'string' || !entry.levelId.trim() || entry.levelId.length > 100 ||
        typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 120 ||
        typeof entry.assetKey !== 'string' || !VALID_ASSET_KEYS.has(entry.assetKey)) {
      throw new Error('Invalid artwork entry');
    }
    if (seenIds.has(entry.id) || seenLevelIds.has(entry.levelId)) {
      throw new Error('Duplicate artwork id or levelId');
    }
    const levelInfo = levelMap.get(entry.levelId);
    if (!levelInfo) {
      throw new Error(`Unknown levelId in artwork: ${entry.levelId}`);
    }
    seenIds.add(entry.id);
    seenLevelIds.add(entry.levelId);
    validated.push({
      id: entry.id,
      levelId: entry.levelId,
      title: entry.title,
      assetKey: entry.assetKey,
      order: levelInfo.order,
      levelTitle: levelInfo.level.title
    });
  }

  return validated
    .sort((first, second) => first.order - second.order)
    .map(({ order, ...item }) => item);
}

export async function loadArtworks(levels, url = new URL('../data/artworks.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load artworks');
  }
  const json = await response.json();
  return parseArtworks(json, levels);
}

export function buildCollectionState(artworks, completedLevelIds) {
  const completedSet = new Set(Array.isArray(completedLevelIds) ? completedLevelIds : []);
  const items = artworks.map((art, index) => ({
    id: art.id,
    levelId: art.levelId,
    title: art.title,
    assetKey: art.assetKey,
    levelTitle: art.levelTitle,
    stageNumber: index + 1,
    unlocked: completedSet.has(art.levelId)
  }));
  const unlockedCount = items.filter(item => item.unlocked).length;
  return {
    items,
    unlockedCount,
    totalCount: items.length
  };
}
