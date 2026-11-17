import { createFixedGameState, loadLevels } from './levels.js';
import { attemptRemoveCard, getGameStatus, drawNextCenterCard } from './rules.js';
import { calculateReveal } from './reveal.js';
import { updateArtworkMask } from './artwork.js';
import { createTutorialController } from './tutorial.js';
import { playBeep, triggerHaptic, handleImageUpload, getDefaultImageSvg, releaseImage } from './media.js';
import { SAVE_KEY, createLevelSignature, restoreProgress, createLocalStorageAdapter, createSaveStore } from './save.js';
import { loadArtworks, buildCollectionState } from './collection.js';

const tri = document.getElementById('tri');
const hud = document.getElementById('hud');
const statusPanel = document.getElementById('statusPanel');
const saveStatus = document.getElementById('saveStatus');
const imageStatus = document.getElementById('imageStatus');
const preview = document.getElementById('preview');
const artworkGrid = document.getElementById('artwork-grid');
const helpBtn = document.getElementById('helpBtn');
const upload = document.getElementById('upload');
const dealBtn = document.getElementById('dealBtn');
const nextBtn = document.getElementById('nextBtn');
const drawBtn = document.getElementById('drawBtn');
const soundBtn = document.getElementById('soundBtn');
const errorPanel = document.getElementById('errorPanel');
const retryBtn = document.getElementById('retryBtn');

const collectionBtn = document.getElementById('collectionBtn');
const collectionPanel = document.getElementById('collectionPanel');
const collectionHeading = document.getElementById('collectionHeading');
const collectionCountText = document.getElementById('collectionCountText');
const collectionCloseBtn = document.getElementById('collectionCloseBtn');
const collectionError = document.getElementById('collectionError');
const collectionRetryBtn = document.getElementById('collectionRetryBtn');
const collectionDetail = document.getElementById('collectionDetail');
const collectionDetailImg = document.getElementById('collectionDetailImg');
const collectionDetailCaption = document.getElementById('collectionDetailCaption');
const collectionDetailCloseBtn = document.getElementById('collectionDetailCloseBtn');
const collectionGrid = document.getElementById('collectionGrid');
const unlockNotice = document.getElementById('unlockNotice');

const adapter = createLocalStorageAdapter();
const store = createSaveStore(adapter);

let state;
let saveSlot;
let currentImageUrl = getDefaultImageSvg();
let allLevels = [];
let allArtworks = [];
let artworksLoaded = false;
let artworkLoadRevision = 0;
let selectedArtworkId = null;
let collectionLoading = false;
let renderedCollectionSignature = '';
let currentLevelIndex = 0;
let isLoading = false;

let saveRequest = 0;
let saveBlockedMessage = '';

function resolveAssetUrl(assetKey) {
  if (assetKey === 'prototype-default') return getDefaultImageSvg();
  throw new Error('Unsupported collection asset');
}

function saveCurrentProgress() {
  if (saveBlockedMessage) {
    saveStatus.textContent = saveBlockedMessage;
    return;
  }
  const request = ++saveRequest;
  saveStatus.textContent = '저장 중...';
  store.save(SAVE_KEY, saveSlot).then(result => {
    if (request !== saveRequest) return;
    saveStatus.textContent = result.ok
      ? '이 기기에 저장되었습니다.'
      : '저장하지 못했습니다. 이번 진행은 유지되지만 재실행 시 복원되지 않을 수 있습니다.';
  });
}

