/**
 * 레벨 및 경험치(XP) 기반 혜택 계산 유틸리티
 * - XP는 누적 기준, 잉크 소모 시에만 XP 지급 (1 잉크 = 10 XP)
 * - 레벨은 XP 구간에 따라 결정
 *
 * 7단계 칭호 시스템:
 * 1단계 (Lv.1~10)  새싹       🌱  기본 혜택
 * 2단계 (Lv.11~20) 작가       ✏️  후원 기능 오픈
 * 3단계 (Lv.21~40) 숙련 작가  🪶  비소설 키워드 새로고침 무료
 * 4단계 (Lv.41~60) 베스트 작가 🖊️  독서 비용 할인 (2→1)
 * 5단계 (Lv.61~80) 스타 작가  ✒️  집필 비용 1차 할인 (5→4)
 * 6단계 (Lv.81~98) 거장       🖋️  기본 혜택
 * 7단계 (Lv.99)    마스터     🌈  집필 비용 최종 할인 (5→3), 프로필 전용 테두리
 * (출석 잉크는 레벨과 무관하게 하루 1개)
 */

const XP_PER_INK = 10;  // 잉크 1개 소모 = 10 XP

// Constants
export const INK_MAX = 999;
export const INITIAL_INK = 10;
export const DAILY_WRITE_LIMIT = 2;
export const DAILY_FREE_WRITES = 1;

/** 잉크 1개당 XP */
export const getXpPerInk = () => XP_PER_INK;

/**
 * 레벨 구간 테이블 (7단계)
 * badgeStyle: 책 목록에서 작가 뱃지 색상
 */
const LEVEL_TIERS = [
  { minLevel: 1,  maxLevel: 10, gradeName: '새싹',      gradeKey: 'sprout',  icon: '🌱', badge: null,      badgeStyle: 'bg-green-500' },
  { minLevel: 11, maxLevel: 20, gradeName: '작가',      gradeKey: 'author',  icon: '✏️', badge: null,      badgeStyle: 'bg-orange-500' },
  { minLevel: 21, maxLevel: 40, gradeName: '숙련 작가',  gradeKey: 'skilled', icon: '🪶', badge: null,      badgeStyle: 'bg-orange-600' },
  { minLevel: 41, maxLevel: 60, gradeName: '베스트 작가', gradeKey: 'best',   icon: '🖊️', badge: 'bronze',  badgeStyle: 'bg-amber-700' },
  { minLevel: 61, maxLevel: 80, gradeName: '스타 작가',  gradeKey: 'star',   icon: '✒️', badge: 'silver',  badgeStyle: 'bg-slate-400' },
  { minLevel: 81, maxLevel: 98, gradeName: '거장',      gradeKey: 'grand',   icon: '🖋️', badge: 'gold',    badgeStyle: 'bg-amber-500' },
  { minLevel: 99, maxLevel: 99, gradeName: '마스터',     gradeKey: 'master', icon: '🌈', badge: 'rainbow', badgeStyle: 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500' }
];

/**
 * XP로부터 레벨 계산 (누적 XP → 레벨 1~99)
 * 레벨 N 달성에 필요한 XP = N² × 10
 */
export const getLevelFromXp = (xp = 0) => {
  const totalXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(Math.sqrt(totalXp / XP_PER_INK));
  return Math.max(1, Math.min(99, level));
};

/** 특정 레벨 시작에 필요한 누적 XP */
const getXpForLevel = (level) => level * level * XP_PER_INK;

/** 레벨에 해당하는 등급 정보 */
export const getGradeInfo = (level = 1) => {
  const lv = Math.max(1, Math.min(99, Number(level) || 1));
  const tier = LEVEL_TIERS.find(t => lv >= t.minLevel && lv <= t.maxLevel);
  return tier || LEVEL_TIERS[LEVEL_TIERS.length - 1];
};

/** 다음 레벨까지 필요한 XP */
export const getXpToNextLevel = (xp = 0) => {
  const level = getLevelFromXp(xp);
  if (level >= 99) return 0;
  const nextLevelXp = getXpForLevel(level + 1);
  return Math.max(0, nextLevelXp - xp);
};

/** 현재 레벨 내 진행률 (0~100) */
export const getLevelProgressPercent = (xp = 0) => {
  const level = getLevelFromXp(xp);
  if (level >= 99) return 100;
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const range = nextLevelXp - currentLevelXp;
  if (range <= 0) return 100;
  const progress = (xp - currentLevelXp) / range;
  return Math.min(100, Math.max(0, Math.floor(progress * 100)));
};

// --- 정책 함수 ---

/** 선물하기(Donation) 가능 여부: 작가 등급 (Lv.11) 이상 */
export const canDonate = (level = 1) => (level || 1) >= 11;

/**
 * 출석 보상 잉크: 레벨과 무관하게 하루 1개 (2026-06 밸런스 조정)
 * (인자는 호출부 호환을 위해 유지하되 사용하지 않음)
 */
export const getAttendanceInk = () => 1;

/**
 * 2회차 집필 비용:
 * 새싹~베스트(1~60): 5
 * 스타~거장(61~98): 4
 * 마스터(99): 3
 */
export const getExtraWriteInkCost = (level = 1) => {
  const lv = level || 1;
  if (lv >= 99) return 3;
  if (lv >= 61) return 4;
  return 5;
};

/**
 * 독서 비용:
 * 새싹~숙련(1~40): 2
 * 베스트 작가+(41+): 1
 */
export const getReadInkCost = (level = 1) => {
  return (level || 1) >= 41 ? 1 : 2;
};

/** 비소설 키워드 새로고침 무료 여부 (숙련 작가: 레벨 21 이상) */
export const isKeywordRefreshFree = (level = 1) => (level || 1) >= 21;

/** 레벨업 시 잉크 보너스 (기존 유지) */
export const getLevelUpInkBonus = () => 5;

/** 레벨에 해당하는 칭호 (등급명 반환) */
export const getTitleByLevel = (level = 1) => {
  return getGradeInfo(level).gradeName || '새싹';
};

/** 마스터 여부 (프로필 전용 테두리 등) */
export const isMaster = (level = 1) => (level || 1) >= 99;
