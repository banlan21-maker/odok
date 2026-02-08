// Import the functions you need from the SDKs you need
import { Capacitor } from "@capacitor/core";
import { initializeApp } from "firebase/app";
import { getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 환경 변수 누락 시 명확한 오류 표시 (흰 화면 방지)
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
  const msg = "Firebase API 키가 설정되지 않았습니다.\n\n"
    + "• 로컬: 프로젝트 루트에 .env 파일이 있고 VITE_FIREBASE_API_KEY 값이 있는지 확인하세요.\n"
    + "• 배포: GitHub Secrets에 VITE_FIREBASE_* 값을 설정했는지 확인하세요.\n"
    + "• 자세한 내용: 환경변수_확인_가이드.md";
  console.error(msg);
  throw new Error("Firebase 설정 오류: VITE_FIREBASE_API_KEY가 없습니다. 콘솔(F12)을 확인하세요.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3'); // 서울 리전으로 변경
export const storage = getStorage(app);

export default app;
