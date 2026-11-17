# Gemini: 파일 중도 종료와 잘못된 해 경로 수정 — 한 번에 한 파일만 반환

Codex가 두 번째 반환본 9개를 검토했으나 실행 코드에는 적용하지 않았습니다. 아래 자료로 수정하세요. 설명으로 끝내지 말고 완전한 파일을 반환하되, 응답 길이 때문에 잘리는 일을 막기 위해 **이번 응답에는 picture-match-levels.json 한 파일만** 반환하세요. main.js/CSS 등 다른 파일은 이번에 출력하지 마세요.

실제 재현:
- main.js는 if (result.outcome === 에서 끝나 SyntaxError: Unexpected end of input.
- 레벨 JSON은 level_2 solutionSwaps의 card_15 문자열 중간에서 끝나 JSON.parse 실패. level_3 없음.
- CSS는 .pm-btn:focus-visible 선택자에서 끝남.
- 완전한 level_1만 추출해 제출 rules.js로 실행한 결과, 세 수 모두 swapped, 남은 카드 12/12/12. 제공 solutionSwaps로 클리어되지 않음.
- check-repo는 파일 존재만 검사. 레거시 해 경로와 새 팩/PNG 검증이 아직 빠짐.

이번 반환 조건:
1. version=2, ruleset=swap-vertical-v1, 세 레벨을 빠짐없이 담은 JSON 전체.
2. level_1 3열4행12장(그림6종 각1쌍), level_2 6열4행24장(각2쌍), level_3 boss 6열6행36장(각3쌍).
3. 카드 id 유일, 그림별 top/bottom 균형, 시작 세로 짝 없음. 모든 카드 정의를 명시하고 코드로 생성하라는 설명으로 대체하지 말 것.
4. 각 solutionSwaps의 모든 수가 제출된 swapCards API에서 유효하고 최종 board가 전부 null이어야 함. 없어지는 카드를 이후 수에 재사용하지 말 것.
5. 아래 최신 규칙 코드를 그대로 기준으로 실제 해를 검산할 것. 실행 도구가 있으면 반드시 실행하고, 없으면 실행했다고 주장하지 말 것. 해가 성립하지 않는 기존 배열을 복사하지 말 것.
6. JSON 하나를 완전한 코드 블록 하나로 반환하고 마지막 닫는 중괄호까지 포함할 것. 생략/주석/후속 파트 표기는 금지. JSON 출력 전에 긴 설명을 쓰지 말 것.

사용자가 확정한 규칙: 보드 어디의 카드끼리든 교환, 빈칸 이동 금지, 같은 그림 top 바로 아래 bottom이면 제거, 같은 열에서 안정 낙하, 자동 연쇄, 전체 제거하면 클리어. 교환 후 짝이 없어도 유지. 열별 카드 수는 교환으로 유지되고 제거로2씩 감소하므로 짝수 행은 필수.

이번 JSON 다음에 사용자가 계속하라고 하면 다음 순서로 **한 응답당 완전한 파일 하나**를 반환할 것:
A. main.js 전체: 아래 불완전한 파일을 완성하되 pointercancel은 교환하지 않고 취소, 포인터 id 추적/다중입력 거부/lost capture/드래그 임계값, 키보드 교환/이름·선택 상태, 이미지 오류 잠금, 재시작·전환·타이머 취소, 최종 정산 저장, 완료/다음 판/팩 완료/옵션/로딩·재시도 이벤트까지 구현. 슬롯 수와 카드 수를 섞어 비교해 렌더마다 전체 DOM이 삭제되는 기존 구조를 고칠 것.
B. CSS 전체: 잘린 끝 복구, 모바일 그림 비율과 보드 높이, 포커스와 모션 감소. body 전역 제스처 차단 금지.
C. levels.js 전체: 아래 코드에 기본 URL 복구, 비어 있지 않은 팩/행 짝수/크기 상한/제목·mode·카드id·solution tuple 검증 강화. 기존 manifest/이미지 사전 검증 보존.
D. rules.js 전체: board를 진실 공급원으로 진행 수 계산. 준비 힌트가 헛돌거나 null이 되는 상태를 검증. 취소와 빈칸 거부를 유지.
E. save.js 전체: removedCardIds는 저장하지 말고 보드에서 계산, 기존 저장 보호와 직렬 쓰기 유지.
F. check-repo.mjs 전체: 아래 실제 저장소 원본의 레거시·PNG 검사를 보존하고 새 팩/해 검증을 추가. 파일 존재만 검사하는 버전 금지.
G. 별도 Node assert 테스트: 실제 모든 해 경로, 연쇄/방향/빈칸/불변성/저장 오류/보호를 검증. 실행 여부는 정직하게 표시.

기존 로컬 manifest/PNG는 재사용하고 새 서비스/패키지/SDK/외부 전송은 추가하지 마세요. 최신 명세와 원본을 아래에 포함합니다. 과거 클릭 규칙/불완전 반환본은 수정 자료이며 정답이 아닙니다.

## SOURCE: docs/PICTURE_SWAP_SPEC.md
````
# 카드 교환·세로 완성·낙하 규칙

2026-11-17 사용자 정정 반영. 현재 실행 코드는 아직 이전 클릭 제거 방식입니다. 이 문서가 이전 PICTURE_MATCH_SPEC.md보다 우선합니다. 구현·신규 QA는 미완료입니다. Gemini가 큰 구현을 맡고 Codex가 검토·적용·검증합니다.

## 사용자 확정 규칙

- 드래그해서 카드 위치를 맞바꿉니다. 보드 어디에 있는 카드와도 교환할 수 있습니다.
- 카드가 있는 칸끼리만 교환합니다. 빈칸으로 이동할 수 없습니다.
- 같은 그림의 위 조각이 위에, 아래 조각이 바로 아래에 놓여 세로로 완성되면 두 장을 제거합니다.
- 남은 카드는 같은 열에서 아래로 내려오고 모든 카드를 제거하면 클리어입니다.
- 단순히 그림 두 장을 선택했다는 이유로 제거하는 이전 동작은 폐기합니다.

## 구현 기본값

- 짝이 생기지 않는 교환도 유지합니다. 시간·이동 횟수 제한이나 카드 보충은 없습니다.
- 같은 artId의 top 바로 아래 bottom만 완성입니다. 가로·대각선·역방향·행 경계 인덱스 이웃은 완성이 아닙니다. 같은 그림의 복사본은 내부 pairId로 제한하지 않습니다.
- 성립하는 모든 세로 짝을 동시에 제거하고, 열마다 남은 카드의 상대 순서를 보존해 바닥으로 내립니다. 낙하 후 생긴 짝도 반복 제거해 안정화합니다. 각 카드는 한 번만 제거하며 열 이동·가로 압축은 없습니다.
- 자기 자신·빈칸·보드 밖 드롭과 드래그 취소는 상태/저장을 바꾸지 않습니다. 키보드로 두 카드를 고르는 경우에도 동일한 교환 API를 사용합니다.
- 교환·제거·낙하·연쇄는 불변 순수 함수로 계산합니다. DOM·오디오·저장·전역 RNG에 의존하지 않습니다. 애니메이션은 계산 결과만 표시하고, 정산 중 추가 보드 입력은 차단합니다.
- 전체 연쇄의 최종 상태를 커밋하고 저장한 뒤 연출합니다. 연출 중 재시작/레벨 전환 시 이전 포인터·타이머·콜백을 취소하고 새 판을 덮지 않게 합니다. 새로고침 시 중간 상태가 복원되어서는 안 됩니다.

## 열의 짝수 조건과 레벨

교환은 열별 카드 수를 보존하고 제거는 한 열에서 두 장씩 줄입니다. 따라서 홀수 장으로 시작한 열은 비울 수 없습니다. 기존 4열×3행 첫 판을 새 규칙에서 재사용하지 않습니다.

- level_1: main, **3열×4행**, 12장/6쌍, 화병 6종 한 쌍씩.
- level_2: main, 6열×4행, 24장/12쌍, 화병 6종 두 쌍씩.
- level_3: boss, 6열×6행, 36장/18쌍, 화병 6종 세 쌍씩.
- 레벨 팩은 version=2, ruleset='swap-vertical-v1'. 모든 칸이 찬 고정 배치이며 시작부터 완성된 세로 짝이 없어야 합니다. 재시작은 원본 배치로 돌아갑니다.
- 카드 정의는 {id,artId,half:'top'|'bottom'}. 유일 id, 타입·크기·짝수 행 수, 그림별 top/bottom 균형, manifest 참조를 검증합니다.
- 각 레벨에 solutionSwaps:[[cardIdA,cardIdB],...]를 제공하고 실제 런타임 교환·연쇄 API로 끝까지 재생해 빈 판을 증명합니다. 사라진 카드·동일 카드·무효 교환이 포함된 해는 거부합니다. 기존 임의 두 조각 제거용 generateClearSequence는 새 규칙의 해가 아닙니다.
- 초기 짝수 조건이 지켜지면 도달 가능한 정상 판에 열당 한 장만 남는 상황은 생기지 않습니다. 복원에서도 열별 짝수 조건을 검사합니다. 한 수로 제거할 수 없다는 이유만으로 실패 처리하지 않습니다. 준비 교환이 필요할 수 있습니다.

## 상태·힌트·화면

- 불변 카드 정의와 길이 columns*rows의 row-major 슬롯 배열을 분리합니다. 슬롯은 카드 id 또는 null입니다. removed 플래그와 보드를 중복 진실 공급원으로 두지 않고 진행 수/상태는 보드에서 파생합니다.
- 힌트는 실제 교환할 두 카드를 안내합니다. 즉시 제거하는 수를 우선하고, 준비 교환이라면 그 의미를 정확히 안내합니다. 탐색은 유한하며 모바일 화면을 멈추지 않아야 합니다. 힌트 자체는 상태/저장을 바꾸지 않습니다.
- 이번 수정에서는 기존 무료 '섞기'를 UI와 동작에서 제거합니다. 섞기 복구/해 보장 정책은 별도 설계합니다. 무료 힌트와 다시하기는 유지합니다. 빈칸 이동이나 열간 재분배로 규칙을 우회하지 않습니다.
- 첫 안내: '카드를 드래그해 자리를 바꾸세요. 위·아래 그림이 세로로 완성되면 사라집니다.' 도움말에 빈칸 이동 불가를 표시합니다.
- Pointer Events로 마우스·터치, 임계값, capture/lost capture/cancel, 보드 밖/빈칸 드롭, 다중 포인터를 처리합니다. 실제 DOM 경계로 드롭 대상을 판별합니다. 미리보기는 레이아웃을 밀지 않습니다. 보드 밖 스크롤은 허용합니다.
- 키보드 포커스·선택 안내·대체 텍스트·상태 알림·모션 감소·사운드/햅틱 옵션을 유지합니다. 375×812와 데스크톱에서 가로 넘침 없이 실제 그림을 식별하게 합니다. 확대를 차단하지 않습니다.
- 기존 manifest와 화병 6종 PNG12장(각128×176)을 재사용합니다. 이미지 실패 시 재시도 안내/입력 잠금/기존 저장 보호를 유지합니다. reference-vases는 사용자 스크린샷 가공본이며 releaseApproved:false를 유지합니다. 출시용 아트는 별도 필요합니다. 외부 이미지·폰트·CDN은 추가하지 않습니다.

## 저장과 기존 게임 보존

- 새 키 **picture-blast-solitaire.picture-swap.save**, schemaVersion=1, ruleset='swap-vertical-v1'를 사용합니다. 이전 picture-match.save와 숫자 게임 save/tutorial 키는 이관·수정·삭제하지 않습니다. 이전 클릭 게임 클리어를 새 완료로 인정하지 않습니다.
- 필드: currentLevelId, levelSignature(규칙·크기·mode·원본 배치), completedLevelIds, board(카드id/null), options:{soundOn}. 안정된 최종 판만 저장합니다. 드래그/선택/힌트/연출/이미지 바이너리/Blob URL/구매 권한은 저장하지 않습니다.
- 보드 길이·유효하고 유일한 남은 id·제거된 그림별 top/bottom 균형·열별 짝수 카드 수·바닥 밀착·미해결 세로 짝 없음·ruleset/signature를 검사합니다. 완료 id는 현 레벨 whitelist로 정규화하며 중복 완료 알림을 방지합니다.
- 시작 복원만으로 저장하지 않습니다. 미래 버전/100KB 초과/읽기 거부는 쓰기를 차단하고 메모리로 플레이합니다. 손상된 현재 버전/signature 불일치는 안내 후 현 판을 초기화합니다. 쓰기는 요청 시점 스냅샷을 직렬화하고 실패하면 다음 변경에서 재시도합니다. 완료 기록과 판은 같은 스냅샷으로 저장합니다.
- legacy-solitaire.html 및 숫자 게임 js/main.js/rules.js/save.js/levels.js/tutorial.js/collection.js 등은 변경하지 않습니다. picture-match 디렉터리의 현재 게임을 수정합니다. 컬렉션/업로드 연결은 계속 보류합니다.

## 제출과 검증

- HubGame·상점·광고·IAP·랭킹·클라우드·Firebase·분석·SDK·의존성·외부 전송을 추가하지 않습니다. 제공되지 않은 game-studio.md 등을 읽었다고 주장하지 않습니다.
- 변경 파일별 전체 코드를 코드 블록으로 반환합니다. 생략/기존과 동일 표기는 금지합니다. PNG를 재출력할 필요는 없습니다. 기존 Node assert 기반의 별도 테스트 코드와 실행 여부를 제공합니다.
- check-repo에서 레거시/PNG 검사를 유지하며 새 팩 버전·짝수 조건·시작 짝 부재·solutionSwaps 재생을 검사합니다. dev-server/build는 필요한 경우에만 수정합니다.
- 자동 검사: 원거리 교환, 빈칸/자기/무효 교환 거부, 가로/역방향/행 경계 오매칭 거부, 동시 제거, 안정 낙하, 다단계 연쇄, 복사본 교차 완성, 입력 불변성, 열 짝수/그림 균형 보존, 힌트 비파괴/합법성, 전 레벨 해 재생, 저장 왕복/손상/미래/과대/거부/직렬화와 이전 키 보존.
- 브라우저 검사: 실제 드래그/원거리 교환, 터치/키보드, 취소/빈칸/보드 밖/다중 입력, 연출 중 재시작·전환·새로고침, 힌트, 전 레벨 클리어, 이미지 실패, 모바일/모션 감소. Node 통과를 실제 터치 검증으로 표시하지 않습니다.
- 이전 PICTURE_MATCH_QA.md는 폐기된 클릭 규칙의 역사 기록입니다. 새 규칙 QA는 별도 기록하고 미실행 검사를 완료로 표시하지 않습니다. iOS 네이티브 검증은 Mac 단계입니다.

````

## SOURCE: submitted/rules.js
````
export function canMatch(topCard, bottomCard) {
  if (!topCard || !bottomCard) return false;
  return topCard.artId === bottomCard.artId && topCard.half === 'top' && bottomCard.half === 'bottom';
}

export function settleBoard(board, columns, rows, cardsMap) {
  let currentBoard = [...board];
  let changed = false;
  let matchLog = [];

  while (true) {
    let loopChanged = false;
    for (let c = 0; c < columns; c++) {
      let writeRow = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        const idx = r * columns + c;
        if (currentBoard[idx] !== null) {
          if (writeRow !== r) {
            currentBoard[writeRow * columns + c] = currentBoard[idx];
            currentBoard[idx] = null;
            loopChanged = true;
          }
          writeRow--;
        }
      }
    }
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < rows - 1; r++) { 
        const topIdx = r * columns + c;
        const botIdx = (r + 1) * columns + c;
        const topId = currentBoard[topIdx];
        const botId = currentBoard[botIdx];
        if (topId && botId) {
          const tCard = cardsMap.get(topId);
          const bCard = cardsMap.get(botId);
          if (canMatch(tCard, bCard)) {
            currentBoard[topIdx] = null;
            currentBoard[botIdx] = null;
            matchLog.push([topId, botId]);
            loopChanged = true;
            r++; 
          }
        }
      }
    }
    if (loopChanged) changed = true;
    else break;
  }
  return { board: currentBoard, changed, matchLog };
}

