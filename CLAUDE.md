# CLAUDE.md

## Project Goal

이 저장소는 `Picture Blast Solitaire`의 핵심인 그림 reveal + 솔리테어 카드 규칙을 HTML5로 빠르게 검증하고, 이후 상용 퍼즐 앱 구조로 이식하기 위한 패키지다.

## Core Product Rules

- 플레이어는 현재 기준 카드 기준으로 `±1` 값 카드를 선택해 제거한다.
- 카드 제거량이 누적될수록 숨겨진 그림이 더 드러난다.
- `Main 5x5`와 `Boss 3x3`는 같은 카드 규칙을 공유한다.
- 이미지 업로드, 오디오, 햅틱은 초반 체험의 차별화 요소다.
