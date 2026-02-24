# 오독오독 (Odok Odok)

AI·릴레이 소설과 집필이 만나는 모바일/웹 앱입니다.

---

## 프로젝트 소개

AI가 만들어주는 나만의 책을 읽는 독서 앱입니다. 사용자가 장르를 선택하면 AI가 책을 생성해주고, 읽고, 보관할 수 있습니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19 + Vite + Tailwind CSS |
| 백엔드 | Firebase (Firestore, Functions, Auth, Hosting) |
| 모바일 | Capacitor (Android) |
| 광고 | AdMob (리워드 광고) |
| 언어 | JavaScript (JSX) |

---

## 주요 기능

- **홈**: 오늘의 책(장르별 선착순 1권), 주간 베스트, 금주 집필왕, 작품 홍보 구역
- **집필**: 1일 2회 집필(첫 회 무료, 2회차 잉크 소모), 장르·스타일·키워드 선택, 시리즈 이어쓰기·완결
- **잉크**: 출석·레벨업·집필 보상으로 획득, 독서·추가 집필·키워드 변경·후원·**작품 홍보(10개/48시간)** 에 사용
- **레벨·칭호**: 잉크 1개 사용 시 10 XP, 7단계 칭호(새싹→작가→숙련작가→베스트→스타→거장→마스터), 책 표지에 칭호 아이콘 표시
- **도서관/보관함**: 내가 쓴 책, 즐겨찾기, 댓글·좋아요·완독

---

## 프로젝트 구조

### src/ 폴더

```
src/
├── App.jsx                 # 메인 앱 (라우팅, 전역 모달)
├── main.jsx                # 진입점
├── firebase.js             # Firebase 설정
├── data.jsx                # 고정 데이터 (장르, 번역 텍스트 등)
├── FirebaseErrorBoundary.jsx
│
├── components/             # 화면 컴포넌트
│   ├── HomeView.jsx        # 홈 화면
│   ├── WriteView.jsx       # 집필(책 생성) 화면
│   ├── GenreSelectView.jsx # 장르 선택
│   ├── StoryListView.jsx   # 이야기 목록
│   ├── ReaderView.jsx      # 책 읽기 화면
│   ├── BookDetail.jsx      # 책 상세 정보
│   ├── LibraryView.jsx     # 서재
│   ├── LibraryMainView.jsx # 서재 메인
│   ├── ArchiveView.jsx     # 보관함
│   └── ProfileView.jsx     # 프로필/설정
│
├── hooks/                  # 비즈니스 로직 (기능 수정 시 우선 확인)
│   ├── useAuth.js          # 로그인/로그아웃
│   ├── useUserProfile.js   # 프로필, 레벨, 경험치
│   ├── useInkSystem.js     # 잉크 시스템 (차감/충전, 열람 권한)
│   ├── useBooks.js         # 책 로딩, 집필(생성)
│   ├── useStoryReader.js   # AI 소설 읽기, 번역, 투표
│   ├── useComments.js      # 댓글
│   └── useNotices.js       # 공지사항
│
└── utils/                  # 유틸리티
    ├── aiService.js        # AI 생성 요청 (Edge Function)
    ├── admobService.js     # 광고
    ├── levelUtils.js       # 레벨/경험치/잉크 비용
    ├── dateUtils.js        # 날짜 포맷
    ├── bookCovers.js       # 책 표지
    ├── formatGenre.js      # 장르 포맷
    └── numberFormat.js     # 숫자 포맷
```

### 기타 폴더

- `functions/` - Firebase Functions (서버, AI 책 생성 등)
- `android/` - Capacitor Android 네이티브

> **개발 팁**: 기능(로직) → `hooks/`, 화면(UI) → `components/`, 전역 설정 → `App.jsx`, `firebase.js`

---

## 실행 방법

```bash
npm install
npm run dev
```

---

## 빌드

| 대상 | 방법 |
|------|------|
| **웹** | `npm run build` → `dist/` |
| **Android APK (디버그)** | 1) `npm run build` 2) `npx cap sync android` 3) `android/gradlew.bat -p android assembleDebug` (Windows) → `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Android AAB (Play Store)** | 1) `npm run build` 2) `npx cap sync android` 3) `android/gradlew.bat -p android bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab` ※ 키스토어 필요 (`android/keystore.properties`) |

---

## 배포

- **Firebase Hosting**: `npm run deploy` 또는 `firebase deploy`
- **Firestore 규칙**: `firebase deploy --only firestore:rules`
- **Functions**: `firebase deploy --only functions`
- **자동 배포**: main 브랜치 push 시 GitHub Actions가 Firebase에 자동 배포

---

## 환경 변수

### 프로젝트 정보

- 프로젝트 ID: `odok-odok-final`
- Functions 리전: `asia-northeast3`

### 로컬 개발

**프론트엔드** (`npm run dev`)

- 프로젝트 루트 `.env`에 `VITE_FIREBASE_*` 변수 필요 (API 키 등)
- Firebase Console → 프로젝트 설정 → 웹 앱에서 복사

**Functions 에뮬레이터**

```powershell
# PowerShell
$env:GEMINI_API_KEY="your-key"
cd functions
firebase emulators:start --only functions
```

### GitHub Actions 자동 배포용 시크릿

**Settings → Secrets and variables → Actions** 에 추가:

| 시크릿 | 설명 |
|--------|------|
| `VITE_FIREBASE_API_KEY` | Firebase API 키 |
| `VITE_FIREBASE_AUTH_DOMAIN` | odok-odok-final.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | odok-odok-final |
| `VITE_FIREBASE_STORAGE_BUCKET` | odok-odok-final.firebasestorage.app |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 숫자 |
| `VITE_FIREBASE_APP_ID` | 웹 앱 ID |
| `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 JSON 전체 (Functions 배포용) |