export function swapCards(state, idA, idB) {
  if (!idA || !idB || idA === idB || typeof idA !== 'string' || typeof idB !== 'string') {
    return { state, outcome: 'invalid' };
  }
  const idxA = state.board.indexOf(idA);
  const idxB = state.board.indexOf(idB);
  
  if (idxA === -1 || idxB === -1) {
    return { state, outcome: 'invalid' };
  }

  const newBoard = [...state.board];
  newBoard[idxA] = idB;
  newBoard[idxB] = idA;

  const settleResult = settleBoard(newBoard, state.columns, state.rows, state.cardsMap);
  const removedSet = new Set(state.removedCardIds);
  settleResult.matchLog.forEach(pair => {
    removedSet.add(pair[0]);
    removedSet.add(pair[1]);
  });

  return {
    state: {
      ...state,
      board: settleResult.board,
      removedCardIds: [...removedSet],
      selectedCardId: null
    },
    outcome: settleResult.changed ? 'matched' : 'swapped',
    matchLog: settleResult.matchLog
  };
}

export function getHint(state) {
  const activeIds = state.board.filter(id => id !== null);
  
  for (let i = 0; i < activeIds.length; i++) {
    for (let j = i + 1; j < activeIds.length; j++) {
      const idA = activeIds[i];
      const idB = activeIds[j];
      const testBoard = [...state.board];
      const idxA = testBoard.indexOf(idA);
      const idxB = testBoard.indexOf(idB);
      testBoard[idxA] = idB;
      testBoard[idxB] = idA;
      
      const settleResult = settleBoard(testBoard, state.columns, state.rows, state.cardsMap);
      if (settleResult.matchLog.length > 0) {
        return { type: 'immediate', pair: [idA, idB] };
      }
    }
  }

  for (const id of activeIds) {
    const card = state.cardsMap.get(id);
    const targetHalf = card.half === 'top' ? 'bottom' : 'top';
    const pairCard = activeIds.find(pid => {
      const pc = state.cardsMap.get(pid);
      return pc.artId === card.artId && pc.half === targetHalf;
    });
    if (pairCard) {
      const idxA = state.board.indexOf(id);
      const idxB = state.board.indexOf(pairCard);
      const colA = idxA % state.columns;
      const colB = idxB % state.columns;
      if (colA !== colB) {
        for (let r = 0; r < state.rows; r++) {
          const targetIdx = r * state.columns + colB;
          const swapTargetId = state.board[targetIdx];
          if (swapTargetId && swapTargetId !== pairCard) {
            return { type: 'prep', pair: [id, swapTargetId] };
          }
        }
      }
    }
  }
  return null;
}

