// src/hooks/usePushNotifications.js
// FCM 푸시 알림 토큰 등록 및 수신 처리
import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const usePushNotifications = ({ user }) => {
  useEffect(() => {
    // 네이티브 플랫폼(Android/iOS)에서만 실행
    if (!Capacitor.isNativePlatform() || !user) return;

    const register = async () => {
      // 권한 확인
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Push] 알림 권한 거부됨');
        return;
      }

      await PushNotifications.register();
    };

    // FCM 토큰 발급 → Firestore에 저장
    const tokenListener = PushNotifications.addListener('registration', async (token) => {
      try {
        await setDoc(
          doc(db, 'artifacts', appId, 'users', user.uid, 'fcm_tokens', 'device'),
          {
            token: token.value,
            updatedAt: serverTimestamp(),
            platform: Capacitor.getPlatform(),
          }
        );
      } catch (err) {
        console.error('[Push] 토큰 저장 오류:', err);
      }
    });

    // 권한 거부 또는 오류
    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] 등록 오류:', err);
    });

    // 앱이 포어그라운드일 때 알림 수신 (알림 표시)
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] 포어그라운드 알림:', notification.title);
    });

    // 알림 탭해서 앱 열었을 때
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] 알림 탭:', action.notification.data);
    });

    register();

    return () => {
      tokenListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [user]);
};
