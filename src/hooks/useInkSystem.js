import { useState, useEffect } from 'react';
import {
  doc, setDoc, getDoc, updateDoc, increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { showRewardVideoAd } from '../utils/admobService';
import { getLevelFromXp, getXpPerInk, getLevelUpInkBonus, getReadInkCost, getExtraWriteInkCost } from '../utils/levelUtils';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const INK_MAX = 999;

export const useInkSystem = ({ user, userProfile, setView, setError, setSelectedBook }) => {
  const [showInkConfirmModal, setShowInkConfirmModal] = useState(false);
  const [pendingBook, setPendingBook] = useState(null);
  const [pendingBookData, setPendingBookData] = useState(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(null);

  // 월간 챌린지 결산 state
  const [challengeResult, setChallengeResult] = useState(null); // null | { result: 'success'|'fail', monthKey, reads, goal }

  // 매월 1일: 지난달 챌린지 결산 (Firestore 직접 읽어 stale 방지)
  useEffect(() => {
    if (!user?.uid) return;

    const settle = async () => {
      try {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        const snap = await getDoc(profileRef);
        if (!snap.exists()) return;
        const data = snap.data();

        const cm = data.challenge_month;
        if (!cm) return;

        const CHALLENGE_START = '2026_04';
        if (cm < CHALLENGE_START) return;

        const now = new Date();
        const thisMonthKey = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;

        // challenge_month가 지난 달 → 아직 결산 안 됐으면 결산
        if (cm >= thisMonthKey) return;
        if (data.challenge_settled_month === cm) return;

        const reads = data.challenge_reads || 0;
        const goal = 5;
        const alreadyClaimed = data.challenge_claimed === true;

        // 수동 수령(challenge_claimed)을 이미 한 경우 잉크 중복 지급 방지
        if (reads >= goal && !alreadyClaimed) {
          await addInk(10);
        }
        await updateDoc(profileRef, { challenge_settled_month: cm, challenge_claimed: reads >= goal });
        setChallengeResult({ result: reads >= goal ? 'success' : 'fail', monthKey: cm, reads, goal });
      } catch (err) {
        console.error('챌린지 결산 오류:', err);
      }
    };

    settle();
  // user.uid가 확정된 후 1회만 실행 (로그인 시)
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // 잉크 차감 (XP: 1잉크=10XP, total_ink_spent 누적, 레벨업 시 잉크 보너스)
  const deductInk = async (amount) => {
    if (!user || !userProfile) return false;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    try {
      const currentXp = userProfile.xp ?? 0;
      const xpGain = amount * getXpPerInk();
      const newXp = currentXp + xpGain;
      const oldLevel = getLevelFromXp(currentXp);
      const nextLevel = getLevelFromXp(newXp);
      const leveledUp = nextLevel > oldLevel;
      const levelUpBonus = leveledUp ? getLevelUpInkBonus() : 0;
      const inkDelta = -amount + levelUpBonus;

      const updateData = {
        ink: increment(inkDelta),
        xp: newXp,
        total_ink_spent: increment(amount),
        level: nextLevel
      };

      await updateDoc(profileRef, updateData);

      if (leveledUp) {
        setNewLevel(nextLevel);
        setShowLevelUpModal(true);
      }

      return true;
    } catch (err) {
      console.error('잉크 차감 오류:', err);
      return false;
    }
  };

  // 잉크 충전
  const addInk = async (amount) => {
    if (!user || !userProfile) return false;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    try {
      const profileSnap = await getDoc(profileRef);
      const currentInk = profileSnap.exists() ? (profileSnap.data().ink || 0) : (userProfile?.ink || 0);
      const nextInk = Math.min(INK_MAX, currentInk + amount);
      await updateDoc(profileRef, {
        ink: nextInk
      });

      console.log(`✅ 잉크 +${amount} 충전 완료`);
      return true;
    } catch (err) {
      console.error('잉크 충전 오류:', err);
      return false;
    }
  };

  // 잉크 확인 후 책 열기 (24시간 이내 재방문은 무료)
  const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24시간

  const openBookWithInkCheck = async (book) => {
    // 본인 책은 무조건 무료
    if (book.authorId === user?.uid) {
      setSelectedBook(book);
      setView('book_detail');
      return;
    }

    // 이미 해금된 책인지 확인 (24시간 이내)
    try {
      const unlockedRef = doc(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories', book.id);
      const unlockedSnap = await getDoc(unlockedRef);
      if (unlockedSnap.exists()) {
        const { unlockedAt } = unlockedSnap.data();
        const elapsed = Date.now() - new Date(unlockedAt).getTime();
        if (elapsed < UNLOCK_DURATION_MS) {
          // 24시간 이내 → 무료로 열기
          setSelectedBook(book);
          setView('book_detail');
          return;
        }
      }
    } catch (e) { /* 조회 실패 시 기존 흐름 진행 */ }

    const requiredInk = getReadInkCost(getLevelFromXp(userProfile?.xp ?? 0));
    if (requiredInk === 0) {
      setSelectedBook(book);
      setView('book_detail');
      if (book.authorId !== user?.uid) {
        try {
          await updateDoc(doc(db, 'artifacts', appId, 'books', book.id), { views: increment(1) });
        } catch (e) { }
      }
      return;
    }
    const currentInk = userProfile?.ink || 0;
    setPendingBook(book);
    setShowInkConfirmModal(true);
    if (currentInk < requiredInk) {
      setError('잉크가 부족합니다! 💧 잉크를 충전해주세요.');
    } else {
      setError(null);
    }
  };

  // 책 열기 (잉크 차감 후)
  const confirmOpenBook = async (isAdReward = false) => {
    if (!pendingBook) return;
    const requiredInk = getReadInkCost(getLevelFromXp(userProfile?.xp ?? 0));

    if (!isAdReward) {
      if ((userProfile?.ink || 0) < requiredInk) {
        alert("보유 잉크가 없어요\n잉크 충전 또는 광고를 보고 잉크를 모아보세요");
        return;
      }

      const success = await deductInk(requiredInk);
      if (!success) {
        setError('잉크 차감에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      console.log(`✅ 책 열기 완료: 잉크 -${requiredInk}, 경험치 +${requiredInk}`);
    } else {
      console.log("📺 광고 시청 보상: 잉크 차감 없이 책 열기");
    }

    const unlockedRef = doc(db, 'artifacts', appId, 'users', user.uid, 'unlocked_stories', pendingBook.id);
    await setDoc(unlockedRef, {
      unlockedAt: new Date().toISOString()
    }, { merge: true });

    if (pendingBook.authorId !== user?.uid) {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'books', pendingBook.id), {
          views: increment(1)
        });
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        await updateDoc(profileRef, {
          totalReadCount: increment(1),
        });
      } catch (viewErr) {
        console.error('조회수 증가 실패:', viewErr);
      }
    }

    setPendingBook(null);
    setShowInkConfirmModal(false);
    setError(null);

    setSelectedBook(pendingBook);
    setView('book_detail');
  };

  // 광고 보고 책 읽기 핸들러
  const handleWatchAdForRead = async () => {
    showRewardVideoAd(
      async () => {
        await confirmOpenBook(true);
      },
      (errMsg) => {
        setError(errMsg);
      }
    );
  };

  const handleBookClick = (book) => {
    openBookWithInkCheck(book);
  };

  return {
    showInkConfirmModal,
    setShowInkConfirmModal,
    pendingBook,
    setPendingBook,
    pendingBookData,
    setPendingBookData,
    showLevelUpModal,
    setShowLevelUpModal,
    newLevel,
    setNewLevel,
    deductInk,
    addInk,
    openBookWithInkCheck,
    confirmOpenBook,
    handleWatchAdForRead,
    handleBookClick,
    challengeResult,
    setChallengeResult,
  };
};
