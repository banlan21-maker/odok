// src/components/BookPreviewModal.jsx
import React, { useState } from 'react';
import { X, BookOpen, Pencil, Sparkles } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const BookPreviewModal = ({ book, user, userProfile, useItem, onRead, onClose, onGoToStore, authorProfiles = {}, t = {} }) => {
  const [phase, setPhase] = useState('view'); // 'view' | 'generating' | 'done'
  const [summary, setSummary] = useState(book.book_summary || null);
  const [summaryType, setSummaryType] = useState(book.summary_type || 'NONE');
  const [error, setError] = useState(null);

  const sharpCount = userProfile?.inventory?.sharp ?? 0;
  const isMyBook = book.authorId === user?.uid;
  const isPremium = summaryType === 'PREMIUM';

  const handleGenerateSummary = async (type) => {
    if (type === 'premium') {
      if (sharpCount < 1) {
        onClose();
        onGoToStore?.();
        return;
      }
      const deductResult = await useItem('sharp', 1);
      if (!deductResult.success) {
        setError(deductResult.error || (t.preview_deduct_fail || '아이템 차감에 실패했습니다.'));
        return;
      }
    }

    setPhase('generating');
    setError(null);

    try {
      const fn = httpsCallable(functions, 'generateBookSummary');
      const result = await fn({ bookId: book.id, appId, type });
      setSummary(result.data.summary);
      setSummaryType(result.data.summary_type);
      setPhase('done');
    } catch (err) {
      setError(err.message || (t.preview_gen_fail || '소개글 생성에 실패했습니다.'));
      setPhase('view');
    }
  };

  const isVisible = phase === 'view' || phase === 'done';

  return (
    <>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .book-preview-modal {
          animation: slide-up 0.32s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="book-preview-modal w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col">

          {/* 닫기 버튼 */}
          <div className="flex justify-end px-4 pt-3 pb-0 flex-none">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto px-5 pb-2">

            {/* 표지 + 제목 */}
            <div className="flex gap-4 mb-4">
              <div className="shrink-0">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-20 h-28 rounded-xl object-cover shadow-md"
                  />
                ) : (
                  <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-orange-200 to-pink-200 dark:from-orange-800 dark:to-pink-900 flex items-center justify-center shadow-md">
                    <span className="text-3xl">📖</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-base font-black text-slate-800 dark:text-slate-100 leading-snug mb-1">
                  {book.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {book.isAnonymous ? (t.anonymous || '익명') : (authorProfiles[book.authorId]?.nickname || book.authorNickname || (t.preview_unknown_author || '알 수 없는 작가'))}
                </p>
                {book.genre && (
                  <span className="mt-1.5 inline-block text-[10px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full w-fit">
                    {book.genre}
                  </span>
                )}
              </div>
            </div>

            {/* 소개글 구역 */}
            <div className="mb-4">
              {/* 생성 중 */}
              {phase === 'generating' && (
                <div className="bg-sky-50 dark:bg-sky-950/30 rounded-2xl px-4 py-5 text-center space-y-2">
                  <span className="text-3xl animate-bounce inline-block">✏️</span>
                  <p className="text-xs font-black text-sky-600 dark:text-sky-400">{t.preview_generating || '소개글 작성 중...'}</p>
                </div>
              )}

              {/* 소개글 없음 */}
              {isVisible && summaryType === 'NONE' && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-4 space-y-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{t.preview_no_summary || '소개글이 없습니다.'}</p>
                  {isMyBook && (
                    <button
                      onClick={() => handleGenerateSummary('premium')}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-sky-500 to-cyan-500 text-white"
                    >
                      <span>✏️</span>
                      {t.preview_sharp_create || '샤프로 소개글 만들기'}
                      <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full ml-1">
                        {(t.preview_sharp_owned || '{count}개 보유').replace('{count}', sharpCount)}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* 기본 요약 (BASIC) */}
              {isVisible && summaryType === 'BASIC' && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-4 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {summary}
                  </p>
                  {isMyBook && (
                    <button
                      onClick={() => handleGenerateSummary('premium')}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black border-2 border-sky-300 dark:border-sky-600 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t.preview_upgrade_btn || '샤프로 소개글 업그레이드'}
                      <span className="text-[10px] font-bold bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 rounded-full ml-0.5">
                        ✏️ {sharpCount}{t.preview_sharp_unit || '개'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* 프리미엄 소개 (PREMIUM) */}
              {isVisible && isPremium && (
                <div className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 border border-sky-200 dark:border-sky-700 rounded-2xl px-4 py-4 space-y-2">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 rounded-full">
                      ✏️ {t.preview_premium_badge || '프리미엄 소개'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {summary}
                  </p>
                </div>
              )}
            </div>

            {/* 완료 메시지 */}
            {phase === 'done' && (
              <p className="text-[11px] text-sky-500 font-bold text-center mb-2">
                ✨ {t.preview_saved || '소개글이 저장되었습니다!'}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-500 font-bold text-center mb-2">{error}</p>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => { onClose(); onRead(book); }}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-orange-200 dark:shadow-orange-900/30"
            >
              <BookOpen className="w-4 h-4" />
              {t.preview_read_btn || '지금 읽기'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default BookPreviewModal;
