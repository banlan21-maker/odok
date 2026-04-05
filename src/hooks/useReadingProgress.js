// src/hooks/useReadingProgress.js
// 읽기 진행률(스크롤 위치)을 Firestore에 저장·복원
import { useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const SCROLL_CONTAINER_ID = 'main-content';
const DEBOUNCE_MS = 1500;        // 스크롤 멈춘 후 1.5초 뒤 저장
const MIN_RATIO = 0.02;          // 2% 미만은 처음으로 간주 → 저장 안 함
const COMPLETE_RATIO = 0.95;     // 95% 이상은 완독으로 간주 → 저장 안 함
const MIN_READ_TIME_MS = 60000;  // 최소 1분 이상 머물러야 저장

export const useReadingProgress = ({ user, bookId, enabled = true }) => {
  const timerRef = useRef(null);
  const restoredRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const getContainer = () => document.getElementById(SCROLL_CONTAINER_ID);

  const getProgressRef = useCallback(() => {
    if (!user || !bookId) return null;
    return doc(db, 'artifacts', appId, 'users', user.uid, 'reading_progress', bookId);
  }, [user, bookId]);

  // 진행률 저장 (디바운스)
  const schedulesSave = useCallback(() => {
    if (!user || !bookId || !enabled) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const el = getContainer();
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;
      const ratio = el.scrollTop / maxScroll;
      if (ratio < MIN_RATIO || ratio > COMPLETE_RATIO) return;
      // 1분 미만 체류는 저장하지 않음 (이어읽기 바에 노출 방지)
      if (Date.now() - startTimeRef.current < MIN_READ_TIME_MS) return;
      try {
        const ref = getProgressRef();
        if (!ref) return;
        await setDoc(ref, { ratio, updatedAt: serverTimestamp() }, { merge: true });
      } catch { /* 저장 실패는 무시 */ }
    }, DEBOUNCE_MS);
  }, [user, bookId, enabled, getProgressRef]);

  // 마운트 시 저장된 위치로 복원
  useEffect(() => {
    if (!user || !bookId || !enabled || restoredRef.current) return;

    const restore = async () => {
      try {
        const ref = getProgressRef();
        if (!ref) return;
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const { ratio } = snap.data();
        if (!ratio || ratio < MIN_RATIO) return;

        // DOM이 그려진 뒤 복원 (약간 지연)
        setTimeout(() => {
          const el = getContainer();
          if (!el) return;
          const maxScroll = el.scrollHeight - el.clientHeight;
          if (maxScroll <= 0) return;
          el.scrollTop = ratio * maxScroll;
          restoredRef.current = true;
        }, 300);
      } catch { /* 복원 실패는 무시 */ }
    };

    restore();
  }, [user, bookId, enabled, getProgressRef]);

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    if (!user || !bookId || !enabled) return;

    const el = getContainer();
    if (!el) return;

    el.addEventListener('scroll', schedulesSave, { passive: true });
    return () => {
      el.removeEventListener('scroll', schedulesSave);
      clearTimeout(timerRef.current);
    };
  }, [user, bookId, enabled, schedulesSave]);

  // 완독 시 진행률 삭제 (처음부터 다시 읽도록)
  const clearProgress = useCallback(async () => {
    try {
      const ref = getProgressRef();
      if (!ref) return;
      await setDoc(ref, { ratio: 0, updatedAt: serverTimestamp() }, { merge: true });
    } catch { /* 무시 */ }
  }, [getProgressRef]);

  return { clearProgress };
};
