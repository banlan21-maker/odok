# Google Play 스토어 배포용 AAB 설정 가이드

## 1. 현재 설정 상태 요약

| 항목 | 현재 값 | 배포 적합 |
|------|---------|-----------|
| versionCode | 1 | ✅ (출시 후 업데이트마다 1씩 증가 필요) |
| versionName | "1.0" | ✅ |
| compileSdk | 36 | ✅ |
| targetSdkVersion | 36 | ✅ (Play 정책 충족) |
| minSdkVersion | 24 | ✅ |
| release 빌드 타입 | 있음 | ✅ |
| **Release 서명** | **없음** | ❌ **필수 추가** |
| minifyEnabled (release) | false | ⚠️ 선택 (true 시 AAB 용량 감소) |

---

## 2. 필수: Release 서명 설정

Play Store에 올리는 AAB/APK는 **반드시 서명**해야 합니다. 한 번 출시한 앱은 같은 키로 계속 서명해야 업데이트가 가능하므로, **키스토어 파일을 안전하게 백업**해 두세요.

### 2-1. 키스토어 생성 (최초 1회)

아직 키스토어가 없다면 **PowerShell 또는 명령 프롬프트를 직접 열고** 아래를 실행하세요.  
(반드시 **프로젝트 루트**에서 시작한 뒤 `android\app`으로 이동해야 경로가 중복되지 않습니다.)

**PowerShell (한 줄):**
```powershell
cd E:\projects\odok-app\android\app
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore odok-release.keystore -alias odok -keyalg RSA -keysize 2048 -validity 10000
```

- `keytool`은 JDK에 포함되어 있으며, Android Studio JBR 경로를 사용했습니다. (JAVA_HOME이 다른 JDK라면 해당 `bin\keytool.exe` 경로로 바꾸세요.)
- 실행 후 **키스토어 비밀번호**(6자 이상), **키 비밀번호**(같은 값 권장), **이름/조직/도시 등**을 입력하라는 메시지가 나오면 입력합니다.
- 생성된 `odok-release.keystore` 파일이 `android/app/` 에 만들어집니다. 이 파일과 비밀번호는 **안전하게 백업**하세요.

### 2-2. 비밀번호 보안 (권장)

비밀번호를 `build.gradle`에 직접 쓰지 않고, `keystore.properties` 파일로 관리하는 것을 권장합니다.

**android/keystore.properties** (이 파일은 반드시 .gitignore에 포함해 저장소에 올리지 마세요):

```properties
storePassword=여기에_키스토어_비밀번호
keyPassword=여기에_키_비밀번호
keyAlias=odok
storeFile=app/odok-release.keystore
```

- `storeFile`: 키스토어 파일 경로. `android` 폴더 기준 상대 경로 (예: `app/odok-release.keystore`).

`app/build.gradle`에서는 **android/keystore.properties** 가 있으면 자동으로 `signingConfigs.release`를 적용합니다.  
이 파일이 없으면 `bundleRelease`는 실행되지만 release 빌드에 서명이 들어가지 않아(또는 디버그 키로 서명됨), **Play Console에는 정식 배포용으로 올릴 수 없습니다.** 반드시 키스토어 생성 후 `keystore.properties`를 작성하세요.  
예시 형식은 **android/keystore.properties.example** 를 참고하면 됩니다.

---

## 3. AAB 빌드 방법

서명 설정 후:

```powershell
cd E:\projects\odok-app
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\android\gradlew.bat -p android bundleRelease
```

생성 경로:  
`android/app/build/outputs/bundle/release/app-release.aab`

이 파일을 Google Play Console → 앱 → 프로덕션(또는 테스트 트랙) → 새 버전 만들기 → AAB 업로드에 사용하면 됩니다.

---

## 4. 버전 업데이트 시

매 출시/업데이트마다:

1. **versionCode**: 이전보다 **반드시 1 이상 커야** 함 (정수, 예: 1 → 2 → 3).
2. **versionName**: 사용자에게 보이는 버전 (예: "1.0" → "1.1").

`android/app/build.gradle`의 `defaultConfig`에서 수정:

```gradle
versionCode 2
versionName "1.1"
```

---

## 5. 선택: ProGuard(난독화/최적화)

현재 `minifyEnabled false`입니다. `true`로 바꾸면:

- AAB 크기 감소
- 난독화로 역공학 난이도 증가  
- 대신 ProGuard 규칙으로 일부 라이브러리/리플렉션 사용 시 크래시가 날 수 있어, 문제 나면 `proguard-rules.pro`에 `-keep` 규칙 추가가 필요합니다.

Capacitor/웹뷰 앱은 보통 그대로 두고, 나중에 필요하면 켜도 됩니다.

---

## 6. 체크리스트

- [ ] 키스토어 생성 및 백업 보관
- [ ] `keystore.properties` 작성 (또는 build.gradle에 직접 서명 정보 입력)
- [ ] `bundleRelease`로 AAB 생성 성공
- [ ] Play Console에서 앱 등록 및 스토어 등록정보·스크린샷 등 작성
- [ ] AAB 업로드 후 검토 제출
