# Design: odok-app (오독 - AI 독서 앱)

## 1. 아키텍처 개요

```
[React SPA] → [Firebase Auth] → [Firestore] ← [Firebase Functions]
     ↓                                              ↓
[Capacitor]                                   [Gemini AI API]
(Android)
```

- **클라이언트**: React 19 SPA (Vite 빌드, Tailwind CSS)
- **인증**: Firebase Auth (Google OAuth)
- **데이터베이스**: Cloud Firestore
- **서버 로직**: Firebase Functions v2 (asia-northeast3)
- **AI 엔진**: Google Gemini 2.0/2.5 Flash (폴백 체인)
- **모바일**: Capacitor 8 (Android)
- **배포**: Firebase Hosting + GitHub Actions

## 2. 컴포넌트 설계

### 2.1 화면 구성

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| HomeView | `src/components/HomeView.jsx` | 홈 화면 (신작, 베스트셀러, 인기작가, 출석) |
| WriteView | `src/components/WriteView.jsx` | 책 생성 UI (장르/키워드/분위기 선택) |
| GenreSelectView | `src/components/GenreSelectView.jsx` | 하위장르 선택 |
| StoryListView | `src/components/StoryListView.jsx` | 장르별 이야기 목록 |
| ReaderView | `src/components/ReaderView.jsx` | 이야기 읽기 (별점/댓글/번역) |
| BookDetail | `src/components/BookDetail.jsx` | 책 상세 (댓글/좋아요/시리즈/잉크쏘기) |
| LibraryView | `src/components/LibraryView.jsx` | 서재 (전체 책 브라우징) |
| LibraryMainView | `src/components/LibraryMainView.jsx` | 서재 장르 선택 |
| ArchiveView | `src/components/ArchiveView.jsx` | 보관함 (내 책 + 즐겨찾기) |
| ProfileView | `src/components/ProfileView.jsx` | 프로필/설정 |

### 2.2 커스텀 훅 설계

| 훅 | 파일 | 역할 |
|----|------|------|
| useAuth | `src/hooks/useAuth.js` | Google 로그인/로그아웃, 디바이스 감지 |
| useUserProfile | `src/hooks/useUserProfile.js` | 프로필 관리, 출석, XP 추적 |
| useBooks | `src/hooks/useBooks.js` | 책 CRUD, 실시간 구독, 슬롯 관리 |
| useInkSystem | `src/hooks/useInkSystem.js` | 잉크 차감/충전, 레벨업 보너스 |
| useComments | `src/hooks/useComments.js` | 이야기 댓글, 보상 시스템 |
| useStoryReader | `src/hooks/useStoryReader.js` | 이야기 읽기, 별점, 즐겨찾기, 번역 |
| useNotices | `src/hooks/useNotices.js` | 관리자 공지사항 CRUD |

### 2.3 유틸리티 설계

| 유틸 | 파일 | 역할 |
|------|------|------|
| aiService | `src/utils/aiService.js` | Firebase Functions 호출 (책 생성/번역/삭제) |
| admobService | `src/utils/admobService.js` | AdMob 리워드 광고 |
| levelUtils | `src/utils/levelUtils.js` | XP/레벨 계산, 잉크 비용 정책 |
| dateUtils | `src/utils/dateUtils.js` | 날짜 포맷, 일별 키 생성 |
| bookCovers | `src/utils/bookCovers.js` | 책 표지 이미지 생성 |
| formatGenre | `src/utils/formatGenre.js` | 장르 태그 포맷 |
| numberFormat | `src/utils/numberFormat.js` | 숫자 포맷 |

## 3. 데이터 모델 (Firestore)

### 3.1 컬렉션 구조

```
/artifacts/{appId}/
  ├── users/{userId}/
  │   ├── profile/info              # 프로필 정보
  │   ├── ink_history/{historyId}   # 잉크 거래 기록
  │   ├── story_rewards/{rewardId}  # 이야기 보상 기록
  │   ├── unlocked_stories/{id}     # 해금된 이야기
  │   ├── read_history/{id}         # 읽기 기록
  │   └── daily_stats/{dateKey}     # 일별 통계
  │
  ├── books/{bookId}                # 사용자 생성 책
  │
  └── public/data/
      ├── stories/{storyId}         # AI 생성 이야기
      ├── comments/{commentId}      # 이야기 댓글
      ├── book_comments/{id}        # 책 댓글
      ├── ratings/{ratingId}        # 별점
      ├── favorites/{favId}         # 이야기 즐겨찾기
      ├── book_favorites/{favId}    # 책 즐겨찾기
      ├── book_likes/{likeId}       # 책 좋아요
      ├── book_completions/{id}     # 완독 기록
      ├── series_votes/{voteId}     # 시리즈 투표
      ├── reports/{reportId}        # 오류 신고
      └── daily_series_slot/{date}  # 일별 시리즈 슬롯

/notices/{noticeId}                 # 전역 공지사항
```

