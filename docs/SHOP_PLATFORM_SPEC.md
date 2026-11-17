# 상점과 구매·광고 플랫폼 경계 구현 기준

상태: Gemini 구현 요청용 명세. 이 문서 추가는 상점 또는 네이티브 결제·광고 구현 완료를 뜻하지 않습니다.

2026-11-17: 사용자 결정으로 그림 위·아래 짝맞추기 전환을 우선하여 이 구현 요청은 보류합니다. 새 코어 플레이가 검증된 후 연결 위치와 저장 경계를 다시 확인합니다.

## 이번 단계

영구형 상품 한 개를 보여주는 인라인 상점, 구매 복원 UI, 구매 상태 제어기와 웹 미지원 플랫폼 어댑터를 만듭니다. 광고는 후속 연결을 위한 미지원 인터페이스만 둡니다. 현재 게임 규칙과 세이브를 그대로 유지합니다.

실제 SDK/Capacitor 설치, 결제 요청, 광고 노출, 네트워크 통신, 계정, 분석 수집은 이번 범위에 없습니다. Windows에서 흐름과 오류 경계를 검증하고, Mac에서 StoreKit/광고 SDK 연결과 실기기 검증을 이어갑니다.

## 상품 카탈로그

- `web-prototype/data/products.json`: `{version:1, products:[...]}`. 이번에는 정확히 한 개의 상품만 허용합니다.
- 항목: `{id:"remove_interstitial_ads", type:"non-consumable", entitlementKey:"removeForcedAds", title:"강제 광고 제거", description:"판 사이에 표시되는 강제 전면 광고를 제거합니다. 선택형 보상 광고는 남습니다."}`.
- id는 앱 내부 논리 ID입니다. 실제 App Store/Google Play 상품 ID는 Mac/Android 연결 때 별도 매핑합니다. 임의의 운영용 상품 ID를 만들지 않습니다.
- 가격, 통화, 할인율, 구매 여부를 정적 카탈로그에 넣지 않습니다. 구매 가격은 향후 스토어가 제공한 현지화 displayPrice만 표시합니다. 값이 없으면 가격 확인 불가로 표시하고 구매를 비활성화합니다.
- 타입/버전/배열 길이/필수 문자열/공백/길이/중복/지원하지 않는 id·type·entitlementKey를 순수 파서로 검증합니다. 문자열 최대 길이: id·entitlementKey 80, title 100, description 300.
- 저장 키, URL, 이미지, HTML, 사용자 데이터, 유료 소모품·구독·아트 팩을 추가하지 않습니다. 제목·설명·가격은 textContent로 렌더링합니다.

## 모듈과 계약

권장 분리는 `platform.js`(웹 어댑터와 플랫폼 생성), `purchases.js`(카탈로그 검증·로딩과 구매 상태 제어), `shop.js`(DOM 연결)입니다. 작게 조정해도 순수 상태/플랫폼/DOM 경계는 유지합니다. main.js에 큰 상점 렌더러를 추가하지 않습니다.

