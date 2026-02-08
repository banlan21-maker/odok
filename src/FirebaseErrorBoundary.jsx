import { Component } from "react";

/**
 * Firebase 초기화 실패(예: invalid-api-key) 시 흰 화면 대신 안내 메시지 표시
 */
export class FirebaseErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Firebase/앱 초기화 오류:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const isAuthError = this.state.error?.code === "auth/invalid-api-key" ||
        this.state.error?.message?.includes("invalid-api-key") ||
        this.state.error?.message?.includes("API 키");

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <h1 className="text-xl font-black text-slate-800 mb-4">
              설정 오류
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              {isAuthError ? (
                <>
                  Firebase API 키 오류가 발생했습니다.
                  <br /><br />
                  <strong>원인</strong>
                  <br />
                  • 로컬: <code className="bg-slate-100 px-1 rounded">.env</code> 파일과 <code className="bg-slate-100 px-1 rounded">VITE_FIREBASE_API_KEY</code> 확인
                  <br />
                  • 배포: GitHub Secrets에 <code className="bg-slate-100 px-1 rounded">VITE_FIREBASE_*</code> 설정 여부
                  <br />
                  • Google Cloud Console → API 키에서 <strong>HTTP referrer</strong> 제한 확인 (접속 URL이 허용 목록에 있어야 함)
                </>
              ) : (
                this.state.error?.message || "알 수 없는 오류"
              )}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