export function getMatchStatus(state) {
  return state.board.every(id => id === null) ? 'cleared' : 'playing';
}

export function getProgressCounts(state) {
  const totalPairs = Math.floor(state.cards.length / 2);
  const completedPairs = Math.floor(state.removedCardIds.length / 2);
  return {
    completedPairs,
    totalPairs,
    remainingCards: state.cards.length - state.removedCardIds.length
  };
}
````

## SOURCE: submitted/levels.js
````
import { swapCards, getMatchStatus, settleBoard } from './rules.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeRelativeAsset(assetPath) {
  return typeof assetPath === 'string' && assetPath.length <= 240 &&
    /^\.\/assets\/picture-match\/[a-zA-Z0-9_/-]+\.png$/.test(assetPath) &&
    !assetPath.includes('..') && assetPath.endsWith('.png');
}

export function parseArtworkManifest(rawData) {
  if (!isRecord(rawData) || rawData.version !== 1 || !Array.isArray(rawData.artworks) ||
      rawData.artworks.length === 0 || rawData.artworks.length > 100 ||
      rawData.releaseApproved !== false || rawData.halfWidth !== 128 || rawData.halfHeight !== 176) {
    throw new Error('Invalid picture-match artwork manifest');
  }
  const seenIds = new Set();
  const artworks = rawData.artworks.map(entry => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 80 ||
        !/^[a-zA-Z0-9_-]+$/.test(entry.id) || typeof entry.title !== 'string' || !entry.title.trim() ||
        entry.title.length > 100 || !isSafeRelativeAsset(entry.top) || !isSafeRelativeAsset(entry.bottom)) {
      throw new Error('Invalid artwork entry in manifest');
    }
    if (seenIds.has(entry.id)) throw new Error(`Duplicate artwork id: ${entry.id}`);
    seenIds.add(entry.id);
    return { id: entry.id, title: entry.title, top: entry.top, bottom: entry.bottom };
  });

  return {
    version: 1,
    releaseApproved: rawData.releaseApproved === true,
    halfWidth: rawData.halfWidth, halfHeight: rawData.halfHeight,
    artworks
  };
}

