import { playBeep, triggerHaptic } from '../media.js';
import { createPictureMatchState, loadPictureMatchContent } from './levels.js';
import {
  findHintPair,
  getMatchStatus,
  getProgressCounts,
  selectCard,
  shuffleRemainingCards
} from './rules.js';
import {
  PICTURE_MATCH_SAVE_KEY,
  createEmptyPictureMatchSave,
  createLocalStorageAdapter,
  createPictureMatchSaveStore,
  restorePictureMatchProgress
} from './save.js';

const stageBadge = document.getElementById('stageBadge');
const levelTitleEl = document.getElementById('levelTitle');
const pairCounterEl = document.getElementById('pairCounter');
const statusText = document.getElementById('statusText');
const saveText = document.getElementById('saveText');
const completedPreview = document.getElementById('completedPreview');
const previewTopImg = document.getElementById('previewTopImg');
const previewBottomImg = document.getElementById('previewBottomImg');
const previewCaption = document.getElementById('previewCaption');
const helpPanel = document.getElementById('helpPanel');
const helpHeading = document.getElementById('helpHeading');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const boardGrid = document.getElementById('boardGrid');
const clearOverlay = document.getElementById('clearOverlay');
const clearHeading = document.getElementById('clearHeading');
const clearSummary = document.getElementById('clearSummary');
const clearRestartBtn = document.getElementById('clearRestartBtn');
const clearNextBtn = document.getElementById('clearNextBtn');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const retryLoadBtn = document.getElementById('retryLoadBtn');
const hintBtn = document.getElementById('hintBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const restartBtn = document.getElementById('restartBtn');
const soundBtn = document.getElementById('soundBtn');
const helpBtn = document.getElementById('helpBtn');

const saveStore = createPictureMatchSaveStore(createLocalStorageAdapter());

let manifest = null;
let artworkMap = new Map();
let levels = [];
let currentLevelIndex = 0;
let state = null;
let saveSlot = null;
let isLoading = false;
let artworkFailed = false;
let saveRequestSeq = 0;
let writeBlockedNotice = '';

let hintIds = new Set();
let mismatchIds = new Set();
let hintTimer = null;
let mismatchTimer = null;
let previewTimer = null;

function clearTransientEffects() {
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  if (mismatchTimer) {
    clearTimeout(mismatchTimer);
    mismatchTimer = null;
  }
  hintIds.clear();
  mismatchIds.clear();
}

function hideCompletedPreview() {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  completedPreview.hidden = true;
}

function showCompletedArt(artId) {
  const artwork = artworkMap.get(artId);
  if (!artwork) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTopImg.src = artwork.top;
  previewTopImg.alt = `${artwork.title} 위 조각`;
  previewBottomImg.src = artwork.bottom;
  previewBottomImg.alt = `${artwork.title} 아래 조각`;
  previewCaption.textContent = `${artwork.title} 완성!`;
  completedPreview.hidden = false;
  previewTimer = setTimeout(() => {
    completedPreview.hidden = true;
    previewTimer = null;
  }, 1600);
}

function persistProgress() {
  if (!saveSlot) return;
  if (writeBlockedNotice) {
    saveText.textContent = writeBlockedNotice;
    return;
  }
  const reqId = ++saveRequestSeq;
  saveText.textContent = '저장 중...';
  saveStore.save(PICTURE_MATCH_SAVE_KEY, saveSlot).then(result => {
    if (reqId !== saveRequestSeq) return;
    saveText.textContent = result.ok
      ? '진행 상태가 이 기기에 저장되었습니다.'
      : '저장에 실패했습니다. 다음 변경 시 다시 시도합니다.';
  });
}

function renderBoard() {
  if (!state) return;
  boardGrid.style.setProperty('--cols', String(state.columns));
  if (boardGrid.children.length !== state.cardOrder.length) boardGrid.replaceChildren();
  const cardById = new Map(state.cards.map(card => [card.id, card]));
  const isCleared = getMatchStatus(state) === 'cleared';
  state.cardOrder.forEach((cardId, slotIndex) => {
    const card = cardById.get(cardId);
    const slotDiv = boardGrid.children[slotIndex] || document.createElement('div');
    slotDiv.className = 'pm-slot';
    if (!slotDiv.isConnected) boardGrid.appendChild(slotDiv);
    if (!card || card.removed) {
      slotDiv.classList.add('pm-slot-empty');
      slotDiv.setAttribute('aria-hidden', 'true');
      if (slotDiv.children.length) slotDiv.replaceChildren();
      return;
    }
    slotDiv.removeAttribute('aria-hidden');
    const artwork = artworkMap.get(card.artId);
    const halfLabel = card.half === 'top' ? '위 조각' : '아래 조각';
    let cardButton = slotDiv.querySelector('button');
    if (!cardButton || cardButton.dataset.cardId !== card.id) {
      cardButton = document.createElement('button');
      cardButton.type = 'button';
      cardButton.dataset.cardId = card.id;
      cardButton.setAttribute('aria-label', `${artwork.title} ${halfLabel}`);
      const cardImage = document.createElement('img');
      cardImage.alt = '';
      cardImage.src = card.half === 'top' ? artwork.top : artwork.bottom;
      cardImage.onerror = () => {
        if (!cardImage.isConnected || artworkFailed) return;
        artworkFailed = true;
        clearTransientEffects();
        hideCompletedPreview();
        errorMessage.textContent = '그림을 불러오지 못해 잠시 멈췄습니다. 재시도해 주세요. 저장된 진행은 유지됩니다.';
        errorPanel.hidden = false;
        for (const control of [hintBtn, shuffleBtn, restartBtn, soundBtn, ...boardGrid.querySelectorAll('button')]) control.disabled = true;
        if (boardGrid.contains(document.activeElement)) document.getElementById('errorHeading').focus();
      };
      cardButton.appendChild(cardImage);
      slotDiv.replaceChildren(cardButton);
    }
    cardButton.className = 'pm-card';
    cardButton.classList.toggle('selected', state.selectedCardId === card.id);
    cardButton.classList.toggle('hinted', hintIds.has(card.id));
    cardButton.classList.toggle('mismatch', mismatchIds.has(card.id));
    cardButton.setAttribute('aria-pressed', String(state.selectedCardId === card.id));
    cardButton.disabled = isLoading || artworkFailed || isCleared;
    cardButton.onclick = () => {
      if (isLoading || artworkFailed || getMatchStatus(state) === 'cleared') return;
      handleCardPress(card.id, slotIndex);
    };
  });
}

function focusNearestRemainingSlot(preferredIndex) {
  const buttons = Array.from(boardGrid.querySelectorAll('button.pm-card:not(:disabled)'));
  if (buttons.length === 0) return;
  const targetBtn = buttons[Math.min(preferredIndex, buttons.length - 1)] || buttons[0];
  targetBtn.focus();
}

function handleCardPress(cardId, slotIndex) {
  clearTransientEffects();
  const result = selectCard(state, cardId);
  state = result.state;

  if (result.outcome === 'selected') {
    playBeep(360, state.options.soundOn);
    statusText.textContent = '짝이 되는 반대 조각을 선택하세요.';
    renderBoard();
    const selectedBtn = boardGrid.querySelector(`button[data-card-id="${cardId}"]`);
    if (selectedBtn) selectedBtn.focus();
    return;
  }

  if (result.outcome === 'deselected') {
    playBeep(260, state.options.soundOn);
    statusText.textContent = '선택을 해제했습니다.';
    renderBoard();
    const currentBtn = boardGrid.querySelector(`button[data-card-id="${cardId}"]`);
    if (currentBtn) currentBtn.focus();
    return;
  }

  if (result.outcome === 'mismatch') {
    playBeep(200, state.options.soundOn);
    triggerHaptic(state.options.soundOn);
    mismatchIds.add(cardId);
    statusText.textContent = '서로 다른 화병이거나 같은 방향 조각입니다. 새 카드를 선택했습니다.';
    renderBoard();
    const nextBtnEl = boardGrid.querySelector(`button[data-card-id="${cardId}"]`);
    if (nextBtnEl) nextBtnEl.focus();
    mismatchTimer = setTimeout(() => {
      mismatchIds.clear();
      mismatchTimer = null;
      renderBoard();
    }, 550);
    return;
  }

  if (result.outcome === 'matched') {
    statusText.textContent = '화병을 완성했어요! 남은 짝을 찾아보세요.';
    playBeep(520, state.options.soundOn);
    triggerHaptic(state.options.soundOn);
    saveSlot.removedCardIds = state.cards.filter(card => card.removed).map(card => card.id);
    showCompletedArt(result.matchedPair.artId);

    const isCleared = getMatchStatus(state) === 'cleared';
    if (isCleared && !saveSlot.completedLevelIds.includes(state.levelId)) {
      saveSlot.completedLevelIds.push(state.levelId);
    }

    persistProgress();
    renderAll();

    if (isCleared) {
      clearHeading.focus();
    } else {
      focusNearestRemainingSlot(slotIndex);
    }
  }
}

function renderAll() {
  if (!state || levels.length === 0) return;
  const levelData = levels[currentLevelIndex];
  const counts = getProgressCounts(state);
  const isCleared = getMatchStatus(state) === 'cleared';
  const isLastLevel = currentLevelIndex >= levels.length - 1;

  stageBadge.textContent = `스테이지 ${currentLevelIndex + 1} / ${levels.length}`;
  levelTitleEl.textContent = `${levelData.title} (${state.mode === 'boss' ? '보스 6×6' : `${state.columns}×${state.rows}`})`;
  pairCounterEl.textContent = `완성 ${counts.completedPairs} / ${counts.totalPairs}쌍`;

  hintBtn.disabled = isLoading || artworkFailed || isCleared || counts.remainingCards < 2;
  shuffleBtn.disabled = isLoading || artworkFailed || isCleared || counts.remainingCards < 2;
  restartBtn.disabled = isLoading || artworkFailed;
  soundBtn.disabled = isLoading || artworkFailed;
  soundBtn.textContent = state.options.soundOn ? '사운드·진동 켬' : '사운드·진동 끔';
  soundBtn.setAttribute('aria-pressed', String(state.options.soundOn));

  if (isCleared) {
    clearOverlay.hidden = false;
    if (isLastLevel) {
      clearHeading.textContent = '전체 스테이지 팩 완료!';
      clearSummary.textContent = `모든 화병 ${counts.totalPairs}쌍을 완성했습니다.`;
      clearNextBtn.disabled = true;
      clearNextBtn.textContent = '팩 완료됨';
      statusText.textContent = '모든 스테이지를 클리어했습니다!';
    } else {
      clearHeading.textContent = '스테이지 완성!';
      clearSummary.textContent = `${levelData.title}의 화병 ${counts.totalPairs}쌍을 모두 맞췄습니다.`;
      clearNextBtn.disabled = false;
      clearNextBtn.textContent = '다음 스테이지';
      statusText.textContent = '스테이지를 클리어했습니다! 다음 스테이지로 이동할 수 있습니다.';
    }
  } else {
    clearOverlay.hidden = true;
    if (!statusText.textContent || statusText.textContent.includes('불러오는 중')) {
      statusText.textContent = '같은 화병의 위·아래 조각을 눌러 짝을 맞추세요.';
    }
  }

  renderBoard();
}

function startLevel(index) {
  if (isLoading || artworkFailed || !Number.isInteger(index) || index < 0 || index >= levels.length) return;
  clearTransientEffects();
  hideCompletedPreview();
  currentLevelIndex = index;
  const levelData = levels[currentLevelIndex];
  const preservedCompleted = saveSlot ? [...saveSlot.completedLevelIds] : [];
  const preservedOptions = saveSlot ? { ...saveSlot.options } : { soundOn: true };

  saveSlot = createEmptyPictureMatchSave(levelData);
  saveSlot.completedLevelIds = preservedCompleted;
  saveSlot.options = preservedOptions;

  state = createPictureMatchState(levelData, preservedOptions);
  statusText.textContent = '같은 화병의 위·아래 조각을 눌러 짝을 맞추세요.';
  persistProgress();
  renderAll();
  levelTitleEl.tabIndex = -1;
  levelTitleEl.focus();
}

async function initializeGame() {
  if (isLoading) return;
  isLoading = true;
  artworkFailed = false;
  clearTransientEffects();
  hideCompletedPreview();
  errorPanel.hidden = true;
  clearOverlay.hidden = true;
  statusText.textContent = '스테이지 데이터를 불러오는 중...';

  for (const btn of [hintBtn, shuffleBtn, restartBtn, soundBtn, retryLoadBtn]) {
    btn.disabled = true;
  }

  try {
    const loadedContent = await loadPictureMatchContent();
    manifest = loadedContent.manifest;
    levels = loadedContent.levels;
    artworkMap = new Map(manifest.artworks.map(art => [art.id, art]));

    const loadedSave = await saveStore.load(PICTURE_MATCH_SAVE_KEY);
    const restored = restorePictureMatchProgress(loadedSave.rawText, levels);

    saveSlot = restored.slot;
    state = restored.state;
    currentLevelIndex = levels.findIndex(lvl => lvl.id === restored.levelData.id);
    if (currentLevelIndex < 0) currentLevelIndex = 0;

    if (restored.writeBlocked || loadedSave.error) {
      saveStore.disableWrites();
      writeBlockedNotice = loadedSave.error
        ? '저장 공간에 접근할 수 없어 메모리 모드로 플레이합니다.'
        : restored.message;
    }
    saveText.textContent = writeBlockedNotice || restored.message;
    statusText.textContent = '같은 화병의 위·아래 조각을 눌러 짝을 맞추세요.';

    isLoading = false;
    retryLoadBtn.disabled = false;
    renderAll();
    if (document.activeElement === retryLoadBtn) {
      levelTitleEl.tabIndex = -1;
      levelTitleEl.focus();
    }
  } catch {
    state = null;
    levels = [];
    boardGrid.replaceChildren();
    errorMessage.textContent = '화병 그림 또는 스테이지 데이터를 불러오지 못했습니다.';
    errorPanel.hidden = false;
    statusText.textContent = '로드 오류가 발생했습니다.';
    isLoading = false;
    retryLoadBtn.disabled = false;
  }
}

hintBtn.onclick = () => {
  if (!state || artworkFailed || isLoading || getMatchStatus(state) === 'cleared') return;
  clearTransientEffects();
  const pair = findHintPair(state);
  if (!pair) {
    statusText.textContent = '남은 짝을 찾을 수 없습니다.';
    return;
  }
  hintIds.add(pair[0]);
  hintIds.add(pair[1]);
  playBeep(440, state.options.soundOn);
  statusText.textContent = '표시된 두 조각이 같은 화병의 짝입니다.';
  renderBoard();
  hintTimer = setTimeout(() => {
    hintIds.clear();
    hintTimer = null;
    renderBoard();
  }, 1400);
};

shuffleBtn.onclick = () => {
  if (!state || artworkFailed || isLoading || getMatchStatus(state) === 'cleared') return;
  clearTransientEffects();
  state = shuffleRemainingCards(state, Math.random);
  saveSlot.cardOrder = [...state.cardOrder];
  playBeep(320, state.options.soundOn);
  triggerHaptic(state.options.soundOn);
  statusText.textContent = '남은 카드의 위치를 섞었습니다.';
  persistProgress();
  renderAll();
};

restartBtn.onclick = () => {
  if (!state || artworkFailed || isLoading) return;
  startLevel(currentLevelIndex);
};

clearRestartBtn.onclick = () => {
  if (!state || artworkFailed || isLoading) return;
  startLevel(currentLevelIndex);
};

clearNextBtn.onclick = () => {
  if (!state || artworkFailed || isLoading || getMatchStatus(state) !== 'cleared') return;
  startLevel(currentLevelIndex + 1);
};

soundBtn.onclick = () => {
  if (!state || artworkFailed || isLoading) return;
  const nextSound = !state.options.soundOn;
  state = {
    ...state,
    options: { soundOn: nextSound }
  };
  saveSlot.options.soundOn = nextSound;
  persistProgress();
  renderAll();
};

helpBtn.onclick = () => {
  const willOpen = helpPanel.hidden;
  helpPanel.hidden = !willOpen;
  helpBtn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    helpHeading.focus();
  } else {
    helpBtn.focus();
  }
};

helpCloseBtn.onclick = () => {
  helpPanel.hidden = true;
  helpBtn.setAttribute('aria-expanded', 'false');
  helpBtn.focus();
};

retryLoadBtn.onclick = () => {
  void initializeGame();
};

void initializeGame();
