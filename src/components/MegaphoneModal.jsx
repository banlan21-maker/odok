// src/components/MegaphoneModal.jsx
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, Loader } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { getCoverImageFromBook } from '../utils/bookCovers';

const MegaphoneModal = ({
  user,
  userProfile,
  books = [],
  createPromotion,
  onClose,
}) => {
  const [step, setStep] = useState('select'); // 'select' | 'form'
  const [selectedBook, setSelectedBook] = useState(null);
  const [promoText, setPromoText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
  const appId = rawAppId.replace(/\//g, '_');

  const myBooks = books.filter(b => b.authorId === user?.uid);

  const authorNickname = selectedBook?.isAnonymous
    ? '익명'
    : (userProfile?.nickname || '작가');
  const authorBio = userProfile?.bio || '';

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    setStep('form');
    setError(null);
  };

  const handleGenerateSummary = async (type = 'basic') => {
    if (!selectedBook || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'generateBookSummary');
      const result = await fn({ bookId: selectedBook.id, appId, type });
      setSelectedBook(prev => ({
        ...prev,
        book_summary: result.data.summary,
        summary_type: result.data.summary_type,
      }));
    } catch (err) {
      setError('소개글 생성에 실패했습니다. 잉크(샤프)가 있는지 확인해주세요.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBook || !promoText.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createPromotion(selectedBook.id, promoText.trim(), {
        authorNickname,
        authorBio,
        bookSummary: selectedBook.book_summary || '',
      });
      setSuccessMsg('홍보가 등록됐어요! 홈 화면에서 확인해보세요 🎉');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      const code = err.message;
      if (code === 'PROMO_NO_ITEM') setError('확성기 아이템이 없습니다. 문방구에서 구매해주세요.');
      else if (code === 'PROMO_FULL') setError('현재 홍보 자리가 꽉 찼습니다. 잠시 후 다시 시도해주세요.');
      else if (code === 'PROMO_ALREADY') setError('이미 홍보 중인 작품이 있습니다.');
      else setError('등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const megaphoneQty = userProfile?.inventory?.megaphone ?? 0;
  const coverImage = selectedBook ? getCoverImageFromBook(selectedBook) : null;

  return (
    <>
      <style>{`
        @keyframes mega-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .mega-sheet { animation: mega-slide-up 0.3s cubic-bezier(0.32,0.72,0,1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="mega-sheet w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col">

          {/* 헤더 */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 flex-none">
            {step === 'form' && (
              <button onClick={() => setStep('select')} className="p-1 text-slate-400 hover:text-slate-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                📢 확성기 사용
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                보유: {megaphoneQty}개 · 홈 화면 24시간 노출
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 성공 메시지 */}
          {successMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 gap-4 text-center">
              <div className="text-5xl">🎉</div>
              <p className="text-base font-black text-slate-800 dark:text-slate-100">{successMsg}</p>
            </div>
          ) : step === 'select' ? (
            /* ─── 책 선택 ─── */
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3">홍보할 책을 선택해주세요</p>
              {myBooks.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-3xl">📚</p>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">아직 작성한 책이 없어요</p>
                </div>
              ) : (
                myBooks.map((book) => {
                  const cover = getCoverImageFromBook(book);
                  return (
                    <button
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-2xl p-3 transition-colors text-left border border-transparent hover:border-orange-200 dark:hover:border-orange-800"
                    >
                      <img src={cover} alt={book.title} className="w-12 h-16 rounded-lg object-cover shrink-0 shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{book.title}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{book.category}</p>
                        {book.book_summary && (
                          <p className="text-[10px] text-emerald-500 font-bold mt-0.5">✏️ 소개글 있음</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* ─── 홍보 정보 입력 ─── */
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 pt-2">

              {/* 책 미리보기 */}
              <div className="relative rounded-2xl overflow-hidden h-28">
                {coverImage && (
                  <img src={coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(8px)', transform: 'scale(1.1)' }} />
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative flex items-center gap-3 p-4">
                  {coverImage && <img src={coverImage} className="w-14 h-18 rounded-lg object-cover shrink-0 shadow-md" style={{ height: '72px' }} />}
                  <div>
                    <p className="text-white font-black text-sm">{selectedBook?.title}</p>
                    <p className="text-white/60 text-xs mt-0.5">{selectedBook?.category}</p>
                  </div>
                </div>
              </div>

              {/* 작가 정보 (자동 입력, 수정 불가) */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">👤 작가 정보 (자동)</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{authorNickname}</p>
                {authorBio && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{authorBio}</p>}
                {!authorBio && (
                  <p className="text-[10px] text-orange-400 mt-0.5">프로필에서 작가 소개말을 입력하면 여기에 표시돼요</p>
                )}
              </div>

              {/* 홍보 문구 입력 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">📣 홍보 문구 <span className="text-red-400">*</span></label>
                  <span className="text-[10px] text-slate-400">{promoText.length}/50</span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="독자의 마음을 사로잡는 강렬한 한마디!"
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-violet-500 outline-none transition-colors text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* 책 소개글 (자동 연동 + 샤프 버튼) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">📖 책 소개글</label>
                {selectedBook?.book_summary ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-3 py-2.5 border border-emerald-100 dark:border-emerald-900 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{selectedBook.book_summary}</p>
                    <button
                      onClick={() => handleGenerateSummary('premium')}
                      disabled={isGeneratingSummary || (userProfile?.inventory?.sharp ?? 0) < 1}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {isGeneratingSummary ? <Loader className="w-3 h-3 animate-spin" /> : '✏️'}
                      샤프 1개로 소개글 더 멋지게 업그레이드 (보유: {userProfile?.inventory?.sharp ?? 0}개)
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2.5 border border-dashed border-slate-200 dark:border-slate-600 space-y-2">
                    <p className="text-xs text-slate-400 dark:text-slate-500">소개글이 없습니다</p>
                    <button
                      onClick={() => handleGenerateSummary('basic')}
                      disabled={isGeneratingSummary || (userProfile?.inventory?.sharp ?? 0) < 1}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {isGeneratingSummary ? <Loader className="w-3 h-3 animate-spin" /> : '✏️'}
                      샤프 1개로 AI 소개글 만들기 (보유: {userProfile?.inventory?.sharp ?? 0}개)
                    </button>
                    {(userProfile?.inventory?.sharp ?? 0) < 1 && (
                      <p className="text-[10px] text-orange-400">샤프가 없으면 소개글 없이 등록됩니다</p>
                    )}
                  </div>
                )}
              </div>

              {/* 에러 */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2.5 border border-red-100">
                  <p className="text-xs text-red-500 font-bold">{error}</p>
                </div>
              )}

            </div>
          )}

          {/* 하단 버튼 */}
          {!successMsg && step === 'form' && (
            <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">확성기 1개 차감 · 24시간 홈 노출</span>
                <span className={`text-[11px] font-black ${megaphoneQty > 0 ? 'text-violet-600' : 'text-red-500'}`}>
                  보유: {megaphoneQty}개
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !promoText.trim() || megaphoneQty < 1}
                className="w-full py-3.5 rounded-2xl font-black text-sm bg-violet-500 hover:bg-violet-600 active:scale-95 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader className="w-4 h-4 animate-spin" /><span>등록 중...</span></>
                ) : megaphoneQty < 1 ? (
                  '확성기 아이템이 없습니다'
                ) : (
                  '📢 홍보 등록하기'
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default MegaphoneModal;