export function parsePictureMatchLevels(rawData, manifest) {
  if (!isRecord(rawData) || rawData.version !== 2 || rawData.ruleset !== 'swap-vertical-v1' || !Array.isArray(rawData.levels)) {
    throw new Error('Invalid picture-swap levels pack (requires version 2, swap-vertical-v1)');
  }
  const validArtIds = new Set(manifest.artworks.map(art => art.id));
  const usedLevelIds = new Set();
  
  return rawData.levels.map(level => {
    if (!isRecord(level) || typeof level.id !== 'string' || !level.id.trim() || !/^[a-zA-Z0-9_-]+$/.test(level.id)) {
      throw new Error('Invalid level identity');
    }
    if (usedLevelIds.has(level.id)) throw new Error(`Duplicate level id: ${level.id}`);
    usedLevelIds.add(level.id);

    if (!Number.isInteger(level.columns) || level.columns < 2 || !Number.isInteger(level.rows) || level.rows < 2) {
      throw new Error(`Invalid grid dimensions: ${level.id}`);
    }
    const expectedCount = level.columns * level.rows;
    if (expectedCount % 2 !== 0 || !Array.isArray(level.cards) || level.cards.length !== expectedCount) {
      throw new Error(`Invalid card count in level: ${level.id}`);
    }

    const cardsMap = new Map();
    const balanceByArt = new Map();
    
    level.cards.forEach((card) => {
      if (!isRecord(card) || typeof card.id !== 'string' || !validArtIds.has(card.artId) || 
          (card.half !== 'top' && card.half !== 'bottom')) {
        throw new Error(`Invalid card in level: ${level.id}`);
      }
      if (cardsMap.has(card.id)) throw new Error(`Duplicate card id: ${card.id}`);
      cardsMap.set(card.id, card);
      
      const counts = balanceByArt.get(card.artId) || { top: 0, bottom: 0 };
      counts[card.half] += 1;
      balanceByArt.set(card.artId, counts);
    });

    for (const [artId, counts] of balanceByArt.entries()) {
      if (counts.top !== counts.bottom) throw new Error(`Unbalanced top/bottom for ${artId} in ${level.id}`);
    }

    const normalizedLevel = {
      id: level.id, title: level.title, mode: level.mode,
      columns: level.columns, rows: level.rows,
      cards: level.cards, solutionSwaps: level.solutionSwaps
    };

    const initialBoard = normalizedLevel.cards.map(c => c.id);
    const initialSettle = settleBoard(initialBoard, level.columns, level.rows, cardsMap);
    if (initialSettle.changed) throw new Error(`Level ${level.id} starts with already-completed matches`);

    verifySolutionSequence(normalizedLevel, cardsMap);
    return normalizedLevel;
  });
}

function verifySolutionSequence(level, cardsMap) {
  let state = {
    columns: level.columns, rows: level.rows, cards: level.cards, cardsMap: cardsMap,
    board: level.cards.map(c => c.id), removedCardIds: []
  };
  if (!Array.isArray(level.solutionSwaps)) throw new Error(`Missing solution for ${level.id}`);
  for (const [idA, idB] of level.solutionSwaps) {
    const result = swapCards(state, idA, idB);
    if (result.outcome === 'invalid') throw new Error(`Invalid swap ${idA}<->${idB} in solution of ${level.id}`);
    state = result.state;
  }
  if (getMatchStatus(state) !== 'cleared') throw new Error(`Provided solutionSwaps do not clear level ${level.id}`);
}

export function createPictureMatchState(levelData, previousOptions = null) {
  const cardsMap = new Map(levelData.cards.map(c => [c.id, c]));
  return {
    levelId: levelData.id, mode: levelData.mode, columns: levelData.columns, rows: levelData.rows,
    cards: levelData.cards, cardsMap: cardsMap,
    board: levelData.cards.map(c => c.id),
    removedCardIds: [], selectedCardId: null,
    options: { soundOn: typeof previousOptions?.soundOn === 'boolean' ? previousOptions.soundOn : true }
  };
}

export async function loadPictureMatchContent(manifestUrl, levelsUrl) {
  const [manifestRes, levelsRes] = await Promise.all([ fetch(manifestUrl), fetch(levelsUrl) ]);
  if (!manifestRes.ok || !levelsRes.ok) throw new Error('Failed to load resources');
  const manifest = parseArtworkManifest(await manifestRes.json());
  const levels = parsePictureMatchLevels(await levelsRes.json(), manifest);
  await Promise.all(manifest.artworks.flatMap(art => [art.top, art.bottom]).map(loadArtworkImage));
  return { manifest, levels };
}

function loadArtworkImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => finish(new Error('Artwork timeout')), 12000);
    function finish(err) { clearTimeout(timer); img.onload = null; img.onerror = null; err ? reject(err) : resolve(); }
    img.onload = () => { if (img.naturalWidth !== 128 || img.naturalHeight !== 176) finish(new Error('Invalid size')); else finish(); };
    img.onerror = () => finish(new Error('Artwork unavailable'));
    img.src = new URL(source, new URL('../../', import.meta.url)).href;
  });
}
````

## SOURCE: submitted/save.js
````
import { createPictureMatchState } from './levels.js';
import { getMatchStatus, settleBoard } from './rules.js';

export const PICTURE_SWAP_SAVE_KEY = 'picture-blast-solitaire.picture-swap.save';
export const MAX_SAVE_LENGTH = 100000;

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function createPictureMatchSignature(levelData) {
  return JSON.stringify({
    rules: 'swap-vertical-v1', mode: levelData.mode, columns: levelData.columns, rows: levelData.rows,
    cards: levelData.cards.map(card => ({ id: card.id, artId: card.artId, half: card.half })),
    board: levelData.cards.map(card => card.id)
  });
}

export function createEmptyPictureMatchSave(levelData) {
  return {
    schemaVersion: 1, ruleset: 'swap-vertical-v1', currentLevelId: levelData.id,
    levelSignature: createPictureMatchSignature(levelData),
    completedLevelIds: [], board: [...levelData.cards.map(c => c.id)],
    removedCardIds: [], options: { soundOn: true }
  };
}

function validateSavedBoard(board, targetLevel) {
  if (!Array.isArray(board) || board.length !== targetLevel.columns * targetLevel.rows) return null;
  const validIds = new Set(targetLevel.cards.map(c => c.id));
  const seenIds = new Set();
  const countsByCol = new Array(targetLevel.columns).fill(0);
  let resolvedIds = [];

  for (let r = 0; r < targetLevel.rows; r++) {
    for (let c = 0; c < targetLevel.columns; c++) {
      const id = board[r * targetLevel.columns + c];
      if (id !== null) {
        if (typeof id !== 'string' || !validIds.has(id) || seenIds.has(id)) return null;
        seenIds.add(id);
        countsByCol[c]++;
        resolvedIds.push(id);
      }
    }
  }

  for (const count of countsByCol) {
    if (count % 2 !== 0) return null; // 짝수 조건
  }

  const cardsMap = new Map(targetLevel.cards.map(c => [c.id, c]));
  const settleResult = settleBoard(board, targetLevel.columns, targetLevel.rows, cardsMap);
  if (settleResult.changed) return null; // 낙하 불안정 또는 미해결 짝 존재

  const removedIds = targetLevel.cards.map(c => c.id).filter(id => !seenIds.has(id));
  const removedTopBottom = new Map();
  for (const rid of removedIds) {
    const card = cardsMap.get(rid);
    const stat = removedTopBottom.get(card.artId) || { top: 0, bottom: 0 };
    stat[card.half]++;
    removedTopBottom.set(card.artId, stat);
  }
  for (const stat of removedTopBottom.values()) {
    if (stat.top !== stat.bottom) return null; // 위아래 짝 균형
  }

  return { board: [...board], removedCardIds: removedIds };
}

