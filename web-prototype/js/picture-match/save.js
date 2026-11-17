import { createPictureMatchState } from './levels.js';
import { getMatchStatus } from './rules.js';

export const PICTURE_MATCH_SAVE_KEY = 'picture-blast-solitaire.picture-match.save';
export const MAX_SAVE_LENGTH = 100000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createPictureMatchSignature(levelData) {
  return JSON.stringify({
    mode: levelData.mode,
    columns: levelData.columns,
    rows: levelData.rows,
    cards: levelData.cards.map(card => ({
      id: card.id,
      artId: card.artId,
      half: card.half
    }))
  });
}

export function createEmptyPictureMatchSave(levelData) {
  return {
    schemaVersion: 1,
    currentLevelId: levelData.id,
    levelSignature: createPictureMatchSignature(levelData),
    completedLevelIds: [],
    removedCardIds: [],
    cardOrder: levelData.cards.map(card => card.id),
    options: { soundOn: true }
  };
}

function validateCardOrder(cardOrder, baseIds) {
  if (!Array.isArray(cardOrder) || cardOrder.length !== baseIds.length) return null;
  const expectedSet = new Set(baseIds);
  const seenSet = new Set();
  for (const id of cardOrder) {
    if (typeof id !== 'string' || !expectedSet.has(id) || seenSet.has(id)) return null;
    seenSet.add(id);
  }
  return [...cardOrder];
}

function validateRemovedCards(removedCardIds, levelData) {
  if (!Array.isArray(removedCardIds)) return null;
  const cardById = new Map(levelData.cards.map(card => [card.id, card]));
  const seen = new Set();
  const countsByArt = new Map();

  for (const id of removedCardIds) {
    if (typeof id !== 'string' || seen.has(id) || !cardById.has(id)) return null;
    seen.add(id);
    const card = cardById.get(id);
    const entry = countsByArt.get(card.artId) || { top: 0, bottom: 0 };
    entry[card.half] += 1;
    countsByArt.set(card.artId, entry);
  }

  for (const counts of countsByArt.values()) {
    if (counts.top !== counts.bottom) return null;
  }

  return [...seen];
}

export function restorePictureMatchProgress(rawText, levels) {
  let parsedData = null;
  let message = '';
  let futureVersion = false;
  let writeBlocked = false;

  if (rawText !== null && rawText !== undefined) {
    if (typeof rawText !== 'string' || rawText.length > MAX_SAVE_LENGTH) {
      writeBlocked = true;
      message = '저장 데이터가 너무 크거나 읽을 수 없어 이번 세션은 저장되지 않습니다.';
    } else {
      try {
        const candidate = JSON.parse(rawText);
        if (!isRecord(candidate)) throw new Error('Invalid save record');
        if (Number.isInteger(candidate.schemaVersion) && candidate.schemaVersion > 1) {
          futureVersion = true;
          writeBlocked = true;
          message = '상위 버전의 저장 데이터입니다. 기존 저장을 보호하기 위해 쓰기를 차단합니다.';
        } else if (candidate.schemaVersion !== 1) {
          message = '지원하지 않는 저장 형식입니다. 현재 판을 처음부터 시작합니다.';
        } else {
          parsedData = candidate;
        }
      } catch {
        message = '저장 데이터가 손상되어 기본 상태로 시작합니다.';
      }
    }
  }

  const validLevelIds = new Set(levels.map(level => level.id));
  const completedLevelIds = Array.isArray(parsedData?.completedLevelIds)
    ? [...new Set(parsedData.completedLevelIds.filter(id => typeof id === 'string' && validLevelIds.has(id)))]
    : [];
  const options = {
    soundOn: typeof parsedData?.options?.soundOn === 'boolean' ? parsedData.options.soundOn : true
  };

  const matchedLevel = levels.find(level => level.id === parsedData?.currentLevelId);
  const targetLevel = matchedLevel || levels.find(level => !completedLevelIds.includes(level.id)) || levels[levels.length - 1];
  if (parsedData && !matchedLevel) {
    message = '저장된 스테이지를 찾을 수 없어 진행 가능한 스테이지로 이동합니다.';
  }

  const slot = createEmptyPictureMatchSave(targetLevel);
  slot.completedLevelIds = completedLevelIds;
  slot.options = options;

  let state = createPictureMatchState(targetLevel, options);

  if (parsedData && matchedLevel) {
    if (parsedData.levelSignature !== slot.levelSignature) {
      message = '스테이지 구성이 변경되어 현재 판을 처음부터 시작합니다.';
    } else {
      const baseIds = targetLevel.cards.map(card => card.id);
      const validOrder = validateCardOrder(parsedData.cardOrder, baseIds);
      const validRemoved = validateRemovedCards(parsedData.removedCardIds, targetLevel);

      if (validOrder && validRemoved) {
        const removedSet = new Set(validRemoved);
        slot.cardOrder = validOrder;
        slot.removedCardIds = validRemoved;
        state = {
          ...state,
          cardOrder: validOrder,
          cards: state.cards.map(card => ({
            ...card,
            removed: removedSet.has(card.id)
          }))
        };
      } else {
        message = '저장된 카드 배치 또는 제거 기록이 유효하지 않아 현재 판을 초기화했습니다.';
      }
    }
  }

  if (getMatchStatus(state) === 'cleared' && !slot.completedLevelIds.includes(targetLevel.id)) {
    slot.completedLevelIds.push(targetLevel.id);
  }

  return {
    slot,
    state,
    levelData: targetLevel,
    message,
    futureVersion,
    writeBlocked
  };
}

