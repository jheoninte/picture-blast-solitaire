# DEV QUICKSTART

## 목표

- 그림 위·아래 조각을 맞추는 실제 카드 플레이를 먼저 검증합니다.
- 후속 엔진 이식 시에도 레벨 데이터와 규칙 데이터가 그대로 쓰이도록 유지합니다.

## 실행

```bash
npm install
npm run dev
```

## 추천 첫 작업 순서

현재 Gemini 협업 자료와 검증된 새 레벨 후보는 `docs/collaboration/README.md`를 확인합니다. 후보 JSON은 활성 런타임에 아직 적용하지 않았습니다.

2026-11-17 정정: 최신 명세는 `docs/PICTURE_SWAP_SPEC.md`입니다. 현재 index.html은 사용자 의도와 다른 클릭 제거 구현이므로 드래그 교환·세로 완성·낙하 규칙으로 수정해야 합니다. `docs/PICTURE_MATCH_QA.md`는 이전 방식의 역사 기록입니다. legacy-solitaire.html은 숫자 ±1 게임입니다.

1. Gemini에 최신 코드와 새 명세를 전달해 교환/낙하/연쇄/저장을 수정하고 Codex가 실제 해 경로와 입력을 검증합니다. 첫 판은 3열×4행입니다. 아래 모듈 설명과 저장 키는 아직 이전 실행 코드의 상태이며 새 목표는 PICTURE_SWAP_SPEC.md를 따릅니다.
2. 출시용 개별 아트의 제작/라이선스를 확인하고 컬렉션 카탈로그를 교체합니다.
3. 네이티브 저장 어댑터 선정 시 기존 웹 저장의 유지/마이그레이션을 검토합니다.

상점/플랫폼 경계의 보류된 명세는 `docs/SHOP_PLATFORM_SPEC.md`입니다. 실제 결제/광고 연결은 아직 구현하지 않았습니다.

## 현재 모듈 구조

- `web-prototype/js/picture-match/rules.js`: 그림 매칭·선택·힌트·주입 RNG 섞기·해 경로 생성
- `web-prototype/js/picture-match/levels.js`: 아트/레벨 검증과 이미지 사전 로딩
- `web-prototype/js/picture-match/save.js`: 새 전용 키의 버전1 저장과 복원, 직렬 쓰기
- `web-prototype/js/picture-match/main.js`: 세로형 화면, 재사용 카드 DOM, 완료/힌트/섞기 UI
- `web-prototype/data/picture-match-levels.json`: 12/24/36장 고정 스테이지
- `web-prototype/data/picture-match-artworks.json`: 개발용 화병6종·PNG12장 참조

새 저장 키는 `picture-blast-solitaire.picture-match.save`입니다. 카드 순열과 짝 균형을 검증하고 판/옵션/클리어 기록을 복원합니다. 선택/힌트/완성 연출은 저장하지 않습니다. 기본 진입점과 레거시 저장은 서로 분리됩니다.

## 레거시 모듈과 동작

- `web-prototype/js/game-state.js`: main/boss 공통 초기 상태와 카드 생성
- `web-prototype/js/rules.js`: 불변 상태 변환을 사용하는 카드 제거 규칙
- `web-prototype/js/reveal.js`: 제거 수 기반 reveal 비율 계산
- `web-prototype/js/artwork.js`: 카드 ID에 대응하는 5×5/3×3 그림 마스크의 부분 갱신
- `web-prototype/js/tutorial.js`: 인라인 규칙 안내, 도움말, 독립된 안내 완료 기록
- `web-prototype/js/collection.js`: 아트 카탈로그 검증과 클리어 기록 기반 해금 상태 계산
- `web-prototype/data/artworks.json`: 6개 스테이지와 일대일 대응하는 검증용 아트 목록
- `web-prototype/js/media.js`: 사운드/햅틱 및 메모리 이미지 URL 관리
- `web-prototype/js/main.js`: 이벤트 연결과 DOM 렌더링
- `web-prototype/js/levels.js`: 고정 레벨 형식 검증, 해 경로 재생 검증, 레벨 로드 및 초기 상태 생성
- `web-prototype/js/save.js`: 버전1 로컬 세이브, 행동 재생 복원, 비동기 저장 어댑터와 직렬 쓰기
- `web-prototype/data/levels.json`: main 3개 + boss 3개의 검증용 스테이지

