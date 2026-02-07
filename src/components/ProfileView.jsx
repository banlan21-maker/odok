// src/components/ProfileView.jsx
// Part 2: 프로필 페이지 전면 리뉴얼 - Single View (100vh), 컴팩트한 레이아웃
import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { LogOut, Trophy, Droplets, Save, Trash2, AlertTriangle, X, Camera, Video } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showRewardVideoAd } from '../utils/admobService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';

// 수정 3: 앱 버전 관리
const APP_VERSION = "v1.07";

const ProfileView = ({
  user,
  userProfile,
  t,
  levelInfo,
  tempNickname,
  setTempNickname,
  language,
  setLanguage,
  fontSize,
  setFontSize,
  handleGoogleLogin,
  saveProfile,
  handleLogout,
  addInk,
  handleDeleteAccount,
  error,
  setError,
  appId
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
    <div className="flex flex-col h-full bg-slate-50 -mx-5">
      {/* Part 2: Single View - 스크롤 없이 한 화면에 모든 정보 배치 (모바일에서는 스크롤 가능) */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-5 py-4 space-y-3 pb-6">

          {/* 1. 상단 정보: 레벨 & 경험치 바 */}
          {userProfile && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-stretch gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">{t?.level || "LEVEL"}</span>
                      <div className="text-xl font-black text-slate-800 leading-none mt-0.5 flex items-center gap-1">
                        Lv.{levelInfo.level}
                        {levelInfo.gradeIcon && <span className="text-lg">{levelInfo.gradeIcon}</span>}
                        {levelInfo.badge === 'silver' && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-300 text-white font-bold">은색</span>}
                        {levelInfo.badge === 'gold' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400 text-amber-900 font-bold">금색</span>}
                      </div>
                      {levelInfo.title && (
                        <div className="text-xs font-bold text-orange-500 mt-1">
                          {levelInfo.title}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold text-orange-500">{levelInfo.progress}%</div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
                      style={{ width: `${levelInfo.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>
                      {t?.next_level || "다음 레벨까지"} <span className="text-orange-600 font-black">{levelInfo.remainingExp} XP</span>
                    </span>
                    <span>{levelInfo.currentExp} XP · {t?.next || "다음"} {levelInfo.remainingExp} XP</span>
                  </div>
                </div>
                <div className="w-24 flex flex-col items-center justify-center gap-2 border-l border-slate-100 pl-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt="프로필 이미지"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer ${isUploadingImage
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
              {isUploadingImage && (
                <div className="mt-2 text-[10px] text-slate-400 font-bold">
                  이미지 압축 및 업로드 중입니다...
                </div>
              )}
            </div>
          )}

          {/* 2. 보유 잉크 & 광고 보고 잉크 얻기 버튼 */}
          {userProfile && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border-2 border-blue-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] text-blue-600 font-bold">{t?.current_ink || "보유 잉크"}</span>
                  <div className="text-2xl font-black text-blue-700 leading-none mt-0.5 flex items-center gap-1">
                    <Droplets className="w-6 h-6 fill-blue-500 text-blue-500" />
                    {userProfile.ink || 50}
                  </div>
                </div>
              </div>
              <button
                onClick={handleChargeInk}
                disabled={isCharging}
                className={`w-full py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${isCharging
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

          {/* 3. 닉네임 변경 (최초 1회 자유, 이후 한 달에 한 번) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 block">{t?.nickname_label || "닉네임"}</label>
            <div className="space-y-2">
              <input
                type="text"
                maxLength={6}
                placeholder={t?.nickname_placeholder || "닉네임 입력 (최대 6글자)"}
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold focus:border-orange-500 focus:bg-white outline-none transition-colors"
              />
              {!canChange && nicknameChangeInfo && (
                <p className="text-[10px] text-orange-600 font-bold">
                  닉네임 변경 가능까지 {nicknameChangeInfo.remainingDays}일 남음
                </p>
              )}
              {canChange && userProfile?.nickname && (
                <p className="text-[10px] text-slate-400">
                  {t?.nickname_hint || "최초 1회는 자유롭게 변경 가능합니다"}
                </p>
              )}
              {!userProfile?.nickname && (
                <p className="text-[10px] text-slate-400">
                  한글/영어/숫자/공백 포함 최대 6글자
                </p>
              )}
            </div>
          </div>

          {/* 4. 환경 설정: 언어 설정 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 block">{t?.language_label || "언어 설정"}</label>
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
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                    }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 글자 크기 설정 (4단계) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 block">{t?.font_size_label || "글자 크기 (본문 용)"}</label>
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
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                    }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. 계정 관리 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
            <label className="text-xs font-bold text-slate-500 mb-2 block">{t?.account_management || "계정 관리"}</label>

            {/* 저장 버튼 */}
            <button
              onClick={saveProfile}
              disabled={!tempNickname.trim()}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${!tempNickname.trim()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                }`}
            >
              <Save className="w-4 h-4" />
              {t?.save_btn || "저장"}
            </button>

            {/* 로그아웃 버튼 */}
            {!user?.isAnonymous && (
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                {t?.logout || "로그아웃"}
              </button>
            )}

            {/* 계정 탈퇴 버튼 (Red Color) */}
            {!user?.isAnonymous && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800">{t?.delete_confirm_title || "계정 탈퇴"}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
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
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                {t?.cancel || "취소"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 3: 앱 버전 표시 (화면 맨 아래) */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          ver {APP_VERSION}
        </p>
      </div>
    </div>
  );
};

export default ProfileView;