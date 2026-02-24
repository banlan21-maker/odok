import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { LogOut, Droplets, Save, Trash2, AlertTriangle, X, Camera, Video, Lock } from 'lucide-react';
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
  tempAnonymousActivity,
  setTempAnonymousActivity,
  language,
  setLanguage,
  fontSize,
  setFontSize,
  darkMode,
  setDarkMode,
  handleGoogleLogin,
  saveProfile,
  handleLogout,
  addInk,
  handleDeleteAccount,
  error,
  setError,
  appId,
  onOpenHelp
}) => {
  const [isCharging, setIsCharging] = useState(false);
  const [showChargeSuccess, setShowChargeSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleChargeInk = async () => {
    if (isCharging) return;
    setIsCharging(true);

    // 광고 시청 요청
    showRewardVideoAd(
      async () => {
        // 성공 시 잉크 충전 로직 실행
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
        // 실패 시 에러 처리
        setIsCharging(false);
        if (setError) setError(errorMsg);
      }
    );
  };

  // 닉네임 변경 가능 여부 확인
  const canChangeNickname = () => {
    if (!userProfile) return true; // 프로필이 없으면 최초 설정으로 간주
    if (!userProfile.nickname) return true; // 닉네임이 없으면 최초 설정
    if (!userProfile.lastNicknameChangeDate) return true; // 변경 기록이 없으면 최초 1회

    const lastChangeDate = userProfile.lastNicknameChangeDate?.toDate?.()
      || (userProfile.lastNicknameChangeDate?.seconds
        ? new Date(userProfile.lastNicknameChangeDate.seconds * 1000)
        : null);

    if (!lastChangeDate) return true;

    const now = new Date();
    const daysSinceLastChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));
    return daysSinceLastChange >= 30;
  };

  const getNicknameChangeInfo = () => {
    if (!userProfile?.lastNicknameChangeDate) return null;

    const lastChangeDate = userProfile.lastNicknameChangeDate?.toDate?.()
      || (userProfile.lastNicknameChangeDate?.seconds
        ? new Date(userProfile.lastNicknameChangeDate.seconds * 1000)
        : null);

    if (!lastChangeDate) return null;

    const now = new Date();
    const daysSinceLastChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, 30 - daysSinceLastChange);

    return { daysSinceLastChange, remainingDays };
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
      await updateDoc(profileRef, {
        profileImageUrl: downloadUrl,
        updatedAt: serverTimestamp()
      });
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
      {/* Part 2: Single View - 스크롤 없이 한 화면에 모든 정보 배치 (모바일에서는 스크롤 가능) */}
      <div className="">
        <div className="space-y-3 pb-10 pt-4">

          {/* 1. 광고 보고 잉크 얻기 버튼 (최상단) */}
          {userProfile && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-2xl p-4 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
              <button
                onClick={handleChargeInk}
                disabled={isCharging}
                className={`w-full py-4 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2 ${isCharging
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                  }`}
              >
                {isCharging ? (
                  <span className="animate-pulse">충전 중...</span>
                ) : showChargeSuccess ? (
                  <>
                    <Droplets className="w-4 h-4" />
                    <span>+10 충전 완료!</span>
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5" />
                    <span>{t?.get_ink_ad || "광고 보고 잉크 얻기 (+10)"}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 2. 상단 정보: 레벨 & 경험치 바 (광고 버튼 아래) */}
          {userProfile && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  {levelInfo.title && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-base">{levelInfo.gradeIcon}</span>
                      <span className={`text-xs font-black ${levelInfo.badge === 'rainbow' ? 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-text text-transparent' : levelInfo.badge === 'gold' ? 'text-amber-500' : levelInfo.badge === 'silver' ? 'text-slate-400' : levelInfo.badge === 'bronze' ? 'text-amber-700' : 'text-orange-500'}`}>
                        {levelInfo.titleKey ? (t?.['title_grade_' + levelInfo.titleKey] || levelInfo.title) : levelInfo.title}
                      </span>
                    </div>
                  )}
                  <div className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none flex items-center gap-1">
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
                <span>
                  {t?.next_level || "다음 레벨까지"} <span className="text-orange-600 font-black">{levelInfo.remainingExp} XP</span>
                </span>
                <span>{levelInfo.currentExp} XP · {t?.next || "다음"} {levelInfo.remainingExp} XP</span>
              </div>
            </div>
          )}

          {/* 3. 내 업적 섹션 */}
          {userProfile && (() => {
            const unlockedAchievements = userProfile.achievements || [];
            const unlockedIds = new Set(unlockedAchievements.map(a => a.id));
            const unlockedCount = unlockedAchievements.length;
            const totalCount = ACHIEVEMENTS.length;
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{t?.achievement_title || '🏆 내 업적'}</h3>
                  <span className="text-xs font-bold text-orange-500">{unlockedCount}/{totalCount}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ACHIEVEMENTS.map((ach) => {
                    const isUnlocked = unlockedIds.has(ach.id);
                    const unlockedEntry = unlockedAchievements.find(a => a.id === ach.id);
                    const title = t?.[`ach_${ach.id}_title`] || ach.title_ko;
                    return (
                      <div
                        key={ach.id}
                        className={`rounded-xl p-2 border text-center ${isUnlocked
                          ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 opacity-50'
                        }`}
                      >
                        <div className="text-2xl mb-1">
                          {isUnlocked ? ach.emoji : <Lock className="w-5 h-5 text-slate-400 mx-auto" />}
                        </div>
                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{title}</div>
                        {isUnlocked && unlockedEntry?.unlockedAt && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
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

          {/* 4. 어플 설정 그룹 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-700 pb-2">{t?.app_settings || "어플 설정"}</h3>

            <div className="flex gap-4">
              {/* 왼쪽: 닉네임 + 익명활동 체크박스 + 사용 설명서 */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t?.nickname_label_required || "닉네임(필수)"}</label>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={tempAnonymousActivity}
                      onChange={(e) => setTempAnonymousActivity(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t?.anonymous_activity || "익명으로 활동"}</span>
                  </label>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder={t?.nickname_placeholder || "닉네임 입력 (최대 6글자)"}
                  value={tempNickname}
                  onChange={(e) => setTempNickname(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl py-2.5 px-4 text-sm font-bold focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-colors"
                />
                {!canChange && nicknameChangeInfo && (
                  <p className="text-[10px] text-orange-600 font-bold mt-1 mb-3">
                    닉네임 변경 가능까지 {nicknameChangeInfo.remainingDays}일 남음
                  </p>
                )}
                {canChange && userProfile?.nickname && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mb-3">
                    {t?.nickname_hint || "최초 1회는 자유롭게 변경 가능합니다"}
                  </p>
                )}

                {/* 사용 설명서 버튼 (왼쪽 컬럼 하단) */}
                {onOpenHelp && (
                  <button
                    onClick={onOpenHelp}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <span>{t?.help_btn || "사용 설명서"}</span>
                  </button>
                )}
              </div>

              {/* 오른쪽: 프로필 사진 */}
              <div className="flex-1 min-w-0 flex flex-col items-center justify-start">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block w-full text-center">{t?.profile_photo || "프로필 사진"}</label>
                <div className={`w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 ${levelInfo?.badge === 'rainbow' ? 'ring-2 ring-offset-1 ring-purple-400' : ''}`}>
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="프로필 이미지"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <label className={`text-[10px] font-bold px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600 mt-2 transition-colors cursor-pointer ${isUploadingImage
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}>
                  {isUploadingImage ? (t?.uploading || '업로드 중...') : (t?.change_photo || '사진 변경')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageChange}
                    disabled={isUploadingImage}
                  />
                </label>
              </div>
            </div>

            {/* 언어 설정 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{t?.language_label || "언어 설정"}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: 'ko', label: '한국어' },
                  { code: 'en', label: 'English' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${language === lang.code
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95'
                      }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 글자 크기 설정 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{t?.font_size_label || "글자 크기 (본문 용)"}</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { size: 'text-sm', label: t?.font_small || '작게' },
                  { size: 'text-base', label: t?.font_medium || '보통' },
                  { size: 'text-lg', label: t?.font_large || '크게' },
                  { size: 'text-xl', label: t?.font_xlarge || '더 크게' }
                ].map((fs) => (
                  <button
                    key={fs.size}
                    onClick={() => setFontSize(fs.size)}
                    className={`py-2 rounded-xl text-[10px] font-bold transition-all ${fontSize === fs.size
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95'
                      }`}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 테마 설정 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                {t?.theme_label || "테마"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: false, label: t?.theme_light || '🌞 라이트' },
                  { val: true,  label: t?.theme_dark  || '🌙 다크'  }
                ].map((th) => (
                  <button
                    key={String(th.val)}
                    onClick={() => setDarkMode(th.val)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${darkMode === th.val
                      ? 'bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 저장 버튼 (높이 축소: py-4 -> py-3) */}
            <button
              onClick={saveProfile}
              disabled={!tempNickname.trim()}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${!tempNickname.trim()
                ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-95'
                }`}
            >
              <Save className="w-5 h-5" />
              {t?.save_btn || "설정 저장"}
            </button>
          </div>

          {/* 5. 계정 관리 그룹 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm space-y-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-50 dark:border-slate-700 pb-2 mb-1">{t?.account_management || "계정 관리"}</h3>

            {/* 로그아웃 버튼 */}
            {!user?.isAnonymous && (
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                {t?.logout || "로그아웃"}
              </button>
            )}

            {/* 계정 탈퇴 버튼 (Red Color) */}
            {!user?.isAnonymous && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 rounded-xl font-bold text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                {t?.delete_account || "계정 탈퇴"}
              </button>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center animate-in fade-in">
              <p className="text-red-600 text-xs font-bold">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-1 text-[10px] text-red-400 hover:text-red-600 underline"
              >
                닫기
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 계정 탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{t?.delete_confirm_title || "계정 탈퇴"}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t?.delete_confirm_desc || "정말로 계정을 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다."}
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  if (handleDeleteAccount) {
                    await handleDeleteAccount();
                  }
                }}
                className="w-full bg-red-500 text-white py-3 rounded-xl font-black hover:bg-red-600 transition-colors"
              >
                {t?.delete_btn || "탈퇴하기"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t?.cancel || "취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;