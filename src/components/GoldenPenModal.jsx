// src/components/GoldenPenModal.jsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle, RotateCcw } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'odok-app-default';
const appId = rawAppId.replace(/\//g, '_');

const getFeatures = (t) => [
  {
    id: 'describe',
    emoji: '🖋️',
    name: t.golden_feature_describe || '묘사 디테일 강화',
    desc: t.golden_feature_describe_desc || '오감을 자극하는 생생한 묘사를 덧입힙니다',
  },
  {
    id: 'quotes',
    emoji: '💎',
    name: t.golden_feature_quotes || '명대사/명문장 제조',
    desc: t.golden_feature_quotes_desc || '주제를 꿰뚫는 철학적 명문장을 삽입합니다',
  },
  {
    id: 'polish',
    emoji: '🎩',
    name: t.golden_feature_polish || '전체 윤문 및 퇴고',
    desc: t.golden_feature_polish_desc || '비문 수정·호흡 조절로 기성 작가 문체로 다듬습니다',
  },
];

const GoldenPenModal = ({ user, books, useItem, onClose, t = {} }) => {
  const [phase, setPhase] = useState('books'); // 'books' | 'feature' | 'processing' | 'preview' | 'done'
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [enhancedSteps, setEnhancedSteps] = useState(null);
  const [error, setError] = useState(null);

  const myBooks = (books || []).filter(b => b.authorId === user?.uid);
  const FEATURES = getFeatures(t);

  const handleEnhance = async (feature = selectedFeature) => {
    if (!selectedBook || !feature) return;
    setPhase('processing');
    setError(null);
    setEnhancedSteps(null);

    const enhanceFn = httpsCallable(functions, 'enhanceBook');

    const steps = selectedBook.steps || [];
    const total = steps.length || 1;
    setProgress({ current: 0, total });

    try {
      let result = [];

      if (steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const res = await enhanceFn({ content: step.content, feature: feature.id });
          result.push({ ...step, content: res.data.enhancedContent });
          setProgress({ current: i + 1, total });
        }
      } else {
        const res = await enhanceFn({ content: selectedBook.content || '', feature: feature.id });
        result = [{ name: t.book_main_text || '본문', content: res.data.enhancedContent }];
        setProgress({ current: 1, total: 1 });
      }

      setEnhancedSteps(result);
      setPhase('preview');
    } catch (err) {
      setError(err.message || t.golden_enhance_fail || '개선에 실패했습니다. 다시 시도해주세요.');
      setPhase('feature');
    }
  };

  const handleConfirm = async () => {
    if (!selectedBook || !selectedFeature || !enhancedSteps) return;
    setError(null);

    const deductResult = await useItem('golden_pen', 1);
    if (!deductResult.success) {
      setError(deductResult.error || t.item_deduct_fail || '아이템 차감에 실패했습니다.');
      return;
    }

    const newContent = enhancedSteps.map(s => s.content).join('\n\n');
    const bookData = {
      title: `${selectedBook.title} - Golden Edition`,
      content: newContent,
      steps: enhancedSteps,
      synopsis: selectedBook.synopsis || '',
      characterSheet: selectedBook.characterSheet || '',
      settingSheet: selectedBook.settingSheet || '',
      authorId: user.uid,
      authorNickname: selectedBook.authorNickname || '',
      authorLevel: selectedBook.authorLevel || null,
      category: selectedBook.category || '',
      subCategory: selectedBook.subCategory || '',
      genre: selectedBook.genre || '',
      keywords: selectedBook.keywords || '',
      isGoldenEdition: true,
      goldenFeature: selectedFeature.id,
      originalBookId: selectedBook.id,
      createdAt: serverTimestamp(),
      hearts: 0,
      views: 0,
      commentsCount: 0,
      isPublic: false,
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'books'), bookData);
      setPhase('done');
    } catch (err) {
      setError(t.save_fail || '저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 미리보기용: 첫 챕터 앞부분 200자
  const previewText = enhancedSteps?.[0]?.content?.slice(0, 300) || '';

  return (
    <>
      {/* 골든 shimmer 애니메이션 */}
      <style>{`
        @keyframes golden-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .golden-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.35) 50%, transparent 100%);
          background-size: 200% auto;
          animation: golden-shimmer 1.8s linear infinite;
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-none">
            <div className="flex items-center gap-2">
              <span className="text-lg">🖋️</span>
              <p className="font-black text-slate-800 dark:text-slate-100">{t.golden_pen_title || '황금만년필'}</p>
              {phase === 'books' && <span className="text-[10px] font-bold text-slate-400">{t.golden_select_book || '책 선택'}</span>}
              {phase === 'feature' && <span className="text-[10px] font-bold text-slate-400">{t.golden_select_feature || '기능 선택'}</span>}
              {phase === 'processing' && <span className="text-[10px] font-bold text-amber-500">{t.golden_processing || '품격 향상 중...'}</span>}
              {phase === 'preview' && <span className="text-[10px] font-bold text-slate-400">{t.golden_preview || '미리보기'}</span>}
              {phase === 'done' && <span className="text-[10px] font-bold text-amber-500">{t.golden_done || '완성!'}</span>}
            </div>
            <button
              onClick={onClose}
              disabled={phase === 'processing'}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto">

            {/* 책 선택 */}
            {phase === 'books' && (
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">{t.golden_select_book_desc || '품격을 높일 내 작품을 선택하세요'}</p>
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
                      onClick={() => {
                        setSelectedBook(book);
                        setSelectedFeature(null);
                        setEnhancedSteps(null);
                        setError(null);
                        setPhase('feature');
                      }}
                      className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
                    >
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
              </div>
            )}

            {/* 기능 선택 */}
            {phase === 'feature' && (
              <div className="px-5 py-4 space-y-3">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t.rainbow_selected_book || '선택된 작품:'}</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{selectedBook?.title}</span>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.golden_select_feature_desc || '적용할 프리미엄 기능을 선택하세요'}</p>
                {FEATURES.map(feat => (
                  <button
                    key={feat.id}
                    onClick={() => setSelectedFeature(feat)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 border-2 transition-all text-left ${
                      selectedFeature?.id === feat.id
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700/50 hover:border-amber-200 dark:hover:border-amber-800'
                    }`}
                  >
                    <span className="text-2xl">{feat.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{feat.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{feat.desc}</p>
                    </div>
                    {selectedFeature?.id === feat.id && (
                      <CheckCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    )}
                  </button>
                ))}
                {error && <p className="text-xs text-red-500 font-bold text-center pt-1">{error}</p>}
              </div>
            )}

            {/* 처리 중 — 황금빛 이펙트 */}
            {phase === 'processing' && (
              <div className="relative overflow-hidden px-5 py-14 text-center space-y-6">
                {/* 황금 shimmer 오버레이 */}
                <div className="absolute inset-0 golden-shimmer pointer-events-none" />

                <div className="relative z-10 space-y-1">
                  <span className="text-6xl inline-block animate-pulse">🖋️</span>
                </div>
                <div className="relative z-10 space-y-2">
                  <p className="text-base font-black text-amber-700 dark:text-amber-400">
                    {t.golden_in_progress || '작품의 품격을 높이는 중입니다...'}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {selectedFeature?.emoji} {selectedFeature?.name}
                  </p>
                </div>
                {progress.total > 0 && (
                  <div className="relative z-10 space-y-1.5 mx-4">
                    <div className="bg-amber-100 dark:bg-amber-950/40 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-amber-600 dark:text-amber-500">
                      {(t.golden_chapter_progress || '{current} / {total} 챕터 완료').replace('{current}', progress.current).replace('{total}', progress.total)}
                    </p>
                  </div>
                )}
                <p className="relative z-10 text-[11px] text-slate-400 dark:text-slate-500">
                  {t.golden_no_close || '화면을 닫지 마세요.'}
                </p>
              </div>
            )}

            {/* 미리보기 */}
            {phase === 'preview' && (
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{selectedFeature?.emoji}</span>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {selectedFeature?.name} {t.golden_apply_result || '적용 결과'}
                  </p>
                </div>
                <div className="relative bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-4 max-h-64 overflow-y-auto">
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                      {t.golden_preview_badge || '✨ Golden Edition 미리보기'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mt-4">
                    {previewText}
                    {(enhancedSteps?.[0]?.content?.length || 0) > 300 && (
                      <span className="text-slate-400"> {t.golden_preview_ellipsis || '...(이하 생략)'}</span>
                    )}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                  {t.golden_preview_desc || '확인 후 저장하면 황금만년필 1개가 차감됩니다.'}
                </p>
                {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
              </div>
            )}

            {/* 완료 */}
            {phase === 'done' && (
              <div className="px-5 py-10 text-center space-y-4">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-yellow-400 opacity-20 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg">
                    <span className="text-4xl">🖋️</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-black text-slate-800 dark:text-slate-100">{t.golden_complete || '명작 완성!'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {selectedBook?.title} - Golden Edition
                    </span>{t.saved_subject_suffix || '이'}<br />
                    {t.golden_saved || '내 서재에 저장되었습니다.'}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                    {t.golden_badge || '✨ Golden Edition 배지가 부여되었습니다'}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">
                    {t.golden_used || '🖋️ 황금만년필 1개가 사용되었습니다'}
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
            {phase === 'feature' && (
              <div className="space-y-2">
                <button
                  onClick={() => handleEnhance()}
                  disabled={!selectedFeature}
                  className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-200 dark:shadow-amber-900/30 transition-all"
                >
                  {selectedFeature ? `${selectedFeature.emoji} ${(t.golden_apply_btn || '{feature} 적용하기').replace('{feature}', selectedFeature.name)}` : (t.golden_select_feature_plz || '기능을 선택해 주세요')}
                </button>
                <button
                  onClick={() => { setPhase('books'); setSelectedFeature(null); }}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-400 dark:text-slate-500"
                >
                  {t.golden_back_to_books || '← 책 다시 선택'}
                </button>
              </div>
            )}
            {phase === 'preview' && (
              <div className="space-y-2">
                <button
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 active:scale-95 text-white shadow-md shadow-amber-200 dark:shadow-amber-900/30 transition-all"
                >
                  {t.golden_save_btn || '🖋️ Golden Edition으로 저장하기'}
                </button>
                <button
                  onClick={() => handleEnhance()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.golden_regen_btn || '다시 생성하기'}
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

export default GoldenPenModal;