- 프로덕션 진입점 main.js는 코드에서 명시적으로 createWebPlatform()만 구성합니다. window 전역, URL 쿼리, localStorage, user-agent, Capacitor 존재 여부로 native/test 모드나 구매 성공을 자동 활성화하지 않습니다.
- 플랫폼은 kind `web-unavailable`과 purchases/ads 객체를 제공합니다. 네이티브 구현은 이번에 만들지 않습니다.
- purchases 인터페이스: getProducts(productIds), getEntitlements(), purchase(productId), restorePurchases(). 모든 메서드는 Promise이며 실패도 구조화된 결과로 반환합니다.
- 상품 조회 결과: `{status:'ok', products:[{id,displayPrice}]}` 또는 `{status:'unavailable'|'error', products:[]}`. 이번 웹은 unavailable입니다. 현지화 가격이 공백/비문자열/과대 문자열(100자 초과)이면 해당 제안을 사용할 수 없습니다.
- 권한 조회 결과: `{status:'verified', removeForcedAds:boolean, purchaseState:'clear'|'pending'|'unknown'}` 또는 `{status:'unavailable'|'error'}`. purchaseState는 이 상품의 미결 거래 상태이며 누락/잘못된 값은 unknown입니다. verified는 향후 네이티브 어댑터가 스토어 검증을 마친 현재 권한 스냅샷을 뜻합니다. 단순 구매 완료 문자열/영수증 존재/로컬 세이브로 추론하지 않습니다. 이 JS 경계 자체가 StoreKit 검증 구현은 아닙니다.
- purchase/restorePurchases 결과 status: `success|cancelled|pending|unavailable|error`. purchase는 요청과 같은 productId를 포함해야 합니다. 알 수 없는 status·다른 productId·잘못된 결과는 error로 처리합니다. pending에 가짜 transactionId나 영수증을 생성하지 않습니다.
- 제어기는 getSnapshot(), subscribe(listener), initialize(), refresh(), purchase(productId), restorePurchases()를 제공합니다. DOM 없이 주입한 어댑터로 검증할 수 있어야 합니다. 반환 스냅샷을 외부에서 수정해 내부 상태를 바꿀 수 없어야 합니다.
- 표시 상태는 idle/loading/purchasing/restoring/ready/unavailable/error와 별도 operation 결과로 구분할 수 있습니다. 상세 API 이름은 조정 가능하나 모든 시나리오가 재현 가능해야 합니다.
- success 응답만으로 권한을 부여하지 않습니다. 성공 후 getEntitlements()의 현재 verified 스냅샷을 재조회합니다. verified false는 이전 true를 해제합니다(환불/철회 반영 기반). 조회 오류·미지원·잘못된 값은 unknown으로 표시하고 새 구매 권한을 부여하지 않습니다. 권한 해제를 환불 확인으로 단정하는 문구를 쓰지 않습니다.
- pending은 결제 재시도 폭주를 막고 '승인 대기 중'을 표시합니다. pending 동안 같은 상품 재구매를 막고 '구매 상태 확인' 또는 재개 refresh로 상태를 재조회합니다. 잠금은 verified 권한을 얻었거나 purchaseState=clear가 명시된 경우에만 해제합니다. 미소유(false)만으로 미결 거래가 없다고 추론하거나 refresh 오류로 잠금을 풀지 않습니다. Mac에서 StoreKit 거래 업데이트와 미결 거래 조회를 연결해야 한다고 문서화합니다.
- 웹 어댑터는 어떤 입력에도 구매/복원 success 또는 verified 권한을 반환하지 않습니다. 웹에는 '이 미리보기에서는 구매와 복원을 사용할 수 없습니다'를 표시합니다. 실제 권한 플래그는 false/unknown이며 fake adapter 결과를 런타임 저장이나 실제 광고 제한에 사용하지 않습니다.
- 구매·복원·조회는 동시에 하나만 실행합니다. 중복 클릭/initialize/refresh 요청을 병합하거나 busy 결과로 무시하며, 초기 권한 조회가 늦게 완료되어 새 결과를 덮지 않게 합니다.
- 어댑터 throw/reject와 영원히 끝나지 않는 Promise를 처리합니다. 타임아웃을 주입 가능하게 하고 기본 15초로 설정합니다. 타임아웃 후 로딩 잠금을 해제하고 늦은 응답은 무시합니다. 타임아웃은 결제 취소를 의미하지 않으므로 결제 결과 확인 필요 안내를 표시하고, purchase/restore를 재전송하기 전에 refresh를 요구합니다. 플랫폼 호출을 타임아웃 때문에 자동 재시도하지 않습니다.
- 테스트는 fake adapter를 별도 코드에서 주입해 위 네이티브 계약을 모의 검증합니다. 이 결과는 실제 결제·영수증 검증 완료가 아닙니다. 런타임 개발용 성공 버튼/모드/테스트 상품/디버그 패널은 추가하지 않습니다.

## 광고 인터페이스의 이번 한계

- ads.getAvailability(), ads.showInterstitial(), ads.showRewarded()를 두고 웹에서 항상 unavailable을 반환합니다. showRewarded는 rewarded:false를 명시합니다.
- 광고 SDK 로딩/요청/추적 동의 창/가짜 광고/보상 콜백 생성/광고 UI/추가 덱을 이번에 추가하지 않습니다. 기존 성공한 remove/draw 로그만 허용하는 세이브에 보상 행동을 끼워 넣지 않습니다.
- 후속 단계에서 테스트 광고, 동의, 판 사이 노출 제한, 실제 보상 콜백 중복 방지, 추가 기회의 규칙·저장 재생을 함께 설계합니다.
- 상점 상품 설명은 제거 대상과 선택형 보상 광고 잔존을 설명하며, 현재 웹에서 광고가 실제 제공된다고 주장하지 않습니다.

## UI와 생명주기