시작 시 첫 스테이지를 로드하며 다시하기는 같은 레벨의 카드/덱을 복원합니다. 클리어 후에만 다음 레벨로 이동하며, 마지막 클리어 시 팩 완료를 표시합니다. 옵션과 업로드 이미지는 레벨 전환에서도 유지합니다.
Main은 16장, Boss는 8장의 유한 드로우 덱으로 시작합니다. 제거 가능한 카드가 없을 때만 Draw로 중앙 숫자를 교체할 수 있으며, reveal은 카드 제거 시에만 증가합니다.
덱을 모두 사용해도 제거 가능한 카드가 있으면 플레이를 계속합니다. 덱과 합법 수가 모두 없으면 다시하기로 시작합니다. 고정 스테이지는 검증된 클리어 경로가 있지만 모든 선택이 성공하는 것은 아닙니다. 무작위 생성 API는 별도로 유지하며 무작위 판의 클리어를 보장하지 않습니다.
로더는 버전 1의 새 팩만 지원합니다. `docs/LEVEL_SAMPLE.json`은 레거시 문서 예시이며 런타임 입력으로 사용하지 않습니다.
단계 진행은 `picture-blast-solitaire.save` 키에 저장됩니다. 현재 레벨의 성공한 remove/draw 로그를 고정 보드에서 재생해 center/제거 수/남은 덱/완료 상태를 복원합니다. 초기 복원 전 저장을 덮어쓰지 않습니다.
저장 접근 오류나 과대/미래 버전은 세션 쓰기를 차단하고 메모리로 플레이합니다. 개별 쓰기 실패는 안내하고 다음 변경에서 다시 시도합니다. 지원하지 않는 로그나 레벨 내용 변경 시 해당 판만 초기화합니다.
상세 스키마와 오류 정책은 `docs/LOCAL_SAVE_SPEC.md`를 확인합니다. 웹 localStorage 어댑터의 검증 완료이며 iOS 네이티브 저장의 검증 완료를 의미하지 않습니다.

그림은 제거한 `board_N` 위치의 마스크만 투명해집니다. Draw와 음소거는 공개 상태를 변경하지 않습니다. 저장 복원과 다시하기에서는 마스크를 즉시 적용하고, 새 제거에만 CSS 전환을 사용합니다. 모션 감소 설정에서는 전환을 끕니다.
첫 단계에서 행동/클리어 기록이 없는 사용자에게만 인라인 안내를 자동 표시합니다. 진행 중인 복원 판에는 자동 표시하지 않으며 도움말로 다시 열 수 있습니다. 안내는 플레이를 막지 않습니다.
튜토리얼은 별도 `picture-blast-solitaire.tutorial` 키의 `{schemaVersion:1,completed:true}`로 기록합니다. 게임 세이브 스키마는 변경하지 않습니다. 안내 기록의 저장 오류/미래 버전 차단은 게임 저장과 분리됩니다.
업로드 이미지는 메모리에만 유지됩니다. 저장용 참조는 `{kind: "user", name, size, lastModified}`이며 Blob URL이나 바이너리를 포함하지 않습니다. 새로고침 후에는 이미지를 다시 선택해야 합니다.

컬렉션 해금은 기존 게임 저장의 completedLevelIds에서 파생합니다. 별도 해금 키/보상 배열은 없으며 재클리어와 로딩은 해금 알림을 반복하지 않습니다. 목록 실패는 전용 재시도로 처리하고 게임을 중단하지 않습니다. 컬렉션 조작은 게임 저장/판/옵션/업로드 이미지를 바꾸지 않습니다. 현재 여섯 항목은 prototype-default 기본 SVG 한 장을 함께 사용하며 출시용 콘텐츠 완료를 뜻하지 않습니다.

## 첫 스프린트 산출물

- 카드 규칙 모듈화
- 스테이지 데이터 파서
- 세이브 슬롯 구조 초안
- UI 상태와 퍼즐 상태 분리
