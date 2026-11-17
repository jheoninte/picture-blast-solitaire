# 그림 짝맞추기 개발용 아트

`picture-match-reference-contact.png`는 사용자가 제공한 게임 참고 스크린샷에서 추출한 화병 6종의 위·아래 조각을 붙여 검토한 시트입니다.

- art_source: existing
- route: user-reference-crop
- 모델/API 호출: 없음
- 산출물: `web-prototype/assets/picture-match/reference-vases/`의 PNG 12장 (각128×176)
- manifest: `web-prototype/data/picture-match-artworks.json`
- 가공: 참고 스크린샷의 각 조각 내부를 잘라 테두리를 제거하고 LANCZOS로 크기를 맞춤. 투명도/AI 생성/새 페인팅 없음.
- 범위: 개발 플레이 검증용. 원작의 소유권/출시용 라이선스를 확보한 것으로 간주하지 않습니다. 출시 전 직접 제작하거나 사용 권한을 확보한 별도 아트로 교체해야 합니다.
- QA: 12개 PNG 형식/크기/경로/6종 top-bottom 대응 검증, 합성 시트 육안 확인. 원본이 스크린샷이므로 일부 조각 접합부의 미세한 폭·배경 차이는 남아 있습니다.

현재 아트 준비 완료는 새 게임 구현 완료를 뜻하지 않습니다. 구현 기준은 `docs/PICTURE_MATCH_SPEC.md`입니다.