export function createLocalStorageAdapter() {
  return {
    async getItem(key) {
      return globalThis.localStorage.getItem(key);
    },
    async setItem(key, value) {
      globalThis.localStorage.setItem(key, value);
    }
  };
}

function serializePictureMatchSlot(slot) {
  if (!isRecord(slot) || slot.schemaVersion !== 1 ||
      typeof slot.currentLevelId !== 'string' || slot.currentLevelId.length > 100 ||
      typeof slot.levelSignature !== 'string' || slot.levelSignature.length > 20000 ||
      !Array.isArray(slot.completedLevelIds) ||
      !Array.isArray(slot.removedCardIds) ||
      !Array.isArray(slot.cardOrder) || slot.completedLevelIds.length > 100 ||
      slot.removedCardIds.length > 64 || slot.cardOrder.length > 64 ||
      slot.cardOrder.length < 4 || new Set(slot.cardOrder).size !== slot.cardOrder.length ||
      new Set(slot.removedCardIds).size !== slot.removedCardIds.length ||
      ![...slot.cardOrder, ...slot.removedCardIds].every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id))) {
    throw new Error('Invalid picture match save slot');
  }
  const snapshot = JSON.stringify({
    schemaVersion: 1,
    currentLevelId: slot.currentLevelId,
    levelSignature: slot.levelSignature,
    completedLevelIds: [...new Set(slot.completedLevelIds.filter(id => typeof id === 'string' && id.length <= 100))],
    removedCardIds: [...new Set(slot.removedCardIds.filter(id => typeof id === 'string' && id.length <= 64))],
    cardOrder: slot.cardOrder.filter(id => typeof id === 'string' && id.length <= 64),
    options: {
      soundOn: typeof slot.options?.soundOn === 'boolean' ? slot.options.soundOn : true
    }
  });
  if (snapshot.length > MAX_SAVE_LENGTH) {
    throw new Error('Save payload exceeds 100KB limit');
  }
  return snapshot;
}

export function createPictureMatchSaveStore(adapter) {
  let queue = Promise.resolve();
  let blockWrites = false;

  return {
    async load(key) {
      await queue;
      try {
        const rawText = await adapter.getItem(key);
        if (rawText !== null && rawText !== undefined) {
          if (typeof rawText !== 'string' || rawText.length > MAX_SAVE_LENGTH) {
            blockWrites = true;
          } else {
            try {
              const data = JSON.parse(rawText);
              if (Number.isInteger(data?.schemaVersion) && data.schemaVersion > 1) {
                blockWrites = true;
              }
            } catch {}
          }
        }
        return { rawText: rawText ?? null, error: false };
      } catch {
        blockWrites = true;
        return { rawText: null, error: true };
      }
    },
    save(key, slot) {
      if (blockWrites) return Promise.resolve({ ok: false, reason: 'blocked' });
      let snapshot;
      try {
        snapshot = serializePictureMatchSlot(slot);
      } catch {
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      queue = queue.then(async () => {
        if (blockWrites) return { ok: false, reason: 'blocked' };
        try {
          await adapter.setItem(key, snapshot);
          return { ok: true };
        } catch {
          return { ok: false, reason: 'storage' };
        }
      });
      return queue;
    },
    disableWrites() {
      blockWrites = true;
    }
  };
}
