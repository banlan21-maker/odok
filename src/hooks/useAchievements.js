import { useState, useEffect, useRef } from 'react';
import { ACHIEVEMENTS } from '../utils/achievementUtils';

export const useAchievements = ({ userProfile }) => {
  const [achievementToShow, setAchievementToShow] = useState(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const prevAchievementIdsRef = useRef(null);

  useEffect(() => {
    // userProfile이 null이면 (로그아웃 상태) 기준선 리셋 후 대기
    if (!userProfile) {
      prevAchievementIdsRef.current = null;
      return;
    }

    const currentAchievements = userProfile.achievements || [];
    const currentIds = currentAchievements.map(a => a.id);

    // 첫 실제 프로필 로드 시 기준선만 설정 (모달 미표시)
    if (prevAchievementIdsRef.current === null) {
      prevAchievementIdsRef.current = new Set(currentIds);
      return;
    }

    const prevIds = prevAchievementIdsRef.current;
    const newIds = currentIds.filter(id => !prevIds.has(id));

    if (newIds.length > 0) {
      const newId = newIds[0];
      const achDef = ACHIEVEMENTS.find(a => a.id === newId);
      if (achDef) {
        setAchievementToShow(achDef);
        setShowAchievementModal(true);
      }
      prevAchievementIdsRef.current = new Set(currentIds);
    } else {
      prevAchievementIdsRef.current = new Set(currentIds);
    }
  }, [userProfile?.achievements]);

  return {
    achievementToShow,
    showAchievementModal,
    setShowAchievementModal
  };
};