export function restorePictureMatchProgress(rawText, levels) {
  let parsed = null;
  let message = '';
  let futureVersion = false;
  let writeBlocked = false;

  if (rawText !== null && rawText !== undefined) {
    if (typeof rawText !== 'string' || rawText.length > MAX_SAVE_LENGTH) {
      writeBlocked = true; message = '저장 데이터가 너무 크거나 읽을 수 없어 쓰기를 차단합니다.';
    } else {
      try {
        const candidate = JSON.parse(rawText);
        if (!isRecord(candidate)) throw new Error('Invalid record');
        if (candidate.schemaVersion > 1 || candidate.ruleset !== 'swap-vertical-v1') {
          futureVersion = true; writeBlocked = true;
          message = '상위 버전/다른 규칙의 데이터입니다. 기존 데이터를 보호합니다.';
        } else if (candidate.schemaVersion === 1) {
          parsed = candidate;
        }
      } catch {
        message = '저장 데이터 손상으로 초기화합니다.';
      }
    }
  }

  const validLevelIds = new Set(levels.map(level => level.id));
  const completed = Array.isArray(parsed?.completedLevelIds)
    ? [...new Set(parsed.completedLevelIds.filter(id => validLevelIds.has(id)))] : [];
  
  const options = { soundOn: typeof parsed?.options?.soundOn === 'boolean' ? parsed.options.soundOn : true };
  const targetLevel = levels.find(level => level.id === parsed?.currentLevelId) || levels.find(l => !completed.includes(l.id)) || levels[levels.length - 1];
  if (parsed && targetLevel.id !== parsed.currentLevelId) message = '저장된 스테이지를 찾을 수 없습니다.';

  const slot = createEmptyPictureMatchSave(targetLevel);
  slot.completedLevelIds = completed;
  slot.options = options;
  let state = createPictureMatchState(targetLevel, options);

  if (parsed && parsed.currentLevelId === targetLevel.id) {
    if (parsed.levelSignature !== slot.levelSignature) {
      message = '스테이지 규칙이나 구성이 변경되어 진행이 초기화되었습니다.';
    } else {
      const validated = validateSavedBoard(parsed.board, targetLevel);
      if (validated) {
        slot.board = validated.board;
        slot.removedCardIds = validated.removedCardIds;
        state.board = validated.board;
        state.removedCardIds = validated.removedCardIds;
      } else {
        message = '보드 배치 무결성 검증 실패로 현재 판을 초기화했습니다.';
      }
    }
  }
  return { slot, state, levelData: targetLevel, message, futureVersion, writeBlocked };
}

export function createLocalStorageAdapter() {
  return {
    async getItem(key) { return globalThis.localStorage.getItem(key); },
    async setItem(key, value) { globalThis.localStorage.setItem(key, value); }
  };
}

export function createPictureMatchSaveStore(adapter) {
  let queue = Promise.resolve();
  let blockWrites = false;
  return {
    async load(key) {
      await queue;
      try {
        const rawText = await adapter.getItem(key);
        return { rawText: rawText ?? null, error: false };
      } catch {
        blockWrites = true; return { rawText: null, error: true };
      }
    },
    save(key, slot) {
      if (blockWrites) return Promise.resolve({ ok: false, reason: 'blocked' });
      const snap = JSON.stringify(slot);
      queue = queue.then(async () => {
        if (blockWrites) return { ok: false, reason: 'blocked' };
        try { await adapter.setItem(key, snap); return { ok: true }; } catch { return { ok: false, reason: 'storage' }; }
      });
      return queue;
    },
    disableWrites() { blockWrites = true; }
  };
}
````

## SOURCE: submitted/main.js (INCOMPLETE)
````
import { playBeep, triggerHaptic } from '../media.js';
import { createPictureMatchState, loadPictureMatchContent } from './levels.js';
import { swapCards, getHint, getMatchStatus, getProgressCounts } from './rules.js';
import { PICTURE_SWAP_SAVE_KEY, createEmptyPictureMatchSave, createLocalStorageAdapter, createPictureMatchSaveStore, restorePictureMatchProgress } from './save.js';

const boardGrid = document.getElementById('boardGrid');
const statusText = document.getElementById('statusText');
const saveText = document.getElementById('saveText');
const completedPreview = document.getElementById('completedPreview');
const previewTopImg = document.getElementById('previewTopImg');
const previewBottomImg = document.getElementById('previewBottomImg');
const previewCaption = document.getElementById('previewCaption');
const helpPanel = document.getElementById('helpPanel');
const helpHeading = document.getElementById('helpHeading');
const helpBtn = document.getElementById('helpBtn');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const clearOverlay = document.getElementById('clearOverlay');
const clearHeading = document.getElementById('clearHeading');
const clearSummary = document.getElementById('clearSummary');
const clearRestartBtn = document.getElementById('clearRestartBtn');
const clearNextBtn = document.getElementById('clearNextBtn');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const retryLoadBtn = document.getElementById('retryLoadBtn');
const hintBtn = document.getElementById('hintBtn');
const restartBtn = document.getElementById('restartBtn');
const soundBtn = document.getElementById('soundBtn');

const stageBadge = document.getElementById('stageBadge');
const levelTitleEl = document.getElementById('levelTitle');
const pairCounterEl = document.getElementById('pairCounter');

const saveStore = createPictureMatchSaveStore(createLocalStorageAdapter());
let state, saveSlot, manifest = null, artworkMap = new Map(), levels = [], currentLevelIndex = 0;
let isLoading = false, artworkFailed = false, saveRequestSeq = 0, writeBlockedNotice = '';
let hintIds = new Set();
let hintTimer = null, previewTimer = null;
let draggedCardId = null, pointerDownEl = null;
let animationLock = false;

function clearTransientEffects() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  hintIds.clear();
}

function hideCompletedPreview() {
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  completedPreview.hidden = true;
}

function showCompletedArt(artId) {
  const artwork = artworkMap.get(artId);
  if (!artwork) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTopImg.src = artwork.top;
  previewBottomImg.src = artwork.bottom;
  previewCaption.textContent = `${artwork.title} 완성!`;
  completedPreview.hidden = false;
  previewTimer = setTimeout(() => { completedPreview.hidden = true; previewTimer = null; }, 1600);
}

function persistProgress() {
  if (!saveSlot) return;
  if (writeBlockedNotice) { saveText.textContent = writeBlockedNotice; return; }
  const reqId = ++saveRequestSeq;
  saveText.textContent = '저장 중...';
  saveStore.save(PICTURE_SWAP_SAVE_KEY, saveSlot).then(result => {
    if (reqId === saveRequestSeq) saveText.textContent = result.ok ? '저장됨' : '저장 실패. 추후 재시도합니다.';
  });
}

function renderBoard() {
  if (!state) return;
  boardGrid.style.setProperty('--cols', String(state.columns));
  boardGrid.style.setProperty('--rows', String(state.rows));
  
  const expectedSlots = state.columns * state.rows;
  if (boardGrid.children.length !== expectedSlots) {
    boardGrid.replaceChildren();
    for (let i = 0; i < expectedSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'pm-slot-empty';
      const col = i % state.columns;
      const row = Math.floor(i / state.columns);
      slot.style.left = `calc(${col} * (100% / var(--cols)))`;
      slot.style.top = `calc(${row} * (100% / var(--rows)))`;
      boardGrid.appendChild(slot);
    }
  }

  const existingCards = new Map();
  Array.from(boardGrid.querySelectorAll('.pm-card')).forEach(cardEl => {
    existingCards.set(cardEl.dataset.cardId, cardEl);
  });

  const currentIds = new Set(state.board.filter(id => id !== null));
  existingCards.forEach((cardEl, id) => {
    if (!currentIds.has(id)) cardEl.remove();
  });

  state.board.forEach((cardId, slotIndex) => {
    if (!cardId) return;
    const card = state.cardsMap.get(cardId);
    const col = slotIndex % state.columns;
    const row = Math.floor(slotIndex / state.columns);
    
    let cardBtn = existingCards.get(cardId);
    if (!cardBtn) {
      cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'pm-card';
      cardBtn.dataset.cardId = cardId;
      
      const artwork = artworkMap.get(card.artId);
      const img = document.createElement('img');
      img.src = card.half === 'top' ? artwork.top : artwork.bottom;
      img.alt = '';
      cardBtn.appendChild(img);

      cardBtn.addEventListener('pointerdown', handlePointerDown);
      cardBtn.addEventListener('pointermove', handlePointerMove);
      cardBtn.addEventListener('pointerup', handlePointerUp);
      cardBtn.addEventListener('pointercancel', handlePointerUp);
      cardBtn.onclick = handleKeyboardClick;

      boardGrid.appendChild(cardBtn);
    }

    if (draggedCardId !== cardId) {
      cardBtn.style.left = `calc(${col} * (100% / var(--cols)))`;
      cardBtn.style.top = `calc(${row} * (100% / var(--rows)))`;
      cardBtn.style.transform = '';
    }

    cardBtn.classList.toggle('selected', state.selectedCardId === cardId);
    cardBtn.classList.toggle('hinted', hintIds.has(cardId));
    cardBtn.disabled = isLoading || artworkFailed || animationLock || getMatchStatus(state) === 'cleared';
  });
}