function renderCollection() {
  const completedIds = saveSlot?.completedLevelIds || [];
  if (!artworksLoaded) {
    collectionBtn.textContent = collectionLoading ? '컬렉션 · 불러오는 중' : '컬렉션 · 불러오기 실패';
    collectionCountText.textContent = collectionLoading ? '불러오는 중' : '목록 확인 필요';
    collectionGrid.replaceChildren();
    collectionDetail.hidden = true;
    renderedCollectionSignature = '';
    return;
  }

  const colState = buildCollectionState(allArtworks, completedIds);
  collectionBtn.textContent = `컬렉션 (${colState.unlockedCount} / ${colState.totalCount})`;
  collectionCountText.textContent = `수집 ${colState.unlockedCount} / ${colState.totalCount}`;
  const signature = JSON.stringify(colState.items);
  if (signature === renderedCollectionSignature) return;
  renderedCollectionSignature = signature;
  const focusedArtworkId = document.activeElement?.dataset?.artId;
  collectionGrid.replaceChildren();
  for (const item of colState.items) {
    if (item.unlocked) {
      const thumbnailButton = document.createElement('button');
      thumbnailButton.type = 'button';
      thumbnailButton.className = 'collection-item';
      thumbnailButton.dataset.artId = item.id;
      thumbnailButton.setAttribute('aria-label', `${item.title}, ${item.levelTitle} 클리어 완료. 큰 보기`);

      const thumb = document.createElement('img');
      thumb.className = 'collection-thumb';
      thumb.src = resolveAssetUrl(item.assetKey);
      thumb.alt = item.title;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'collection-item-title';
      titleSpan.textContent = item.title;

      const subSpan = document.createElement('span');
      subSpan.className = 'collection-item-sub';
      subSpan.textContent = `${item.levelTitle} 클리어 완료`;

      thumbnailButton.append(thumb, titleSpan, subSpan);
      thumbnailButton.onclick = () => {
        selectedArtworkId = item.id;
        collectionDetailImg.src = resolveAssetUrl(item.assetKey);
        collectionDetailImg.alt = item.title;
        collectionDetailCaption.textContent = `${item.title} (${item.levelTitle})`;
        collectionDetail.hidden = false;
        collectionDetailCloseBtn.focus();
      };
      collectionGrid.appendChild(thumbnailButton);
      if (focusedArtworkId === item.id) thumbnailButton.focus();
    } else {
      const card = document.createElement('div');
      card.className = 'collection-item locked';

      const lockTitle = document.createElement('span');
      lockTitle.className = 'collection-item-title';
      lockTitle.textContent = `🔒 #${item.stageNumber} 잠긴 아트`;

      const lockCond = document.createElement('span');
      lockCond.className = 'collection-item-sub';
      lockCond.textContent = `${item.levelTitle} 클리어 시 해금`;

      card.append(lockTitle, lockCond);
      collectionGrid.appendChild(card);
    }
  }

  if (selectedArtworkId) {
    const currentItem = colState.items.find(item => item.id === selectedArtworkId && item.unlocked);
    if (!currentItem) {
      selectedArtworkId = null;
      collectionDetail.hidden = true;
    }
  }
}

async function fetchCollectionCatalog() {
  if (collectionLoading || allLevels.length === 0) return;
  const revision = ++artworkLoadRevision;
  collectionLoading = true;
  collectionRetryBtn.disabled = true;
  if (document.activeElement === collectionRetryBtn && !collectionPanel.hidden) collectionHeading.focus();
  collectionError.hidden = true;
  collectionPanel.setAttribute('aria-busy', 'true');
  renderCollection();
  try {
    const loaded = await loadArtworks(allLevels);
    if (revision !== artworkLoadRevision) return;
    allArtworks = loaded;
    artworksLoaded = true;
    collectionLoading = false;
    renderCollection();
  } catch {
    if (revision !== artworkLoadRevision) return;
    allArtworks = [];
    artworksLoaded = false;
    collectionLoading = false;
    collectionError.hidden = false;
    renderCollection();
  } finally {
    if (revision === artworkLoadRevision) {
      collectionLoading = false;
      collectionRetryBtn.disabled = false;
      collectionPanel.setAttribute('aria-busy', 'false');
    }
  }
}