### 3.2 주요 문서 스키마

**users/{userId}/profile/info:**
```
{ nickname, language, fontSize, ink, xp, level,
  total_ink_spent, dailyWriteCount, lastBookCreatedDate,
  attendanceDays, lastAttendanceDate, createdAt }
```

**books/{bookId}:**
```
{ title, content, summary, category, subCategory, genre, keywords,
  authorId, authorName, selectedMood, endingStyle,
  isSeries, seriesId, episodes[], synopsis, characterSheet, settingSheet,
  status, views, likes, favorites, completions, createdAt }
```

**public/data/book_comments/{id}:**
```
{ bookId, userId, authorName, text, parentId, parentAuthorName, createdAt, editedAt }
```

## 4. Firestore 보안 규칙 설계

| 컬렉션 | read | create | update | delete |
|--------|------|--------|--------|--------|
| users/{uid}/profile/info | 공개 | 본인 | 본인 + 잉크선물(ink필드만) | 본인 |
| users/{uid}/ink_history | 본인 | 로그인 | - | - |
| users/{uid}/기타 | 본인 | 본인 | 본인 | 본인 |
| books | 공개 | 로그인+본인저자 | 로그인 | 본인+관리자 |
| book_comments | 공개 | 로그인+본인 | 본인 | 본인 |
| book_likes | 공개 | 로그인 | 로그인 | 로그인 |
| book_favorites | 공개 | 로그인 | 로그인 | 로그인 |
| book_completions | 공개 | 로그인 | 로그인 | 로그인 |
| comments | 공개 | 로그인+본인 | 본인 | 본인 |
| ratings | 공개 | 로그인+본인 | 본인 | - |
| stories | 공개 | 로그인 | 본인저자+관리자 | - |
| daily_series_slot | 공개 | 로그인 | 로그인 | 로그인 |
| notices | 공개 | 관리자 | 관리자 | 관리자 |

## 5. Firebase Functions 설계

| 함수 | 트리거 | 역할 |
|------|--------|------|
| generateBookAI | HTTPS Callable | AI 책 생성 (Gemini, 폴백 체인) |
| generateSeriesEpisode | HTTPS Callable | 시리즈 다음 화 생성 (맥락 보존) |
| analyzeReportAI | HTTPS Callable | 오류 신고 분석 (승인/거절) |
| translateStoryAI | HTTPS Callable | 이야기 번역 |
| deleteBookAdmin | HTTPS Callable | 관리자 책 삭제 (관련 데이터 일괄) |

## 6. 라우팅 설계 (App.jsx 뷰 상태)

| view 상태 | 화면 | 설명 |
|-----------|------|------|
| profile_setup | 프로필 초기 설정 | 최초 로그인 시 |
| home | 홈 | 기본 화면 |
| write | 글쓰기 | 책 생성 |
| genre_select | 장르 선택 | 하위 장르 선택 |
| list | 이야기 목록 | 장르별 목록 |
| reader | 이야기 읽기 | 읽기 뷰어 |
| library | 서재 | 전체 책 목록 |
| library_main | 서재 메인 | 장르 선택 |
| book_detail | 책 상세 | 상세/시리즈 |
| archive | 보관함 | 내 책/즐겨찾기 |
| profile | 프로필 | 설정 |
| notice_list | 공지사항 | 공지 목록 |

## 7. 잉크/레벨 경제 설계

### 7.1 레벨 티어

| 티어 | 레벨 | XP 범위 | 혜택 |
|------|------|---------|------|
| 새싹 | 1-5 | 0-500 | 기본 |
| 작가 | 6-10 | 501-2000 | 잉크선물 해금, 출석+1 |
| 베스트 | 11-20 | 2001-10000 | 읽기 비용 2→1, 키워드갱신 무료 |
| 마스터 | 21+ | 10001+ | 추가집필 비용 5→4 |

### 7.2 잉크 흐름

| 행위 | 잉크 변동 | XP |
|------|----------|-----|
| 출석 | +2(기본), +3(Lv6+) | - |
| 레벨업 | +5 | - |
| 1일 1회 집필 | 무료 | - |
| 추가 집필 | -5 (Lv21+ -4) | +50(+40) |
| 읽기 해금 | -2 (Lv11+ -1) | +20(+10) |
| 잉크 선물 | -N (보내기) / +N (받기) | 보내는 쪽 N*10 |
| 광고 시청 | 비용 면제 | - |

## 8. 구현 순서

1. Firebase 설정 + 인증
2. 데이터 모델 + Firestore 규칙
3. 홈 화면 + 서재
4. 책 생성 (AI Functions)
5. 책 읽기 + 상호작용 (댓글/좋아요/즐겨찾기)
6. 잉크/레벨 시스템
7. 시리즈 시스템
8. 관리자 기능
9. 모바일 (Capacitor) + 광고
10. 배포 자동화
