import { useState, useEffect, useRef } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

export const useFollows = ({ user, books }) => {
  const [follows, setFollows] = useState({}); // { [authorId]: { followedAt, nickname, profileImageUrl } }
  const initializedRef = useRef(false);
  const knownBookIdsRef = useRef(new Set());

  // 팔로우 컬렉션 구독
  useEffect(() => {
    if (!user) {
      setFollows({});
      initializedRef.current = false;
      return;
    }
    const followsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'follows');
    const unsub = onSnapshot(followsRef, (snap) => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setFollows(data);
    }, (err) => {
      console.warn('[팔로우] 구독 오류:', err);
    });
    return () => unsub();
  }, [user]);

  // 신작 실시간 감지 (books 변경 시 팔로우 작가 신작 체크)
  useEffect(() => {
    if (!user || !books.length) return;
    const followedIds = Object.keys(follows);

    // 첫 로드 시: 현재 책 목록을 "이미 아는 책"으로 등록하고 종료
    if (!initializedRef.current) {
      books.forEach(b => knownBookIdsRef.current.add(b.id));
      initializedRef.current = true;
      return;
    }

    if (followedIds.length === 0) return;

    // 새로 추가된 팔로우 작가의 책 감지
    const newBooks = books.filter(b => {
      if (knownBookIdsRef.current.has(b.id)) return false;
      if (!followedIds.includes(b.authorId)) return false;
      if (b.isAnonymous) return false;
      return true;
    });

    if (newBooks.length > 0) {
      newBooks.forEach(b => knownBookIdsRef.current.add(b.id));
      sendFollowNotifications(newBooks);
    }
  }, [books, follows, user]);

  const sendFollowNotifications = async (newBooks) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;

      for (const book of newBooks) {
        const authorNickname = follows[book.authorId]?.nickname || book.authorName || '작가';
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 900000) + 100000,
            title: `📚 ${authorNickname}님의 신작 등록!`,
            body: `"${book.title}"이(가) 등록되었습니다. 지금 확인해보세요.`,
            schedule: { at: new Date(Date.now() + 1000) }
          }]
        });
      }
    } catch (err) {
      console.warn('[팔로우] 알림 전송 실패:', err);
    }
  };

  const followAuthor = async (authorId, authorNickname, profileImageUrl) => {
    if (!user || user.uid === authorId) return false;
    try {
      const followRef = doc(db, 'artifacts', appId, 'users', user.uid, 'follows', authorId);
      await setDoc(followRef, {
        followedAt: serverTimestamp(),
        nickname: authorNickname || '익명',
        profileImageUrl: profileImageUrl || null
      });
      return true;
    } catch (err) {
      console.error('[팔로우] 팔로우 실패:', err);
      return false;
    }
  };

  const unfollowAuthor = async (authorId) => {
    if (!user) return false;
    try {
      const followRef = doc(db, 'artifacts', appId, 'users', user.uid, 'follows', authorId);
      await deleteDoc(followRef);
      return true;
    } catch (err) {
      console.error('[팔로우] 언팔로우 실패:', err);
      return false;
    }
  };

  const isFollowing = (authorId) => !!follows[authorId];

  return { follows, followAuthor, unfollowAuthor, isFollowing };
};
