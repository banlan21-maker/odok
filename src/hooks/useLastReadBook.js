// src/hooks/useLastReadBook.js
// 마지막으로 읽던 책(이어읽기) 정보를 가져오는 훅
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const MIN_RATIO = 0.02;
const COMPLETE_RATIO = 0.95;

export const useLastReadBook = ({ user, books }) => {
  const [lastReadBook, setLastReadBook] = useState(null);   // book 객체
  const [lastReadRatio, setLastReadRatio] = useState(0);   // 진행률 (0~1)
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !books || books.length === 0) return;

    const fetchLastRead = async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'reading_progress');
        const q = query(colRef, orderBy('updatedAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        if (snap.empty) return;

        // 유효한 진행률인 것 중 첫 번째
        for (const docSnap of snap.docs) {
          const { ratio } = docSnap.data();
          if (!ratio || ratio < MIN_RATIO || ratio > COMPLETE_RATIO) continue;

          const bookId = docSnap.id;
          const book = books.find(b => b.id === bookId);
          if (!book) continue;

          setLastReadBook(book);
          setLastReadRatio(ratio);
          break;
        }
      } catch {
        // 조회 실패는 무시
      }
    };

    fetchLastRead();
  }, [user, books]);

  const dismiss = () => setDismissed(true);

  // 책을 실제로 열면 바 숨기기
  const clearLastRead = () => {
    setLastReadBook(null);
    setLastReadRatio(0);
    setDismissed(false);
  };

  return {
    lastReadBook: dismissed ? null : lastReadBook,
    lastReadRatio,
    dismiss,
    clearLastRead,
  };
};