- 상점 토글 버튼과 인라인 section, 제목, 상품 설명, 가격/지원 상태, 구매·구매 복원·구매 상태 확인·닫기 버튼, 전용 aria-live 상태 영역을 둡니다.
- 웹에서는 상품 설명을 읽을 수 있으나 구매와 복원은 명확한 미지원 안내와 함께 비활성화합니다. 상태 확인도 실제로 지원될 때만 활성화합니다. 재시도는 카탈로그 오류용으로 별도 제공합니다.
- 카탈로그는 동봉 상대 경로에서 로드하며 실패/잘못된 형식은 상점 전용 재시도로 격리합니다. 게임 레벨 로딩·세이브 복원·튜토리얼·컬렉션이 상점을 기다리지 않게 합니다. 중복 재시도는 병합하고 늦은 로딩 결과가 최신 UI를 덮지 않게 합니다.
- 상점 열기·닫기·조회·구매 시도·복원은 게임 판/행동 로그/덱/마스크/옵션/이미지/클리어/컬렉션/게임 저장을 바꾸지 않습니다. 구매 권한을 일반 세이브나 별도 localStorage에 쓰지 않습니다.
- 튜토리얼·컬렉션·상점은 독립적으로 열고 닫습니다. 상점 열기는 tutorial.noteInteraction()으로 자동 안내와 포커스 경합을 피하되 도움말 완료 기록을 새로 저장하지 않습니다.
- 모든 버튼 type=button, aria-expanded/aria-controls와 제목 연결, 키보드 조작, 닫을 때 토글로 포커스 복원을 처리합니다. 비동기 렌더링으로 포커스된 버튼을 숨기거나 교체할 때는 보이는 제목 등으로 복원합니다.
- 비모달, 포커스 트랩 없음, 게임 차단 없음. 375px에서 가로 넘침이 없어야 하며 확대와 모션 감소 설정을 유지합니다. 사용자를 향한 UI에 브리지/어댑터/SDK 같은 구현 용어를 나열하지 않습니다.
- document.visibilitychange가 visible로 바뀌면 네이티브 구현의 향후 권한 갱신을 위한 refresh 경로를 제공합니다. 웹 미지원일 때는 추가 작업 없이 종료하며, 숨김/표시가 반복되어도 중복 호출·이벤트 리스너 누적이 없어야 합니다. 외부 거래 업데이트 구독은 이번 범위에 넣지 않습니다.

## 보호 대상과 제출물

- AGENTS.md와 이 명세 및 RELEASE_PLAN.md가 이 작업의 기준입니다. 제공되지 않은 game-studio.md, game-ui-frontend.md, web-game-foundations.md, data-save-leaderboard.txt를 읽었다고 주장하거나 거기서 HubGame 지시를 끌어오지 않습니다.
- HubGame/랭킹/클라우드 저장/로그인/Firebase/RevenueCat/AdMob 호출/외부 전송을 추가하지 않습니다. 유료 서비스 선택과 가격 조사를 다시 작성할 필요가 없습니다.
- rules.js, game-state.js, levels.js, levels.json, save.js, reveal.js, artwork.js, media.js, tutorial.js, collection.js, artworks.json의 동작과 게임 세이브 스키마는 변경하지 않습니다. 네이티브 패키지/새 의존성/프레임워크를 추가하지 않습니다.
- check-repo.mjs에 새 모듈·products.json 필수 파일과 순수 상품 파서 검증을 추가하고, 기존 6개 해 경로와 아트 대응 검증을 보존합니다.
- 변경한 파일만 전체 코드로 반환합니다. 생략부호/동일하므로 생략/패치만 반환하지 않습니다. 원본 전체를 받은 파일의 기존 기능을 유지합니다. 새 모듈은 전체 코드를 제공합니다.
- 코드 내부 주석, 한 글자 변수명, 테스트 파일/프레임워크를 추가하지 않습니다. Node assert 검증 코드를 별도로 반환합니다.
- 검증: 상품 파서 정상/오류/중복/버전, 웹 결제·복원·광고의 무조건 미지원, 초기/성공/취소/보류/오류/상품 불일치/검증 없는 성공/verified false 권한 철회, 중복·지연·타임아웃과 늦은 응답, 재개 refresh, 스냅샷 불변성, 상점 오류 격리·포커스·기존 저장/게임 불변성.
- 실행하지 않은 테스트를 통과했다고 주장하지 않습니다. 네이티브 실제 결제·광고 검증은 Mac 필수 작업으로 남깁니다.
