# 오독오독 개선 과제

> 마지막 업데이트: 2026-04-11 | 현재 버전: v2.1.0 (versionCode 16)

---

## 🔴 1순위 — 리텐션/핵심 UX

### ✅ [v2.1.0] 하이라이트·공유 기능 Android 미작동
- **원인**: 기능이 사용되지 않는 BookReader(ReaderView Mode 1)에 구현되어 있었음. 실제 책 읽기는 BookDetail에서 이루어짐
- **해결**:
  - BookDetail에 커스텀 선택 메뉴(하이라이트 저장/공유) 이전
  - MainActivity.java에 `onActionModeStarted` 추가 (네이티브 플로팅 툴바 차단)
  - selectionchange 200ms 지연으로 레이스 컨디션 해결
  - getBoundingClientRect 폴백 + savedTextRef 캐싱
  - 불필요한 BookReader(Mode 1) 제거

### ✅ [v2.0.2] 푸시 알림 시스템 구현
- `@capacitor/push-notifications` + FCM
- Cloud Functions 트리거: 댓글/좋아요/팔로우 → 작가에게 알림

### ✅ [v2.1.0] 읽기 진행률 저장/복원
- **원인**: BookReader에만 구현되어 있었고, 언마운트 시 clearTimeout이 저장을 취소하는 버그
- **해결**:
  - BookDetail에 useReadingProgress 연결
  - 언마운트 시 fire-and-forget 즉시 저장
  - ResizeObserver로 정확한 복원 타이밍
  - 완독(95%+) 시 clearProgress 자동 호출

### ✅ [v2.1.0] 이어읽기 바 미작동
- **원인**: useLastReadBook이 앱 시작 시 한 번만 조회 + 진행률 저장 자체가 안 됨
- **해결**:
  - refreshTrigger로 리더 종료 시 재조회 (1.5s 지연으로 저장 완료 대기)
  - ContinueReadingBar가 BookDetail로 열도록 변경
  - 최소 체류시간 30초로 조정

---

## 🟠 2순위 — 데이터 신뢰성

### ✅ [v2.1.0] 댓글수(commentCount) 필드 신뢰성 문제
- **원인**: book_comments에 addDoc/deleteDoc만 하고 book 문서의 commentCount 미갱신
- **해결**: 댓글 추가 시 `increment(1)`, 삭제 시 `increment(-1)` 추가

### ✅ [v2.1.0] 구버전 APK 강제 업데이트
- v2.0.0+ 사용자: Firestore `app_settings/version_info.min_version` 비교 → 정상 작동
- v1.0.9 이하: 버전체크 코드 자체가 없어 대응 불가 → Play Store 자동 업데이트 의존
- APP_VERSION 하드코딩 → 2.1.0 동기화 완료

### ⬜ 좋아요/즐겨찾기 카운트 음수 방지
- `increment(-1)` 호출 시 0 이하로 떨어질 수 있음 (빠른 더블탭 등)
- **필요 작업**: Cloud Function에서 음수 방지 트리거 또는 클라이언트에서 0 체크 후 호출

---

## 🟡 3순위 — 성능

### ⬜ 전체 책 데이터를 한 번에 로드
- `books` 배열 전체를 Firestore `onSnapshot`으로 로드 후 클라이언트에서 filter/sort
- 책이 수백 권 이상이면 로드 시간·메모리 문제 발생
- **필요 작업**: Firestore 쿼리 기반 페이지네이션 (limit + startAfter)

### ⬜ 검색 품질 한계
- Firestore는 부분 문자열 full-text 검색 미지원
- 현재 클라이언트 `Array.filter + includes()`로 검색 → 전체 로드 필요
- **필요 작업**: Algolia / Typesense 연동 또는 Firestore 배열 인덱스 패턴 적용

### ⬜ 공유 이미지 생성 속도
- `html2canvas`는 모바일에서 느림 (특히 배경 이미지 + 텍스트 조합)
- **필요 작업**: Canvas API 직접 사용하거나 서버사이드 이미지 생성 검토

### ⬜ App 번들 크기 (730KB+ gzip 197KB)
- 단일 App 청크가 730KB로 Vite 경고 발생
- **필요 작업**: `React.lazy` + 동적 import로 코드 스플리팅 (BookDetail, StoreView 등)

---

## 🟢 4순위 — 기능 추가

### ⬜ 독서 히스토리/통계
- 내가 읽은 책 목록, 이번 달 몇 권 읽었는지 등 통계 화면 없음
- `completions` + `reading_progress` 데이터 활용 가능

### ⬜ 알림 내역 화면 (인앱 알림함)
- 푸시 알림은 있으나 앱 내에서 지난 알림을 확인할 수 있는 화면 없음
- **필요 작업**: Firestore `notifications` 컬렉션 + 알림 목록 UI

### ⬜ 책 쓰기 중 임시저장 명확화
- 장문 작성 중 실수로 뒤로가면 내용이 날아갈 수 있음
- **필요 작업**: 자동저장 상태 표시 또는 이탈 시 경고 다이얼로그

### ⬜ 팔로우 작가 신작 알림
- 팔로우한 작가가 새 책을 올리면 푸시 알림
- Cloud Functions 트리거: books 문서 생성 → 작가의 팔로워들에게 알림

### ⬜ 오프라인 읽기 (캐싱)
- 네트워크 없을 때 이전에 읽던 책 본문을 볼 수 없음
- **필요 작업**: Service Worker 또는 Capacitor Storage로 최근 읽은 책 본문 캐싱

### ⬜ 글자 크기 설정 영구 저장
- 현재 글자 크기 선택이 세션 내에서만 유지 (앱 재시작 시 초기화)
- **필요 작업**: Firestore 또는 localStorage에 사용자 설정 저장

### ⬜ 시리즈 구독 및 새 화 알림
- 시리즈물을 구독하면 새 에피소드 발행 시 알림
- **필요 작업**: `series_subscriptions` 컬렉션 + Cloud Functions 트리거

---

## 완료 목록

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-04-11 | v2.1.0 | 하이라이트/공유 메뉴 BookDetail로 이전 (근본 수정) |
| 2026-04-11 | v2.1.0 | 읽기 진행률 저장 — 언마운트 즉시 저장 + ResizeObserver 복원 |
| 2026-04-11 | v2.1.0 | 이어읽기 바 — refreshTrigger 재조회 + BookDetail 연결 |
| 2026-04-11 | v2.1.0 | 댓글수 commentCount increment 동기화 |
| 2026-04-11 | v2.1.0 | APP_VERSION 2.1.0 동기화, 불필요 BookReader 제거 |
| 2026-04-11 | v2.1.0 | MainActivity.java onActionModeStarted 추가 |
| 2026-04-05 | v2.0.2 | 푸시 알림 시스템 (댓글/팔로우/선물 트리거) |
| 2026-04-05 | v2.0.2 | 우편함 시스템 (선물/잉크 수령 UI) |
| 2026-04-05 | v2.0.2 | 보관함 탭+그리드 UI, 미리보기 모달, 통계 통일 |
| 2026-04-05 | v2.0.2 | 익명 댓글 작성자 프로필 클릭 차단 |