function handlePointerDown(e) {
  if (isLoading || artworkFailed || animationLock || e.button !== 0) return;
  const btn = e.currentTarget;
  e.preventDefault();
  draggedCardId = btn.dataset.cardId;
  pointerDownEl = btn;
  btn.classList.add('dragging');
  btn.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
  if (!draggedCardId || e.currentTarget !== pointerDownEl) return;
  const btn = e.currentTarget;
  const rect = boardGrid.getBoundingClientRect();
  const x = e.clientX - rect.left - (btn.offsetWidth / 2);
  const y = e.clientY - rect.top - (btn.offsetHeight / 2);
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
}

function handlePointerUp(e) {
  if (!draggedCardId || e.currentTarget !== pointerDownEl) return;
  const btn = e.currentTarget;
  btn.releasePointerCapture(e.pointerId);
  btn.classList.remove('dragging');
  
  draggedCardId = null;
  pointerDownEl = null;

  btn.style.display = 'none'; // Temporarily hide to find underlying element
  const dropEl = document.elementFromPoint(e.clientX, e.clientY);
  btn.style.display = '';

  const targetCard = dropEl?.closest('.pm-card');
  if (targetCard && targetCard !== btn) {
    executeSwap(btn.dataset.cardId, targetCard.dataset.cardId);
  } else {
    renderBoard(); // Snap back
  }
}

function handleKeyboardClick(e) {
  if (e.detail !== 0) return; // Only process keyboard Enter/Space, ignore pointer clicks since we use PointerEvents
  const btn = e.currentTarget;
  const cardId = btn.dataset.cardId;
  if (!state.selectedCardId) {
    state = { ...state, selectedCardId: cardId };
    renderBoard();
  } else if (state.selectedCardId === cardId) {
    state = { ...state, selectedCardId: null };
    renderBoard();
  } else {
    const prevId = state.selectedCardId;
    state = { ...state, selectedCardId: null };
    executeSwap(prevId, cardId);
  }
}

