// src/hooks/useNotificationHistory.js
// 인앱 알림 내역 (댓글, 좋아요, 팔로우 등) 조회
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useNotificationHistory = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'notifications');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.read).length);
    });

    return () => unsub();
  }, [user]);

  return { notifications, unreadCount };
};
