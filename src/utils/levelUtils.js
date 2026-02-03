/**
 * 레벨 기반 혜택 계산 유틸리티
 * - 출석 보상, 집필 비용/보상, 독서 비용, 키워드 새로고침 등
 */

const LEVEL_UP_INK_BONUS = 5;  // 레벨업 시 지급 잉크

/** 레벨업 시 잉크 보너스 */
export const getLevelUpInkBonus = () => LEVEL_UP_INK_BONUS;

/** 출석 보상: 1 + floor(level/5) → Lv1-4: 1, Lv5-9: 2, Lv10-14: 3... */
export const getAttendanceInk = (level = 1) => {
  return 1 + Math.floor((level || 1) / 5);
};

/** 2회차 집필 비용: 5 - floor(level/10), 최소 1 → Lv1-9: 5, Lv10-19: 4, Lv20-29: 3... */
export const getExtraWriteInkCost = (level = 1) => {
  return Math.max(1, 5 - Math.floor((level || 1) / 10));
};

/** 1회 무료 집필 보상: 5 + floor(level/3) → Lv1-2: 5, Lv3-5: 6, Lv6-8: 7... */
export const getFreeWriteRewardInk = (level = 1) => {
  return 5 + Math.floor((level || 1) / 3);
};

/** 독서 비용: max(0, 2 - floor(level/5)) → Lv1-4: 2, Lv5-9: 1, Lv10+: 0 */
export const getReadInkCost = (level = 1) => {
  return Math.max(0, 2 - Math.floor((level || 1) / 5));
};

/** 비소설 키워드 새로고침 무료 여부 (레벨 10 이상) */
export const isKeywordRefreshFree = (level = 1) => {
  return (level || 1) >= 10;
};

/** 레벨별 칭호 */
const TITLES_BY_LEVEL = [
  { minLevel: 1, title: '독서가' },
  { minLevel: 5, title: '열혈 독서가' },
  { minLevel: 10, title: '작가 지망생' },
  { minLevel: 15, title: '신인 작가' },
  { minLevel: 20, title: '베테랑 작가' },
  { minLevel: 30, title: '인기 작가' },
  { minLevel: 40, title: '스타 작가' },
  { minLevel: 50, title: '마스터 작가' },
  { minLevel: 70, title: '전설의 작가' },
  { minLevel: 99, title: '오독의 전설' }
].sort((a, b) => b.minLevel - a.minLevel); // 내림차순

/** 레벨에 해당하는 칭호 반환 */
export const getTitleByLevel = (level = 1) => {
  const lv = level || 1;
  const found = TITLES_BY_LEVEL.find(t => lv >= t.minLevel);
  return found ? found.title : '독서가';
};
