# 오독(odok) - AI 독서 앱

## 프로젝트 소개
AI가 만들어주는 나만의 책을 읽는 독서 앱입니다.
사용자가 장르를 선택하면 AI가 책을 생성해주고, 읽고, 보관할 수 있습니다.

## 기술 스택
- **프론트엔드**: React 19 + Vite + Tailwind CSS
- **백엔드**: Firebase (Firestore, Functions, Auth, Hosting)
- **모바일**: Capacitor (Android)
- **광고**: AdMob (리워드 광고)
- **언어**: JavaScript (JSX)

## 프로젝트 구조
```
src/
  App.jsx              # 메인 앱 (라우팅, 상태 관리)
  firebase.js          # Firebase 설정
  data.jsx             # 데이터 관련
  components/          # 화면 컴포넌트들
    HomeView.jsx       # 홈 화면
    WriteView.jsx      # 글쓰기(책 생성) 화면
    GenreSelectView.jsx # 장르 선택
    ReaderView.jsx     # 책 읽기 화면
    BookDetail.jsx     # 책 상세 정보
    LibraryView.jsx    # 서재
    LibraryMainView.jsx # 서재 메인
    StoryListView.jsx  # 이야기 목록
    ArchiveView.jsx    # 보관함
    ProfileView.jsx    # 프로필/마이페이지
  utils/               # 유틸리티
    aiService.js       # AI 서비스 연동
    admobService.js    # 광고 서비스
    levelUtils.js      # 레벨/경험치 시스템
    dateUtils.js       # 날짜 처리
    bookCovers.js      # 책 표지
    formatGenre.js     # 장르 포맷
    numberFormat.js    # 숫자 포맷
  api/                 # API 관련
functions/             # Firebase Functions (서버)
  index.js             # 서버 함수들
android/               # Android 네이티브
```

## 주요 명령어
- `npm run dev` - 개발 서버 실행
- `npm run build` - 빌드
- `npm run deploy` - 빌드 후 Firebase 배포

## 배포
- main 브랜치에 push하면 GitHub Actions가 자동으로 Firebase에 배포

## 주의사항
- 이 프로젝트의 사용자는 비개발자입니다. 설명은 항상 쉬운 말로 해주세요.
- 환경 변수(.env)나 비밀 키는 절대 커밋하지 마세요.
- 코드 수정 시 기존 스타일을 따라주세요.