function render(initialLoad = false) {
  if (!state) return;

  tri.className = `tri ${state.mode}`;
  tri.innerHTML = '';

  state.cards.forEach(card => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `card ${card.color}`;
    button.disabled = card.removed;
    button.style.opacity = card.removed ? 0.12 : 1;
    button.innerHTML = `<span>${card.value}</span><span>${card.suit}</span>`;

    button.onclick = () => {
      tutorial.noteInteraction();
      if (isLoading) return;
      const newState = attemptRemoveCard(state, card.id);
      if (newState !== state) {
        state = newState;
        saveSlot.actions.push({ type: 'remove', cardId: card.id });
        playBeep(280 + card.value * 20, saveSlot.options.soundOn);
        triggerHaptic(saveSlot.options.soundOn);
        checkClearAndSave();
        render();
      }
    };
    tri.appendChild(button);
  });

  const percent = calculateReveal(state.removed, state.totalCards);
  updateArtworkMask(artworkGrid, state, initialLoad);
  preview.alt = `그림 공개: ${percent}%`;

  const levelData = allLevels[currentLevelIndex];
  hud.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = `${currentLevelIndex + 1} / ${allLevels.length} · ${levelData.title}`;
  const details = document.createElement('div');
  details.textContent = `Center Card: ${state.center} | Deck: ${state.deck.length} | Reveal: ${percent}% | ${state.mode === 'boss' ? 'Boss 3x3' : 'Main 5x5'}`;
  hud.append(heading, details);

  const status = getGameStatus(state);
  let statusMsg = '';

  if (status === 'cleared') {
    if (currentLevelIndex >= allLevels.length - 1) {
      statusMsg = '🏆 팩 완료! 모든 스테이지를 클리어했습니다.';
      nextBtn.disabled = true;
    } else {
      statusMsg = '✨ 스테이지 완료!';
      nextBtn.disabled = false;
    }
  } else {
    nextBtn.disabled = true;
    if (status === 'blocked') statusMsg = '진행 불가! Draw를 누르세요.';
    else if (status === 'failed') statusMsg = '💀 실패! 다시하기를 누르세요.';
    else statusMsg = '진행 중...';
  }

  statusPanel.textContent = statusMsg;
  drawBtn.disabled = (status !== 'blocked' || isLoading);
  drawBtn.textContent = `Draw (${state.deck.length})`;
  drawBtn.style.opacity = drawBtn.disabled ? 0.5 : 1;
  drawBtn.style.cursor = drawBtn.disabled ? 'not-allowed' : 'pointer';

  dealBtn.disabled = isLoading;
  soundBtn.textContent = saveSlot.options.soundOn ? 'Sound/Haptic' : 'Muted';
}

function checkClearAndSave() {
  if (getGameStatus(state) === 'cleared' && !saveSlot.completedLevelIds.includes(saveSlot.currentLevelId)) {
    saveSlot.completedLevelIds.push(saveSlot.currentLevelId);
    const unlockedArt = allArtworks.find(art => art.levelId === saveSlot.currentLevelId);
    unlockNotice.textContent = unlockedArt
      ? `🎨 새 아트 해금: ${unlockedArt.title}`
      : '🎨 새로운 컬렉션 아트가 해금되었습니다!';
    renderCollection();
  }
  saveCurrentProgress();
}

function setupLevel(index) {
  if (isLoading || !Number.isInteger(index) || index < 0 || index >= allLevels.length) return;
  unlockNotice.textContent = '';
  currentLevelIndex = index;
  const levelData = allLevels[currentLevelIndex];

  saveSlot.currentLevelId = levelData.id;
  saveSlot.levelSignature = createLevelSignature(levelData);
  saveSlot.actions = [];

  state = createFixedGameState(levelData, { ...saveSlot.options, imageRef: saveSlot.imageRef });

  saveCurrentProgress();
  render(true);
}

