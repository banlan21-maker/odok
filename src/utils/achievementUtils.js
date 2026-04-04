import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

// 16개 업적 — 4행 × 4열, 행별로 난이도 증가
export const ACHIEVEMENTS = [
  // ── 1행: 시작 단계 (쉬움) ──────────────────────────────
  {
    id: 'first_write',
    emoji: '✍️',
    title_ko: '첫 집필',
    title_en: 'First Write',
    desc_ko: '첫 번째 책을 집필했습니다',
    desc_en: 'Wrote your first book',
    condition: (p) => (p.bookCount || 0) >= 1
  },
  {
    id: 'first_read',
    emoji: '📖',
    title_ko: '첫 독서',
    title_en: 'First Read',
    desc_ko: '처음으로 다른 사람의 책을 읽었습니다',
    desc_en: 'Read someone\'s book for the first time',
    condition: (p) => (p.totalReadCount || 0) >= 1
  },
  {
    id: 'first_comment',
    emoji: '💬',
    title_ko: '첫 댓글',
    title_en: 'First Comment',
    desc_ko: '처음으로 댓글을 달았습니다',
    desc_en: 'Posted your first comment',
    condition: (p) => (p.totalCommentCount || 0) >= 1
  },
  {
    id: 'first_attend',
    emoji: '📅',
    title_ko: '첫 출석',
    title_en: 'First Attendance',
    desc_ko: '첫 출석 도장을 찍었습니다',
    desc_en: 'Checked in for the first time',
    condition: (p) => (p.attendanceStreak || 0) >= 1
  },

  // ── 2행: 조금 더 어렵게 ────────────────────────────────
  {
    id: 'writer_5',
    emoji: '📝',
    title_ko: '집필가',
    title_en: 'Writer',
    desc_ko: '책 5권을 집필했습니다',
    desc_en: 'Wrote 5 books',
    condition: (p) => (p.bookCount || 0) >= 5
  },
  {
    id: 'reader_5',
    emoji: '📕',
    title_ko: '독서가',
    title_en: 'Reader',
    desc_ko: '책 5권을 읽었습니다',
    desc_en: 'Read 5 books',
    condition: (p) => (p.totalReadCount || 0) >= 5
  },
  {
    id: 'streak_7',
    emoji: '🗓️',
    title_ko: '7일 연속',
    title_en: '7-Day Streak',
    desc_ko: '7일 연속으로 출석했습니다',
    desc_en: 'Attended 7 days in a row',
    condition: (p) => (p.attendanceStreak || 0) >= 7
  },
  {
    id: 'comment_5',
    emoji: '🗨️',
    title_ko: '댓글 달인',
    title_en: 'Commenter',
    desc_ko: '댓글을 5개 작성했습니다',
    desc_en: 'Posted 5 comments',
    condition: (p) => (p.totalCommentCount || 0) >= 5
  },

  // ── 3행: 더 어렵게 ────────────────────────────────────
  {
    id: 'writer_10',
    emoji: '📚',
    title_ko: '다작가',
    title_en: 'Prolific Writer',
    desc_ko: '책 10권을 집필했습니다',
    desc_en: 'Wrote 10 books',
    condition: (p) => (p.bookCount || 0) >= 10
  },
  {
    id: 'reader_10',
    emoji: '📗',
    title_ko: '다독가',
    title_en: 'Avid Reader',
    desc_ko: '책 10권을 읽었습니다',
    desc_en: 'Read 10 books',
    condition: (p) => (p.totalReadCount || 0) >= 10
  },
  {
    id: 'streak_30',
    emoji: '🔥',
    title_ko: '30일 연속',
    title_en: '30-Day Streak',
    desc_ko: '30일 연속으로 출석했습니다',
    desc_en: 'Attended 30 days in a row',
    condition: (p) => (p.attendanceStreak || 0) >= 30
  },
  {
    id: 'level_20',
    emoji: '🌟',
    title_ko: 'Lv.20 달성',
    title_en: 'Level 20',
    desc_ko: '레벨 20에 도달했습니다',
    desc_en: 'Reached level 20',
    condition: (p) => (p.level || 1) >= 20
  },

  // ── 4행: 매우 어렵게 ──────────────────────────────────
  {
    id: 'writer_30',
    emoji: '🏅',
    title_ko: '작가왕',
    title_en: 'Master Writer',
    desc_ko: '책 30권을 집필했습니다',
    desc_en: 'Wrote 30 books',
    condition: (p) => (p.bookCount || 0) >= 30
  },
  {
    id: 'reader_30',
    emoji: '🥇',
    title_ko: '독서왕',
    title_en: 'Master Reader',
    desc_ko: '책 30권을 읽었습니다',
    desc_en: 'Read 30 books',
    condition: (p) => (p.totalReadCount || 0) >= 30
  },
  {
    id: 'ink_500',
    emoji: '💎',
    title_ko: '잉크 거장',
    title_en: 'Ink Legend',
    desc_ko: '잉크를 500방울 사용했습니다',
    desc_en: 'Used 500 drops of ink',
    condition: (p) => (p.total_ink_spent || 0) >= 500
  },
  {
    id: 'level_50',
    emoji: '👑',
    title_ko: 'Lv.50 달성',
    title_en: 'Level 50',
    desc_ko: '레벨 50에 도달했습니다',
    desc_en: 'Reached level 50',
    condition: (p) => (p.level || 1) >= 50
  },
];

export const checkAndUnlockAchievements = async (uid, profile) => {
  try {
    const currentAchievements = profile.achievements || [];
    const currentIds = new Set(currentAchievements.map(a => a.id));

    const newAchievements = ACHIEVEMENTS
      .filter(ach => !currentIds.has(ach.id) && ach.condition(profile))
      .map(ach => ({ id: ach.id, unlockedAt: new Date().toISOString() }));

    if (newAchievements.length > 0) {
      const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
      await updateDoc(profileRef, {
        achievements: arrayUnion(...newAchievements)
      });
    }
  } catch (err) {
    console.error('업적 체크 오류:', err);
  }
};
