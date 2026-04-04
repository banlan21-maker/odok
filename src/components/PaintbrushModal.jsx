// src/components/PaintbrushModal.jsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle, RotateCcw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

// 캔버스 페인트 스트로크 설정
const PAINT_STROKES = [
  { color: '#f87171', delay: '0s',    top: '0%',   height: '22%' },
  { color: '#fb923c', delay: '0.25s', top: '20%',  height: '22%' },
  { color: '#fbbf24', delay: '0.5s',  top: '40%',  height: '22%' },
  { color: '#34d399', delay: '0.75s', top: '60%',  height: '22%' },
  { color: '#60a5fa', delay: '1s',    top: '78%',  height: '22%' },
];

const PaintbrushModal = ({ user, userProfile, books, useItem, onClose, t = {} }) => {
  const [phase, setPhase] = useState('books'); // 'books' | 'generating' | 'preview' | 'confirming' | 'done'
  const [selectedBook, setSelectedBook] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  const myBooks = (books || []).filter(b => b.authorId === user?.uid);
  const authorNickname = userProfile?.nickname || t.paintbrush_default_author || '작가';

  const handleGenerate = async (book = selectedBook) => {
    if (!book) return;
    setPhase('generating');
    setError(null);
    setPreviewUrl(null);

    const regenerateFn = httpsCallable(functions, 'regenerateCover');

    try {
      const result = await regenerateFn({ bookId: book.id, appId });
      setPreviewUrl(result.data.previewUrl);
      setPhase('preview');
    } catch (err) {
      setError(err.message || t.paintbrush_gen_fail || '표지 생성에 실패했습니다. 다시 시도해주세요.');
      setPhase('books');
    }
  };

  const handleConfirm = async () => {
    if (!selectedBook || !previewUrl) return;
    setPhase('confirming');
    setError(null);

    const deductResult = await useItem('paint_brush', 1);
    if (!deductResult.success) {
      setError(deductResult.error || t.item_deduct_fail || '아이템 차감에 실패했습니다.');
      setPhase('preview');
      return;
    }

    try {
      const bookRef = doc(db, 'artifacts', appId, 'books', selectedBook.id);
      await updateDoc(bookRef, {
        cover_url: previewUrl,
        cover_generated_at: serverTimestamp(),
      });
      setPhase('done');
    } catch (err) {
      setError(t.paintbrush_save_fail || '표지 저장에 실패했습니다. 고객센터에 문의해주세요.');
      setPhase('preview');
    }
  };

  return (
    <>
      <style>{`
        @keyframes brush-stroke {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes brush-wobble {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          50% { transform: rotate(5deg) translateY(-8px); }
        }
        .brush-stroke-anim {
          transform-origin: left center;
          animation: brush-stroke 0.5s cubic-bezier(0.4,0,0.2,1) both;
        }
        .brush-wobble { animation: brush-wobble 0.8s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-none">
            <div className="flex items-center gap-2">
              <span className="text-lg">🖌️</span>
              <p className="font-black text-slate-800 dark:text-slate-100">{t.paintbrush_title || '페인트붓'}</p>
              {phase === 'books' && <span className="text-[10px] font-bold text-slate-400">{t.paintbrush_select_book || '책 선택'}</span>}
              {phase === 'generating' && <span className="text-[10px] font-bold text-pink-500">{t.paintbrush_generating || '표지 생성 중...'}</span>}
              {phase === 'preview' && <span className="text-[10px] font-bold text-slate-400">{t.paintbrush_preview || '미리보기'}</span>}
              {phase === 'confirming' && <span className="text-[10px] font-bold text-pink-500">{t.paintbrush_confirming || '저장 중...'}</span>}
              {phase === 'done' && <span className="text-[10px] font-bold text-pink-500">{t.paintbrush_done || '완성!'}</span>}
            </div>
            <button
              onClick={onClose}
              disabled={phase === 'generating' || phase === 'confirming'}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto">

            {/* 책 선택 */}
            {phase === 'books' && (
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                  {t.paintbrush_select_book_desc || '표지를 새로 만들 작품을 선택하세요'}
                </p>
                {myBooks.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <p className="text-4xl">📚</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.rainbow_no_books || '아직 작성한 작품이 없습니다.'}</p>
                    <p className="text-xs text-slate-400">{t.rainbow_no_books_desc || '집필 탭에서 글을 써보세요!'}</p>
                  </div>
                ) : (
                  myBooks.map(book => (
                    <button
                      key={book.id}
                      onClick={() => { setSelectedBook(book); handleGenerate(book); }}
                      className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-10 h-12 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-12 rounded-md bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-lg">📖</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{book.title}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {book.genre} · {book.steps?.length || 1}{t.chapter_unit || '챕터'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))
                )}
                {error && <p className="text-xs text-red-500 font-bold text-center pt-2">{error}</p>}
              </div>
            )}

            {/* 생성 중 — 캔버스 페인트 효과 */}
            {phase === 'generating' && (
              <div className="px-5 py-4 space-y-4">
                {/* 캔버스 영역 */}
                <div
                  className="relative rounded-2xl overflow-hidden bg-slate-900"
                  style={{ height: '260px' }}
                >
                  {PAINT_STROKES.map((stroke, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 brush-stroke-anim"
                      style={{
                        top: stroke.top,
                        height: stroke.height,
                        backgroundColor: stroke.color,
                        opacity: 0.75,
                        animationDelay: stroke.delay,
                        animationDuration: '0.55s',
                        animationIterationCount: 'infinite',
                        animationDirection: i % 2 === 0 ? 'alternate' : 'alternate-reverse',
                      }}
                    />
                  ))}
                  {/* 중앙 메시지 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <span className="text-5xl brush-wobble">🖌️</span>
                  </div>
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {t.paintbrush_in_progress || 'AI가 표지를 그리는 중입니다...'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t.paintbrush_analyzing || '소설의 분위기를 분석하고 있어요'}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 text-center">{t.paintbrush_no_close || '화면을 닫지 마세요.'}</p>
              </div>
            )}

            {/* 미리보기 */}
            {phase === 'preview' && previewUrl && (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.paintbrush_preview_label || '생성된 표지 미리보기'}</p>
                {/* 표지 미리보기 — 텍스트 오버레이 포함 */}
                <div
                  className="relative rounded-2xl overflow-hidden shadow-xl mx-auto"
                  style={{ maxWidth: '200px', aspectRatio: '3/4' }}
                >
                  <img
                    src={previewUrl}
                    alt="generated cover"
                    className="w-full h-full object-cover"
                  />
                  {/* 그라디언트 오버레이 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
                  {/* 텍스트 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                    <p className="text-white font-black text-sm leading-tight line-clamp-2 drop-shadow-lg font-jua">
                      {selectedBook?.title}
                    </p>
                    <p className="text-white/80 text-[10px] mt-1 drop-shadow">
                      by {authorNickname}
                    </p>
                  </div>
                  {/* 미리보기 배지 */}
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-black text-white bg-pink-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                      {t.paintbrush_preview_badge || '미리보기'}
                    </span>
                  </div>
                </div>
                <div className="bg-pink-50 dark:bg-pink-950/20 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[11px] text-pink-600 dark:text-pink-400">
                    {t.paintbrush_cost_desc || '🖌️ 확정 시 페인트붓 1개가 차감됩니다'}
                  </p>
                </div>
                {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
              </div>
            )}

            {/* 저장 중 */}
            {phase === 'confirming' && (
              <div className="px-5 py-16 text-center space-y-4">
                <span className="text-6xl brush-wobble inline-block">🖌️</span>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{t.paintbrush_saving || '표지를 저장하는 중...'}</p>
              </div>
            )}

            {/* 완료 */}
            {phase === 'done' && (
              <div className="px-5 py-10 text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 opacity-20 animate-ping" />
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-xl border-2 border-pink-300 dark:border-pink-600">
                    <img src={previewUrl} alt="new cover" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center shadow-md">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-black text-slate-800 dark:text-slate-100">{t.paintbrush_complete || '새 표지 완성!'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    <span className="font-bold text-pink-600 dark:text-pink-400">{selectedBook?.title}</span>{t.paintbrush_title_suffix || '의'}<br />
                    {t.paintbrush_saved || '표지가 새롭게 업데이트되었습니다.'}
                  </p>
                </div>
                <div className="bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-pink-600 dark:text-pink-400 font-bold">
                    {t.paintbrush_used || '🖌️ 페인트붓 1개가 사용되었습니다'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="px-5 pb-10 pt-3 flex-none border-t border-slate-100 dark:border-slate-700">
            {phase === 'books' && myBooks.length === 0 && (
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {t.close || '닫기'}
              </button>
            )}
            {phase === 'preview' && (
              <div className="space-y-2">
                <button
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 active:scale-95 text-white shadow-md shadow-pink-200 dark:shadow-pink-900/30 transition-all"
                >
                  {t.paintbrush_confirm_btn || '🖌️ 이 표지로 확정하기'}
                </button>
                <button
                  onClick={() => handleGenerate()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.paintbrush_regen_btn || '다시 생성하기'}
                </button>
              </div>
            )}
            {phase === 'done' && (
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-orange-500 text-white"
              >
                {t.confirm || '확인'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PaintbrushModal;