async function initGame() {
  if (isLoading) return;
  isLoading = true;
  errorPanel.style.display = 'none';
  statusPanel.textContent = '스테이지를 불러오는 중...';
  for (const control of [dealBtn, nextBtn, drawBtn, soundBtn, upload, retryBtn, helpBtn, collectionBtn]) control.disabled = true;

  try {
    allLevels = await loadLevels();
    const loaded = await store.load(SAVE_KEY);
    const restored = restoreProgress(loaded.rawText, allLevels);
    saveSlot = restored.slot;
    state = restored.state;
    currentLevelIndex = allLevels.findIndex(level => level.id === restored.levelData.id);

    if (restored.writeBlocked || loaded.error) {
      store.disableWrites();
      saveBlockedMessage = loaded.error
        ? '저장 공간에 접근할 수 없어 이번 세션은 저장되지 않습니다.'
        : restored.message;
    }
    saveStatus.textContent = saveBlockedMessage || restored.message;
    imageStatus.textContent = saveSlot.imageRef ? '배경 이미지를 다시 업로드해주세요.' : '';

    isLoading = false;
    soundBtn.disabled = false;
    upload.disabled = false;
    helpBtn.disabled = false;
    collectionBtn.disabled = false;
    render(true);
    retryBtn.disabled = false;

    void fetchCollectionCatalog();
    void tutorial.initialize();
  } catch {
    state = undefined;
    allLevels = [];
    tri.replaceChildren();
    hud.textContent = '';
    statusPanel.textContent = '스테이지를 불러오지 못했습니다.';
    errorPanel.style.display = 'block';
    isLoading = false;
    retryBtn.disabled = false;
  }
}

collectionBtn.onclick = () => {
  tutorial.noteInteraction();
  const willOpen = collectionPanel.hidden;
  collectionPanel.hidden = !willOpen;
  collectionBtn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    renderCollection();
    collectionHeading.focus();
  } else {
    selectedArtworkId = null;
    collectionDetail.hidden = true;
    collectionBtn.focus();
  }
};

collectionCloseBtn.onclick = () => {
  collectionPanel.hidden = true;
  collectionBtn.setAttribute('aria-expanded', 'false');
  selectedArtworkId = null;
  collectionDetail.hidden = true;
  collectionBtn.focus();
};

collectionDetailCloseBtn.onclick = () => {
  const thumbnailButton = Array.from(collectionGrid.children).find(element => element.dataset.artId === selectedArtworkId);
  selectedArtworkId = null;
  collectionDetail.hidden = true;
  (thumbnailButton || collectionHeading).focus();
};

collectionRetryBtn.onclick = () => {
  if (allLevels.length > 0) {
    void fetchCollectionCatalog();
  }
};

retryBtn.onclick = initGame;

dealBtn.onclick = () => {
  tutorial.noteInteraction();
  if (!state || isLoading) return;
  setupLevel(currentLevelIndex);
};

nextBtn.onclick = () => {
  tutorial.noteInteraction();
  if (!state || isLoading || getGameStatus(state) !== 'cleared') return;
  setupLevel(currentLevelIndex + 1);
};

drawBtn.onclick = () => {
  tutorial.noteInteraction();
  if (!state || isLoading) return;
  const newState = drawNextCenterCard(state);
  if (newState !== state) {
    state = newState;
    saveSlot.actions.push({ type: 'draw' });
    checkClearAndSave();
    render();
  }
};

soundBtn.onclick = () => {
  tutorial.noteInteraction();
  if (!state || isLoading) return;
  saveSlot.options.soundOn = !saveSlot.options.soundOn;
  state = { ...state, options: { ...state.options, soundOn: saveSlot.options.soundOn } };
  saveCurrentProgress();
  render();
};

upload.onchange = event => {
  tutorial.noteInteraction();
  const file = event.target.files[0];
  if (!file || !state || isLoading) return;
  handleImageUpload(file, url => {
    currentImageUrl = url;
    preview.src = currentImageUrl;
    imageStatus.textContent = '';
  }, fileRef => {
    saveSlot.imageRef = fileRef;
    state = { ...state, options: { ...state.options, imageRef: fileRef } };
    saveCurrentProgress();
  });
};

const tutorial = createTutorialController({
  adapter,
  getContext: () => ({
    isFirstLevel: currentLevelIndex === 0,
    actions: saveSlot?.actions || [],
    completedLevelIds: saveSlot?.completedLevelIds || []
  }),
  panel: document.getElementById('tutorial-panel'),
  title: document.getElementById('tut-title'),
  description: document.getElementById('tut-desc'),
  nextButton: document.getElementById('tut-next'),
  skipButton: document.getElementById('tut-skip'),
  helpButton: helpBtn,
  notice: document.getElementById('tutorialStatus')
});

preview.src = currentImageUrl;
initGame();

window.addEventListener('pagehide', event => {
  if (!event.persisted) releaseImage();
});
