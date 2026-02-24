import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const ACHIEVEMENTS = [
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
    id: 'writer_5',
    emoji: '📝',
    title_ko: '집필가',
    title_en: 'Writer',
    desc_ko: '책 5권을 집필했습니다',
    desc_en: 'Wrote 5 books',
    condition: (p) => (p.bookCount || 0) >= 5
  },
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
    id: 'first_read',
    emoji: '📖',
    title_ko: '첫 독서',
    title_en: 'First Read',
    desc_ko: '처음으로 다른 사람의 책을 읽었습니다',
    desc_en: 'Read another person\'s book for the first time',
    condition: (p) => (p.totalReadCount || 0) >= 1
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
    id: 'reader_10',
    emoji: '📗',
    title_ko: '다독가',
    title_en: 'Avid Reader',
    desc_ko: '책 10권을 읽었습니다',
    desc_en: 'Read 10 books',
    condition: (p) => (p.totalReadCount || 0) >= 10
  },
  {
    id: 'streak_3',
    emoji: '📅',
    title_ko: '3일 연속 출석',
    title_en: '3-Day Streak',
    desc_ko: '3일 연속으로 출석했습니다',
    desc_en: 'Attended 3 days in a row',
    condition: (p) => (p.attendanceStreak || 0) >= 3
  },
  {
    id: 'streak_7',
    emoji: '🗓️',
    title_ko: '7일 연속 출석',
    title_en: '7-Day Streak',
    desc_ko: '7일 연속으로 출석했습니다',
    desc_en: 'Attended 7 days in a row',
    condition: (p) => (p.attendanceStreak || 0) >= 7
  },
  {
    id: 'level_10',
    emoji: '🌟',
    title_ko: '레벨 10 달성',
    title_en: 'Level 10',
    desc_ko: '레벨 10에 도달했습니다',
    desc_en: 'Reached level 10',
    condition: (p) => (p.level || 1) >= 10
  },
  {
    id: 'level_30',
    emoji: '⭐',
    title_ko: '레벨 30 달성',
    title_en: 'Level 30',
    desc_ko: '레벨 30에 도달했습니다',
    desc_en: 'Reached level 30',
    condition: (p) => (p.level || 1) >= 30
  },
  {
    id: 'comment_5',
    emoji: '💬',
    title_ko: '댓글 달인',
    title_en: 'Commenter',
    desc_ko: '댓글을 5개 작성했습니다',
    desc_en: 'Posted 5 comments',
    condition: (p) => (p.totalCommentCount || 0) >= 5
  },
  {
    id: 'ink_100',
    emoji: '💧',
    title_ko: '잉크 100 소비',
    title_en: 'Ink Master',
    desc_ko: '잉크를 100방울 사용했습니다',
    desc_en: 'Used 100 drops of ink',
    condition: (p) => (p.total_ink_spent || 0) >= 100
  }
];

export const checkAndUnlockAchievements = async (uid, profile) => {
  try {
    const currentAchievements = profile.achievements || [];
    const unlockedIds = new Set(currentAchievements.map(a => a.id));

    const newAchievements = ACHIEVEMENTS
      .filter(a => !unlockedIds.has(a.id) && a.condition(profile))
      .map(a => ({ id: a.id, unlockedAt: new Date().toISOString() }));

    if (newAchievements.length === 0) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
    await updateDoc(profileRef, {
      achievements: arrayUnion(...newAchievements)
    });

    console.log('🏆 새 업적 해제:', newAchievements.map(a => a.id));
  } catch (err) {
    console.error('업적 체크 오류:', err);
  }
};
