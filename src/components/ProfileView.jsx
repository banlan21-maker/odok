import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Droplets, Save, Camera, Video, Lock, BookOpen, Flame, TrendingUp } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showRewardVideoAd } from '../utils/admobService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ACHIEVEMENTS } from '../utils/achievementUtils';

const ProfileView = ({
  user,
  userProfile,
  t,
  levelInfo,
  tempNickname,
  setTempNickname,
  tempBio = '',
  setTempBio,
  tempAnonymousActivity,
  setTempAnonymousActivity,
  handleGoogleLogin,
  saveProfile,
  addInk,
  error,
  setError,
  appId,
  follows = {},
  unfollowAuthor,
  highlights = [],
  deleteHighlight,
  readingStats = null,
}) => {
  const [isCharging, setIsCharging] = useState(false);
  const [showChargeSuccess, setShowChargeSuccess] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [expandedHighlightId, setExpandedHighlightId] = useState(null);

  // 월간 챌린지 계산 (현재달 기준, 2026_04부터 시작)
  const CHALLENGE_START = '2026_04';
  const _now = new Date();
  const challengeMonthKey = `${_now.getFullYear()}_${String(_now.getMonth() + 1).padStart(2, '0')}`;
  const challengeActive = challengeMonthKey >= CHALLENGE_START;
  const storedMonth = userProfile?.challenge_month;
  const challengeReads = (challengeActive && storedMonth === challengeMonthKey) ? (userProfile?.challenge_reads || 0) : 0;
  // challenge_claimed = true이거나 settled_month가 현재달이면 이미 수령됨
  const challengeClaimed = (challengeActive && storedMonth === challengeMonthKey)
    ? ((userProfile?.challenge_claimed || false) || (userProfile?.challenge_settled_month === challengeMonthKey))
    : false;
  const challengeGoal = 5;
  const challengeProgress = Math.min(challengeReads, challengeGoal);
  const challengeComplete = challengeReads >= challengeGoal;

  const handleClaimChallenge = async () => {
    if (!user || !appId || isClaiming || challengeClaimed || !challengeComplete) return;
    setIsClaiming(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await updateDoc(profileRef, { challenge_claimed: true });
      await addInk(10);
    } catch (err) {
      console.error('챌린지 보상 오류:', err);
      if (setError) setError('보상 받기에 실패했습니다.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleChargeInk = async () => {
    if (isCharging) return;
    setIsCharging(true);
    showRewardVideoAd(
      async () => {
        try {
          const success = await addInk(10);
          if (success) {
            setShowChargeSuccess(true);
            setTimeout(() => setShowChargeSuccess(false), 2000);
          }
        } catch (err) {
          console.error('잉크 충전 오류:', err);
          if (setError) setError('잉크 충전에 실패했습니다.');
        } finally {
          setIsCharging(false);
        }
      },
      (errorMsg) => {
        setIsCharging(false);
        if (setError) setError(errorMsg);
      }
    );
  };

  const canChangeNickname = () => {
    if (!userProfile) return true;
    if (!userProfile.nickname) return true;
    if (!userProfile.lastNicknameChangeDate) return true;
    const lastChangeDate = userProfile.lastNicknameChangeDate?.toDate?.()
      || (userProfile.lastNicknameChangeDate?.seconds
        ? new Date(userProfile.lastNicknameChangeDate.seconds * 1000)
        : null);
    if (!lastChangeDate) return true;
    const daysSinceLastChange = Math.floor((new Date() - lastChangeDate) / (1000 * 60 * 60 * 24));
    return daysSinceLastChange >= 30;
  };

  const getNicknameChangeInfo = () => {
    if (!userProfile?.lastNicknameChangeDate) return null;
    const lastChangeDate = userProfile.lastNicknameChangeDate?.toDate?.()
      || (userProfile.lastNicknameChangeDate?.seconds
        ? new Date(userProfile.lastNicknameChangeDate.seconds * 1000)
        : null);
    if (!lastChangeDate) return null;
    const daysSinceLastChange = Math.floor((new Date() - lastChangeDate) / (1000 * 60 * 60 * 24));
    return { daysSinceLastChange, remainingDays: Math.max(0, 30 - daysSinceLastChange) };
  };

  const nicknameChangeInfo = getNicknameChangeInfo();
  const canChange = canChangeNickname();
  const profileImageUrl = userProfile?.profileImageUrl || '';

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user || !appId) return;
    setIsUploadingImage(true);
    try {
      const compressedFile = await imageCompression(file, {
        maxWidthOrHeight: 500,
        maxSizeMB: 0.1,
        useWebWorker: true,
        fileType: 'image/webp'
      });
      const imageRef = ref(storage, `users/${user.uid}/profile_image.webp`);
      await uploadBytes(imageRef, compressedFile, { contentType: 'image/webp' });
      const downloadUrl = await getDownloadURL(imageRef);
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await updateDoc(profileRef, { profileImageUrl: downloadUrl, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('프로필 이미지 업로드 실패:', err);
      if (setError) setError('프로필 사진 업로드에 실패했습니다.');
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-900 -mx-5 px-5">
      <div className="space-y-3 pb-10 pt-4">

        {/* 1. 광고 보고 잉크 얻기 버튼 */}
        {userProfile && (
          <button
            onClick={handleChargeInk}
            disabled={isCharging}
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              isCharging ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : showChargeSuccess ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white'
            }`}
          >
            {isCharging ? <span className="animate-pulse">광고 로딩 중...</span>
            : showChargeSuccess ? <><Droplets className="w-4 h-4" /><span>+10 충전 완료!</span></>
            : <><Video className="w-4 h-4" /><span>{t?.get_ink_ad || "광고 보고 잉크 얻기 (+10)"}</span></>}
          </button>
        )}

        {/* 2. 레벨 & 경험치 바 */}
        {userProfile && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                {levelInfo.title && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-base">{levelInfo.gradeIcon}</span>
                    <span className={`text-xs font-black ${
                      levelInfo.badge === 'rainbow'
                        ? 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-text text-transparent'
                        : levelInfo.badge === 'gold' ? 'text-amber-500'
                        : levelInfo.badge === 'silver' ? 'text-slate-400'
                        : levelInfo.badge === 'bronze' ? 'text-amber-700'
                        : 'text-orange-500'
                    }`}>
                      {levelInfo.titleKey ? (t?.['title_grade_' + levelInfo.titleKey] || levelInfo.title) : levelInfo.title}
                    </span>
                  </div>
                )}
                <div className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none">
                  Lv.{levelInfo.level}
                </div>
              </div>
              <div className="text-xs font-bold text-orange-500">{levelInfo.progress}%</div>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
                style={{ width: `${levelInfo.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
              <span>{t?.next_level || "다음 레벨까지"} <span className="text-orange-600 font-black">{levelInfo.remainingExp} XP</span></span>
              <span>{levelInfo.currentExp} XP · {t?.next || "다음"} {levelInfo.remainingExp} XP</span>
            </div>
          </div>
        )}

        {/* 3. 사용자 설정 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-700 pb-2">사용자 설정</h3>

          {/* 프로필 사진 + 닉네임 */}
          <div className="flex gap-4 items-start">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-600 ${levelInfo?.badge === 'rainbow' ? 'ring-2 ring-offset-1 ring-purple-400' : ''}`}>
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt="프로필 이미지" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <label className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 mt-1.5 transition-colors cursor-pointer ${isUploadingImage ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                {isUploadingImage ? (t?.uploading || '업로드 중...') : (t?.change_photo || '사진 변경')}
                <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} disabled={isUploadingImage} />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.nickname_label_required || "닉네임(필수)"}</label>
                {/* 익명 기능은 책 집필 시 개별 선택으로 이동 */}
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder={t?.nickname_placeholder || "닉네임 입력 (최대 6글자)"}
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-2 px-3 text-sm font-bold focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors"
              />
              {!canChange && nicknameChangeInfo && (
                <p className="text-[10px] text-orange-600 font-bold mt-1">닉네임 변경 가능까지 {nicknameChangeInfo.remainingDays}일 남음</p>
              )}
              {canChange && userProfile?.nickname && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t?.nickname_hint || "최초 1회는 자유롭게 변경 가능합니다"}</p>
              )}
            </div>
          </div>

          {/* 작가 소개말 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">작가 소개말</label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{(tempBio || '').length} / 100</span>
            </div>
            <textarea
              maxLength={100}
              rows={3}
              placeholder="독자들에게 나를 소개해 보세요 (최대 100자)"
              value={tempBio}
              onChange={(e) => setTempBio?.(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={saveProfile}
            disabled={!tempNickname.trim()}
            className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
              !tempNickname.trim()
                ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-95'
            }`}
          >
            <Save className="w-5 h-5" />
            {t?.save_btn || "설정 저장"}
          </button>
        </div>

        {/* 4. 팔로잉 목록 */}
        {Object.keys(follows).length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-700 pb-2 mb-1">
              📚 팔로잉 ({Object.keys(follows).length}명)
            </h3>
            <div className="space-y-2">
              {Object.entries(follows).map(([authorId, info]) => (
                <div key={authorId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {info.profileImageUrl ? (
                      <img src={info.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-sm">📖</div>
                    )}
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                      {info.nickname || '익명'}
                    </span>
                  </div>
                  <button
                    onClick={() => unfollowAuthor && unfollowAuthor(authorId)}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-400 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950 px-3 py-1.5 rounded-full font-bold transition-colors"
                  >
                    언팔로우
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. 내 하이라이트 */}
        {highlights.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">🎨 내 하이라이트</h3>
              <span className="text-xs font-bold text-slate-400">{highlights.length}개</span>
            </div>
            <div className="space-y-2">
              {highlights.map((h) => {
                const isExpanded = expandedHighlightId === h.id;
                const dateStr = h.createdAt
                  ? new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                  : '';
                return (
                  <div
                    key={h.id}
                    className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden"
                  >
                    {/* 목록 헤더 */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                      onClick={() => setExpandedHighlightId(isExpanded ? null : h.id)}
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
                          {h.bookTitle || '제목 없음'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {h.authorNickname || '익명'} · {dateStr}
                        </p>
                      </div>
                      <span className="text-slate-400 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* 펼쳐진 내용 */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-700 bg-orange-50/40 dark:bg-orange-950/20">
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed py-2.5" style={{ fontFamily: 'serif' }}>
                          "{h.text}"
                        </p>
                        <button
                          onClick={() => deleteHighlight?.(h.id)}
                          className="text-[10px] text-red-400 hover:text-red-600 font-bold"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. 독서 통계 */}
        {readingStats && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">📊 {t.reading_stats_title || '독서 통계'}</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
                <BookOpen className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{readingStats.totalReads}</p>
                <p className="text-[10px] text-slate-400 font-bold">{t.reading_stats_total || '총 완독'}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{readingStats.thisMonthReads}</p>
                <p className="text-[10px] text-slate-400 font-bold">{t.reading_stats_month || '이번 달'}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <Flame className="w-5 h-5 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-black text-slate-800 dark:text-slate-100">{readingStats.streak}</p>
                <p className="text-[10px] text-slate-400 font-bold">{t.reading_stats_streak || '연속 일'}</p>
              </div>
            </div>
            {readingStats.recentBooks.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t.reading_stats_inprogress || '읽는 중'}</p>
                <div className="space-y-1.5">
                  {readingStats.recentBooks.slice(0, 3).map((b) => (
                    <div key={b.bookId} className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-400 to-pink-500 rounded-full" style={{ width: `${Math.round((b.ratio || 0) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{Math.round((b.ratio || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. 월간 챌린지 */}
        {userProfile && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">📅 월간 챌린지</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {challengeActive ? '이번 달 책 5권 완독하기' : `4월 1일부터 시작됩니다 🗓️`}
                </p>
              </div>
              {challengeActive && (
                <div className="text-right">
                  <span className={`text-lg font-black ${challengeComplete ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {challengeProgress}
                  </span>
                  <span className="text-xs font-bold text-slate-400"> / {challengeGoal}</span>
                </div>
              )}
            </div>

            {challengeActive ? (
              <>
                {/* 프로그레스 바 */}
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${challengeComplete ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
                    style={{ width: `${(challengeProgress / challengeGoal) * 100}%` }}
                  />
                </div>

                {/* 보상 버튼 */}
                {challengeComplete ? (
                  challengeClaimed ? (
                    <div className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-400 text-center">
                      ✅ 이번 달 보상 완료!
                    </div>
                  ) : (
                    <button
                      onClick={handleClaimChallenge}
                      disabled={isClaiming}
                      className="w-full py-2.5 rounded-xl text-sm font-black bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white transition-all disabled:opacity-60"
                    >
                      {isClaiming ? '처리 중...' : '🎁 보상 받기 (+10 잉크)'}
                    </button>
                  )
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                    {challengeGoal - challengeProgress}권 더 읽으면 잉크 10개를 받을 수 있어요!
                  </p>
                )}
              </>
            ) : (
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" />
            )}
          </div>
        )}

        {/* 6. 내 업적 (4×4 그리드) */}
        {userProfile && (() => {
          const unlockedAchievements = userProfile.achievements || [];
          const unlockedIds = new Set(unlockedAchievements.map(a => a.id));
          const unlockedCount = unlockedAchievements.length;
          const totalCount = ACHIEVEMENTS.length;
          return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">🏆 내 업적</h3>
                <span className="text-xs font-bold text-orange-500">{unlockedCount}/{totalCount}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlockedIds.has(ach.id);
                  const unlockedEntry = unlockedAchievements.find(a => a.id === ach.id);
                  const title = t?.[`ach_${ach.id}_title`] || ach.title_ko;
                  return (
                    <div
                      key={ach.id}
                      className={`rounded-lg p-1.5 border text-center ${
                        isUnlocked
                          ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 opacity-50'
                      }`}
                    >
                      <div className="text-lg mb-0.5 flex items-center justify-center">
                        {isUnlocked ? ach.emoji : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div className="text-[9px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{title}</div>
                      {isUnlocked && unlockedEntry?.unlockedAt && (
                        <div className="text-[8px] text-slate-400 mt-0.5">
                          {new Date(unlockedEntry.unlockedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center animate-in fade-in">
            <p className="text-red-600 text-xs font-bold">{error}</p>
            <button onClick={() => setError(null)} className="mt-1 text-[10px] text-red-400 hover:text-red-600 underline">
              닫기
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProfileView;
