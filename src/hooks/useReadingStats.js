// src/hooks/useReadingStats.js
// 독서 히스토리 및 통계 (AI 스토리 완독 + 책 진행률)
import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useReadingStats = ({ user }) => {
  const [stats, setStats] = useState({
    totalReads: 0,
    thisMonthReads: 0,
    streak: 0,
    recentBooks: [],
    readHistory: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      try {
        // 1) AI 스토리 완독 히스토리
        const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'read_history');
        const historySnap = await getDocs(query(historyRef, orderBy('readAt', 'desc')));
        const readHistory = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2) 책 진행률 (읽는 중인 책)
        const progressRef = collection(db, 'artifacts', appId, 'users', user.uid, 'reading_progress');
        const progressSnap = await getDocs(query(progressRef, orderBy('updatedAt', 'desc')));
        const recentBooks = progressSnap.docs
          .map(d => ({ bookId: d.id, ...d.data() }))
          .filter(p => p.ratio > 0.02);

        // 이번 달 완독수
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const thisMonthReads = readHistory.filter(h => (h.readAt || '') >= thisMonthStart).length;

        // 연속 읽기 일수 (streak)
        const readDates = new Set(readHistory.map(h => (h.readAt || '').slice(0, 10)));
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          if (readDates.has(key)) streak++;
          else if (i > 0) break; // 오늘은 아직 안 읽었을 수 있으니 1일 여유
        }

        setStats({
          totalReads: readHistory.length,
          thisMonthReads,
          streak,
          recentBooks,
          readHistory,
        });
      } catch (err) {
        console.error('독서 통계 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user]);

  return { stats, loading };
};
