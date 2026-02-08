# Firebase 배포 가이드

## Firestore 규칙 변경 시

`firestore.rules` 파일을 수정한 후, **로컬 변경사항이 Firebase 서버에 자동으로 적용되지 않습니다.**

다음 명령어로 규칙만 배포해야 합니다:

```bash
firebase deploy --only firestore:rules
```

- `--only firestore:rules`: Firestore 보안 규칙만 배포 (Functions, Hosting 등은 제외)
- 전체 배포: `firebase deploy`

## Functions 배포

Cloud Functions를 수정한 경우:

```bash
cd functions
npm run deploy
# 또는
firebase deploy --only functions
```
