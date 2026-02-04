/**
 * 레벨 및 경험치(XP) 기반 혜택 계산 유틸리티
 * - XP는 누적 기준, 잉크 소모 시에만 XP 지급 (1 잉크 = 10 XP)
 * - 레벨은 XP 구간에 따라 결정
 */

const XP_PER_INK = 10;  // 잉크 1개 소모 = 10 XP

/** 잉크 1개당 XP */
export const getXpPerInk = () => XP_PER_INK;

/**
 * 레벨 구간 테이블 (누적 XP 기준)
 * Lv 1~5: 0~500 (새싹)
 * Lv 6~10: 501~2,000 (작가)
 * Lv 11~20: 2,001~10,000 (베스트)
 * Lv 21~: 10,001~ (마스터)
 */
const LEVEL_TIERS = [
  { minLevel: 1, maxLevel: 5, minXp: 0, maxXp: 500, gradeName: '새싹', icon: '🌱', badge: null },
  { minLevel: 6, maxLevel: 10, minXp: 501, maxXp: 2000, gradeName: '작가', icon: '✍️', badge: null },
  { minLevel: 11, maxLevel: 20, minXp: 2001, maxXp: 10000, gradeName: '베스트', icon: '🏆', badge: 'silver' },
  { minLevel: 21, maxLevel: 99, minXp: 10001, maxXp: Infinity, gradeName: '마스터', icon: '👑', badge: 'gold' }
];

/** XP로부터 레벨 계산 (누적 XP → 레벨 1~99) */
export const getLevelFromXp = (xp = 0) => {
  const totalXp = Math.max(0, Number(xp) || 0);
  if (totalXp <= 500) return Math.min(5, 1 + Math.floor(totalXp / 100));
  if (totalXp <= 2000) return Math.min(10, 6 + Math.floor((totalXp - 501) / 300));
  if (totalXp <= 10000) return Math.min(20, 11 + Math.floor((totalXp - 2001) / 800));
  return Math.min(99, 21 + Math.floor((totalXp - 10001) / 1000));
};

/** 레벨에 해당하는 등급 정보 */
export const getGradeInfo = (level = 1) => {
  const lv = Math.max(1, Math.min(99, Number(level) || 1));
  const tier = LEVEL_TIERS.find(t => lv >= t.minLevel && lv <= t.maxLevel);
  return tier || LEVEL_TIERS[LEVEL_TIERS.length - 1];
};

/** 다음 레벨까지 필요한 XP (현재 구간 내) */
export const getXpToNextLevel = (xp = 0) => {
  const level = getLevelFromXp(xp);
  const tier = getGradeInfo(level);
  if (level >= 99) return 0;
  const xpInTier = xp - tier.minXp;
  const xpPerLevel = (tier.maxXp - tier.minXp) / (tier.maxLevel - tier.minLevel + 1);
  const currentLevelProgress = (level - tier.minLevel) * xpPerLevel;
  const nextLevelXp = (level - tier.minLevel + 1) * xpPerLevel;
  return Math.ceil(nextLevelXp - xpInTier);
};

/** 현재 구간 내 진행률 (0~100) */
export const getLevelProgressPercent = (xp = 0) => {
  const level = getLevelFromXp(xp);
  const tier = getGradeInfo(level);
  if (level >= 99) return 100;
  const xpInTier = xp - tier.minXp;
  const xpPerLevel = (tier.maxXp - tier.minXp) / (tier.maxLevel - tier.minLevel + 1);
  const currentLevelStart = (level - tier.minLevel) * xpPerLevel;
  const currentLevelEnd = (level - tier.minLevel + 1) * xpPerLevel;
  const progress = (xpInTier - currentLevelStart) / (currentLevelEnd - currentLevelStart);
  return Math.min(100, Math.max(0, Math.floor(progress * 100)));
};

// --- 정책 함수 ---

/** 선물하기(Donation) 가능 여부: Lv 6 이상 */
export const canDonate = (level = 1) => (level || 1) >= 6;

/** 출석 보상: Lv 1~5 → 3, Lv 6+ → 4 (기본 +1 추가) */
export const getAttendanceInk = (level = 1) => {
  return (level || 1) >= 6 ? 4 : 3;
};

/** 2회차 집필 비용: Lv 21+ → 4, 그 외 → 5 */
export const getExtraWriteInkCost = (level = 1) => {
  return (level || 1) >= 21 ? 4 : 5;
};

/** 1회 무료 집필 보상 (기존 유지) */
export const getFreeWriteRewardInk = (level = 1) => {
  return 5 + Math.floor((level || 1) / 3);
};

/** 독서 비용: Lv 11+ → 1, 그 외 → 2 */
export const getReadInkCost = (level = 1) => {
  return (level || 1) >= 11 ? 1 : 2;
};

/** 비소설 키워드 새로고침 무료 여부 (레벨 10 이상) */
export const isKeywordRefreshFree = (level = 1) => (level || 1) >= 10;

/** 레벨업 시 잉크 보너스 (기존 유지) */
export const getLevelUpInkBonus = () => 5;

/** 레벨에 해당하는 칭호 (등급명 반환) */
export const getTitleByLevel = (level = 1) => {
  return getGradeInfo(level).gradeName;
};
