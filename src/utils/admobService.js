// src/utils/admobService.js
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// 구글이 제공하는 '보상형 광고' 공식 테스트 ID (절대 변경 금지)
const TEST_AD_UNIT_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_AD_UNIT_ID_IOS = 'ca-app-pub-3940256099942544/1712485313';

// 실제 ID
const REAL_AD_UNIT_ID_ANDROID = 'ca-app-pub-9517850144901016/2220729686';

export const initializeAdMob = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await AdMob.initialize({
            requestTrackingAuthorization: true,
            initializeForTesting: false,
        });
    } catch {
        // AdMob 초기화 실패 시 광고 없이 계속 진행
    }
};

export const showRewardVideoAd = async (onReward, onError) => {
    // 1. 웹 환경(PC) 테스트용: 바로 보상 지급
    if (!Capacitor.isNativePlatform()) {
        const confirmed = window.confirm('[테스트] 광고를 시청하시겠습니까?\n(확인을 누르면 2초 뒤 보상이 지급됩니다)');
        if (confirmed) {
            setTimeout(() => {
                onReward();
                alert('🎉 광고 시청 보상이 지급되었습니다!');
            }, 2000);
        } else {
            if (onError) onError('광고 시청을 취소했습니다.');
        }
        return;
    }

    // 2. 모바일 앱 환경: 실제 광고 송출
    try {
        const isIOS = Capacitor.getPlatform() === 'ios';
        const adId = isIOS ? TEST_AD_UNIT_ID_IOS : REAL_AD_UNIT_ID_ANDROID;

        // 기존 리스너 제거 (메모리 누수 방지)
        await AdMob.removeAllListeners();

        // 광고 로드 리스너
        AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
            AdMob.showRewardVideoAd();
        });

        // 보상 지급 리스너
        AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
            onReward();
        });

        // 광고 실패 리스너
        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
            if (onError) onError('광고를 불러오는데 실패했습니다.');
        });

        // 광고 요청
        await AdMob.prepareRewardVideoAd({
            adId: adId,
        });

    } catch {
        if (onError) onError('광고 시스템 오류가 발생했습니다.');
    }
};