### auth/invalid-api-key 오류 시

1. **배포 사이트**: GitHub Secrets에 `VITE_FIREBASE_*` 6개 확인 후 재배포
2. **로컬**: `.env`에 `VITE_FIREBASE_API_KEY=AIzaSy...` 등 확인, `npm run dev` 재시작
3. **API 키 제한**: Google Cloud Console에서 HTTP referrer에 접속 URL 추가

---

## 프로젝트 기본 정보 (초보자용)

- **언어**: JavaScript (웹 브라우저에서 동작)
- **프레임워크**: React (화면), Vite (빌드/개발)
- **배포**: Firebase Hosting (웹), Capacitor (Android)
- **백엔드**: Firebase Functions (AI 책 생성 등)
- **DB**: Firebase Firestore
- **인증**: Firebase Authentication

---

## 주의사항

- 이 프로젝트의 사용자는 비개발자입니다. 설명은 쉬운 말로 해주세요.
- 환경 변수(.env)나 비밀 키는 절대 커밋하지 마세요.
- 코드 수정 시 기존 스타일을 따라주세요.

---

## 앱 내 사용 설명서

앱 내 **프로필 탭 → 사용 설명서** 버튼에서 다음을 안내합니다.

1. **집필 시스템**: 1일 2회, 선착순 발행, 광고로 무료 집필
2. **잉크 시스템**: 획득(출석/레벨업/보상), 사용(독서/집필/홍보 등)
3. **레벨 & 칭호**: 7단계 구간별 혜택
4. **작품 홍보**: 잉크 10개로 48시간 홈 홍보 구역 노출
5. **릴레이 시리즈**: 이어쓰기, 연재/완결 투표

---

## 최근 업데이트 (2025-02-22)

### 영어 설정 시 UI 한글 잔존 수정

설정에서 언어를 영어로 변경했을 때 아래 항목들이 한글로 남아있던 문제를 수정했습니다.

1. **SUB GENRE (시리즈 세부 장르)**  
   - 웹소설형 → "Web novel style"  
   - 일반소설형 → "Classic novel style"

2. **GENRE / MOOD**  
   - 장르·분위기 옵션 선택 시 비교 로직을 `genre.id` 기반으로 변경하여 영문 설정 시에도 올바르게 표시

3. **MOOD 설명 문구**  
   - "날카롭고 건조한 문체. 숨 막히는 긴장감." 등 21개 mood 설명 전체 영문 번역 추가

4. **비소설 키워드**  
   - 에세이·자기계발·인문철학 키워드 95+81+87개 영문 번역 적용 (예: 새벽 → Dawn, 해질녘 → Dusk)

5. **비소설 SELECT STYLE**  
   - 담백한/건조한, 감성적인/시적인 등 스타일 옵션 12개 영문 번역 적용

6. **프로필 탭 레벨 칭호** (2025-02-22)  
   - 새싹·작가·숙련 작가·베스트 작가·스타 작가·거장·마스터 → Sprout, Author, Skilled Author 등 영문 표시

7. **레벨 게이지 "다음"**
   - "1920 XP · 다음 40 XP" → "1920 XP · Next 40 XP" 영문 표시

---

## 최근 업데이트 (2026-02-24)

### 다크 모드 추가

야간 독서를 위한 다크 모드를 전체 앱에 적용했습니다.

- **토글 위치**: 프로필 탭 → 어플 설정 → 테마 (🌞 라이트 / 🌙 다크)
- **저장 방식**: 언어·글자크기와 동일하게 저장 버튼 적용, Firestore에 영구 저장
- **적용 범위**: 전체 화면 (홈·서재·보관함·집필·책 상세·독서·프로필)
- **기술**: Tailwind `darkMode: 'class'` 전략, 루트 div에 `dark` 클래스 토글

**수정 파일**: `tailwind.config.js`, `useUserProfile.js`, `App.jsx`, `data.jsx`, `ProfileView.jsx`, `HomeView.jsx`, `LibraryView.jsx`, `ArchiveView.jsx`, `BookDetail.jsx`, `WriteView.jsx`, `ReaderView.jsx`

---

### 업적 해제 모달 중복 표시 버그 수정

페이지를 새로고침할 때마다 "첫 집필" 등 이미 해제된 업적 모달이 반복 표시되는 버그를 수정했습니다.

- **원인**: `useAchievements.js`에서 `userProfile`이 `null`인 초기 상태(로딩 전)를 실제 업적 없음과 동일하게 처리하여 기준선을 빈 Set으로 설정한 뒤, 실제 데이터가 도착하면 모든 기존 업적이 "신규"로 감지됨
- **수정**: `userProfile`이 null일 때는 기준선 설정을 건너뛰고 실제 데이터 도착 후에만 초기 기준선을 설정하도록 변경

**수정 파일**: `src/hooks/useAchievements.js`
