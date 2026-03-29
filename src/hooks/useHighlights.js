import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useHighlights = ({ user }) => {
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    if (!user) { setHighlights([]); return; }
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'highlights'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  const addHighlight = async ({ text, bookId, bookTitle, authorNickname }) => {
    if (!user) return false;
    try {
      await addDoc(
        collection(db, 'artifacts', appId, 'users', user.uid, 'highlights'),
        {
          text,
          bookId: bookId || '',
          bookTitle: bookTitle || '',
          authorNickname: authorNickname || '익명',
          createdAt: new Date().toISOString(),
        }
      );
      return true;
    } catch (err) {
      console.error('하이라이트 저장 오류:', err);
      return false;
    }
  };

  const deleteHighlight = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'highlights', id));
    } catch (err) {
      console.error('하이라이트 삭제 오류:', err);
    }
  };

  return { highlights, addHighlight, deleteHighlight };
};
