export const TUTORIAL_KEY = 'picture-blast-solitaire.tutorial';

const steps = [
  { title: '규칙 안내 1/4', description: '중앙 숫자보다 1 크거나 작은 카드를 제거하세요. 1과 13도 이어집니다.' },
  { title: '규칙 안내 2/4', description: '카드를 제거하면 같은 위치의 그림 조각이 드러납니다. 그림을 완성해 보세요.' },
  { title: '규칙 안내 3/4', description: '제거할 카드가 없을 때만 Draw를 쓸 수 있습니다. 남은 덱을 모두 쓰면 다시 도전하세요.' },
  { title: '규칙 안내 4/4', description: '모든 카드를 제거하면 다음 스테이지로 이동합니다. 진행은 이 기기에 저장되며, 저장 안내에서 상태를 확인할 수 있습니다.' }
];

export function createTutorialStore(adapter) {
  let loading;
  let completion;
  let completed = false;
  let blockWrites = false;
  let storageError = false;

  function load() {
    loading ??= (async () => {
      try {
        const raw = await adapter.getItem(TUTORIAL_KEY);
        if (raw !== null && raw !== undefined) {
          if (typeof raw !== 'string' || raw.length > 4096) {
            completed = true;
            blockWrites = true;
          } else {
            try {
              const record = JSON.parse(raw);
              if (record && !Array.isArray(record) && typeof record === 'object') {
                if (Number.isInteger(record.schemaVersion) && record.schemaVersion > 1) {
                  completed = true;
                  blockWrites = true;
                } else if (record.schemaVersion === 1 && record.completed === true) {
                  completed = true;
                }
              }
            } catch {}
          }
        }
      } catch {
        storageError = true;
        blockWrites = true;
      }
      return { completed, blockWrites, storageError };
    })();
    return loading;
  }

  function complete() {
    completed = true;
    completion ??= (async () => {
      await load();
      if (blockWrites) return { ok: false, reason: storageError ? 'storage' : 'version' };
      try {
        await adapter.setItem(TUTORIAL_KEY, JSON.stringify({ schemaVersion: 1, completed: true }));
        return { ok: true };
      } catch {
        return { ok: false, reason: 'storage' };
      }
    })();
    return completion;
  }

  return { load, complete };
}

export function createTutorialController({
  adapter, getContext, panel, title, description, nextButton, skipButton, helpButton, notice
}) {
  const store = createTutorialStore(adapter);
  let activity = 0;
  let autoAttempted = false;
  let step = 0;
  let returnFocus;

  function update() {
    title.textContent = steps[step].title;
    description.textContent = steps[step].description;
    nextButton.textContent = step === steps.length - 1 ? '시작하기' : '다음 설명';
  }

  function open(manual) {
    step = 0;
    returnFocus = manual ? panel.ownerDocument.activeElement : null;
    panel.hidden = false;
    update();
    if (manual) title.focus();
  }

  function finish() {
    activity++;
    const focusInside = panel.contains(panel.ownerDocument.activeElement);
    panel.hidden = true;
    if (focusInside) {
      const target = returnFocus?.isConnected ? returnFocus : helpButton;
      if (!target.disabled) target.focus();
    }
    store.complete().then(result => {
      notice.textContent = result.ok ? '' : result.reason === 'version'
        ? '새 버전의 도움말 기록을 보호합니다. 도움말은 언제든 열 수 있습니다.'
        : '안내 완료를 저장하지 못했습니다. 다음 실행 시 다시 표시될 수 있습니다.';
    });
  }

  nextButton.onclick = () => {
    activity++;
    if (step < steps.length - 1) {
      step++;
      update();
    } else {
      finish();
    }
  };
  skipButton.onclick = finish;
  helpButton.onclick = () => {
    activity++;
    open(true);
  };

  return {
    noteInteraction() {
      activity++;
    },
    async initialize() {
      if (autoAttempted) return;
      autoAttempted = true;
      const revision = activity;
      const record = await store.load();
      if (record.storageError) notice.textContent = '안내 기록에 접근할 수 없어 다음 실행 시 안내가 다시 표시될 수 있습니다.';
      const context = getContext();
      if (revision === activity && !record.completed && context.isFirstLevel &&
          context.actions.length === 0 && context.completedLevelIds.length === 0) open(false);
    }
  };
}
