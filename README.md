# Picture Blast Solitaire

`Picture Blast Solitaire`는 같은 화병의 위·아래 조각을 맞추는 HTML5 퍼즐입니다. iOS 우선 출시를 목표로 Windows에서 플레이를 검증하며, 네이티브 연결과 TestFlight는 Mac에서 진행합니다.

최신 사용자 규칙은 드래그 교환 → 세로 그림 완성 → 제거·낙하·연쇄 → 보드 전체 제거입니다. 어느 카드끼리든 교환할 수 있지만 빈칸으로 이동할 수는 없습니다. `docs/PICTURE_SWAP_SPEC.md`가 최신 기준입니다.

현재 실행 화면은 이전 클릭 제거 방식으로, 새 규칙 수정은 아직 미완료입니다. 아래 실행 동작/저장 키/검사 설명은 이전 코드에 해당하며 새 규칙의 검증을 뜻하지 않습니다. 그림은 사용자 참고 이미지의 개발 검증용 가공본이고 출시 전 교체가 필요합니다.

기존 숫자 ±1 게임은 `/web-prototype/legacy-solitaire.html`에서 확인할 수 있습니다. 아래 레거시 모듈과 저장 기록도 유지됩니다.

## 포함 내용

- `web-prototype/index.html`: 그림 위·아래 짝맞추기 게임
- `web-prototype/js/picture-match/`: 그림 매칭 규칙, 고정 콘텐츠 검증, 전용 저장, UI
- `web-prototype/css/picture-match.css`: 세로형 그림 게임 화면
- `web-prototype/data/picture-match-*.json`: 새 그림 게임 아트/3개 고정 레벨
- `web-prototype/js/`: 공통 게임 상태, 카드 규칙, reveal 계산, 미디어 및 UI 연결 모듈
- `web-prototype/css/style.css`: 모바일 대응 레이아웃
- `web-prototype/data/levels.json`: 클리어 경로를 검증한 고정 스테이지 6개
- 카드 제거 위치에 대응하는 그림 조각 공개와 건너뛰기 가능한 인라인 튜토리얼/도움말
- 클리어 기록으로 해금하는 아트 컬렉션, 잠금 표시와 큰 보기. 검증용 6개 항목은 현재 기본 이미지 한 장을 공유합니다.
- `docs/GAME_DESIGN_SPEC.md`: 5x5 메인 + 3x3 보스 퍼즐 구조
- `docs/LEVEL_SAMPLE.json`: 보스 스테이지 샘플 데이터
- `docs/TECH_NOTES.md`: 이미지 업로드, 사운드/햅틱, 세이브 확장 포인트
- `src-concept/scene_map.md`: 후속 엔진 씬/서비스 분리 메모
## 빠른 시작

```bash
npm install
npm run dev
```

- 개발 서버의 루트 주소는 `/web-prototype/index.html`로 이동합니다. CSS와 JavaScript는 HTML 기준 상대 경로로 로드합니다.
- 그림 게임은 `picture-blast-solitaire.picture-match.save` 키를 사용하며 레거시 게임/튜토리얼 키를 덮어쓰지 않습니다. 힌트·선택·도움말은 저장하지 않고 매칭·섞기·옵션·단계 전환만 저장합니다.
- 클리어하면 다음 스테이지로 이동하며 다시하기는 원래 그림 배치를 복원합니다. 현재 판의 제거/섞인 배치, 클리어 기록과 음소거 옵션은 같은 브라우저 주소에서 새로고침 후 복원됩니다.
- 저장은 기기 내 localStorage를 사용하며 클라우드 동기화는 없습니다. 브라우저 데이터 삭제/주소 변경/재설치 후 복원은 보장하지 않습니다. 사용자 이미지 업로드는 레거시에서만 제공하며 재실행 후 다시 선택해야 합니다.
- 정적 빌드는 아래 명령으로 생성합니다.

```bash
npm run build
```

- 저장소 구조 점검은 아래 명령으로 실행합니다.
- 점검에는 모든 스테이지의 클리어 경로 재생과 아트 카탈로그의 레벨 대응 검증이 포함됩니다.

```bash
npm run check
```

## 개발 인계 문서

- `docs/RELEASE_PLAN.md`: iOS 우선 출시, IAP/IAA, 서버 비용과 Windows/Mac 개발 경계
- `docs/DEV_QUICKSTART.md`: 다음 개발자/에이전트가 바로 이어서 작업하기 위한 실행 가이드
- `BACKLOG.md`: 우선순위 기준 후속 구현 작업 목록

