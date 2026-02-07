import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithCredential, signOut
} from 'firebase/auth';
import { auth } from '../firebase';
import { initializeAdMob } from '../utils/admobService';

export const useAuth = ({ setView, setUserProfile, viewRef }) => {
  const [user, setUser] = useState(null);
  const [showInAppBrowserWarning, setShowInAppBrowserWarning] = useState(false);
  const [detectedInAppBrowser, setDetectedInAppBrowser] = useState(null);
  const [detectedDevice, setDetectedDevice] = useState(null);

  // 인앱 브라우저 감지 함수
  const detectInAppBrowser = () => {
    if (typeof navigator === 'undefined') return null;

    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const ua = userAgent.toLowerCase();

    let device = 'unknown';
    if (/iphone|ipad|ipod/.test(ua)) {
      device = 'ios';
    } else if (/android/.test(ua)) {
      device = 'android';
    }

    let inAppBrowser = null;

    if (ua.includes('kakaotalk') || ua.includes('kakaostory')) {
      inAppBrowser = '카카오톡';
    } else if (ua.includes('instagram')) {
      inAppBrowser = '인스타그램';
    } else if (ua.includes('fban') || ua.includes('fbav')) {
      inAppBrowser = '페이스북';
    } else if (ua.includes('naver')) {
      inAppBrowser = '네이버';
    } else if (ua.includes('line')) {
      inAppBrowser = '라인';
    } else if (ua.includes('snapchat')) {
      inAppBrowser = '스냅챗';
    } else if (ua.includes('tiktok')) {
      inAppBrowser = '틱톡';
    } else if (ua.includes('wv')) {
      if (!ua.includes('chrome') && !ua.includes('edg') && !ua.includes('safari')) {
        inAppBrowser = '인앱 브라우저';
      }
    }

    return {
      isInApp: !!inAppBrowser,
      browserName: inAppBrowser,
      device: device
    };
  };

  // 인앱 브라우저 감지 + AdMob 초기화
  useEffect(() => {
    const detection = detectInAppBrowser();
    if (detection && detection.isInApp) {
      console.warn('⚠️ 인앱 브라우저 감지:', {
        browser: detection.browserName,
        device: detection.device,
        userAgent: navigator.userAgent
      });
      setDetectedInAppBrowser(detection.browserName);
      setDetectedDevice(detection.device);
      setShowInAppBrowserWarning(true);
    }

    initializeAdMob();
  }, []);

  // 1. 로그인 (Google 로그인 필수)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.isAnonymous) {
          console.log('⚠️ 익명 로그인 감지, 로그아웃 처리');
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setView('login');
        } else {
          console.log('✅ 인증 상태 변경 - 로그인됨:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          });
          setUser(user);
        }
      } else {
        console.log('❌ 인증 상태 변경 - 로그아웃됨');
        setUser(null);
        setUserProfile(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // Native silent sign-in
  useEffect(() => {
    const tryNativeSilentSignIn = async () => {
      if (!Capacitor.isNativePlatform()) return;
      if (auth.currentUser) return;
      try {
        const currentUserResult = await FirebaseAuthentication.getCurrentUser();
        if (!currentUserResult?.user) return;
        const tokenResult = await FirebaseAuthentication.getIdToken();
        if (!tokenResult?.token) return;
        const credential = GoogleAuthProvider.credential(tokenResult.token);
        await signInWithCredential(auth, credential);
      } catch (err) {
        console.warn('Native silent sign-in skipped:', err);
      }
    };

    tryNativeSilentSignIn();
  }, []);

  // 로컬 알림 리스너
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const setupNotificationListener = async () => {
      await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        console.log('알림 클릭됨:', notification);
        if (viewRef.current !== 'archive') {
          setView('archive');
        }
      });
    };
    setupNotificationListener();
    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, []);

  // Google 로그인 핸들러
  const handleGoogleLogin = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      console.log('🔐 Google 로그인 시도...');

      if (Capacitor.isNativePlatform()) {
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        const idToken = nativeResult?.credential?.idToken;
        if (!idToken) {
          throw new Error('Google 로그인 토큰을 가져올 수 없습니다.');
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        console.log('✅ Native Google 로그인 성공:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        });
        return;
      }

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      console.log('✅ Google 로그인 성공:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      });

    } catch (error) {
      console.error('❌ Google 로그인 실패:', error);

      let errorMessage = "로그인에 실패했습니다.";

      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "로그인 팝업이 닫혔습니다. 다시 시도해주세요.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "로그인이 취소되었습니다. 다시 시도해주세요.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(`로그인 오류\n\n${errorMessage}\n\n에러 코드: ${error.code || 'unknown'}`);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      }
      await signOut(auth);
      setView('profile_setup');
    } catch (e) { }
  };

  return {
    user,
    setUser,
    showInAppBrowserWarning,
    detectedInAppBrowser,
    detectedDevice,
    handleGoogleLogin,
    handleLogout
  };
};
