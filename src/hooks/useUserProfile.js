import { useState, useEffect, useRef } from 'react';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, increment, deleteDoc, getDocs, collection
} from 'firebase/firestore';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase';
import { getTodayDateKey } from '../utils/dateUtils';
import { getLevelFromXp, getAttendanceInk, getXpToNextLevel, getLevelProgressPercent, DAILY_WRITE_LIMIT } from '../utils/levelUtils';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const INK_MAX = 999;
const INITIAL_INK = 10;

export const useUserProfile = ({ user, setView, setError, viewRef }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [tempNickname, setTempNickname] = useState("");
  const [language, setLanguage] = useState('ko');
  const [fontSize, setFontSize] = useState('text-base');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [lastAttendanceInk, setLastAttendanceInk] = useState(1);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const checkAttendance = async (profileRef, today) => {
    try {
      const snap = await getDoc(profileRef);
      const data = snap.exists() ? snap.data() : {};
      const currentInk = data.ink || 0;
      const level = getLevelFromXp(data.xp ?? 0);
      const attendanceInk = getAttendanceInk(level);
      const nextInk = Math.min(INK_MAX, currentInk + attendanceInk);
      await updateDoc(profileRef, { lastAttendanceDate: today, ink: nextInk });
      setLastAttendanceInk(attendanceInk);
      setShowAttendanceModal(true);
    } catch (e) { }
  };

  // 프로필 구독 및 초기화
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

    const initProfile = async () => {
      try {
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
          console.log('신규 유저 감지, 프로필 문서 생성:', user.uid);
          const initialProfileData = {
            nickname: '',
            language: 'ko',
            fontSize: 'text-base',
            points: 0,
            xp: 0,
            level: 1,
            total_ink_spent: 0,
            ink: INITIAL_INK,
            bookCount: 0,
            dailyGenerationCount: 0,
            dailyFreeReadUsed: false,
            lastGeneratedDate: '',
            lastSeriesGeneratedDate: '',
            lastReadDate: '',
            lastAttendanceDate: '',
            dailyWriteCount: 0,
            lastBookCreatedDate: null,
            lastNicknameChangeDate: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          await setDoc(profileRef, initialProfileData);
          console.log('✅ 프로필 문서 생성 완료');

          setUserProfile(initialProfileData);
          setTempNickname('');
          setLanguage('ko');
          setFontSize('text-base');

          console.log('📍 프로필 설정 화면으로 이동 (신규 유저)');
          setView('profile_setup');
          return;
        }

        const data = profileSnap.data();

        const needsUpdate = {};
        if (data.ink === undefined || data.ink === null) {
          needsUpdate.ink = INITIAL_INK;
        }
        if (data.level === undefined || data.level === null) {
          needsUpdate.level = 1;
        }
        if (data.xp === undefined || data.xp === null) {
          needsUpdate.xp = 0;
        }
        if (data.total_ink_spent === undefined || data.total_ink_spent === null) {
          needsUpdate.total_ink_spent = 0;
        }
        if (data.dailyWriteCount === undefined || data.dailyWriteCount === null) {
          needsUpdate.dailyWriteCount = 0;
        }
        if (data.lastBookCreatedDate === undefined) {
          needsUpdate.lastBookCreatedDate = null;
        }
        if (data.lastNicknameChangeDate === undefined) {
          needsUpdate.lastNicknameChangeDate = null;
        }

        if (Object.keys(needsUpdate).length > 0) {
          try {
            await updateDoc(profileRef, needsUpdate);
            return;
          } catch (err) {
            console.error('프로필 초기화 오류:', err);
          }
        }

        setUserProfile(data);
        setTempNickname(data.nickname || '');
        if (data.language) setLanguage(data.language);
        if (data.fontSize) setFontSize(data.fontSize);

        const today = getTodayString();
        if (data.lastAttendanceDate !== today) checkAttendance(profileRef, today);

        if (!data.nickname || data.nickname.trim() === '') {
          console.log('📍 프로필 설정 화면으로 이동 (닉네임 없음)');
          setView('profile_setup');
        } else {
          console.log('🏠 홈 화면으로 이동 (닉네임 있음:', data.nickname, ')');
          if (viewRef.current === 'login' || viewRef.current === 'profile_setup' || !viewRef.current) {
            setView('home');
          }
        }
      } catch (err) {
        console.error('프로필 초기화 오류:', err);
        setError('프로필을 불러오는데 실패했습니다.');
      }
    };

    initProfile();

    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('📊 프로필 스냅샷 업데이트:', {
          hasNickname: !!data.nickname,
          nickname: data.nickname || '(없음)'
        });

        setUserProfile(data);
        if (data.nickname) {
          setTempNickname(data.nickname);
        }
        if (data.language) setLanguage(data.language);
        if (data.fontSize) setFontSize(data.fontSize);

        const today = getTodayString();
        if (data.lastAttendanceDate !== today) checkAttendance(profileRef, today);

        if (!data.nickname || data.nickname.trim() === '') {
          if (viewRef.current === 'home' || viewRef.current === 'profile' || viewRef.current === 'login') {
            console.log('📍 프로필 설정 화면으로 이동 (snapshot: 닉네임 없음)');
            setView('profile_setup');
          }
        } else {
          if (viewRef.current === 'profile_setup' || viewRef.current === 'login') {
            console.log('🏠 홈 화면으로 이동 (snapshot: 닉네임 있음:', data.nickname, ')');
            setView('home');
          }
        }
      } else {
        console.warn('⚠️ 프로필 문서가 존재하지 않습니다.');
        if (viewRef.current !== 'profile_setup' && viewRef.current !== 'login') {
          setView('profile_setup');
        }
      }
    }, (err) => {
      console.error("❌ Profile snapshot error:", err);
      setError('프로필을 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    });

    return () => unsubscribe();
  }, [user]);

  // 닉네임 변경 제한 로직 포함한 saveProfile 함수
  const saveProfile = async () => {
    if (!tempNickname.trim()) return;
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      const profileSnap = await getDoc(profileRef);
      const currentProfile = profileSnap.exists() ? profileSnap.data() : null;

      const newNickname = tempNickname.trim();
      const isNicknameChanged = currentProfile?.nickname && currentProfile.nickname !== newNickname;

      if (isNicknameChanged && currentProfile?.lastNicknameChangeDate) {
        const lastChangeDate = currentProfile.lastNicknameChangeDate?.toDate?.()
          || (currentProfile.lastNicknameChangeDate?.seconds
            ? new Date(currentProfile.lastNicknameChangeDate.seconds * 1000)
            : null);

        if (lastChangeDate) {
          const now = new Date();
          const daysSinceLastChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));

          if (daysSinceLastChange < 30) {
            const remainingDays = 30 - daysSinceLastChange;
            setError(`닉네임은 한 달에 한 번만 변경 가능합니다. (${remainingDays}일 후 변경 가능)`);
            return;
          }
        }
      }

      if (newNickname.length > 6) {
        setError('닉네임은 최대 6글자까지 입력 가능합니다.');
        return;
      }

      const nicknamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
      if (!nicknamePattern.test(newNickname)) {
        setError('닉네임은 한글, 영어, 숫자, 공백만 사용할 수 있습니다.');
        return;
      }

      const isFirstTimeUser = !currentProfile?.lastNicknameChangeDate && !currentProfile?.nickname;
      const isOnlySettingsChange = !isNicknameChanged && currentProfile?.nickname === newNickname;

      const updateData = {
        language: language,
        fontSize: fontSize,
        updatedAt: serverTimestamp()
      };

      if (!currentProfile?.nickname || isNicknameChanged) {
        updateData.nickname = newNickname;
        if (isNicknameChanged && !isFirstTimeUser) {
          updateData.lastNicknameChangeDate = serverTimestamp();
        }
      }

      await setDoc(profileRef, updateData, { merge: true });

      console.log('✅ 프로필 저장 완료:', {
        ...updateData,
        isFirstTimeUser,
        isOnlySettingsChange,
        isNicknameChanged
      });

      setUserProfile((prev) => ({
        ...prev,
        ...updateData,
        nickname: newNickname
      }));

      if (viewRef.current === 'profile_setup') {
        setView('home');
      }

      if (isFirstTimeUser) {
        setShowSaveSuccessModal(true);
      } else if (isOnlySettingsChange) {
        alert('설정이 저장되었습니다.');
      } else if (isNicknameChanged) {
        alert(`닉네임이 "${newNickname}"으로 변경되었습니다.`);
      }
    } catch (e) {
      console.error("Save failed", e);
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 개발용 리셋
  const handleDevReset = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const confirmMessage = '⚠️ 개발용 리셋 기능입니다.\n\n다음 작업이 수행됩니다:\n1. 오늘 시리즈 집필 슬롯 초기화\n2. 내 프로필 정보 (닉네임/잉크/레벨 등) 초기화\n3. 페이지 새로고침\n\n※ 기존에 생성된 책과 통계는 그대로 유지됩니다.\n\n계속하시겠습니까?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log('🔄 개발용 리셋 시작...');

      const dailySeriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily_series_slot');
      const dailySeriesSnapshot = await getDocs(dailySeriesRef);
      const dailySeriesDeletePromises = dailySeriesSnapshot.docs.map((slotDoc) => deleteDoc(slotDoc.ref));
      await Promise.all(dailySeriesDeletePromises);
      console.log(`✅ 시리즈 집필 슬롯 ${dailySeriesSnapshot.docs.length}개 초기화 완료`);

      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await updateDoc(profileRef, {
        nickname: null,
        lastNicknameChangeDate: null,
        ink: INITIAL_INK,
        level: 1,
        xp: 0,
        total_ink_spent: 0,
        dailyWriteCount: 0,
        lastBookCreatedDate: null,
        updatedAt: serverTimestamp()
      });

      console.log('✅ 유저 정보 초기화 완료');

      alert('리셋이 완료되었습니다. 페이지를 새로고침합니다.');
      window.location.reload();

    } catch (error) {
      console.error('❌ 리셋 실패:', error);
      alert(`리셋에 실패했습니다: ${error.message}`);
    }
  };

  // 포인트 획득
  const earnPoints = async (amount) => {
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await updateDoc(profileRef, { points: increment(amount) });
    } catch (e) {
      console.error("Points update failed", e);
    }
  };

  // 계정 탈퇴
  const handleDeleteAccount = async () => {
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        await deleteDoc(profileRef);
        console.log('✅ 프로필 문서 삭제 완료');
      }

      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === user.uid) {
        await deleteUser(currentUser);
        console.log('✅ Firebase Auth 계정 삭제 완료');
      }

      await signOut(auth);

      console.log('✅ 계정 탈퇴 완료');
      setView('login');
      setUserProfile(null);
      setError(null);
    } catch (err) {
      console.error('계정 탈퇴 오류:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인한 후 탈퇴해주세요.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      } else {
        setError('계정 탈퇴에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  return {
    userProfile,
    setUserProfile,
    tempNickname,
    setTempNickname,
    language,
    setLanguage,
    fontSize,
    setFontSize,
    showAttendanceModal,
    setShowAttendanceModal,
    lastAttendanceInk,
    showSaveSuccessModal,
    setShowSaveSuccessModal,
    saveProfile,
    handleDevReset,
    handleDeleteAccount,
    getTodayString,
    appId,
    INITIAL_INK,
    INK_MAX,
    earnPoints,
    levelInfo: userProfile ? {
      level: getLevelFromXp(userProfile.xp ?? 0),
      nextLevelXp: getXpToNextLevel(userProfile.xp ?? 0),
      progress: getLevelProgressPercent(userProfile.xp ?? 0)
    } : { level: 1, nextLevelXp: 100, progress: 0 },
    remainingDailyWrites: userProfile ? Math.max(0, DAILY_WRITE_LIMIT - (userProfile.lastBookCreatedDate === getTodayString() ? (userProfile.dailyWriteCount || 0) : 0)) : 2,
    dailyWriteCount: userProfile && userProfile.lastBookCreatedDate === getTodayString() ? (userProfile.dailyWriteCount || 0) : 0,
    lastBookCreatedDate: userProfile?.lastBookCreatedDate || null,
    isNoticeAdmin: user?.email === 'admin@odok.app' // 예시: 관리자 이메일 하드코딩 또는 DB 확인
  };
};
