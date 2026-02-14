# 오독오독 (Odok Odok)

AI·릴레이 소설과 집필이 만나는 모바일/웹 앱입니다.

## 주요 기능

- **홈**: 오늘의 책(장르별 선착순 1권), 주간 베스트, 금주 집필왕, 작품 홍보 구역
- **집필**: 1일 2회 집필(첫 회 무료, 2회차 잉크 소모), 장르·스타일·키워드 선택, 시리즈 이어쓰기·완결
- **잉크**: 출석·레벨업·집필 보상으로 획득, 독서·추가 집필·키워드 변경·후원·**작품 홍보(10개/48시간)** 에 사용
- **레벨·칭호**: 잉크 1개 사용 시 10 XP, 7단계 칭호(새싹→작가→숙련작가→베스트→스타→거장→마스터), 책 표지에 칭호 아이콘 표시
- **도서관/아카이브**: 내가 쓴 책, 즐겨찾기, 댓글·좋아요·완독

## 실행

```bash
npm install
npm run dev
```

## 빌드

- **웹**: `npm run build` → `dist/`
- **Android APK**:  
  1. `npm run build`  
  2. `npx cap sync android`  
  3. `android/gradlew.bat -p android assembleDebug` (Windows, JAVA_HOME 설정 필요)  
  → `android/app/build/outputs/apk/debug/app-debug.apk`

## 배포

- **Firebase Hosting**: `npm run deploy` 또는 `firebase deploy`
- **Firestore 규칙**: `firebase deploy --only firestore:rules`
- **Functions**: `firebase deploy --only functions` (환경 변수는 `functions/.env` 등 참고)

## 사용 설명서 (앱 내)

앱 내 **사용 설명서** 모달(물음표 아이콘)에서 다음을 안내합니다.

1. **집필 시스템**: 1일 2회, 선착순 발행, 광고로 무료 집필
2. **잉크 시스템**: 획득(출석/레벨업/보상), 사용(독서/집필/홍보 등), XP 적립
3. **레벨 & 칭호**: 7단계 구간별 혜택(출석 수, 후원, 독서·집필 비용 할인 등)
4. **작품 홍보**: 잉크 10개로 48시간 홈 홍보 구역 노출
5. **릴레이 시리즈**: 이어쓰기, 연재/완결 투표, 하루 1회 발행

---

React + Vite + Firebase + Capacitor(Android)