function executeSwap(idA, idB) {
  clearTransientEffects();
  const result = swapCards(state, idA, idB);
  if (result.outcome ===
````

## SOURCE: submitted/picture-match-levels.json (INCOMPLETE)
````
{
  "version": 2,
  "ruleset": "swap-vertical-v1",
  "levels": [
    {
      "id": "level_1",
      "title": "초급 화병 갤러리",
      "mode": "main",
      "columns": 3,
      "rows": 4,
      "cards": [
        { "id": "card_0", "artId": "vase_stripes", "half": "top" },
        { "id": "card_1", "artId": "vase_orange", "half": "bottom" },
        { "id": "card_2", "artId": "vase_mint", "half": "top" },
        { "id": "card_3", "artId": "vase_ivory", "half": "bottom" },
        { "id": "card_4", "artId": "vase_spiral", "half": "bottom" },
        { "id": "card_5", "artId": "vase_speckles", "half": "top" },
        { "id": "card_6", "artId": "vase_stripes", "half": "bottom" },
        { "id": "card_7", "artId": "vase_mint", "half": "bottom" },
        { "id": "card_8", "artId": "vase_orange", "half": "top" },
        { "id": "card_9", "artId": "vase_ivory", "half": "top" },
        { "id": "card_10", "artId": "vase_speckles", "half": "bottom" },
        { "id": "card_11", "artId": "vase_spiral", "half": "top" }
      ],
      "solutionSwaps": [
        ["card_1", "card_4"],
        ["card_3", "card_9"],
        ["card_5", "card_10"]
      ]
    },
    {
      "id": "level_2",
      "title": "메인 도자기 진열장",
      "mode": "main",
      "columns": 6,
      "rows": 4,
      "cards": [
        { "id": "card_0", "artId": "vase_stripes", "half": "top" },
        { "id": "card_1", "artId": "vase_orange", "half": "bottom" },
        { "id": "card_2", "artId": "vase_mint", "half": "top" },
        { "id": "card_3", "artId": "vase_ivory", "half": "top" },
        { "id": "card_4", "artId": "vase_spiral", "half": "bottom" },
        { "id": "card_5", "artId": "vase_speckles", "half": "top" },
        { "id": "card_6", "artId": "vase_ivory", "half": "bottom" },
        { "id": "card_7", "artId": "vase_spiral", "half": "bottom" },
        { "id": "card_8", "artId": "vase_speckles", "half": "top" },
        { "id": "card_9", "artId": "vase_stripes", "half": "bottom" },
        { "id": "card_10", "artId": "vase_orange", "half": "bottom" },
        { "id": "card_11", "artId": "vase_mint", "half": "top" },
        { "id": "card_12", "artId": "vase_stripes", "half": "bottom" },
        { "id": "card_13", "artId": "vase_mint", "half": "bottom" },
        { "id": "card_14", "artId": "vase_orange", "half": "top" },
        { "id": "card_15", "artId": "vase_ivory", "half": "bottom" },
        { "id": "card_16", "artId": "vase_mint", "half": "bottom" },
        { "id": "card_17", "artId": "vase_orange", "half": "top" },
        { "id": "card_18", "artId": "vase_ivory", "half": "top" },
        { "id": "card_19", "artId": "vase_speckles", "half": "bottom" },
        { "id": "card_20", "artId": "vase_spiral", "half": "top" },
        { "id": "card_21", "artId": "vase_stripes", "half": "top" },
        { "id": "card_22", "artId": "vase_speckles", "half": "bottom" },
        { "id": "card_23", "artId": "vase_spiral", "half": "top" }
      ],
      "solutionSwaps": [
        ["card_1", "card_7"],
        ["card_6", "card_3"],
        ["card_5", "card_11"],
        ["card_9", "card_21"],
        ["card_10", "card_16"],
        ["card_15
````

## SOURCE: submitted/picture-match.css (INCOMPLETE)
````
:root {
  color-scheme: dark;
  --table-bg: #113829;
  --table-deep: #082017;
  --panel-bg: rgba(10, 31, 23, 0.92);
  --card-surface: #f8fafc;
  --card-border: #e2e8f0;
  --accent-gold: #fbbf24;
  --accent-emerald: #10b981;
  --text-main: #f8fafc;
  --text-muted: #cbd5e1;
}

* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: radial-gradient(circle at top, var(--table-bg), var(--table-deep));
  color: var(--text-main);
  display: flex; justify-content: center;
}
[hidden] { display: none !important; }

.pm-shell {
  width: 100%; max-width: 520px; min-height: 100vh;
  padding: 12px 12px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.pm-header { background: var(--panel-bg); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 10px 12px; }
.pm-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pm-title-row h1 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
.pm-badge { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(110,231,183,0.35); }
.pm-guide { margin: 6px 0 4px; font-size: 13px; font-weight: 700; color: var(--accent-gold); }
.pm-hud { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-muted); gap: 8px; flex-wrap: wrap; }
.pm-counter { font-weight: 700; color: var(--text-main); white-space: nowrap; }
.pm-status-bar { display: flex; flex-direction: column; gap: 2px; padding: 0 4px; }
.pm-status { font-size: 13px; font-weight: 700; color: #fef08a; min-height: 18px; }
.pm-save-status { font-size: 11px; color: #94a3b8; min-height: 14px; }

.pm-preview-box {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 100;
  width: min(320px, calc(100% - 24px)); pointer-events: none;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 8px 12px; border-radius: 12px; background: #064e3b; border: 1px solid rgba(52,211,153,0.45);
}
.pm-preview-art { width: 44px; display: flex; flex-direction: column; border-radius: 6px; overflow: hidden; border: 1px solid var(--card-border); background: var(--card-surface); flex-shrink: 0; }
.pm-preview-art img { display: block; width: 100%; aspect-ratio: 128 / 176; }
.pm-preview-label { font-size: 13px; font-weight: 700; color: #a7f3d0; }

.pm-drawer, .pm-clear-card, .pm-error-card { background: #0f2920; border: 1px solid rgba(255,255,255,0.22); border-radius: 14px; padding: 12px 14px; }
.pm-drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pm-drawer-head h2, .pm-clear-card h2 { margin: 0; font-size: 15px; color: #6ee7b7; }
.pm-help-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.55; color: var(--text-muted); }

.pm-table { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 4px 0; }
.pm-grid {
  position: relative;
  width: 100%;
  aspect-ratio: calc(var(--cols, 3) * 128) / calc(var(--rows, 4) * 176);
  max-height: 60vh;
}
.pm-slot-empty {
  position: absolute;
  width: calc(100% / var(--cols) - 6px);
  height: calc(100% / var(--rows) - 6px);
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
  border: 1px dashed rgba(255,255,255,0.12);
}
.pm-card {
  position: absolute;
  width: calc(100% / var(--cols) - 6px);
  height: calc(100% / var(--rows) - 6px);
  padding: 2px; border-radius: 10px; border: 2px solid var(--card-border);
  background: var(--card-surface); box-shadow: 0 4px 10px rgba(0,0,0,0.35);
  cursor: grab; display: flex; align-items: center; justify-content: center;
  touch-action: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.2s ease, left 0.3s ease-out, top 0.3s ease-in;
  z-index: 10;
}
.pm-card:active { cursor: grabbing; }
.pm-card img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }

.pm-card.hinted { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.75); z-index: 20; }
.pm-card.hinted::before { content: "힌트"; position: absolute; top: 2px; left: 2px; font-size: 10px; font-weight: 800; padding: 1px 4px; border-radius: 4px; background: #0284c7; color: #ffffff; }
.pm-card-fallback { font-size: 11px; font-weight: 700; color: #0f172a; text-align: center; padding: 4px; line-height: 1.25; overflow-wrap: anywhere; }

.pm-card.dragging { z-index: 50; box-shadow: 0 12px 24px rgba(0,0,0,0.5); transform: scale(1.05); opacity: 0.9; transition: none; }
.pm-card.selected { border-color: var(--accent-gold); box-shadow: 0 0 0 3px rgba(251,191,36,0.65), 0 8px 16px rgba(0,0,0,0.45); transform: translateY(-2px); z-index: 20; }
.pm-card.selected::after { content: "선택됨"; position: absolute; bottom: 2px; right: 2px; font-size: 10px; font-weight: 800; padding: 1px 4px; border-radius: 4px; background: #111827; color: var(--accent-gold); }

.pm-clear-card p, .pm-error-card p { margin: 6px 0 10px; font-size: 13px; color: var(--text-muted); }
.pm-clear-actions, .pm-controls { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pm-btn { border: 1px solid rgba(255,255,255,0.16); border-radius: 10px; padding: 9px 11px; font-size: 13px; font-weight: 700; background: #0284c7; color: #ffffff; cursor: pointer; }
.pm-btn-primary { background: var(--accent-emerald); color: #042f2e; }
.pm-btn-ghost { background: #1e3a2f; color: #e2e8f0; }
.pm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pm-btn:focus-visible
````

## SOURCE: submitted/index.html
````
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#113829" />
<title>화병 조각 맞추기 · Picture Blast Solitaire</title>
<link rel="stylesheet" href="./css/picture-match.css" />
</head>
<body>
<main class="pm-shell">
  <header class="pm-header">
    <div class="pm-title-row">
      <h1>화병 조각 맞추기</h1>
      <span id="stageBadge" class="pm-badge">준비 중</span>
    </div>
    <p class="pm-guide">카드를 드래그해 자리를 바꾸세요. 위·아래 그림이 세로로 완성되면 사라집니다.</p>
    <div class="pm-hud">
      <span id="levelTitle"></span>
      <span id="pairCounter" class="pm-counter">완성 0 / 6쌍</span>
    </div>
  </header>
  <section class="pm-status-bar" aria-label="플레이 안내">
    <div id="statusText" class="pm-status" role="status">그림을 준비하고 있습니다.</div>
    <div id="saveText" class="pm-save-status" aria-live="polite"></div>
  </section>
  <section id="completedPreview" class="pm-preview-box" aria-label="완성한 화병" hidden>
    <div class="pm-preview-art">
      <img id="previewTopImg" alt="" />
      <img id="previewBottomImg" alt="" />
    </div>
    <span id="previewCaption" class="pm-preview-label"></span>
  </section>
  <section id="helpPanel" class="pm-drawer" aria-labelledby="helpHeading" hidden>
    <div class="pm-drawer-head">
      <h2 id="helpHeading" tabindex="-1">플레이 방법</h2>
      <button id="helpCloseBtn" class="pm-btn pm-btn-ghost" type="button">닫기</button>
    </div>
    <ul class="pm-help-list">
      <li>카드를 드래그해서 다른 카드가 있는 자리와 교환하세요. 빈칸으로는 이동할 수 없습니다.</li>
      <li>같은 화병 그림의 위 조각이 위에, 아래 조각이 바로 아래에 놓이면 완성되어 사라집니다.</li>
      <li>카드가 사라지면 위에 있던 카드들이 아래로 떨어지며 연속으로 완성될 수 있습니다.</li>
      <li>힌트와 다시하기는 무료로 언제든 사용할 수 있습니다.</li>
    </ul>
  </section>
  <section id="errorPanel" class="pm-error-card" aria-labelledby="errorHeading" hidden>
    <h2 id="errorHeading" tabindex="-1">그림을 다시 불러와주세요</h2>
    <p id="errorMessage" role="alert"></p>
    <button id="retryLoadBtn" class="pm-btn" type="button">불러오기 재시도</button>
  </section>
  <section class="pm-table" aria-label="화병 그림 조각 보드">
    <div id="boardGrid" class="pm-grid"></div>
  </section>
  <section id="clearOverlay" class="pm-clear-card" aria-labelledby="clearHeading" hidden>
    <h2 id="clearHeading" tabindex="-1">스테이지 완성!</h2>
    <p id="clearSummary"></p>
    <div class="pm-clear-actions">
      <button id="clearNextBtn" class="pm-btn pm-btn-primary" type="button">다음 스테이지</button>
      <button id="clearRestartBtn" class="pm-btn pm-btn-ghost" type="button">한 번 더</button>
    </div>
  </section>
  <footer class="pm-controls" aria-label="게임 도구">
    <button id="hintBtn" class="pm-btn pm-btn-primary" type="button" disabled>힌트</button>
    <button id="restartBtn" class="pm-btn pm-btn-ghost" type="button" disabled>다시하기</button>
    <button id="helpBtn" class="pm-btn pm-btn-ghost" type="button" aria-expanded="false" aria-controls="helpPanel">도움말</button>
    <button id="soundBtn" class="pm-btn pm-btn-ghost" type="button" disabled>사운드·진동 켬</button>
  </footer>
</main>
<script type="module" src="./js/picture-match/main.js"></script>
</body>
</html>
````

## SOURCE: current/scripts/check-repo.mjs (PRESERVE CHECKS)
````
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevels } from '../web-prototype/js/levels.js';
import { parseArtworks } from '../web-prototype/js/collection.js';
import { parseArtworkManifest, parsePictureMatchLevels } from '../web-prototype/js/picture-match/levels.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/GAME_DESIGN_SPEC.md',
  'docs/LEVEL_SAMPLE.json',
  'docs/TECH_NOTES.md',
  'docs/PICTURE_MATCH_SPEC.md',
  'src-concept/scene_map.md',
  'web-prototype/index.html',
  'web-prototype/legacy-solitaire.html',
  'web-prototype/css/picture-match.css',
  'web-prototype/data/picture-match-artworks.json',
  'web-prototype/data/picture-match-levels.json',
  'web-prototype/js/picture-match/rules.js',
  'web-prototype/js/picture-match/levels.js',
  'web-prototype/js/picture-match/save.js',
  'web-prototype/js/picture-match/main.js',
  'web-prototype/data/levels.json',
  'web-prototype/data/artworks.json',
  'web-prototype/js/levels.js',
  'web-prototype/js/collection.js',
  'web-prototype/css/style.css',
  'web-prototype/js/game-state.js',
  'web-prototype/js/rules.js',
  'web-prototype/js/reveal.js',
  'web-prototype/js/artwork.js',
  'web-prototype/js/tutorial.js',
  'web-prototype/js/media.js',
  'web-prototype/js/save.js',
  'web-prototype/js/main.js'
];

const missing = [];
for (const file of required) {
  try {
    await access(path.join(rootDir, file));
  } catch {
    missing.push(file);
  }
}

if (missing.length) {
  console.error('Missing required files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const legacyLevels = parseLevels(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/levels.json'), 'utf8')));
const legacyArtworks = parseArtworks(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/artworks.json'), 'utf8')), legacyLevels);

const pmManifest = parseArtworkManifest(JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/picture-match-artworks.json'), 'utf8')));
for (const art of pmManifest.artworks) {
  const topFile = path.join(rootDir, 'web-prototype', art.top.replace(/^\.\//, ''));
  const bottomFile = path.join(rootDir, 'web-prototype', art.bottom.replace(/^\.\//, ''));
  await access(topFile);
  await access(bottomFile);
  for (const imageFile of [topFile, bottomFile]) {
    const imageBytes = await readFile(imageFile);
    if (imageBytes.length < 24 || imageBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        imageBytes.readUInt32BE(16) !== 128 || imageBytes.readUInt32BE(20) !== 176) {
      throw new Error(`Invalid 128x176 PNG: ${imageFile}`);
    }
  }
}

const pmLevels = parsePictureMatchLevels(
  JSON.parse(await readFile(path.join(rootDir, 'web-prototype/data/picture-match-levels.json'), 'utf8')),
  pmManifest
);

console.log(`Repository check passed. Legacy: ${legacyLevels.length} levels, ${legacyArtworks.length} artworks. PictureMatch: ${pmLevels.length} levels, ${pmManifest.artworks.length * 2} PNGs verified.`);

````

## SOURCE: current/web-prototype/data/picture-match-artworks.json
````
{
  "version": 1,
  "artSource": "existing",
  "route": "user-reference-crop",
  "usage": "development-reference-only",
  "releaseApproved": false,
  "halfWidth": 128,
  "halfHeight": 176,
  "artworks": [
    {
      "id": "vase_stripes",
      "title": "검정 줄무늬 화병",
      "top": "./assets/picture-match/reference-vases/vase_stripes-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_stripes-bottom.png",
      "sourceCells": {
        "top": [
          0,
          0
        ],
        "bottom": [
          1,
          3
        ]
      }
    },
    {
      "id": "vase_spiral",
      "title": "빨간 나선 화병",
      "top": "./assets/picture-match/reference-vases/vase_spiral-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_spiral-bottom.png",
      "sourceCells": {
        "top": [
          2,
          0
        ],
        "bottom": [
          3,
          1
        ]
      }
    },
    {
      "id": "vase_orange",
      "title": "주황 줄무늬 화병",
      "top": "./assets/picture-match/reference-vases/vase_orange-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_orange-bottom.png",
      "sourceCells": {
        "top": [
          3,
          0
        ],
        "bottom": [
          2,
          1
        ]
      }
    },
    {
      "id": "vase_mint",
      "title": "민트 격자 화병",
      "top": "./assets/picture-match/reference-vases/vase_mint-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_mint-bottom.png",
      "sourceCells": {
        "top": [
          5,
          0
        ],
        "bottom": [
          4,
          3
        ]
      }
    },
    {
      "id": "vase_speckles",
      "title": "크림 점박이 화병",
      "top": "./assets/picture-match/reference-vases/vase_speckles-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_speckles-bottom.png",
      "sourceCells": {
        "top": [
          1,
          2
        ],
        "bottom": [
          0,
          1
        ]
      }
    },
    {
      "id": "vase_ivory",
      "title": "아이보리 화병",
      "top": "./assets/picture-match/reference-vases/vase_ivory-top.png",
      "bottom": "./assets/picture-match/reference-vases/vase_ivory-bottom.png",
      "sourceCells": {
        "top": [
          4,
          2
        ],
        "bottom": [
          5,
          1
        ]
      }
    }
  ]
}

````

## SOURCE: current/web-prototype/js/media.js
````
let audioCtx = null;
let currentBlobUrl = null;

export function playBeep(frequency, soundOn) {
  if (!soundOn) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = 0.025;
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    oscillator.stop(audioCtx.currentTime + 0.18);
  } catch {}
}

export function triggerHaptic(soundOn) {
  if (!soundOn) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch {}
}

export function handleImageUpload(file, onPreviewUrl, onSaveRef) {
  if (!file || !file.type.startsWith('image/')) return;
  const nextBlobUrl = URL.createObjectURL(file);
  releaseImage();
  currentBlobUrl = nextBlobUrl;

  const fileRef = {
    kind: "user",
    name: file.name,
    size: file.size,
    lastModified: file.lastModified
  };

  onPreviewUrl(currentBlobUrl);
  onSaveRef(fileRef);
}

export function getDefaultImageSvg() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="400" height="220" fill="#0f172a"/><circle cx="120" cy="110" r="60" fill="url(#g)"/><rect x="190" y="50" width="130" height="120" rx="18" fill="#f59e0b" opacity="0.85"/></svg>`);
}

export function releaseImage() {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = null;
}

````
다시 강조: 이번 응답에는 완전한 picture-match-levels.json 하나만 출력하세요.
