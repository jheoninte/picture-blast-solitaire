# Technical Notes

- 업로드 이미지는 `FileReader` 또는 `createObjectURL`로 미리보기 처리
- 세이브에는 실제 이미지 바이너리 대신 stage id 또는 user art reference만 저장
- 모바일 이식 시 `navigator.vibrate` 대체 햅틱 브리지 필요
- 상용 단계에서 카드 배치 생성기와 실패 판정 로직 분리 필요
