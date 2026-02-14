# Google 로그인 "no credentials available" 해결 – SHA-1 등록

## 원인
- 내부 테스트 빌드는 **릴리스(또는 Play App Signing) 키**로 서명됨.
- 현재 Firebase/Google에는 **디버그 키** SHA-1만 등록되어 있음 (`google-services.json`의 `9253e28...`).
- 서명 키가 다르면 Google Sign-In이 OAuth 클라이언트를 찾지 못해 **no credentials available** 발생.

---

## 1. 등록할 SHA-1 값 구하기

### A) Play Console에서 배포한 내부 테스트용 (가장 흔한 경우)
Google Play가 앱을 다시 서명하므로, **실제 기기에 설치된 앱의 서명**은 Play Console의 **앱 서명 키**입니다.

1. **Google Play Console** → [내 앱] → **오독오독** 선택  
2. **설정** → **앱 무결성** (또는 **앱 서명**)  
3. **앱 서명 키 인증서** 섹션에서 **SHA-1 인증서 지문** 복사  
   - 이 SHA-1을 Firebase / Google Cloud에 등록해야 함.

### B) 직접 설치한 release 빌드용 (AAB 직접 설치 시)
직접 `bundleRelease` 후 기기에 설치한 경우에는 **업로드(릴리스) 키스토어**의 SHA-1을 씁니다.

```powershell
keytool -list -v -keystore android\app\odok-release.keystore -alias odok
```
비밀번호 입력 후 출력에서 **SHA1:** 줄의 값을 복사 (콜론·공백 제거해도 됨).

---

## 2. SHA-1을 등록하는 곳

### (1) Firebase Console – 반드시
1. [Firebase Console](https://console.firebase.google.com/) → 프로젝트 **odok-odok-final** 선택  
2. ⚙️ **프로젝트 설정** → **일반** 탭  
3. **내 앱**에서 Android 앱 **com.banlan21.odok** 선택  
4. **디버그/릴리스 인증서 지문** 영역에서 **지문 추가**  
5. 위에서 복사한 **SHA-1** 붙여넣기 → 저장  
6. **(중요)** **google-services.json 다운로드** 후 프로젝트의  
   `android/app/google-services.json` 을 **덮어쓰기**

### (2) Google Cloud Console – 필요 시
Firebase에서 지문 추가 후에도 같은 오류가 나면 여기서도 확인합니다.

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 **odok-odok-final**  
2. **API 및 서비스** → **사용자 인증 정보**  
3. **OAuth 2.0 클라이언트 ID** 중 **Android** 타입 (패키지명 `com.banlan21.odok`) 선택  
4. **SHA-1 인증서 지문** 추가 후 저장  

(일반적으로 Firebase에서 지문 추가 후 새 `google-services.json` 쓰면 여기 설정도 연동됩니다.)

---

## 3. 구글 로그인 설정 점검

- **Capacitor**  
  - `capacitor.config.ts`에 `FirebaseAuthentication: { providers: ['google.com'] }` 있음 → OK.

- **Firebase Auth**  
  - Firebase Console → **빌드** → **Authentication** → **Sign-in method**  
  - **Google** 사용 설정됨, 지원 이메일 도메인 확인.

- **패키지명**  
  - `com.banlan21.odok`로 Firebase Android 앱과 `build.gradle`/`capacitor.config.ts` 일치함 → OK.

- **google-services.json**  
  - `android/app/google-services.json` 존재, Firebase에서 SHA-1 추가 후 **반드시 새 파일로 교체**.

---

## 4. 적용 순서 요약

1. Play Console **앱 서명** (또는 직접 빌드 시 keytool)에서 **SHA-1** 복사  
2. **Firebase** → 프로젝트 설정 → Android 앱 → 지문 추가 → **google-services.json 다시 다운로드**  
3. `android/app/google-services.json` 교체  
4. 앱 **클린 빌드** 후 내부 테스트에 다시 배포  
   ```powershell
   cd android
   .\gradlew.bat clean
   .\gradlew.bat bundleRelease
   ```  
5. 필요 시 Google Cloud Console에서 동일 SHA-1 확인  

이후 내부 테스트 버전에서 Google 로그인이 동작하는지 확인하면 됩니다.
