// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJrA5mHDNrVN0TN92CUmxDakgnrAYlTEs",
  authDomain: "odok-odok-final.firebaseapp.com",
  projectId: "odok-odok-final",
  storageBucket: "odok-odok-final.firebasestorage.app",
  messagingSenderId: "38540467550",
  appId: "1:38540467550:web:5b64f927eb744d2cfb03cf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3'); // 서울 리전으로 변경
export const storage = getStorage(app);

export default app;
