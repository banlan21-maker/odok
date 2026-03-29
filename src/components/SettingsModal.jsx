// src/components/SettingsModal.jsx
import React, { useState } from 'react';
import { X, LogOut, Trash2, AlertTriangle } from 'lucide-react';

const SettingsModal = ({
  language,
  setLanguage,
  fontSize,
  setFontSize,
  darkMode,
  setDarkMode,
  t,
  user,
  handleLogout,
  handleDeleteAccount,
  saveProfile,
  onClose,
  onOpenHelp,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    saveProfile();
    onClose();
  };

  const handleLogoutAndClose = () => {
    handleLogout();
    onClose();
  };

  const fontSizeOptions = [
    { value: 'text-sm',   label: '작게',    textClass: 'text-sm'  },
    { value: 'text-base', label: '보통',    textClass: 'text-base' },
    { value: 'text-lg',   label: '크게',    textClass: 'text-lg'  },
    { value: 'text-xl',   label: '더 크게', textClass: 'text-xl'  },
  ];

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .settings-modal {
          animation: slide-up 0.32s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="settings-modal w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-none">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
              {t?.settings ?? '설정'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">

            {/* Section: 화면 설정 */}
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                {t?.displaySettings ?? '화면 설정'}
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-4">

                {/* 언어 */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {t?.language ?? '언어'}
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: 'ko', label: '한국어' },
                      { value: 'en', label: 'English' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setLanguage(value)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          language === value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 글자 크기 */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {t?.fontSize ?? '글자 크기'}
                  </p>
                  <div className="flex gap-1.5">
                    {fontSizeOptions.map(({ value, label, textClass }) => (
                      <button
                        key={value}
                        onClick={() => setFontSize(value)}
                        className={`flex-1 py-2 rounded-xl font-bold border transition-all ${textClass} ${
                          fontSize === value
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 테마 */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {t?.theme ?? '테마'}
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: false, label: '🌞 라이트' },
                      { value: true,  label: '🌙 다크'   },
                    ].map(({ value, label }) => (
                      <button
                        key={String(value)}
                        onClick={() => setDarkMode(value)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          darkMode === value
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Section: 계정 관리 (non-anonymous only) */}
            {!user?.isAnonymous && (
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                  {t?.accountManagement ?? '계정 관리'}
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 space-y-1">

                  {/* 로그아웃 */}
                  <button
                    onClick={handleLogoutAndClose}
                    className="w-full flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {t?.logout ?? '로그아웃'}
                    </span>
                  </button>

                  {/* 계정 탈퇴 */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-semibold text-red-500">
                      {t?.deleteAccount ?? '계정 탈퇴'}
                    </span>
                  </button>

                </div>
              </div>
            )}

          {/* Section: 사용 설명서 */}
          {onOpenHelp && (
            <div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => { onOpenHelp(); onClose(); }}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <span>{t?.help_btn ?? '📖 사용 설명서'}</span>
                </button>
              </div>
            </div>
          )}

          </div>

          {/* Footer: 저장 button */}
          <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleSave}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 active:scale-95 transition-all"
            >
              {t?.save ?? '저장'}
            </button>
          </div>

        </div>
      </div>

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                {t?.deleteAccountTitle ?? '정말 탈퇴하시겠어요?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t?.deleteAccountDesc ?? '계정을 삭제하면 모든 데이터가 영구적으로 제거되며 복구할 수 없습니다.'}
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {t?.cancel ?? '취소'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDeleteAccount();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white"
              >
                {t?.confirm ?? '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsModal;
