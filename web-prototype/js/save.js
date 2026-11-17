import { createFixedGameState } from './levels.js';
import { attemptRemoveCard, drawNextCenterCard, getGameStatus } from './rules.js';

export const SAVE_KEY = 'picture-blast-solitaire.save';
export const MAX_SAVE_LENGTH = 100000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createLevelSignature(levelData) {
  return JSON.stringify({
    mode: levelData.mode,
    startingCenterCard: levelData.startingCenterCard,
    cards: levelData.cards.map(card => ({ value: card.value, suit: card.suit })),
    deck: levelData.deck
  });
}

export function createEmptySaveSlot(levelId, signature) {
  return {
    schemaVersion: 1,
    currentLevelId: levelId,
    levelSignature: signature,
    completedLevelIds: [],
    actions: [],
    options: { soundOn: true },
    imageRef: null
  };
}

function cleanImageRef(reference) {
  if (!isRecord(reference) || reference.kind !== 'user' ||
      typeof reference.name !== 'string' || !reference.name.trim() ||
      reference.name.length > 255 || /[<>]|^(?:blob:|data:|https?:\/\/)/i.test(reference.name) ||
      !Number.isSafeInteger(reference.size) || reference.size < 0 ||
      !Number.isSafeInteger(reference.lastModified) || reference.lastModified < 0 ||
      reference.lastModified > 8640000000000000) return null;
  return {
    kind: 'user',
    name: reference.name,
    size: reference.size,
    lastModified: reference.lastModified
  };
}

export function restoreProgress(rawText, levels) {
  let data = null;
  let message = '';
  let futureVersion = false;
  let writeBlocked = false;
  if (rawText !== null && rawText !== undefined) {
    if (typeof rawText !== 'string' || rawText.length > MAX_SAVE_LENGTH) {
      writeBlocked = true;
      message = '저장 데이터가 너무 크거나 읽을 수 없는 형식입니다. 이번 세션은 저장되지 않습니다.';
    } else {
      try {
        const parsed = JSON.parse(rawText);
        if (!isRecord(parsed)) throw new Error('Invalid save');
        if (Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > 1) {
          futureVersion = true;
          writeBlocked = true;
          message = '미래 버전의 저장 데이터입니다. 이번 세션은 저장되지 않습니다.';
        } else {
          data = parsed;
          if (data.schemaVersion !== 1) message = '지원하지 않는 저장 형식입니다. 현재 판을 처음부터 시작합니다.';
        }
      } catch {
        message = '저장 데이터가 손상되어 기본 상태로 시작합니다.';
      }
    }
  }

  const levelIds = new Set(levels.map(level => level.id));
  const completed = Array.isArray(data?.completedLevelIds)
    ? [...new Set(data.completedLevelIds.filter(id => typeof id === 'string' && levelIds.has(id)))]
    : [];
  const options = { soundOn: typeof data?.options?.soundOn === 'boolean' ? data.options.soundOn : true };
  const imageRef = cleanImageRef(data?.imageRef);
  const matchedLevel = levels.find(level => level.id === data?.currentLevelId);
  const targetLevel = matchedLevel || levels.find(level => !completed.includes(level.id)) || levels[levels.length - 1];
  if (data && !matchedLevel) message = '저장된 레벨을 찾을 수 없어 진행 가능한 레벨로 이동합니다.';

  const signature = createLevelSignature(targetLevel);
  const slot = createEmptySaveSlot(targetLevel.id, signature);
  slot.completedLevelIds = completed;
  slot.options = options;
  slot.imageRef = imageRef;
  let state = createFixedGameState(targetLevel, { ...options, imageRef });

  if (data?.schemaVersion === 1 && matchedLevel) {
    if (data.levelSignature !== signature) {
      message = '레벨 내용이 변경되어 해당 레벨을 처음부터 시작합니다.';
    } else {
      const maxActions = targetLevel.cards.length + targetLevel.deck.length;
      let valid = Array.isArray(data.actions) && data.actions.length <= maxActions;
      let candidate = state;
      const actions = [];
      if (valid) {
        for (const action of data.actions) {
          if (!isRecord(action) ||
              (action.type !== 'draw' && action.type !== 'remove') ||
              (action.type === 'remove' && typeof action.cardId !== 'string')) {
            valid = false;
            break;
          }
          const nextState = action.type === 'draw'
            ? drawNextCenterCard(candidate)
            : attemptRemoveCard(candidate, action.cardId);
          if (nextState === candidate) {
            valid = false;
            break;
          }
          candidate = nextState;
          actions.push(action.type === 'draw' ? { type: 'draw' } : { type: 'remove', cardId: action.cardId });
        }
      }
      if (valid) {
        state = candidate;
        slot.actions = actions;
      } else {
        message = '무효한 진행 로그가 발견되어 해당 레벨을 처음부터 시작합니다.';
      }
    }
  }
  if (getGameStatus(state) === 'cleared' && !slot.completedLevelIds.includes(targetLevel.id)) {
    slot.completedLevelIds.push(targetLevel.id);
  }
  return { slot, state, levelData: targetLevel, message, futureVersion, writeBlocked };
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

function serializeSlot(slot) {
  if (!isRecord(slot) || slot.schemaVersion !== 1 ||
      typeof slot.currentLevelId !== 'string' || slot.currentLevelId.length > 255 ||
      typeof slot.levelSignature !== 'string' ||
      !Array.isArray(slot.completedLevelIds) || !Array.isArray(slot.actions) ||
      slot.actions.length > 41) throw new Error('Invalid save slot');
  const snapshot = JSON.stringify({
    schemaVersion: 1,
    currentLevelId: slot.currentLevelId,
    levelSignature: slot.levelSignature,
    completedLevelIds: [...new Set(slot.completedLevelIds.filter(id => typeof id === 'string' && id.length <= 255))],
    actions: slot.actions.map(action => {
      if (!isRecord(action)) throw new Error('Invalid action');
      if (action.type === 'draw') return { type: 'draw' };
      if (action.type !== 'remove' || typeof action.cardId !== 'string' ||
          !/^board_(0|[1-9]\d*)$/.test(action.cardId) || action.cardId.length > 16) {
        throw new Error('Invalid action');
      }
      return { type: 'remove', cardId: action.cardId };
    }),
    options: { soundOn: typeof slot.options?.soundOn === 'boolean' ? slot.options.soundOn : true },
    imageRef: cleanImageRef(slot.imageRef)
  });
  if (snapshot.length > MAX_SAVE_LENGTH) throw new Error('Save too large');
  return snapshot;
}

export function createSaveStore(adapter) {
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
              if (Number.isInteger(data?.schemaVersion) && data.schemaVersion > 1) blockWrites = true;
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
        snapshot = serializeSlot(slot);
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
