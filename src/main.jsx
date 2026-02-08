import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { FirebaseErrorBoundary } from './FirebaseErrorBoundary.jsx'

// Firebase 초기화가 import 시점에 실행되므로, 오류 시 흰 화면 대신 안내 표시
Promise.all([
  import('./firebase.js'),
  import('./App.jsx')
])
  .then(([, { default: App }]) => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <FirebaseErrorBoundary>
          <App />
        </FirebaseErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((err) => {
    const root = document.getElementById('root')
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:sans-serif;background:#f1f5f9;">
        <div style="max-width:400px;background:white;padding:32px;border-radius:16px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:16px;">Firebase 설정 오류</h1>
          <p style="font-size:14px;color:#64748b;margin-bottom:16px;line-height:1.6;">
            ${err?.code === 'auth/invalid-api-key' || err?.message?.includes('invalid-api-key') ? `
            <strong>auth/invalid-api-key</strong> 오류입니다.<br><br>
            • <strong>로컬</strong>: .env 파일에 VITE_FIREBASE_API_KEY가 있는지 확인<br>
            • <strong>배포</strong>: GitHub Secrets에 VITE_FIREBASE_* 설정 확인<br>
            • <strong>Google Cloud Console</strong> → API 키 → HTTP referrer에 접속 URL 추가
            ` : (err?.message || '알 수 없는 오류')}
          </p>
          <button onclick="location.reload()" style="width:100%;padding:12px;border-radius:12px;background:#f97316;color:white;font-weight:bold;border:none;cursor:pointer;">새로고침</button>
        </div>
      </div>
    `
    console.error('Firebase 초기화 실패:', err)
  })
